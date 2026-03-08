#!/bin/bash

# Database Backup Script with Compression, Encryption, and Retention
# Requirements: 21.1, 21.2, 21.3, 21.4, 21.6

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-postgres}"
DB_USER="${DB_USER:-postgres}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
DAILY_RETENTION_DAYS=7
WEEKLY_RETENTION_DAYS=28

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"

echo "[Backup] Starting database backup at $(date)"

# Step 1: Create compressed backup using pg_dump
echo "[Backup] Creating compressed backup..."
PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[Backup] ERROR: Backup file was not created"
  exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[Backup] Backup created: $BACKUP_FILE (${BACKUP_SIZE})"

# Step 2: Verify backup integrity
echo "[Backup] Verifying backup integrity..."
if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "[Backup] ERROR: Backup file is corrupted"
  rm -f "$BACKUP_FILE"
  exit 1
fi
echo "[Backup] Backup integrity verified"

# Step 3: Encrypt backup if encryption key is provided
if [ -n "$ENCRYPTION_KEY" ]; then
  echo "[Backup] Encrypting backup with AES-256..."
  openssl enc -aes-256-cbc -salt -pbkdf2 \
    -in "$BACKUP_FILE" \
    -out "$ENCRYPTED_FILE" \
    -k "$ENCRYPTION_KEY"
  
  if [ ! -f "$ENCRYPTED_FILE" ]; then
    echo "[Backup] ERROR: Encryption failed"
    exit 1
  fi
  
  # Remove unencrypted backup
  rm -f "$BACKUP_FILE"
  FINAL_FILE="$ENCRYPTED_FILE"
  echo "[Backup] Backup encrypted: $ENCRYPTED_FILE"
else
  FINAL_FILE="$BACKUP_FILE"
  echo "[Backup] WARNING: No encryption key provided, backup is unencrypted"
fi

# Step 4: Cleanup old backups
echo "[Backup] Cleaning up old backups..."

# Remove daily backups older than 7 days
find "$BACKUP_DIR" -name "backup_*.sql.gz*" -type f -mtime +${DAILY_RETENTION_DAYS} -delete
echo "[Backup] Removed daily backups older than ${DAILY_RETENTION_DAYS} days"

# Keep weekly backups (Sunday backups) for 28 days
# This is a simplified approach - in production, you'd want more sophisticated logic
CURRENT_DAY=$(date +%u)
if [ "$CURRENT_DAY" -eq 7 ]; then
  # It's Sunday, mark this as a weekly backup
  WEEKLY_BACKUP="${BACKUP_DIR}/weekly_backup_${TIMESTAMP}.sql.gz"
  if [ -n "$ENCRYPTION_KEY" ]; then
    cp "$ENCRYPTED_FILE" "${WEEKLY_BACKUP}.enc"
  else
    cp "$BACKUP_FILE" "$WEEKLY_BACKUP"
  fi
  echo "[Backup] Created weekly backup"
fi

# Remove weekly backups older than 28 days
find "$BACKUP_DIR" -name "weekly_backup_*.sql.gz*" -type f -mtime +${WEEKLY_RETENTION_DAYS} -delete
echo "[Backup] Removed weekly backups older than ${WEEKLY_RETENTION_DAYS} days"

echo "[Backup] Backup completed successfully at $(date)"
echo "[Backup] Final backup: $FINAL_FILE"

# List current backups
echo "[Backup] Current backups:"
ls -lh "$BACKUP_DIR"/backup_*.sql.gz* 2>/dev/null || echo "No backups found"
