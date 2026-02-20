# Authentication Hardening - Deployment Checklist

Complete deployment and validation checklist for the authentication hardening system.

## Pre-Deployment Validation

### 1. Database Migration

**File**: `/supabase/migrations/20260214240000_add_auth_hardening.sql`

**Apply Migration:**
```bash
# Start Docker Desktop (required for Supabase local)
# Then:
npx supabase start
npx supabase db push
```

**Verify Tables Created:**
```sql
-- In Supabase SQL Editor or CLI
\dt auth_login_attempts
\dt account_lockouts
\dt user_sessions
\dt password_history

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('auth_login_attempts', 'account_lockouts', 'user_sessions');

-- Verify functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'cleanup_%';
```

**Expected Output:**
- 4 tables created
- 5 indexes created
- 4 cleanup functions created
- 1 helper function (is_account_locked)

### 2. Edge Functions Deployment

**Files:**
- `/supabase/functions/auth-guard/index.ts`
- `/supabase/functions/validate-password/index.ts`

**Deploy:**
```bash
# Deploy both functions
npx supabase functions deploy auth-guard
npx supabase functions deploy validate-password

# Verify deployment
npx supabase functions list
```

**Test Edge Functions:**
```bash
# Test auth-guard (check-lockout)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-guard \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"check-lockout","email":"test@example.com"}'

# Expected: {"is_locked":false}

# Test validate-password
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/validate-password \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"short"}'

# Expected: {"valid":false,"score":1,"strength":"weak","feedback":[...]}
```

### 3. API Routes

**Files Created:**
- `/apps/web/src/app/api/auth/check-lockout/route.ts`
- `/apps/web/src/app/api/auth/validate-password/route.ts`
- `/apps/web/src/app/api/client-ip/route.ts`

**Verify:**
```bash
# Start dev server
npm run dev

# Test API routes (in browser console or curl)
fetch('/api/auth/check-lockout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'check-lockout', email: 'test@example.com' })
}).then(r => r.json()).then(console.log)

# Expected: {"is_locked":false}
```

### 4. Client-Side Integration

**Files Modified:**
- `/apps/web/src/app/(auth)/login/page.tsx` - Server-side lockout check
- `/apps/web/src/app/(auth)/signup/page.tsx` - 12-character minimum
- `/apps/web/src/lib/security.ts` - Password validation updated

**Verify:**
1. Navigate to `/signup`
2. Try password `short` - should show error "Password must be at least 12 characters"
3. Try password `MySecur3P@ssw0rd!` - should show "strong" in green
4. Navigate to `/login`
5. Try 5 wrong passwords - should trigger lockout

### 5. TypeScript Compilation

**Check:**
```bash
npm run build
```

**If Errors:**
- Most NextJS/React type errors are configuration-related
- Focus on our specific files:
  - `security.ts` - should compile cleanly
  - `session-manager.ts` - should compile cleanly
  - API routes - should compile cleanly

## Deployment Steps

### Step 1: Deploy to Staging

1. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(auth): Add authentication hardening system

   - Progressive account lockout (5/10/20 failures)
   - Password policy enforcement (12-char minimum)
   - Session tracking and management
   - Login attempt audit logging
   - Server-side validation via Edge Functions
   "
   git push origin develop
   ```

2. **Deploy to Vercel Staging**
   - Vercel will auto-deploy from `develop` branch
   - Wait for deployment to complete

3. **Apply Migration to Staging Supabase**
   ```bash
   # Connect to staging project
   npx supabase link --project-ref YOUR_STAGING_REF

   # Push migration
   npx supabase db push

   # Deploy Edge Functions to staging
   npx supabase functions deploy auth-guard --project-ref YOUR_STAGING_REF
   npx supabase functions deploy validate-password --project-ref YOUR_STAGING_REF
   ```

4. **Verify Staging**
   - Visit staging URL: https://your-app-staging.vercel.app/login
   - Test lockout flow (5 failed attempts)
   - Test password validation (weak vs strong)
   - Check database for recorded attempts

### Step 2: Configure Supabase Settings

Follow `/docs/SUPABASE_AUTH_CONFIG.md`:

1. **Navigate to Supabase Dashboard**
   - Project: YOUR_STAGING_PROJECT
   - Authentication > Settings

2. **Update Session Settings**
   ```
   Access Token Lifetime: 900 (15 minutes)
   Refresh Token Lifetime: 604800 (7 days)
   Refresh Token Rotation: ✓ Enabled
   Refresh Token Reuse Interval: 10 (seconds)
   ```

3. **Save Changes**

### Step 3: Run Tests

Follow `/docs/AUTH_HARDENING_TESTING.md`:

1. **Test Password Validation**
   - Weak password rejected
   - Strong password accepted
   - Common password rejected

2. **Test Account Lockout**
   - 5 failures → 15-min lock
   - Lockout expires correctly
   - Successful login clears attempts

3. **Test Session Tracking** (manual for now)
   - Session recorded on login
   - Device info captured
   - IP address logged

4. **Test Performance**
   - Lockout check < 500ms
   - Password validation < 300ms
   - No UI lag

### Step 4: Monitor and Iterate

1. **Set Up Monitoring**
   ```sql
   -- Create a view for security dashboard
   CREATE VIEW security_dashboard AS
   SELECT
     (SELECT COUNT(*) FROM account_lockouts WHERE locked_until > NOW()) as active_lockouts,
     (SELECT COUNT(*) FROM auth_login_attempts WHERE success = false AND created_at > NOW() - INTERVAL '1 hour') as failed_logins_last_hour,
     (SELECT COUNT(DISTINCT email) FROM auth_login_attempts WHERE created_at > NOW() - INTERVAL '24 hours') as active_users_24h,
     (SELECT COUNT(*) FROM user_sessions WHERE last_active_at > NOW() - INTERVAL '24 hours') as active_sessions_24h;
   ```

2. **Schedule Cleanup**
   - Set up daily cron job or scheduled Edge Function
   - Call cleanup functions:
     ```sql
     SELECT cleanup_old_login_attempts();
     SELECT cleanup_expired_lockouts();
     SELECT cleanup_inactive_sessions();
     ```

3. **Monitor Logs**
   ```bash
   # View Edge Function logs
   npx supabase functions logs auth-guard --project-ref YOUR_REF
   npx supabase functions logs validate-password --project-ref YOUR_REF
   ```

### Step 5: Deploy to Production

**Only after staging validation passes!**

1. **Merge to Main**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Apply to Production Supabase**
   ```bash
   npx supabase link --project-ref YOUR_PRODUCTION_REF
   npx supabase db push
   npx supabase functions deploy auth-guard --project-ref YOUR_PRODUCTION_REF
   npx supabase functions deploy validate-password --project-ref YOUR_PRODUCTION_REF
   ```

3. **Configure Production Settings**
   - Repeat Step 2 for production project

4. **Announce to Users**
   - Email notification about enhanced security
   - Inform about 12-character password requirement
   - Mention account lockout for failed attempts

## Post-Deployment Monitoring

### Week 1: Intensive Monitoring

**Daily Checks:**
```sql
-- Failed login patterns
SELECT email, COUNT(*) as failures
FROM auth_login_attempts
WHERE success = false
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY email
ORDER BY failures DESC
LIMIT 10;

