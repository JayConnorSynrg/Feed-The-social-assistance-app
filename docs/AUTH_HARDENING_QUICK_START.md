# Authentication Hardening - Quick Start Guide

**5-Minute Setup for Testing**

## Prerequisites

- Docker Desktop running
- Node.js installed
- Supabase CLI installed

## Quick Deployment (Local Testing)

```bash
# 1. Start Supabase (requires Docker)
npx supabase start

# 2. Apply migration
npx supabase db push

# 3. Deploy Edge Functions
npx supabase functions deploy auth-guard
npx supabase functions deploy validate-password

# 4. Start development server
npm run dev

# 5. Open browser to http://localhost:3000/signup
```

## Quick Test

### Test 1: Password Validation (30 seconds)

1. Go to http://localhost:3000/signup
2. Enter password: `short` → Should show "weak" in red
3. Enter password: `MySecur3P@ssw0rd!` → Should show "strong" in green
4. ✅ **Pass**: Password validation working

### Test 2: Account Lockout (2 minutes)

1. Go to http://localhost:3000/login
2. Enter email: `test@example.com`
3. Enter wrong password: `wrongpassword`
4. Click "Sign In"
5. Repeat steps 3-4 **five times**
6. After 5th attempt: Should see "Account temporarily locked. Please try again in 15 minutes."
7. ✅ **Pass**: Account lockout working

### Test 3: Database Verification (30 seconds)

```sql
-- Open Supabase Studio: http://localhost:54323
-- Go to SQL Editor and run:

-- Check login attempts recorded
SELECT * FROM auth_login_attempts ORDER BY created_at DESC LIMIT 5;

-- Check lockout created
SELECT * FROM account_lockouts;
```

Expected:
- 5 rows in `auth_login_attempts` with `success = false`
- 1 row in `account_lockouts` with `lockout_level = 1`

✅ **Pass**: Database tracking working

## Common Issues

### Issue: "Cannot connect to Docker daemon"

**Solution:**
```bash
# Start Docker Desktop
open -a Docker

# Wait 30 seconds, then retry:
npx supabase start
```

### Issue: "Supabase is already running"

**Solution:**
```bash
# Just continue - this is fine
npx supabase db push
```

### Issue: Edge Function deployment fails

**Solution:**
```bash
# Check Supabase status
npx supabase status

# If running, redeploy:
npx supabase functions deploy auth-guard --no-verify-jwt
npx supabase functions deploy validate-password --no-verify-jwt
```

### Issue: "Account locked" but I want to test again

**Solution:**
```sql
-- In Supabase SQL Editor (http://localhost:54323)
DELETE FROM account_lockouts WHERE email = 'test@example.com';
```

## Verification Checklist

- [ ] Docker Desktop running
- [ ] Supabase started (`npx supabase status` shows services)
- [ ] Migration applied (4 new tables visible in Supabase Studio)
- [ ] Edge Functions deployed (`npx supabase functions list` shows both)
- [ ] Dev server running (`npm run dev`)
- [ ] Password validation working (signup page)
- [ ] Account lockout working (login page)
- [ ] Database records created (SQL queries)

## Next Steps

Once local testing passes:

1. **Read Full Documentation**
   - `/docs/AUTH_HARDENING_README.md` - Feature overview
   - `/docs/AUTH_HARDENING_TESTING.md` - Complete test suite
   - `/docs/AUTH_HARDENING_DEPLOYMENT.md` - Production deployment

2. **Deploy to Staging**
   - Link to staging project: `npx supabase link --project-ref STAGING_REF`
   - Push migration: `npx supabase db push`
   - Deploy functions: `npx supabase functions deploy auth-guard`

3. **Configure Supabase Dashboard**
   - Follow: `/docs/SUPABASE_AUTH_CONFIG.md`
   - Set session lifetimes, refresh token rotation

4. **Production Deployment**
   - Only after staging validation passes!
   - Follow: `/docs/AUTH_HARDENING_DEPLOYMENT.md`

## Support

**Quick Help:**
- View Edge Function logs: `npx supabase functions logs auth-guard`
- Check database: Open Supabase Studio at http://localhost:54323
- Read summary: `/AUTHENTICATION_HARDENING_SUMMARY.md`

**For Detailed Help:**
- Testing guide: `/docs/AUTH_HARDENING_TESTING.md`
- Deployment guide: `/docs/AUTH_HARDENING_DEPLOYMENT.md`
- Configuration guide: `/docs/SUPABASE_AUTH_CONFIG.md`

---

**Total Setup Time**: ~5 minutes
**Testing Time**: ~3 minutes
**Ready for**: Local validation → Staging → Production
