# Data Retention and Compliance Policy

This document outlines the data retention policies, deletion procedures, and compliance requirements for the Parcel Admin Dashboard.

## Overview

The Parcel Admin Dashboard implements comprehensive data retention policies to comply with regulatory requirements including GDPR, CCPA, and SOC 2. This document describes retention periods, automated cleanup procedures, and data subject rights management.

## Data Retention Periods

### Parcel Delivery Data

**Retention Period:** 2 years

**Scope:**

- Parcel logs (status history)
- Delivery details (order and delivery information)
- Collector reports
- Preparation reports
- Items per order
- Freshdesk tickets

**Rationale:**

- Supports operational analytics and trend analysis
- Enables historical performance comparisons
- Meets audit and compliance requirements
- Balances storage costs with business needs

**Deletion Process:**

- Soft delete after 2 years (marked as deleted, retained for 30-day grace period)
- Hard delete after 30-day grace period
- Automated via `compliance:cleanup` script

### Audit Logs

**Retention Period:** 7 years

**Scope:**

- Authentication events (login, logout)
- Data modification events (upload, delete)
- Configuration changes
- Access logs
- Security events

**Rationale:**

- Meets SOC 2 audit requirements
- Supports security incident investigation
- Complies with financial record retention standards
- Enables long-term compliance verification

**Deletion Process:**

- Automated deletion after 7 years
- Monthly partitioning for efficient cleanup
- Archived to cold storage before deletion (optional)

### User Session Data

**Retention Period:** 30 days

**Scope:**

- Active session tokens
- Session metadata
- Temporary authentication data

**Rationale:**

- Minimizes security risk from stale sessions
- Reduces storage overhead
- Aligns with typical session timeout policies

**Deletion Process:**

- Automatic expiration via database TTL
- Daily cleanup of expired sessions

### Seed/Test Data

**Retention Period:** On-demand deletion

**Scope:**

- Data marked with `is_seed_data = true`
- Development and testing records

**Rationale:**

- Prevents test data pollution in production
- Enables clean development environments
- Supports idempotent testing

**Deletion Process:**

- Manual deletion via `db:seed` script (clears before re-seeding)
- Can be deleted at any time without affecting production data

## Data Deletion Procedures

### Automated Cleanup

The system implements automated data cleanup through scheduled scripts:

**Daily Cleanup:**

```bash
npm run compliance:cleanup
```

This script:

1. Identifies parcel delivery data older than 2 years
2. Marks records for soft deletion
3. Hard deletes records past 30-day grace period
4. Logs all deletion operations to audit log
5. Generates deletion summary report

**Recommended Schedule:** Daily at 02:00 UTC via cron or CI/CD scheduler

### Manual Deletion

For immediate data deletion (e.g., GDPR requests):

**GDPR Right to Erasure:**

```bash
npm run compliance:gdpr-delete -- --user-id=<user_id>
```

This script:

1. Identifies all data associated with the user
2. Anonymizes or deletes personal information
3. Logs deletion request and completion
4. Generates deletion certificate

**Data Export (CCPA/GDPR):**

```bash
npm run compliance:data-export -- --user-id=<user_id>
```

This script:

1. Exports all user data in machine-readable format (JSON)
2. Includes all personal information and activity history
3. Logs export request
4. Generates export package

## Data Archival Procedures

Before permanent deletion, data may be archived to cold storage for compliance or business continuity purposes.

**Archival Process:**

1. **Identify Data for Archival**
   - Data approaching retention limit
   - Data marked for deletion but requiring long-term storage

2. **Export to Archive Format**
   - Compressed JSON or CSV format
   - Encrypted with AES-256
   - Includes metadata and checksums

3. **Transfer to Cold Storage**
   - AWS S3 Glacier, Azure Archive Storage, or equivalent
   - Geographically redundant storage
   - Access controls and encryption at rest

4. **Verify Archive Integrity**
   - Checksum verification
   - Test restore procedure
   - Document archive location and retrieval process

5. **Delete from Primary Database**
   - Only after successful archive verification
   - Log archival operation

## Compliance with Regulations

### GDPR (General Data Protection Regulation)

**Applicable Requirements:**

- Right to erasure (Article 17)
- Right to data portability (Article 20)
- Data minimization (Article 5)
- Storage limitation (Article 5)

**Implementation:**

- `compliance:gdpr-delete` script for erasure requests
- `compliance:data-export` script for portability requests
- Automated retention limits enforce storage limitation
- Minimal data collection aligned with business purpose

