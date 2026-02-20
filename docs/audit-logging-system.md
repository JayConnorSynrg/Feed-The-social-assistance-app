# Audit Logging System

## Overview

The FEED platform includes a comprehensive audit logging system that provides an immutable audit trail for all security-relevant events. This system is critical for SOC 2 and HIPAA compliance.

## Architecture

### Database Schema

**Table**: `audit_log`

The audit log table is designed to be:
- **Immutable**: No update or delete policies - logs cannot be modified once created
- **Comprehensive**: Captures who, what, when, where for all security events
- **Performant**: Optimized indexes for common query patterns
- **Compliant**: Meets SOC 2 and HIPAA audit trail requirements

**Columns**:
- `id`: Unique identifier (UUID)
- `user_id`: References auth.users (NULL for system events)
- `session_id`: Hashed session identifier
- `ip_address`: Client IP address (INET type)
- `user_agent`: Client user agent string
- `event_type`: Specific event (e.g., 'vault.unlock', 'mfa.verified')
- `event_category`: Category for filtering (auth, vault, encryption, mfa, document, profile, admin, system)
- `severity`: Event severity (info, warning, critical)
- `resource_type`: Type of resource accessed (e.g., 'secure_profile', 'document')
- `resource_id`: ID of the specific resource
- `action`: Action performed (read, create, update, delete, encrypt, decrypt, verify, etc.)
- `details`: Additional context as JSONB
- `created_at`: Immutable timestamp

**Indexes**:
- User timeline: `(user_id, created_at DESC)`
- Event type filtering: `(event_type, created_at DESC)`
- Category filtering: `(event_category, created_at DESC)`
- Security monitoring: `(severity, created_at DESC)` WHERE severity IN ('warning', 'critical')
- Resource tracking: `(resource_type, resource_id, created_at DESC)`
- Session tracking: `(session_id, created_at DESC)`
- IP analysis: `(ip_address, created_at DESC)`

### Row Level Security (RLS)

**User Access**:
- Users can SELECT their own audit logs via `auth.uid() = user_id`
- Users can INSERT their own audit events

**Admin Access**:
- Admins can SELECT all audit logs via `profiles.is_admin = true`

**Immutability**:
- NO UPDATE policies - logs cannot be modified
- NO DELETE policies - logs cannot be deleted
- Service role bypasses RLS for system events

## Pre-defined Event Types

### Authentication Events
- `AUTH_LOGIN_SUCCESS`: Successful login (severity: info)
- `AUTH_LOGIN_FAILED`: Failed login attempt (severity: warning)
- `AUTH_LOGOUT`: User logout (severity: info)
- `AUTH_PASSWORD_CHANGED`: Password changed (severity: critical)
- `AUTH_ACCOUNT_LOCKED`: Account locked due to failed attempts (severity: critical)
- `AUTH_MFA_REQUIRED`: MFA verification required (severity: info)

### Vault Events
- `VAULT_SETUP`: First-time vault setup (severity: critical)
- `VAULT_UNLOCK`: Successful vault unlock (severity: info)
- `VAULT_LOCK`: Vault locked (severity: info)
- `VAULT_PASSWORD_CHANGED`: Vault master password changed (severity: critical)
- `VAULT_UNLOCK_FAILED`: Failed vault unlock attempt (severity: warning)

### Encryption Events
- `DATA_ENCRYPTED`: Data encrypted (severity: info)
- `DATA_DECRYPTED`: Data decrypted (severity: info)
- `DATA_MIGRATION`: Data migrated to encrypted format (severity: warning)
- `ENCRYPTION_ERROR`: Encryption operation failed (severity: critical)

### MFA Events
- `MFA_ENROLLED`: MFA enrolled for account (severity: critical)
- `MFA_UNENROLLED`: MFA disabled for account (severity: critical)
- `MFA_VERIFIED`: Successful MFA verification (severity: info)
- `MFA_FAILED`: Failed MFA verification (severity: warning)
- `MFA_BACKUP_CODE_USED`: Backup code used for authentication (severity: warning)
- `MFA_BACKUP_CODES_GENERATED`: New backup codes generated (severity: critical)

