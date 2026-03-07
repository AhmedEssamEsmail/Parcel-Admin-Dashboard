#!/usr/bin/env tsx

/**
 * Data Export Script for CCPA/GDPR Compliance
 * Requirements: 23.6
 *
 * Implements GDPR Right to Data Portability (Article 20) and CCPA Right to Know:
 * - Export all user data in machine-readable format (JSON)
 * - Include all personal information and activity history
 * - Log export operation
 * - Generate export package
 *
 * Usage: npm run compliance:data-export -- --user-id=<user_id> [--output=<file>]
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const userIdArg = args.find((arg) => arg.startsWith('--user-id='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));

  if (!userIdArg) {
    console.error('ERROR: Missing required argument --user-id');
    console.error('Usage: npm run compliance:data-export -- --user-id=<user_id> [--output=<file>]');
    process.exit(1);
  }

  const userId = userIdArg.split('=')[1];
  const outputFile = outputArg
    ? outputArg.split('=')[1]
    : `user_data_export_${userId}_${Date.now()}.json`;

  if (!userId) {
    console.error('ERROR: Invalid user ID');
    process.exit(1);
  }

  return { userId, outputFile };
}

/**
 * Get user profile data
 */
async function getUserProfile(userId: string) {
  console.log(`[Export] Fetching user profile for ${userId}...`);

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    console.error(`[Export] User ${userId} not found`);
    return null;
  }

  const user = data.user;

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_sign_in_at: user.last_sign_in_at,
    email_confirmed_at: user.email_confirmed_at,
    phone_confirmed_at: user.phone_confirmed_at,
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
  };
}

/**
 * Get user audit logs
 */
async function getUserAuditLogs(userId: string) {
  console.log(`[Export] Fetching audit logs for user ${userId}...`);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) {
    // Audit logs table might not exist yet
    console.warn('[Export] Warning: Could not fetch audit_logs:', error.message);
    return [];
  }

  console.log(`[Export] Found ${data?.length || 0} audit log records`);
  return data || [];
}

/**
 * Log data export operation
 */
async function logDataExport(userId: string, recordCounts: { profile: number; auditLogs: number }) {
  console.log('[Export] Logging data export operation...');

  const { error } = await supabase.from('audit_logs').insert({
    event_type: 'data.export',
    user_id: userId,
    ip_address: null,
    user_agent: 'data-export-script',
    resource_type: 'user',
    resource_id: userId,
    metadata: {
      operation: 'data_export',
      timestamp: new Date().toISOString(),
      records_exported: recordCounts,
      compliance: ['GDPR Article 20', 'CCPA Right to Know'],
    },
  });

  if (error) {
    console.warn('[Export] Warning: Could not log data export:', error.message);
  } else {
    console.log('[Export] Data export logged to audit log');
  }
}

/**
 * Generate export package
 */
function generateExportPackage(
  userId: string,
  profile: Record<string, unknown> | null,
  auditLogs: Record<string, unknown>[]
) {
  return {
    export_metadata: {
      export_id: `EXPORT-${userId}-${Date.now()}`,
      export_date: new Date().toISOString(),
      user_id: userId,
      format: 'JSON',
      compliance: ['GDPR Article 20 - Right to Data Portability', 'CCPA - Right to Know'],
      data_categories: ['profile', 'audit_logs'],
    },
    user_profile: profile,
    audit_logs: auditLogs,
    data_summary: {
      total_records: 1 + auditLogs.length,
      profile_records: profile ? 1 : 0,
      audit_log_records: auditLogs.length,
    },
    legal_notice: {
      purpose:
        'This export contains all personal data associated with your account as required by GDPR and CCPA.',
      retention:
        'You may retain this data for your records. The data in this export reflects the state of your account at the time of export.',
      contact: 'For questions about this export, please contact privacy@example.com',
    },
  };
}

/**
 * Write export to file
 */
function writeExportToFile(exportData: Record<string, unknown>, outputFile: string) {
  console.log(`[Export] Writing export to ${outputFile}...`);

  const outputPath = path.resolve(outputFile);
  const outputDir = path.dirname(outputPath);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write export data to file
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  const fileSize = fs.statSync(outputPath).size;
  const fileSizeKB = (fileSize / 1024).toFixed(2);

  console.log(`[Export] Export written to ${outputPath} (${fileSizeKB} KB)`);
  return outputPath;
}

/**
 * Main data export function
 */
async function dataExport() {
  const startTime = Date.now();
  console.log('[Export] Starting data export process...');

  try {
    const { userId, outputFile } = parseArgs();
    console.log(`[Export] User ID: ${userId}`);
    console.log(`[Export] Output file: ${outputFile}`);
    console.log('');

    // Step 1: Get user profile
    const profile = await getUserProfile(userId);
    if (!profile) {
      console.error('[Export] Cannot proceed: User not found');
      process.exit(1);
    }

    // Step 2: Get user audit logs
    const auditLogs = await getUserAuditLogs(userId);

    // Step 3: Generate export package
    const exportData = generateExportPackage(userId, profile, auditLogs);

    // Step 4: Write export to file
    const outputPath = writeExportToFile(exportData, outputFile);

    // Step 5: Log data export
    await logDataExport(userId, {
      profile: profile ? 1 : 0,
      auditLogs: auditLogs.length,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log(`[Export] ✓ Data export completed in ${duration}s`);
    console.log(`[Export] Export ID: ${exportData.export_metadata.export_id}`);
    console.log(`[Export] Total records: ${exportData.data_summary.total_records}`);
    console.log(`[Export] Output file: ${outputPath}`);
    console.log('');
    console.log('[Export] Summary:');
    console.log(`  - User profile: ${exportData.data_summary.profile_records} record`);
    console.log(`  - Audit logs: ${exportData.data_summary.audit_log_records} records`);
  } catch (error) {
    console.error('[Export] ✗ Data export failed:', error);
    process.exit(1);
  }
}

// Run data export
dataExport();
