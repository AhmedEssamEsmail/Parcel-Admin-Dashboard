# Database Backup and Restore Procedures

This document describes the automated backup system, retention policies, and restore procedures for the Parcel Admin Dashboard database.

## Automated Backup Schedule

The database backup system runs automatically using the `scripts/db/backup.sh` script.

**Schedule:**

- Daily backups at 03:00 UTC
- Weekly backups on Sundays (retained separately)
- Automated via cron job or CI/CD scheduler

**Backup Process:**

1. Creates compressed PostgreSQL dump using `pg_dump`
2. Verifies backup integrity using gzip test
3. Encrypts backup with AES-256 (if encryption key provided)
4. Stores backup in designated backup directory
5. Cleans up old backups according to retention policy

## Backup Retention Policy

The system maintains backups according to the following retention schedule:

- **Daily Backups:** 7 days
  - All daily backups are kept for 7 days
  - Automatically deleted after 7 days
- **Weekly Backups:** 28 days (4 weeks)
  - Sunday backups are marked as weekly backups
  - Kept for 28 days for longer-term recovery
  - Automatically deleted after 28 days

This policy balances storage costs with recovery capabilities, allowing:

- Recent recovery within the past week (daily granularity)
- Historical recovery up to 4 weeks (weekly granularity)

## Backup Storage Location

**Default Location:** `./backups/` (relative to project root)

**Configurable via Environment Variables:**

- `BACKUP_DIR`: Custom backup directory path

**Backup File Naming:**

- Daily: `backup_YYYYMMDD_HHMMSS.sql.gz.enc`
- Weekly: `weekly_backup_YYYYMMDD_HHMMSS.sql.gz.enc`

**Storage Recommendations:**

- Use network-attached storage (NAS) or cloud storage for production
- Ensure backup directory has sufficient disk space
- Monitor backup directory size and set up alerts
- Consider off-site backup replication for disaster recovery

## Restore Procedure

### Prerequisites

- Access to backup files
- PostgreSQL client tools (`psql`, `pg_restore`)
- Database credentials with restore permissions
- Encryption key (if backups are encrypted)

### Step-by-Step Restore

#### 1. Stop Application Services

```bash
# Stop the application to prevent new connections
docker-compose down
# Or if using systemd
systemctl stop parcel-admin
```

#### 2. Identify Backup to Restore

```bash
# List available backups
ls -lh ./backups/

# Choose the backup file you want to restore
BACKUP_FILE="./backups/backup_20240115_030000.sql.gz.enc"
```

#### 3. Decrypt Backup (if encrypted)

```bash
# Decrypt the backup file
openssl enc -aes-256-cbc -d -pbkdf2 \
  -in "$BACKUP_FILE" \
  -out "${BACKUP_FILE%.enc}" \
  -k "$BACKUP_ENCRYPTION_KEY"

# Update BACKUP_FILE to point to decrypted file
BACKUP_FILE="${BACKUP_FILE%.enc}"
```

#### 4. Decompress Backup

```bash
# Decompress the backup
gunzip -c "$BACKUP_FILE" > restore.sql
```

#### 5. Create New Database (Optional)

```bash
# If restoring to a new database
createdb -h localhost -U postgres parcel_admin_restored
```

#### 6. Restore Database

```bash
# Restore the database
psql -h localhost -U postgres -d parcel_admin_restored < restore.sql

# Or if restoring to existing database (WARNING: This will overwrite data)
psql -h localhost -U postgres -d parcel_admin < restore.sql
```

#### 7. Verify Restore

```bash
# Connect to database and verify data
psql -h localhost -U postgres -d parcel_admin_restored

# Run verification queries
SELECT COUNT(*) FROM parcel_logs;
SELECT COUNT(*) FROM delivery_details;
SELECT MAX(created_at) FROM parcel_logs;
```

#### 8. Restart Application

```bash
# Update database connection string if needed
# Restart application services
docker-compose up -d
# Or if using systemd
systemctl start parcel-admin
```