### Document Events
- `DOCUMENT_UPLOADED`: Document uploaded (severity: info)
- `DOCUMENT_DOWNLOADED`: Document downloaded (severity: info)
- `DOCUMENT_DELETED`: Document deleted (severity: warning)
- `DOCUMENT_VIEWED`: Document viewed (severity: info)

### Profile Events
- `PROFILE_SENSITIVE_VIEWED`: Sensitive profile data accessed (severity: info)
- `PROFILE_SENSITIVE_UPDATED`: Sensitive profile data updated (severity: warning)
- `PROFILE_CREATED`: Profile created (severity: info)
- `PROFILE_UPDATED`: Profile updated (severity: info)

### Admin Events
- `ADMIN_USER_VIEWED`: Admin viewed user details (severity: warning)
- `ADMIN_RESOURCE_APPROVED`: Admin approved resource (severity: info)
- `ADMIN_USER_UPDATED`: Admin updated user (severity: warning)

## Usage

### Server-Side (TypeScript/React)

**Log a pre-defined event**:
```typescript
import { logPredefinedEvent } from '@/lib/audit-logger'

// Log vault unlock
logPredefinedEvent('VAULT_UNLOCK', {
  action: 'unlock',
  resourceType: 'vault',
  resourceId: userId,
})

// Log document upload with details
logPredefinedEvent('DOCUMENT_UPLOADED', {
  action: 'upload',
  resourceType: 'document',
  resourceId: documentId,
  details: {
    category: 'medical',
    fileName: 'test.pdf',
    fileSize: 1024,
  },
})
```

**Log a custom event**:
```typescript
import { logAuditEvent } from '@/lib/audit-logger'

logAuditEvent({
  eventType: 'custom.action',
  eventCategory: 'system',
  action: 'create',
  severity: 'info',
  resourceType: 'custom_resource',
  resourceId: 'resource-123',
  details: { key: 'value' },
})
```

**Use the React hook**:
```typescript
import { useAuditLog } from '@/hooks/use-audit-log'

function SecurityDashboard() {
  const { logs, loading, viewMyLogs, loadMore, hasMore } = useAuditLog()

  useEffect(() => {
    // Load recent logs
    viewMyLogs({ limit: 20 })
  }, [])

  // Filter by category
  const viewAuthLogs = () => {
    viewMyLogs({ category: 'auth', limit: 20 })
  }

  // Filter by severity
  const viewCriticalEvents = () => {
    viewMyLogs({ severity: 'critical', limit: 20 })
  }

  return (
    <div>
      {logs.map((log) => (
        <div key={log.id}>
          {log.eventType} - {log.severity}
        </div>
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  )
}
```

### Database (SQL)

**Query audit logs directly**:
```sql
-- Recent critical events
SELECT * FROM audit_log
WHERE severity = 'critical'
ORDER BY created_at DESC
LIMIT 100;

-- Vault unlocks for a specific user
SELECT * FROM audit_log
WHERE user_id = 'user-uuid'
  AND event_type = 'vault.unlock'
ORDER BY created_at DESC;

-- All MFA events in the last 30 days
SELECT * FROM audit_log
WHERE event_category = 'mfa'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Document access by resource
SELECT * FROM audit_log
WHERE resource_type = 'document'
  AND resource_id = 'doc-uuid'
ORDER BY created_at DESC;
```

**Use helper function**:
```sql
-- Log an audit event from a database function
SELECT log_audit_event(
  p_user_id := auth.uid(),
  p_event_type := 'custom.event',
  p_event_category := 'system',
  p_action := 'create',
  p_severity := 'info',
  p_resource_type := 'resource',
  p_resource_id := 'resource-id',
  p_details := '{"key": "value"}'::jsonb
);
```

## Integration Points

The audit logging system is integrated into:

1. **Vault Context** (`apps/web/src/contexts/vault-context.tsx`)
   - Vault setup, unlock, lock, password change

2. **MFA Enrollment** (`apps/web/src/components/auth/mfa-enrollment.tsx`)
   - MFA enrollment, backup code generation

3. **MFA Verification** (`apps/web/src/components/auth/mfa-verify.tsx`)
   - TOTP verification, backup code usage, failures

4. **Login Page** (`apps/web/src/app/(auth)/login/page.tsx`)
   - Login success/failure, MFA required

5. **Secure Profile Hook** (`apps/web/src/hooks/use-vault-secure-profile.ts`)
   - Sensitive profile views, updates

