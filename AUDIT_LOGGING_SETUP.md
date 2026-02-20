# Audit Logging System - Setup Instructions

## Overview
This PR implements a comprehensive audit logging system for the FEED platform, providing an immutable audit trail for all security-relevant events. This is critical for SOC 2 and HIPAA compliance.

---

## What Was Built

### 1. Database Migration
**File**: `/supabase/migrations/20260215000000_add_audit_logging.sql`

Creates the `audit_log` table with:
- Immutable audit trail (no update/delete policies)
- Comprehensive event tracking (who, what, when, where)
- Optimized indexes for common queries
- RLS policies for user privacy and admin access
- Helper function for SQL-based logging

### 2. Audit Logger Service
**File**: `/apps/web/src/lib/audit-logger.ts`

Provides:
- Type-safe event logging
- Fire-and-forget pattern (never blocks main actions)
- Pre-defined event types for consistency
- Silent failure handling (logging failures never break the app)
- Automatic user context injection

### 3. React Hook
**File**: `/apps/web/src/hooks/use-audit-log.ts`

Features:
- View user's audit history
- Filter by category and severity
- Pagination support
- Type-safe audit log entries

### 4. Security Activity UI
**File**: `/apps/web/src/components/security/security-activity.tsx`

User-facing security dashboard showing:
- Recent audit events
- Filterable by category and severity
- Expandable event details
- Real-time refresh

### 5. Integration Points
Audit logging integrated into:
- ✅ Vault context (setup, unlock, lock, password change)
- ✅ MFA enrollment and verification
- ✅ Login flow (success, failure, MFA required)
- ✅ Secure profile access and updates
- ✅ Document uploads
- ✅ Settings panel (security activity viewer)

---

## Setup Instructions

### Step 1: Apply Database Migration

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to your Supabase project dashboard
2. Navigate to **Database** > **Migrations**
3. Click **New Migration**
4. Copy the contents of `/supabase/migrations/20260215000000_add_audit_logging.sql`
5. Paste into the SQL editor
6. Click **Run Migration**

**Option B: Via Supabase CLI**
```bash
# Set your database password
export SUPABASE_DB_PASSWORD="your-db-password"

# Apply migration
npx supabase db push --linked
```

**Option C: Via SQL Editor**
1. Go to **SQL Editor** in Supabase dashboard
2. Create new query
3. Copy contents of migration file
4. Execute

### Step 2: Regenerate TypeScript Types

After applying the migration, regenerate types to include the new `audit_log` table:

```bash
# Generate types from linked project
npx supabase gen types typescript --linked > packages/database/types.ts
```

### Step 3: Verify Installation

Run this SQL query in the Supabase SQL Editor to verify:
```sql
-- Check table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'audit_log';

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'audit_log';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'audit_log';
```

Expected results:
- Table `audit_log` exists
- 7+ indexes created
- Row security enabled (true)

### Step 4: Test Audit Logging

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Perform a security action**:
   - Log in to the app
   - Unlock your vault
   - View your secure profile

3. **Check audit logs**:
   - Go to Settings > Account
   - Scroll to "Security Activity"
   - Verify recent events appear

4. **Verify in database**:
   ```sql
   SELECT
     event_type,
     severity,
     created_at,
     details
   FROM audit_log
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## Pre-defined Event Types

### Critical Events (severity: critical)
- `VAULT_SETUP` - First-time vault setup
- `VAULT_PASSWORD_CHANGED` - Vault password changed
- `AUTH_PASSWORD_CHANGED` - Auth password changed
- `AUTH_ACCOUNT_LOCKED` - Account locked
- `MFA_ENROLLED` - MFA enabled
- `MFA_UNENROLLED` - MFA disabled
- `MFA_BACKUP_CODES_GENERATED` - Backup codes generated

### Warning Events (severity: warning)
- `AUTH_LOGIN_FAILED` - Failed login
- `VAULT_UNLOCK_FAILED` - Failed vault unlock
- `MFA_FAILED` - Failed MFA verification
- `MFA_BACKUP_CODE_USED` - Backup code used
- `DATA_MIGRATION` - Data migration occurred
- `DOCUMENT_DELETED` - Document deleted
- `PROFILE_SENSITIVE_UPDATED` - Sensitive profile updated
- `ADMIN_*` - Admin actions

### Info Events (severity: info)
- `AUTH_LOGIN_SUCCESS` - Successful login
- `VAULT_UNLOCK` / `VAULT_LOCK` - Vault access
- `MFA_VERIFIED` - Successful MFA
- `DOCUMENT_UPLOADED` / `DOCUMENT_DOWNLOADED` - Document access
- `PROFILE_SENSITIVE_VIEWED` - Profile viewed
- And more...

---

## Usage Examples

### Log an event (TypeScript)
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
    fileName: 'prescription.pdf',
    fileSize: 2048000,
  },
})
```

