# 🚨 SECURITY ALERT - IMMEDIATE ACTION REQUIRED

## Critical Security Issue

**Status**: ACTIVE CREDENTIALS EXPOSED
**Severity**: CRITICAL
**Date Discovered**: 2026-02-11

## Issue

The file `apps/web/.env.local` contains **live production credentials** that may be visible in the repository or file system:

- Supabase production URL and keys
- Supabase service role key (admin access)
- Supabase access token
- Mapbox production token

## Immediate Actions Required

### 1. Rotate All Credentials (URGENT - Do this NOW)

#### Supabase
1. Go to https://app.supabase.com/project/_/settings/api
2. Click "Reset anon key" and "Reset service role key"
3. Update `.env.local` with new keys
4. Click "Revoke all tokens" in Access Tokens section

#### Mapbox
1. Go to https://account.mapbox.com/access-tokens/
2. Delete the exposed token
3. Create a new token
4. Update `.env.local` with new token

### 2. Verify .gitignore (IMPORTANT)

Check that `.env.local` is in .gitignore:

```bash
grep ".env.local" .gitignore
```

Should return:
```
.env.local
.env*.local
```

✅ This is already configured correctly in this repository.

### 3. Check Git History (CRITICAL)

If credentials were ever committed to git:

```bash
# Search git history for exposed keys
git log -S "SUPABASE_SERVICE_ROLE_KEY" --all
git log -S "NEXT_PUBLIC_MAPBOX_TOKEN" --all
```

If found in history:
```bash
# Use git-filter-repo to remove sensitive data
pip install git-filter-repo
git-filter-repo --path apps/web/.env.local --invert-paths
```

**WARNING**: This rewrites git history. Coordinate with team first.

### 4. Check GitHub (If repository is pushed)

If this code is on GitHub:

1. **Make repository private immediately** (Settings → Danger Zone → Change visibility)
2. **Rotate all credentials** (as above)
3. **Check "Security" tab** for exposed secrets alerts
4. **Review commit history** for any credential commits
5. **Force push after filtering** (if credentials were committed)

### 5. Monitor for Abuse

After rotating credentials:

1. **Supabase**: Check Auth logs for unauthorized logins
2. **Mapbox**: Check usage dashboard for unexpected traffic
3. **Set up alerts** for unusual activity

## Prevention Measures

### Add Pre-commit Hooks

Install pre-commit hooks to prevent future leaks:

```bash
npm install --save-dev husky lint-staged

# Initialize husky
npx husky init

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run check-secrets"
```

Add to `package.json`:
```json
{
  "scripts": {
    "check-secrets": "git diff --cached --name-only | grep -E '\\.env' && echo 'ERROR: Attempting to commit .env file' && exit 1 || exit 0"
  }
}
```

### Use Environment Variable Validation

Add startup validation in `apps/web/src/app/layout.tsx`:

```typescript
// Validate required env vars on startup
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}
```

### Use Supabase Vault for Secrets

For Edge Functions, use Supabase Vault:

```typescript
// Instead of process.env.FIREWORKS_API_KEY
const { data: secret } = await supabase.rpc('vault.get_secret', {
  secret_name: 'fireworks_api_key'
})
```

## Checklist

Before considering this issue resolved:

- [ ] All Supabase keys rotated
- [ ] Mapbox token rotated
- [ ] .env.local verified in .gitignore
- [ ] Git history checked for credentials
- [ ] GitHub repository set to private (if applicable)
- [ ] Pre-commit hooks installed
- [ ] Environment validation added
- [ ] Team notified of credential rotation
- [ ] Auth logs monitored for 7 days
- [ ] This file deleted after issue resolved

## Questions?

Contact: security@feedplatform.org

---

**This file should be deleted after the security issue is resolved.**
