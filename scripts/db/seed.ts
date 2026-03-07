#!/usr/bin/env tsx

/**
 * Database Seed Data Generator
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 *
 * Generates idempotent seed data for development and testing:
 * - Sample parcel records with is_seed_data flag
 * - Sample delivery records with is_seed_data flag
 * - Sample user accounts
 *
 * Usage: npm run db:seed
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Seed data configuration
const SEED_CONFIG = {
  warehouseCode: 'WH001',
  warehouseName: 'Main Warehouse',
  parcelCount: 100,
  deliveryCount: 100,
};

/**
 * Clear existing seed data (idempotent operation)
 */
async function clearSeedData() {
  console.log('[Seed] Clearing existing seed data...');

  // Delete seed data from parcel_logs
  const { error: parcelLogsError } = await supabase
    .from('parcel_logs')
    .delete()
    .eq('is_seed_data', true);

  if (parcelLogsError) {
    console.error('[Seed] Error clearing parcel_logs:', parcelLogsError);
    throw parcelLogsError;
  }

  // Delete seed data from delivery_details
  const { error: deliveryError } = await supabase
    .from('delivery_details')
    .delete()
    .eq('is_seed_data', true);

  if (deliveryError) {
    console.error('[Seed] Error clearing delivery_details:', deliveryError);
    throw deliveryError;
  }

  console.log('[Seed] Existing seed data cleared');
}

/**
 * Ensure warehouse exists
 */
async function ensureWarehouse() {
  console.log('[Seed] Ensuring warehouse exists...');

  // Check if warehouse exists
  const { data: existing, error: selectError } = await supabase
    .from('warehouses')
    .select('id, code')
    .eq('code', SEED_CONFIG.warehouseCode)
    .single();

  if (selectError && selectError.code !== 'PGRST116') {
    // PGRST116 = not found
    console.error('[Seed] Error checking warehouse:', selectError);
    throw selectError;
  }

  if (existing) {
    console.log(`[Seed] Warehouse ${SEED_CONFIG.warehouseCode} already exists`);
    return existing.id;
  }

  // Create warehouse
  const { data: warehouse, error: insertError } = await supabase
    .from('warehouses')
    .insert({
      code: SEED_CONFIG.warehouseCode,
      name: SEED_CONFIG.warehouseName,
      tz: 'Etc/GMT-3',
      sla_minutes: 240,
      default_shift_start: '08:00:00',
      default_shift_end: '17:00:00',
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[Seed] Error creating warehouse:', insertError);
    throw insertError;
  }

  console.log(`[Seed] Created warehouse ${SEED_CONFIG.warehouseCode}`);
  return warehouse.id;
}

/**
 * Generate sample delivery records
 */
async function generateDeliveryRecords(warehouseId: string) {
  console.log(`[Seed] Generating ${SEED_CONFIG.deliveryCount} delivery records...`);

  const deliveryRecords = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30); // Start 30 days ago

  for (let i = 1; i <= SEED_CONFIG.deliveryCount; i++) {
    const orderDate = new Date(baseDate);
    orderDate.setDate(orderDate.getDate() + Math.floor(i / 10)); // Spread over 10 days

    const deliveryDate = new Date(orderDate);
    deliveryDate.setHours(deliveryDate.getHours() + 4 + Math.floor(Math.random() * 8)); // 4-12 hours later

    const statuses = ['Delivered', 'In Transit', 'Pending', 'Cancelled'];
    const cities = ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina'];
    const areas = ['North', 'South', 'East', 'West', 'Central'];
    const zones = ['Zone A', 'Zone B', 'Zone C', 'Zone D'];

    deliveryRecords.push({
      warehouse_id: warehouseId,
      parcel_id: 1000 + i,
      order_id: 2000 + i,
      order_date: orderDate.toISOString(),
      delivery_date: deliveryDate.toISOString(),
      order_status: statuses[Math.floor(Math.random() * statuses.length)],
      delivery_address: `${i} Test Street, Building ${Math.floor(i / 10)}`,
      city: cities[Math.floor(Math.random() * cities.length)],
      area: areas[Math.floor(Math.random() * areas.length)],
      zone: zones[Math.floor(Math.random() * zones.length)],
      is_seed_data: true,
    });
  }

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < deliveryRecords.length; i += batchSize) {
    const batch = deliveryRecords.slice(i, i + batchSize);
    const { error } = await supabase.from('delivery_details').insert(batch);

    if (error) {
      console.error('[Seed] Error inserting delivery records:', error);
      throw error;
    }
  }

  console.log(`[Seed] Created ${SEED_CONFIG.deliveryCount} delivery records`);
}

/**
 * Generate sample parcel log records
 */
async function generateParcelLogs(warehouseId: string) {
  console.log(`[Seed] Generating ${SEED_CONFIG.parcelCount} parcel log records...`);

  const parcelLogs = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 30); // Start 30 days ago

  const statuses = [
    'Order Received',
    'Picking',
    'Packing',
    'Ready for Dispatch',
    'Out for Delivery',
    'Delivered',
  ];

  for (let i = 1; i <= SEED_CONFIG.parcelCount; i++) {
    const parcelId = 1000 + i;
    const orderId = 2000 + i;
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + Math.floor(i / 10));

    // Create status progression for each parcel
    for (let statusIdx = 0; statusIdx < statuses.length; statusIdx++) {
      const statusDate = new Date(startDate);
      statusDate.setHours(statusDate.getHours() + statusIdx * 2); // 2 hours between statuses

      parcelLogs.push({
        warehouse_id: warehouseId,
        parcel_id: parcelId,
        order_id: orderId,
        parcel_status: statuses[statusIdx],
        status_ts: statusDate.toISOString(),
        is_seed_data: true,
      });
    }
  }

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < parcelLogs.length; i += batchSize) {
    const batch = parcelLogs.slice(i, i + batchSize);
    const { error } = await supabase.from('parcel_logs').insert(batch);

    if (error) {
      console.error('[Seed] Error inserting parcel logs:', error);
      throw error;
    }
  }

  console.log(`[Seed] Created ${parcelLogs.length} parcel log records`);
}

/**
 * Main seed function
 */
async function seed() {
  const startTime = Date.now();
  console.log('[Seed] Starting seed data generation...');

  try {
    // Step 1: Clear existing seed data (idempotent)
    await clearSeedData();

    // Step 2: Ensure warehouse exists
    const warehouseId = await ensureWarehouse();

    // Step 3: Generate delivery records
    await generateDeliveryRecords(warehouseId);

    // Step 4: Generate parcel logs
    await generateParcelLogs(warehouseId);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Seed] ✓ Seed data generation completed in ${duration}s`);
    console.log(`[Seed] Summary:`);
    console.log(`  - Warehouse: ${SEED_CONFIG.warehouseCode}`);
    console.log(`  - Delivery records: ${SEED_CONFIG.deliveryCount}`);
    console.log(`  - Parcel log records: ${SEED_CONFIG.parcelCount * 6}`);
  } catch (error) {
    console.error('[Seed] ✗ Seed data generation failed:', error);
    process.exit(1);
  }
}

// Run seed
seed();