### Query logs (SQL)
```sql
-- Recent critical events
SELECT * FROM audit_log
WHERE severity = 'critical'
ORDER BY created_at DESC
LIMIT 100;

-- Failed login attempts in last hour
SELECT user_id, COUNT(*) as attempts
FROM audit_log
WHERE event_type = 'auth.login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id;

-- All vault unlocks for a user
SELECT * FROM audit_log
WHERE user_id = 'user-uuid'
  AND event_type = 'vault.unlock'
ORDER BY created_at DESC;
```

### View in UI
1. Navigate to **Settings** panel
2. Click **Account** section
3. Scroll to **Security Activity**
4. Filter by category or severity
5. Click events to expand details

---

## Security Features

### Immutability
- ✅ No UPDATE policies - logs cannot be modified
- ✅ No DELETE policies - logs cannot be deleted
- ✅ Only DB admins can archive for compliance

### Privacy
- ✅ Users see only their own logs (RLS)
- ✅ Admins see all logs (via `profiles.is_admin`)
- ✅ Session IDs are hashed (not full JWTs)
- ✅ Sensitive data NOT logged in details field

### Reliability
- ✅ Fire-and-forget (never blocks main actions)
- ✅ Silent failure (logging errors don't break app)
- ✅ Automatic user context injection
- ✅ Type-safe event definitions

---

## Compliance

### SOC 2
✅ **CC6.2** - System monitoring for security incidents
✅ **CC6.3** - Logging and investigation of anomalous activity
✅ **CC7.2** - Detection of security incidents
✅ **CC7.3** - Evaluation and response to security events

### HIPAA
✅ **§164.312(b)** - Audit controls to record and examine activity
✅ **§164.308(a)(1)(ii)(D)** - Information system activity review
✅ **§164.308(a)(5)(ii)(C)** - Log-in monitoring

---

## Files Created/Modified

### New Files
- `/supabase/migrations/20260215000000_add_audit_logging.sql` - Database migration
- `/apps/web/src/lib/audit-logger.ts` - Audit logging service
- `/apps/web/src/hooks/use-audit-log.ts` - React hook for audit logs
- `/apps/web/src/components/security/security-activity.tsx` - Security UI
- `/docs/audit-logging-system.md` - Comprehensive documentation
- `/AUDIT_LOGGING_SETUP.md` - This setup guide

### Modified Files
- `/apps/web/src/contexts/vault-context.tsx` - Added vault event logging
- `/apps/web/src/components/auth/mfa-enrollment.tsx` - Added MFA enrollment logging
- `/apps/web/src/components/auth/mfa-verify.tsx` - Added MFA verification logging
- `/apps/web/src/app/(auth)/login/page.tsx` - Added login event logging
- `/apps/web/src/hooks/use-vault-secure-profile.ts` - Added profile access logging
- `/apps/web/src/components/documents/encrypted-upload.tsx` - Added document logging
- `/apps/web/src/components/panels/settings-panel.tsx` - Added security activity viewer
- `/package.json` - Added date-fns dependency

---

## Monitoring Queries

### Detect Suspicious Activity
```sql
-- Multiple failed logins (brute force)
SELECT user_id, COUNT(*) as failures
FROM audit_log
WHERE event_type = 'auth.login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 5;

-- Vault unlock attempts
SELECT user_id, COUNT(*) as failures
FROM audit_log
WHERE event_type = 'vault.unlock_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) > 3;

-- Recent security regressions
SELECT * FROM audit_log
WHERE event_type IN ('mfa.unenrolled', 'vault.password_changed')
  AND created_at > NOW() - INTERVAL '24 hours';
```

---

## Troubleshooting

### Migration Fails
**Error**: "relation already exists"
**Fix**: Table already exists, skip migration or drop table first

**Error**: "permission denied"
**Fix**: Check database connection and credentials

### Logs Not Appearing
1. Check migration was applied: `SELECT * FROM audit_log LIMIT 1;`
2. Verify user is authenticated
3. Check browser console for errors
4. Verify RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'audit_log';`

### UI Not Showing
1. Check SecurityActivity component is imported
2. Verify date-fns is installed: `npm list date-fns`
3. Check browser console for errors

---

## Next Steps

1. **Apply migration** (see Step 1 above)
2. **Regenerate types** (see Step 2 above)
3. **Test the system** (see Step 4 above)
4. **Set up monitoring** (use queries above)
5. **Configure alerts** (optional, via webhooks)
6. **Document retention policy** (archive old logs)

---

## Support

For detailed documentation, see `/docs/audit-logging-system.md`

For questions or issues:
1. Check the troubleshooting section above
2. Review the comprehensive docs
3. Examine the SQL migration file
4. Check integration points in code
