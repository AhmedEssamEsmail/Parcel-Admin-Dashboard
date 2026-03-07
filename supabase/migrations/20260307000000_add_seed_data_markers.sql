-- Migration: Add seed data markers to parcel_logs and delivery_details
-- Purpose: Enable identification and cleanup of seed/test data
-- Requirements: 20.1

-- Add is_seed_data column to parcel_logs
alter table public.parcel_logs
add column if not exists is_seed_data boolean not null default false;

-- Add is_seed_data column to delivery_details
alter table public.delivery_details
add column if not exists is_seed_data boolean not null default false;

-- Create indexes for efficient seed data queries
create index if not exists idx_parcel_logs_is_seed_data
on public.parcel_logs(is_seed_data)
where is_seed_data = true;

create index if not exists idx_delivery_details_is_seed_data
on public.delivery_details(is_seed_data)
where is_seed_data = true;

-- Add comment for documentation
comment on column public.parcel_logs.is_seed_data is 'Flag to identify seed/test data for cleanup purposes';
comment on column public.delivery_details.is_seed_data is 'Flag to identify seed/test data for cleanup purposes';
