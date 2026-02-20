# Multi-Factor Authentication (MFA) Implementation

## Overview

FEED Platform implements TOTP (Time-based One-Time Password) based two-factor authentication using Supabase's native MFA support. Users can secure their accounts with any TOTP-compatible authenticator app (Google Authenticator, Authy, 1Password, etc.).

## Architecture

### Supabase Native MFA
- Uses Supabase's built-in MFA API (no custom crypto needed)
- TOTP secrets managed securely by Supabase
- Automatic session upgrade with AAL (Authenticator Assurance Level)
- Battle-tested implementation

### Components

#### 1. MFA Service (`/lib/mfa.ts`)
Core service handling all TOTP operations:
- `isMFAEnabled()` - Check if user has MFA enabled
- `getAssuranceLevel()` - Get current AAL (aal1 = password, aal2 = password + TOTP)
- `enrollTOTP()` - Start MFA enrollment (returns QR code)
- `verifyEnrollment()` - Complete enrollment with TOTP code
- `createChallenge()` - Create MFA challenge during login
- `verifyChallenge()` - Verify TOTP code for challenge
- `unenrollTOTP()` - Disable MFA
- `generateBackupCodes()` - Generate 10 recovery codes
- `verifyBackupCode()` - Verify and consume backup code

#### 2. MFA Enrollment Component (`/components/auth/mfa-enrollment.tsx`)
Multi-step enrollment flow:
1. Initial - Explain requirements
2. Scan QR Code - Display QR code and manual entry secret
3. Verify Code - Verify 6-digit TOTP code
4. Backup Codes - Display one-time recovery codes
5. Complete - Success confirmation

#### 3. MFA Verification Component (`/components/auth/mfa-verify.tsx`)
Login verification:
- 6-digit TOTP code input with auto-submit
- Backup code recovery option
- Challenge creation and verification
- Error handling with retry

#### 4. Login Flow Integration (`/app/(auth)/login/page.tsx`)
Enhanced login flow:
- Password authentication first
- Check if user has MFA enrolled
- Show MFA verification if AAL1 but MFA enrolled
- Only redirect after AAL2 achieved

#### 5. Settings Panel Integration (`/components/panels/settings-panel.tsx`)
Account settings section:
- Show MFA status (enabled/disabled)
- Enable MFA button (triggers enrollment)
- Disable MFA with confirmation
- Status indicator (green dot when enabled)

#### 6. Middleware Protection (`/middleware.ts`)
Route-level MFA enforcement:
- Check AAL for authenticated users
- Redirect to MFA verification if AAL1 but MFA enrolled
- Protect sensitive routes (optional enhancement)

### Database

#### Backup Codes Table (`mfa_backup_codes`)
```sql
CREATE TABLE mfa_backup_codes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  code_hash TEXT NOT NULL,        -- SHA-256 hash
  used_at TIMESTAMPTZ,            -- NULL if unused
  created_at TIMESTAMPTZ
);
```

**RLS Policies:**
- Users can only manage their own backup codes
- Full CRUD permissions for own data

## User Flows

### Enrollment Flow
1. User navigates to Settings → Account
2. Clicks "Enable" on Two-Factor Authentication
3. Scans QR code with authenticator app
4. Enters verification code
5. Saves backup codes (one-time display)
6. MFA enabled

### Login Flow (with MFA)
1. User enters email + password
2. System checks for verified TOTP factor
3. If found and AAL1, show MFA verification
4. User enters TOTP code (or backup code)
5. System verifies and upgrades to AAL2
6. User redirected to app

### Recovery Flow (Lost Device)
1. User attempts login
2. Clicks "Use Backup Code"
3. Enters one of the saved backup codes
4. System verifies code (marks as used)
5. User logs in and can regenerate codes

### Disable Flow
1. User navigates to Settings → Account
2. Clicks "Disable" on 2FA
3. Confirms action
4. System unenrolls TOTP factor
5. MFA disabled

## Security Considerations

### Implemented
- TOTP secrets managed by Supabase (never exposed)
- QR codes rendered client-side only
- Backup codes hashed with SHA-256
- Each backup code single-use
- Backup codes displayed once (cannot retrieve)
- Rate limiting on authentication
- RLS policies on backup codes table

### Best Practices
- Use HTTPS in production (enforced)
- Session tokens are httpOnly cookies
- No sensitive data in client-side code
- Proper error handling (no info leakage)

## Usage Examples

### Check MFA Status
```typescript
import { mfaService } from '@/lib/mfa'

const enabled = await mfaService.isMFAEnabled()
console.log('MFA enabled:', enabled)
```

### Enroll TOTP
```typescript
const enrollmentData = await mfaService.enrollTOTP('My App')
if (enrollmentData) {
  // Display QR code: enrollmentData.qrCode
  // Show manual entry: enrollmentData.secret
  // Save factor ID: enrollmentData.factorId
}
```

### Verify Enrollment
```typescript
const verified = await mfaService.verifyEnrollment(factorId, '123456')
if (verified) {
  // Enrollment complete, generate backup codes
  const codes = await mfaService.generateBackupCodes()
  // Display codes to user (one-time only!)
}
```

### Login Verification
```typescript
// Create challenge
const challengeId = await mfaService.createChallenge(factorId)

// Verify code
const verified = await mfaService.verifyChallenge(factorId, challengeId, '123456')
if (verified) {
  // AAL upgraded to aal2, redirect to app
}
```

## Testing

### Manual Testing Checklist
- [ ] Enroll MFA from settings
- [ ] Verify QR code scans correctly
- [ ] Verify TOTP code works
- [ ] Save backup codes
- [ ] Log out and log back in
- [ ] MFA verification appears
- [ ] TOTP code grants access
- [ ] Backup code works (use once)
- [ ] Disable MFA
- [ ] Login without MFA verification

### Automated Tests
See `/lib/__tests__/mfa.test.ts` for unit tests.

## Dependencies

- `@supabase/supabase-js` ^2.90.1 - Supabase client with MFA support
- `qrcode.react` - QR code rendering (client-side)

## Migration

Run migration to create backup codes table:
```bash
npx supabase migration up
```

Or manually run:
```bash
psql -f supabase/migrations/20260214230000_add_mfa_backup_codes.sql
```

## Future Enhancements

1. **SMS Backup** - Add SMS-based recovery option
2. **Trusted Devices** - Remember devices for 30 days
3. **MFA Enforcement** - Require MFA for specific user roles
4. **Recovery Email** - Alternative recovery method
5. **Audit Log** - Track MFA enrollment/usage events
6. **WebAuthn** - Add hardware key support (FIDO2)

## Troubleshooting

### "Failed to start enrollment"
- Check Supabase MFA is enabled in project settings
- Verify user is authenticated before enrollment

### "Invalid verification code"
- Ensure device time is synchronized (NTP)
- TOTP codes are time-based (30-second window)
- Try the next code if current one fails

### "Backup code not working"
- Verify code hasn't been used before
- Check for typos (case-sensitive)
- Ensure backup codes were generated after enrollment

### "MFA verification not showing"
- Check if user has verified TOTP factor
- Verify AAL check in login flow
- Clear browser cache and retry

## Support

For issues or questions:
1. Check Supabase MFA documentation
2. Review implementation in `/lib/mfa.ts`
3. Check console for error messages
4. Verify database policies are correct

## References

- [Supabase MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa)
- [RFC 6238 - TOTP Specification](https://tools.ietf.org/html/rfc6238)
- [OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
