# Authentication Hardening System

Comprehensive server-side authentication security implementation for the FEED platform.

## Overview

This system implements government-grade authentication security including:
- **Password Policy Enforcement** (12-character minimum, complexity requirements)
- **Account Lockout Protection** (progressive brute-force prevention)
- **Session Management** (device tracking, session revocation)
- **Audit Logging** (comprehensive login attempt tracking)

## Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Check lockout before login
       ├─────────────────────────────────────────┐
       │                                         │
       │                                         ▼
       │                              ┌──────────────────┐
       │                              │  API Route       │
       │                              │  /check-lockout  │
       │                              └────────┬─────────┘
       │                                       │
       │                                       ▼
       │                              ┌──────────────────┐
       │                              │  Edge Function   │
       │ 2. Attempt login            │  auth-guard      │
       ├──────────────────────►       └────────┬─────────┘
       │                                       │
       │                                       ▼
       │                              ┌──────────────────┐
       │                              │  Database        │
       │                              │  - login_attempts│
       │ 3. Record result            │  - lockouts      │
       └─────────────────────────────►│  - sessions      │
                                      └──────────────────┘
```

## Components

### 1. Database Tables

**Location**: `/supabase/migrations/20260214240000_add_auth_hardening.sql`

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `auth_login_attempts` | Audit log of all login attempts | email, success, ip_address, created_at |
| `account_lockouts` | Active account lockouts | email, locked_until, lockout_level |
| `user_sessions` | Active user sessions | user_id, device_info, is_current |
| `password_history` | Previous password hashes | user_id, password_hash |

### 2. Edge Functions

**Location**: `/supabase/functions/`

#### auth-guard
- Checks account lockout status
- Records login attempts (success/failure)
- Applies progressive lockout rules
- Endpoint: `POST /auth-guard`

**Actions:**
- `check-lockout` - Check if email is locked
- `record-attempt` - Log login attempt
- `get-status` - Get current lockout info

#### validate-password
- Server-side password strength validation
- Common password checking (top 100 list)
- Pattern detection (sequential, repeated chars)
- Email/username similarity check
- Endpoint: `POST /validate-password`

### 3. API Routes

**Location**: `/apps/web/src/app/api/auth/`

- `check-lockout/route.ts` - Proxy to auth-guard Edge Function
- `validate-password/route.ts` - Proxy to validate-password Edge Function
- `client-ip/route.ts` - Get client IP for session tracking

### 4. Client Libraries

**Location**: `/apps/web/src/lib/`

- `security.ts` - Client-side validation, rate limiting, password strength
- `session-manager.ts` - Session tracking and management

## Security Features

### Progressive Account Lockout

Prevents brute-force attacks with escalating lockout periods:

| Level | Threshold | Window | Lockout Duration |
|-------|-----------|--------|------------------|
| 1 | 5 failures | 15 min | 15 minutes |
| 2 | 10 failures | 1 hour | 1 hour |
| 3 | 20 failures | 24 hours | 24 hours |

**Example:**
- User enters wrong password 5 times in 10 minutes → Locked for 15 minutes
- User continues attacking (10 failures in 1 hour) → Locked for 1 hour
- Persistent attacks (20 failures in a day) → Locked for 24 hours

### Password Requirements

**Minimum Security:**
- At least 12 characters (government-grade)
- 1 uppercase letter
- 1 lowercase letter
- 1 number
- 1 special character
- Not in common password list
- Not similar to email/username

**Score Calculation:**
- Length ≥12: +1 point
- Length ≥16: +1 point
- Lowercase: +1 point
- Uppercase: +1 point
- Numbers: +1 point
- Special chars: +1 point
- Common pattern: -2 points
- Sequential chars: -2 points

**Valid Password:** Score ≥4 AND length ≥12

### Session Tracking

Track all active user sessions:
- Device information (browser, OS)
- IP address
- Location (optional, via geolocation)
- Last activity timestamp
- Current session indicator

**User Benefits:**
- View all active sessions
- Revoke suspicious sessions
- "Logout all other devices" feature

## Installation & Setup

### 1. Apply Database Migration

```bash
# Push migration to local Supabase
npx supabase db push

# Or apply specific migration
npx supabase db reset
```

### 2. Deploy Edge Functions

```bash
# Deploy auth-guard
npx supabase functions deploy auth-guard

# Deploy validate-password
npx supabase functions deploy validate-password

