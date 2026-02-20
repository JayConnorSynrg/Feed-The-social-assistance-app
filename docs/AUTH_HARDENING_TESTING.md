# Authentication Hardening - Testing Guide

This document provides test procedures to validate the authentication hardening implementation.

## Prerequisites

1. **Local Supabase Running**
   ```bash
   npx supabase start
   ```

2. **Apply Migration**
   ```bash
   npx supabase db push
   ```

3. **Deploy Edge Functions**
   ```bash
   npx supabase functions deploy auth-guard
   npx supabase functions deploy validate-password
   ```

4. **Start Dev Server**
   ```bash
   npm run dev
   ```

## Test Suite

### 1. Password Strength Validation

#### Test 1.1: Client-Side Validation (Minimum Length)

**Steps:**
1. Navigate to `/signup`
2. Enter email: `test@example.com`
3. Enter password: `short` (5 characters)
4. Observe password strength indicator

**Expected:**
- Strength shows "weak" in red
- Feedback: "Password must be at least 12 characters"
- Submit button disabled

#### Test 1.2: Server-Side Validation (Common Password)

**Steps:**
1. Open browser console
2. Run:
   ```javascript
   fetch('/api/auth/validate-password', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ password: 'password123' })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
```json
{
  "valid": false,
  "score": 0-2,
  "strength": "weak",
  "feedback": ["This is a commonly used password - choose something more unique"]
}
```

#### Test 1.3: Strong Password

**Steps:**
1. Navigate to `/signup`
2. Enter password: `MySecur3P@ssw0rd!2024`
3. Observe password strength indicator

**Expected:**
- Strength shows "strong" in green
- Score: 5-6
- No error feedback
- Submit button enabled

### 2. Account Lockout System

#### Test 2.1: Progressive Lockout (Level 1)

**Setup:**
Create test account or use existing:
```sql
-- In Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('lockout-test@example.com', crypt('correctpassword', gen_salt('bf')), NOW());
```

**Steps:**
1. Navigate to `/login`
2. Enter email: `lockout-test@example.com`
3. Enter wrong password: `wrongpassword`
4. Click "Sign In"
5. Repeat steps 3-4 **five times** (within 15 minutes)

**Expected After 5th Failure:**
- Error message: "Account temporarily locked. Please try again in 15 minutes."
- Submit button shows "Locked - Wait 15 minutes"
- Cannot attempt login

**Verify in Database:**
```sql
SELECT * FROM account_lockouts WHERE email = 'lockout-test@example.com';
-- Should show lockout_level = 1, locked_until = NOW() + 15 minutes
```

#### Test 2.2: Lockout Check API

**Steps:**
1. Open browser console
2. Run:
   ```javascript
   fetch('/api/auth/check-lockout', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       action: 'check-lockout',
       email: 'lockout-test@example.com'
     })
   }).then(r => r.json()).then(console.log)
   ```

**Expected:**
```json
{
  "is_locked": true,
  "locked_until": "2026-02-14T15:30:00Z",
  "lockout_level": 1,
  "minutes_remaining": 14
}
```

#### Test 2.3: Successful Login Clears Lockout

**Steps:**
1. Wait for lockout to expire (or manually clear):
   ```sql
   DELETE FROM account_lockouts WHERE email = 'lockout-test@example.com';
   ```
2. Navigate to `/login`
3. Enter correct credentials
4. Click "Sign In"

**Expected:**
- Login succeeds
- Redirected to dashboard
- Lockout record removed from database

**Verify:**
```sql
SELECT * FROM account_lockouts WHERE email = 'lockout-test@example.com';
-- Should return 0 rows
```

### 3. Login Attempt Tracking

#### Test 3.1: Failed Attempt Recording

**Steps:**
1. Attempt login with wrong password (email: `test@example.com`, password: `wrong`)
2. Query database:
   ```sql
   SELECT * FROM auth_login_attempts
   WHERE email = 'test@example.com'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**Expected:**
- New row inserted
- `success = false`
- `failure_reason = 'invalid_credentials'`
- `ip_address` and `user_agent` populated

#### Test 3.2: Successful Attempt Recording