-- Lockout activity
SELECT COUNT(*) as total_lockouts,
       AVG(attempt_count) as avg_attempts,
       MAX(lockout_level) as max_level
FROM account_lockouts
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Session activity
SELECT COUNT(*) as total_sessions,
       COUNT(DISTINCT user_id) as unique_users
FROM user_sessions
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**User Feedback:**
- Monitor support tickets for lockout issues
- Track complaints about password requirements
- Collect feedback on session management

### Month 1: Optimization

**Review Metrics:**
- False positive lockout rate (legitimate users locked out)
- Attack mitigation effectiveness (actual attacks blocked)
- User friction (password reset rate, support tickets)

**Tune Settings if Needed:**
- Adjust lockout thresholds (currently 5/10/20)
- Modify lockout durations (currently 15min/1hr/24hr)
- Refine password requirements (currently 12-char minimum)

## Rollback Plan

If critical issues arise:

### Emergency Rollback

1. **Disable Lockout Enforcement**
   ```sql
   -- Temporarily clear all lockouts
   DELETE FROM account_lockouts;

   -- Or disable specific email
   DELETE FROM account_lockouts WHERE email = 'affected-user@example.com';
   ```

2. **Revert Password Minimum**
   - Update signup form placeholder to "At least 8 characters"
   - Change `minLength={12}` to `minLength={8}`
   - Update `validatePasswordStrength()` to accept 8+ chars

3. **Full Code Rollback**
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main

   # Or rollback to specific version in Vercel dashboard
   ```

## Success Criteria

System is considered successfully deployed when:

- [ ] All tables created without errors
- [ ] Edge Functions deploy and respond correctly
- [ ] API routes return expected responses
- [ ] Client-side lockout works (5 failures = locked)
- [ ] Password validation enforces 12-character minimum
- [ ] No increase in support tickets (beyond expected)
- [ ] No performance degradation (< 500ms API response)
- [ ] Session tracking captures device/IP correctly
- [ ] Cleanup functions run without errors
- [ ] No security vulnerabilities introduced

## Documentation Updates

After successful deployment:

- [ ] Update main README with security features
- [ ] Add to changelog: `CHANGELOG.md`
- [ ] Document in user-facing help: "Why is my account locked?"
- [ ] Create internal runbook for support team
- [ ] Update security audit documentation

## Support Runbook

For support team handling lockout inquiries:

**Issue**: User says "My account is locked"

**Steps:**
1. Verify lockout in database:
   ```sql
   SELECT * FROM account_lockouts WHERE email = 'user@example.com';
   ```

2. Check failed attempts:
   ```sql
   SELECT * FROM auth_login_attempts
   WHERE email = 'user@example.com'
   AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

3. If legitimate user:
   ```sql
   -- Clear lockout
   DELETE FROM account_lockouts WHERE email = 'user@example.com';

   -- Log in support notes
   ```

4. If suspicious activity:
   - Review IP addresses and user agents
   - Consider password reset requirement
   - Enable MFA for account

---

**Deployment Owner**: Security Team
**Last Updated**: 2026-02-14
**Status**: Ready for Staging Deployment