# Set environment variables (if needed)
npx supabase secrets set SOME_SECRET=value
```

### 3. Configure Supabase Dashboard

See `/docs/SUPABASE_AUTH_CONFIG.md` for detailed configuration:
- Access token lifetime: 15 minutes
- Refresh token lifetime: 7 days
- Refresh token rotation: Enabled
- Password minimum length: 12 characters

### 4. Test Implementation

Follow `/docs/AUTH_HARDENING_TESTING.md` for comprehensive testing.

## Usage Examples

### Check Lockout Before Login

```typescript
// In login page
const checkLockout = async (email: string) => {
  const response = await fetch('/api/auth/check-lockout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check-lockout', email }),
  })

  const data = await response.json()

  if (data.is_locked) {
    setError(`Account locked. Try again in ${data.minutes_remaining} minutes.`)
    return true
  }

  return false
}
```

### Record Login Attempt

```typescript
// After login attempt
const recordAttempt = async (email: string, success: boolean) => {
  await fetch('/api/auth/check-lockout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'record-attempt',
      email,
      success,
      failure_reason: success ? undefined : 'invalid_credentials',
    }),
  })
}
```

### Validate Password Strength

```typescript
import { validatePasswordServer } from '@/lib/security'

// Server-side validation
const result = await validatePasswordServer('MyP@ssw0rd123', 'user@example.com')

if (!result.valid) {
  console.log('Password issues:', result.feedback)
}
```

### Manage Sessions

```typescript
import { sessionManager } from '@/lib/session-manager'

// Get all sessions
const sessions = await sessionManager.getUserSessions()

// Revoke a session
await sessionManager.revokeSession(sessionId)

// Revoke all other sessions
await sessionManager.revokeAllOtherSessions()
```

## Monitoring & Maintenance

### Scheduled Cleanup

Run these functions daily (via cron or scheduled Edge Function):

```sql
-- Remove old login attempts (30 days)
SELECT cleanup_old_login_attempts();

-- Remove expired lockouts
SELECT cleanup_expired_lockouts();

-- Remove inactive sessions (30 days)
SELECT cleanup_inactive_sessions();
```

### Security Monitoring

Query suspicious activity:

```sql
-- High failure rate (potential attack)
SELECT email, COUNT(*) as failures
FROM auth_login_attempts
WHERE success = false
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email
HAVING COUNT(*) > 5;

-- Multiple IPs for same account (credential sharing or attack)
SELECT email, COUNT(DISTINCT ip_address) as ip_count
FROM auth_login_attempts
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY email
HAVING COUNT(DISTINCT ip_address) > 3;
```

## Security Considerations

### What This System Prevents

✅ Brute-force password attacks (via progressive lockout)
✅ Credential stuffing (via rate limiting + lockout)
✅ Weak passwords (via server-side validation)
✅ Password reuse (via password history)
✅ Unauthorized session access (via session management)

### What This System Does NOT Prevent

❌ Phishing attacks (require user education)
❌ Social engineering (require user awareness)
❌ Compromised credentials from breaches (recommend MFA)
❌ Man-in-the-middle attacks (require HTTPS)

### Additional Recommendations

1. **Enable MFA** - Add TOTP support for high-value accounts
2. **Use HTTPS** - Enforce HTTPS everywhere (Vercel does this by default)
3. **Monitor Logs** - Set up alerts for suspicious patterns
4. **User Education** - Teach users about phishing, strong passwords
5. **Regular Audits** - Review security logs weekly

## Troubleshooting

### User Can't Login (Locked Out)

**Symptom:** Error "Account temporarily locked"

**Solution:**
```sql
-- Check lockout status
SELECT * FROM account_lockouts WHERE email = 'user@example.com';

-- Manually remove if legitimate user
DELETE FROM account_lockouts WHERE email = 'user@example.com';
```

### Edge Function Not Working

**Symptom:** API calls fail with 500 error

**Debug:**
```bash
# Check Edge Function logs
npx supabase functions logs auth-guard

# Test directly
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/auth-guard \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"check-lockout","email":"test@example.com"}'
```

### Password Validation Too Strict

**Symptom:** Users complain passwords are rejected

**Solution:** Review requirements in `/supabase/functions/validate-password/index.ts`
- Current minimum: 12 characters
- Can reduce to 10 (not recommended for government-grade)
- Ensure feedback messages are clear

## Future Enhancements

- [ ] Password reset with history checking
- [ ] Account recovery via backup codes
- [ ] IP-based geolocation and suspicious location alerts
- [ ] Device fingerprinting for enhanced security
- [ ] Anomaly detection (unusual login times/locations)
- [ ] Passwordless authentication (WebAuthn/passkeys)
- [ ] Risk-based authentication (challenge on suspicious activity)

## Related Documentation

- [Supabase Auth Configuration](./SUPABASE_AUTH_CONFIG.md)
- [Testing Guide](./AUTH_HARDENING_TESTING.md)
- [Security Audit Checklist](../apps/web/src/lib/security.ts)

## Support

For issues or questions:
1. Check logs: `npx supabase functions logs auth-guard`
2. Review database: Query `auth_login_attempts` and `account_lockouts`
3. Test Edge Functions directly via curl
4. Consult testing guide for validation procedures

---

**Version:** 1.0.0
**Last Updated:** 2026-02-14
**Status:** Production-Ready ✅