**Response Time:** Within 30 days of request

### CCPA (California Consumer Privacy Act)

**Applicable Requirements:**

- Right to deletion
- Right to know (data access)
- Right to opt-out of data sale

**Implementation:**

- `compliance:gdpr-delete` script supports deletion requests
- `compliance:data-export` script provides data access
- No data sale - opt-out not applicable

**Response Time:** Within 45 days of request

### SOC 2 (Service Organization Control 2)

**Applicable Requirements:**

- Logical access controls
- Change management
- System monitoring
- Data retention and disposal

**Implementation:**

- Audit logging for all data access and modifications
- 7-year audit log retention
- Documented retention and deletion procedures
- Regular compliance audits

**Audit Frequency:** Annual SOC 2 Type II audit

## Data Subject Rights Management

### Right to Access

Users can request access to their personal data:

1. Submit request via support channel or privacy email
2. Verify user identity
3. Run `compliance:data-export` script
4. Provide data export to user within required timeframe

### Right to Erasure

Users can request deletion of their personal data:

1. Submit request via support channel or privacy email
2. Verify user identity
3. Assess legal obligations (e.g., audit requirements)
4. Run `compliance:gdpr-delete` script if approved
5. Provide deletion confirmation to user

**Exceptions:**

- Data required for legal compliance (audit logs)
- Data required for contract fulfillment (active orders)
- Data required for legal claims

### Right to Rectification

Users can request correction of inaccurate data:

1. Submit request with corrected information
2. Verify user identity
3. Update records in database
4. Log rectification in audit log
5. Confirm update to user

## Monitoring and Reporting

### Compliance Metrics

Track and report on:

- Data retention compliance rate
- Deletion request response time
- Data export request response time
- Audit log retention compliance
- Storage usage trends

### Audit Trail

All data retention and deletion operations are logged:

- Timestamp of operation
- Type of operation (deletion, export, archival)
- User or system initiating operation
- Records affected
- Success or failure status

### Regular Reviews

**Quarterly Review:**

- Verify automated cleanup is functioning
- Review deletion request handling
- Assess storage usage and trends
- Update retention policies if needed

**Annual Review:**

- Comprehensive compliance audit
- Review regulatory changes
- Update procedures and documentation
- Train staff on updated policies

## Security Considerations

### Data Deletion Security

- **Soft Delete:** Initial deletion marks records as deleted but retains data for grace period
- **Hard Delete:** Permanent removal from database after grace period
- **Secure Deletion:** Database vacuum operations to reclaim storage
- **Backup Cleanup:** Ensure deleted data is removed from backups after retention period

### Access Controls

- Deletion scripts require service role credentials
- Audit logging for all deletion operations
- Separation of duties for manual deletions
- Regular access review for compliance scripts

### Encryption

- Data encrypted at rest in database
- Archived data encrypted with AES-256
- Secure key management for encryption keys
- Encrypted backups

## Troubleshooting

### Cleanup Script Fails

**Symptoms:** `compliance:cleanup` script exits with error

**Possible Causes:**

- Database connection failure
- Insufficient permissions
- Constraint violations (foreign keys)

**Resolution:**

1. Check database connectivity
2. Verify service role permissions
3. Review error logs for specific constraint violations
4. Manually resolve data dependencies if needed

### GDPR Deletion Incomplete

**Symptoms:** User data still present after deletion request

**Possible Causes:**

- Data in multiple tables not fully deleted
- Backup data not cleaned up
- Cached data not invalidated

**Resolution:**

1. Run deletion script again with verbose logging
2. Manually verify all tables for user data
3. Clear application caches
4. Schedule backup cleanup

### Export Script Timeout

**Symptoms:** Data export script times out for large datasets

**Possible Causes:**

- User has extensive data history
- Database query performance issues
- Network timeout

**Resolution:**

1. Increase script timeout limit
2. Implement pagination for large exports
3. Optimize database queries with indexes
4. Export in multiple batches if needed

## Contact Information

For data retention and compliance questions:

- **Privacy Officer:** privacy@example.com
- **Data Protection Officer:** dpo@example.com
- **Security Team:** security@example.com

## Document History

| Version | Date       | Changes                 | Author |
| ------- | ---------- | ----------------------- | ------ |
| 1.0     | 2024-01-15 | Initial policy document | System |

## Related Documents

- [Backup and Restore Procedures](../database/backup-restore.md)
- [Security Policies](../security/)
- [Audit Logging](../../lib/audit/README.md)
