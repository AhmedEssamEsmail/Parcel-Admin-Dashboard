# Backfill and Upload Runbook (Enhancements-v4)

## Intended upload order
1. Delivery Details
2. Parcel Logs
3. Items/Collectors/Prepare (optional)
4. WA Orders
5. Delivery Timing Rules

## Operational checks
- Confirm row counts after each dataset upload.
- Check Data Quality page for critical issues.
- Verify dashboard WoW/DOD sections load for ALL and single warehouse.

## Rollback note
- Any schema changes in v4 are isolated in new migration files; rollback should be done by dedicated down migration where provided.
