# Supabase Authentication Configuration

This document outlines the required Supabase authentication settings for production-grade security.

## Session Configuration

These settings must be configured in the **Supabase Dashboard** under:
`Authentication > Settings > Auth Settings`

### Recommended Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Access Token Lifetime** | 15 minutes | Short-lived tokens reduce exposure window if compromised |
| **Refresh Token Lifetime** | 7 days | Balanced convenience for mobile users with security |
| **Refresh Token Rotation** | Enabled | Each refresh invalidates old token, preventing replay attacks |
| **Refresh Token Reuse Interval** | 10 seconds | Grace period for concurrent requests during token refresh |
| **JWT Expiry** | 3600 seconds (1 hour) | Standard JWT lifetime |

### Configuration Steps

1. **Navigate to Supabase Dashboard**
   - Go to your project: https://app.supabase.com/project/YOUR_PROJECT_ID
   - Click on "Authentication" in sidebar
   - Click on "Settings" tab

2. **Update Session Settings**
   ```
   Access Token Lifetime: 900 (15 minutes)
   Refresh Token Lifetime: 604800 (7 days)
   Refresh Token Rotation: ✓ Enabled
   Refresh Token Reuse Interval: 10 (seconds)
   ```

3. **Save Changes**
   - Click "Save" at the bottom of the page
   - Changes take effect immediately for new sessions

## Password Policy

Configure in: `Authentication > Settings > Auth Providers > Email`

| Setting | Value |
|---------|-------|
| **Minimum Password Length** | 12 characters |
| **Password Strength** | Custom (validated server-side) |

**Note**: Supabase doesn't enforce custom password strength validation natively. We implement this via:
- Client-side validation in `security.ts`
- Server-side validation in `validate-password` Edge Function
- Validation is called before `supabase.auth.signUp()`

## Account Lockout

Supabase doesn't provide built-in account lockout. We implement this via:

1. **Database Tables** (in migration `20260214240000_add_auth_hardening.sql`)
   - `auth_login_attempts` - Audit log of all attempts
   - `account_lockouts` - Active lockouts

2. **Edge Function** (`auth-guard`)
   - Checks lockout status before login
   - Records all attempts
   - Applies progressive lockout rules

3. **Progressive Lockout Rules**
   - 5 failures in 15 min → lock for 15 min
   - 10 failures in 1 hour → lock for 1 hour
   - 20 failures in 24 hours → lock for 24 hours

## Session Tracking

Track active user sessions for security monitoring:

1. **Database Table**: `user_sessions`
   - Stores device info, IP, location, last activity
   - Users can view/revoke sessions via UI

2. **Session Manager**: `apps/web/src/lib/session-manager.ts`
   - Records sessions on login
   - Updates activity timestamps
   - Allows session revocation

## Multi-Factor Authentication (MFA)

Configure in: `Authentication > Settings > Auth Providers > Phone`

| Setting | Value |
|---------|-------|
| **MFA Enforcement** | Optional (user choice) |
| **MFA Provider** | TOTP (Time-based One-Time Password) |

**Implementation**:
- TOTP setup flow in settings panel
- MFA verification in login flow
- Backup codes for account recovery

## OAuth Providers

Configure in: `Authentication > Settings > Auth Providers`

### Google OAuth

1. Create credentials in Google Cloud Console
2. Add to Supabase:
   ```
   Client ID: YOUR_GOOGLE_CLIENT_ID
   Client Secret: YOUR_GOOGLE_CLIENT_SECRET
   ```
3. Add authorized redirect URI:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

### Apple OAuth

1. Create App ID and Service ID in Apple Developer
2. Configure Sign in with Apple
3. Add to Supabase with credentials

## Security Headers

These are configured in `apps/web/src/middleware.ts` and enforced by Vercel/hosting:

```typescript
Content-Security-Policy: "default-src 'self'; ..."
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

## Email Templates

Customize in: `Authentication > Email Templates`

### Important Templates

1. **Confirm Signup** - Email verification
2. **Reset Password** - Password reset link
3. **Magic Link** - Passwordless login (if enabled)
4. **Change Email Address** - Email change confirmation

**Best Practices**:
- Include clear branding
- Add contact information
- Set reasonable link expiry (15 minutes for reset, 24 hours for verification)
- Use branded sender email

## Rate Limiting

Supabase provides basic rate limiting. We augment with:

1. **Client-Side Rate Limiting**
   - Implemented in `security.ts` via `RateLimiter` class
   - Prevents spam during normal operation

2. **Server-Side Rate Limiting**
   - Edge Function `auth-guard` tracks attempts
   - Progressive lockout prevents brute force

## Monitoring & Alerts

Set up monitoring for:

1. **Failed Login Attempts**
   - Query `auth_login_attempts` table
   - Alert on unusual patterns

2. **Account Lockouts**
   - Query `account_lockouts` table
   - Alert on frequent lockouts (potential attack)

3. **Session Activity**
   - Query `user_sessions` table
   - Alert on sessions from unusual locations

## Cleanup & Maintenance

Schedule these cleanup functions (via cron or scheduled Edge Function):

```sql
-- Run daily
SELECT cleanup_old_login_attempts();     -- Removes attempts older than 30 days
SELECT cleanup_expired_lockouts();       -- Removes expired lockouts
SELECT cleanup_inactive_sessions();      -- Removes sessions inactive > 30 days
```

## Production Checklist

Before going live:

- [ ] Access token lifetime set to 15 minutes
- [ ] Refresh token rotation enabled
- [ ] Password minimum length 12 characters
- [ ] Account lockout system deployed and tested
- [ ] OAuth providers configured with production credentials
- [ ] Email templates customized and branded
- [ ] Rate limiting verified
- [ ] Session tracking enabled
- [ ] Cleanup functions scheduled
- [ ] Security headers configured
- [ ] Monitoring and alerts set up

## Support & Troubleshooting

### Common Issues

1. **Users locked out unexpectedly**
   - Check `account_lockouts` table
   - Manually remove lockout: `DELETE FROM account_lockouts WHERE email = 'user@example.com'`

2. **Session refresh failing**
   - Verify refresh token rotation is enabled
   - Check reuse interval is appropriate (10 seconds recommended)

3. **Password validation too strict**
   - Review requirements in `validate-password` Edge Function
   - Ensure client-side matches server-side validation

### Emergency Access

If you need to bypass lockout for a user:

```sql
-- Remove lockout
DELETE FROM account_lockouts WHERE email = 'user@example.com';

-- Clear failed attempts
DELETE FROM auth_login_attempts WHERE email = 'user@example.com';
```

---

**Last Updated**: 2026-02-14
**Maintained By**: Security Team
