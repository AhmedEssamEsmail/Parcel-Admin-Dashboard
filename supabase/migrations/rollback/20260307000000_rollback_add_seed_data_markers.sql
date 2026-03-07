-- Rollback Migration: Remove seed data markers
-- Reverts: 20260307000000_add_seed_data_markers.sql

-- Drop indexes
drop index if exists public.idx_parcel_logs_is_seed_data;
drop index if exists public.idx_delivery_details_is_seed_data;

-- Drop columns
alter table public.parcel_logs
drop column if exists is_seed_data;

alter table public.delivery_details
drop column if exists is_seed_data;
