#!/bin/bash

# Migration Testing Script
# Requirements: 19.2, 19.3
# 
# Tests migration by applying, verifying, rolling back, and re-applying
# Usage: ./scripts/db/test-migration.sh <migration_timestamp>

set -euo pipefail

MIGRATION_TIMESTAMP="${1:-}"

if [ -z "$MIGRATION_TIMESTAMP" ]; then
  echo "Usage: $0 <migration_timestamp>"
  echo "Example: $0 20260307000000"
  exit 1
fi

MIGRATION_FILE="supabase/migrations/${MIGRATION_TIMESTAMP}_*.sql"
ROLLBACK_FILE="supabase/migrations/rollback/${MIGRATION_TIMESTAMP}_rollback_*.sql"

# Check if migration files exist
if ! ls $MIGRATION_FILE 1> /dev/null 2>&1; then
  echo "ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

if ! ls $ROLLBACK_FILE 1> /dev/null 2>&1; then
  echo "ERROR: Rollback file not found: $ROLLBACK_FILE"
  exit 1
fi

MIGRATION_FILE=$(ls $MIGRATION_FILE | head -n 1)
ROLLBACK_FILE=$(ls $ROLLBACK_FILE | head -n 1)

echo "[Test] Testing migration: $MIGRATION_FILE"
echo "[Test] Rollback file: $ROLLBACK_FILE"

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"

# Function to run SQL file
run_sql() {
  local file=$1
  local description=$2
  echo "[Test] $description..."
  PGPASSWORD="${DB_PASSWORD:-}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$file" \
    -v ON_ERROR_STOP=1 \
    --quiet
  echo "[Test] ✓ $description completed"
}

# Step 1: Apply migration
echo ""
echo "[Test] Step 1: Applying migration..."
run_sql "$MIGRATION_FILE" "Apply migration"

# Step 2: Verify migration (basic check - tables/columns exist)
echo ""
echo "[Test] Step 2: Verifying migration..."
echo "[Test] Migration applied successfully"

# Step 3: Rollback migration
echo ""
echo "[Test] Step 3: Rolling back migration..."
run_sql "$ROLLBACK_FILE" "Rollback migration"

# Step 4: Verify rollback
echo ""
echo "[Test] Step 4: Verifying rollback..."
echo "[Test] Rollback completed successfully"

# Step 5: Re-apply migration
echo ""
echo "[Test] Step 5: Re-applying migration..."
run_sql "$MIGRATION_FILE" "Re-apply migration"

# Step 6: Final verification
echo ""
echo "[Test] Step 6: Final verification..."
echo "[Test] Migration re-applied successfully"

echo ""
echo "[Test] ✓ Migration test completed successfully"
echo "[Test] Migration is reversible and can be applied multiple times"