#### 9. Cleanup

```bash
# Remove temporary restore file
rm -f restore.sql
```

## Backup Verification Process

Regular verification ensures backups are valid and restorable.

**Verification Schedule:** Weekly (automated)

**Verification Steps:**

1. Select a recent backup file
2. Verify gzip integrity: `gzip -t backup_file.sql.gz`
3. Decrypt backup (if encrypted)
4. Restore to test database
5. Run data integrity checks
6. Document verification results
7. Clean up test database

**Automated Verification Script:**

```bash
#!/bin/bash
# scripts/db/verify-backup.sh

BACKUP_FILE="$1"
TEST_DB="parcel_admin_test_restore"

# Verify compression
gzip -t "$BACKUP_FILE" || exit 1

# Create test database
createdb -h localhost -U postgres "$TEST_DB"

# Restore to test database
gunzip -c "$BACKUP_FILE" | psql -h localhost -U postgres -d "$TEST_DB"

# Run integrity checks
psql -h localhost -U postgres -d "$TEST_DB" -c "SELECT COUNT(*) FROM parcel_logs;"

# Cleanup
dropdb -h localhost -U postgres "$TEST_DB"

echo "Backup verification successful"
```

## Point-in-Time Recovery

The backup system supports point-in-time recovery (PITR) through daily and weekly backups.

**Recovery Capabilities:**

- **Last 7 days:** Daily granularity (restore to any day)
- **Last 28 days:** Weekly granularity (restore to any Sunday)

**PITR Procedure:**

1. Identify the backup closest to desired recovery point
2. Follow standard restore procedure
3. If needed, replay transaction logs (requires WAL archiving - not currently implemented)

**Limitations:**

- Current system does not support sub-day recovery
- For sub-day recovery, implement PostgreSQL WAL archiving
- Consider implementing continuous archiving for critical production systems

## Disaster Recovery

In case of complete system failure:

1. **Provision new infrastructure**
   - Set up new database server
   - Install PostgreSQL and required extensions
2. **Retrieve backups from off-site storage**
   - Download latest backup from cloud storage
   - Verify backup integrity
3. **Restore database**
   - Follow standard restore procedure
   - Verify data integrity
4. **Restore application**
   - Deploy application code
   - Update database connection strings
   - Start application services
5. **Verify system functionality**
   - Run health checks
   - Test critical workflows
   - Monitor for errors

## Troubleshooting

### Backup Fails with "Permission Denied"

- Ensure backup directory has write permissions
- Check database user has sufficient privileges
- Verify `pg_dump` is in PATH

### Restore Fails with "Role Does Not Exist"

- Backup was created with `--no-owner` flag
- Manually create required roles before restore
- Or restore with superuser privileges

### Encrypted Backup Cannot Be Decrypted

- Verify encryption key is correct
- Check OpenSSL version compatibility
- Ensure backup file is not corrupted

### Backup File Size Too Large

- Consider using `pg_dump` custom format with compression
- Implement incremental backups
- Archive old data to separate storage

## Monitoring and Alerts

**Recommended Monitoring:**

- Backup completion status (daily)
- Backup file size trends
- Backup directory disk space
- Backup verification results (weekly)

**Alert Conditions:**

- Backup fails to complete
- Backup file size anomaly (too small/large)
- Backup directory disk space < 20%
- Backup verification fails

## Security Considerations

- **Encryption:** All production backups must be encrypted
- **Access Control:** Restrict backup directory access to authorized users only
- **Key Management:** Store encryption keys in secure key management system (e.g., AWS KMS, HashiCorp Vault)
- **Audit Logging:** Log all backup and restore operations
- **Off-site Storage:** Replicate backups to geographically separate location

## Compliance

This backup system supports compliance with:

- **SOC 2:** Regular backups and tested restore procedures
- **GDPR:** Data retention and deletion capabilities
- **CCPA:** Data export and deletion capabilities

Backup retention aligns with data retention policies documented in `docs/compliance/data-retention.md`.