6. **Document Upload** (`apps/web/src/components/documents/encrypted-upload.tsx`)
   - Document uploads

7. **Settings Panel** (`apps/web/src/components/panels/settings-panel.tsx`)
   - Security Activity viewer

## Security Considerations

### Fire-and-Forget Design
Audit logging uses a **fire-and-forget** pattern:
- Never blocks the main action
- Failures are logged to console but don't throw errors
- App continues to function even if audit logging fails

```typescript
// This will never block or throw
logPredefinedEvent('VAULT_UNLOCK', { ... })

// Main action continues immediately
await performVaultUnlock()
```

### Data Privacy
- **Session IDs are hashed** to avoid storing full JWT tokens
- **IP addresses** are collected for security monitoring but can be anonymized
- **User agents** are stored for device tracking
- **Sensitive details** should NOT be logged in the `details` field

### Immutability
- Audit logs **CANNOT be updated or deleted** by any user
- Only database administrators can archive logs for compliance retention
- RLS ensures users can only view their own logs (except admins)

## Compliance

### SOC 2 Requirements
✅ **CC6.2** - System monitoring for security incidents
✅ **CC6.3** - Logging and investigation of anomalous activity
✅ **CC7.2** - Detection of security incidents
✅ **CC7.3** - Evaluation and response to security events

### HIPAA Requirements
✅ **§164.312(b)** - Audit controls to record and examine activity
✅ **§164.308(a)(1)(ii)(D)** - Information system activity review
✅ **§164.308(a)(5)(ii)(C)** - Log-in monitoring

## Monitoring & Alerts

### Critical Events to Monitor
```sql
-- Failed login attempts (potential brute force)
SELECT user_id, COUNT(*) as attempts
FROM audit_log
WHERE event_type = 'auth.login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 5;

-- Multiple vault unlock failures (potential attack)
SELECT user_id, COUNT(*) as failures
FROM audit_log
WHERE event_type = 'vault.unlock_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 3;

-- MFA disabled (security regression)
SELECT * FROM audit_log
WHERE event_type = 'mfa.unenrolled'
  AND created_at > NOW() - INTERVAL '24 hours';
```

### Performance Optimization
For high-volume audit logging:
1. Use **partitioning** by created_at (monthly partitions)
2. Implement **archival** strategy (move old logs to cold storage)
3. Use **materialized views** for common queries
4. Consider **async job processing** for non-critical events

## Migration

The audit logging migration is located at:
```
/supabase/migrations/20260215000000_add_audit_logging.sql
```

**Apply the migration**:
```bash
# Via Supabase CLI (local)
npx supabase db push

# Via Supabase CLI (remote)
npx supabase db push --linked

# Via Supabase Dashboard
# 1. Go to Database > Migrations
# 2. Create new migration
# 3. Paste migration SQL
# 4. Run migration
```

**Regenerate types**:
```bash
# After applying migration
npx supabase gen types typescript --linked > packages/database/types.ts
```

## Testing

```typescript
import { logPredefinedEvent } from '@/lib/audit-logger'
import { useAuditLog } from '@/hooks/use-audit-log'

// Test logging
logPredefinedEvent('VAULT_UNLOCK', {
  action: 'unlock',
  resourceType: 'vault',
  resourceId: 'test-user-id',
  details: { test: true },
})

// Test retrieval
const { logs, viewMyLogs } = useAuditLog()
await viewMyLogs({ limit: 10 })
console.log('Recent logs:', logs)
```

## Troubleshooting

### Logs not appearing
1. Check RLS policies are enabled
2. Verify user is authenticated
3. Check console for silent failures
4. Verify migration was applied

### Performance issues
1. Check index usage: `EXPLAIN ANALYZE SELECT ...`
2. Consider pagination limits
3. Implement archival for old logs
4. Use category/severity filters

### Missing event types
1. Add to `AUDIT_EVENTS` in `audit-logger.ts`
2. Update event type constraints in migration
3. Add logging calls at integration points

## Future Enhancements

- [ ] Real-time alerting via webhooks
- [ ] Anomaly detection (ML-based)
- [ ] Export functionality (CSV, JSON)
- [ ] Retention policy automation
- [ ] Integration with SIEM systems
- [ ] Log aggregation for multi-tenant setups
