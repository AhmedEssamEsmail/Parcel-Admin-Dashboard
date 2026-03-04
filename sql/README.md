# SQL Execution Order

1. Run base schema:
   - `sql/supabase_schema_v2.sql`
2. Upload Delivery Details + Parcel Logs CSV files.
3. Run timezone repair once:
   - `sql/backfill_delivery_details_timezone.sql`

## Notes
- The backfill script is idempotent:
  - It only updates warehouses whose median mismatch is around +180 minutes.
  - After correction, re-running finds no candidates and performs no additional shifts.
- Run SQL from Supabase SQL Editor or any Postgres client connected to the project database.

## Verification
After running the backfill script, verify:
- Median mismatch (`Delivered log ts - delivery_details.delivery_date`) for affected warehouses is near `0`.
- `/api/dod` and `/api/raw-delivery-stages` return corrected rows for your selected date range.