**Steps:**
1. Login with correct credentials
2. Query database:
   ```sql
   SELECT * FROM auth_login_attempts
   WHERE email = 'test@example.com'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected:**
- New row inserted
- `success = true`
- `failure_reason = null`

### 4. Session Management

#### Test 4.1: Session Recording (Manual Test)

**Note**: Session recording requires integration with login flow (future enhancement).

**Steps:**
1. Create session manager instance in login page:
   ```typescript
   import { sessionManager } from '@/lib/session-manager'

   // After successful login
   const { data: { session } } = await supabase.auth.getSession()
   if (session) {
     await sessionManager.recordSession(session.user.id, session.access_token)
   }
   ```

2. Login successfully
3. Query database:
   ```sql
   SELECT * FROM user_sessions WHERE user_id = 'YOUR_USER_ID';
   ```

**Expected:**
- Session recorded with device info
- `is_current = true`

#### Test 4.2: Multiple Sessions

**Steps:**
1. Login from Chrome
2. Login from Firefox (same user)
3. Query database

**Expected:**
- Two session records
- Chrome session: `is_current = false`
- Firefox session: `is_current = true`

### 5. Edge Cases & Security

#### Test 5.1: Bypass Client-Side Rate Limiting

**Steps:**
1. Open browser dev tools
2. Disable JavaScript
3. Attempt to submit login form 10 times rapidly

**Expected:**
- Server-side lockout still triggered after 5 attempts
- Account locked despite bypassing client-side checks

#### Test 5.2: SQL Injection Prevention

**Steps:**
1. Attempt login with email: `test@example.com' OR '1'='1`
2. Observe behavior

**Expected:**
- Login fails (no SQL injection)
- Attempt recorded safely
- No database errors

#### Test 5.3: Password Reset Flow (Future)

**Note**: Password reset with history checking is not yet implemented.

**Future Test:**
1. Request password reset
2. Set new password
3. Verify password history is recorded
4. Attempt to reuse old password
5. Should be rejected

### 6. Performance Tests

#### Test 6.1: Lockout Check Performance

**Steps:**
1. Run in browser console:
   ```javascript
   const start = performance.now()
   await fetch('/api/auth/check-lockout', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ action: 'check-lockout', email: 'test@example.com' })
   })
   const end = performance.now()
   console.log(`Lockout check took ${end - start}ms`)
   ```

**Expected:**
- Response time < 500ms
- No noticeable delay in login flow

#### Test 6.2: Database Query Performance

**Steps:**
1. Run in Supabase SQL Editor:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM auth_login_attempts
   WHERE email = 'test@example.com'
   AND created_at > NOW() - INTERVAL '15 minutes';
   ```

**Expected:**
- Uses index `idx_login_attempts_email_time`
- Execution time < 10ms

## Cleanup After Testing

```sql
-- Remove test lockouts
DELETE FROM account_lockouts WHERE email LIKE 'test%' OR email LIKE 'lockout-test%';

-- Remove test login attempts
DELETE FROM auth_login_attempts WHERE email LIKE 'test%' OR email LIKE 'lockout-test%';

-- Remove test sessions
DELETE FROM user_sessions WHERE device_info LIKE '%Test%';
```

## Automated Testing (Future)

Consider adding automated tests using:

1. **Playwright** for E2E testing
   ```typescript
   test('account locks after 5 failed attempts', async ({ page }) => {
     // Test implementation
   })
   ```

2. **Jest** for unit testing
   ```typescript
   describe('validatePasswordStrength', () => {
     it('rejects passwords shorter than 12 characters', () => {
       // Test implementation
     })
   })
   ```

## Monitoring Queries

Run these periodically to monitor security:

```sql
-- Failed logins in last hour
SELECT email, COUNT(*) as failures
FROM auth_login_attempts
WHERE success = false
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY email
HAVING COUNT(*) > 3
ORDER BY failures DESC;

-- Active lockouts
SELECT email, locked_until, lockout_level, attempt_count
FROM account_lockouts
WHERE locked_until > NOW()
ORDER BY locked_until DESC;

-- Suspicious login patterns (multiple IPs)
SELECT email, COUNT(DISTINCT ip_address) as ip_count
FROM auth_login_attempts
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY email
HAVING COUNT(DISTINCT ip_address) > 3
ORDER BY ip_count DESC;
```

## Issue Reporting

If any test fails, report with:
1. Test number and name
2. Steps taken
3. Expected vs actual behavior
4. Browser console logs
5. Database query results
6. Edge Function logs (via `npx supabase functions logs auth-guard`)

---

**Last Updated**: 2026-02-14
