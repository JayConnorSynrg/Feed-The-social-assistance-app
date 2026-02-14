# Service Role Key Security Audit & Remediation

**Date:** 2026-02-14
**Severity:** HIGH
**Status:** PARTIALLY REMEDIATED

## Executive Summary

The FEED platform was using the Supabase service role key in Next.js API routes accessible from the browser. This bypasses Row Level Security (RLS) policies and creates security vulnerabilities.

## Files Audited

### ✅ FIXED - User-Facing Routes

#### 1. `/apps/web/src/app/api/search/federated/route.ts`
- **Previous Issue:** Used service role key for authenticated user searches
- **Risk:** Bypassed RLS, allowed users to access non-public resources
- **Fix Applied:**
  - Switched to authenticated Supabase client from `@/lib/supabase/server`
  - Added user authentication check
  - Now respects RLS policies
- **Lines Changed:** 19, 243-268

#### 2. `/apps/web/src/app/.well-known/webfinger/route.ts`
- **Previous Issue:** Used service role key to count resources
- **Risk:** Unnecessary admin access for public endpoint
- **Fix Applied:**
  - Switched to anon key with explicit status filter
  - RLS enforces public-only access
- **Lines Changed:** 17, 24, 26-28

### ⚠️ DOCUMENTED - Federation Routes (Requires Migration)

The following routes legitimately need admin access for external federation but should be moved to Supabase Edge Functions:

#### 3. `/apps/web/src/app/api/federation/webhook/route.ts`
- **Current Status:** Uses service role key (lines 243, 358)
- **Justification:**
  - Receives unauthenticated webhooks from external federation instances
  - Authentication via HMAC signature verification (not user sessions)
  - Needs admin access to insert federated resources
- **Security Controls:**
  - HMAC signature verification (line 460)
  - Instance verification against database
  - Timestamp validation (max 5 minutes old)
  - UUID format validation
- **Recommendation:** Move to Supabase Edge Function
- **Risk Level:** MEDIUM (protected by HMAC, but service role in Next.js is anti-pattern)

#### 4. `/apps/web/src/app/api/federation/resources/route.ts`
- **Current Status:** Uses service role key (lines 150-151)
- **Justification:**
  - Serves resources to verified federation partners
  - Protected by HTTP signature verification (`withFederationAuth`)
  - Only returns approved, verified resources (SQL filter line 175)
  - Requires trust level check
- **Security Controls:**
  - HTTP signature verification via `withFederationAuth`
  - Trust level enforcement
  - Only approved/verified resources exposed
- **Recommendation:** Move to Supabase Edge Function
- **Risk Level:** MEDIUM (protected by HTTP signatures)

#### 5. `/apps/web/src/lib/federation/verify-federation.ts`
- **Current Status:** Uses service role key (lines 65, 100)
- **Justification:**
  - Verifies HTTP signatures from external federation peers
  - Needs to look up instance public keys
  - Updates last_seen_at timestamp
- **Recommendation:** Create dedicated RPC function or move to Edge Function
- **Risk Level:** MEDIUM (library function, not directly exposed)

## Remediation Plan

### Phase 1: COMPLETED ✅
- [x] Fix user-facing search endpoint to use authenticated client
- [x] Fix webfinger endpoint to use anon key
- [x] Document security rationale for remaining service role usage
- [x] Add TODO comments for Edge Function migration

### Phase 2: HIGH PRIORITY (Next Sprint)
Move federation routes to Supabase Edge Functions:

1. **Create Edge Function: `federation-webhook-receiver`**
   - Handles webhook processing
   - HMAC verification
   - Resource upsert/delete

2. **Create Edge Function: `federation-resources-api`**
   - Serves resources to federation partners
   - HTTP signature verification
   - Trust level enforcement

3. **Create RPC Function: `verify_federation_signature`**
   - Verifies HTTP signatures
   - Returns instance details if valid
   - Eliminates need for service role in Next.js

### Phase 3: VALIDATION
- [ ] Remove service role key from Next.js environment
- [ ] Update all federation routes to call Edge Functions
- [ ] Run security audit
- [ ] Penetration testing on federation endpoints

## Security Best Practices

### ✅ DO
- Use authenticated Supabase client for user-facing routes
- Implement RLS policies on all tables
- Use Edge Functions for admin operations
- Validate all external input (HMAC, HTTP signatures)
- Log security events

### ❌ DON'T
- Expose service role key in Next.js API routes
- Bypass RLS for user data access
- Trust external input without verification
- Use service role for operations that can use RLS

## Testing Checklist

- [x] Federated search returns only accessible resources
- [x] Webfinger returns correct resource counts
- [ ] Webhook receiver validates HMAC correctly
- [ ] Resources API enforces trust levels
- [ ] Service role is not accessible from browser

## Additional Findings

### Other Service Role Usage
No additional service role key usage found in:
- `/apps/web/src/middleware/`
- `/apps/web/src/app/`
- `/apps/web/src/lib/supabase/` (correctly uses anon key)

### Environment Variables
Confirmed that `SUPABASE_SERVICE_ROLE_KEY` is:
- [x] In `.env.local` (not committed)
- [x] Not exposed via `NEXT_PUBLIC_` prefix
- [ ] Should be removed after Edge Function migration

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [HTTP Signatures Spec](https://datatracker.ietf.org/doc/html/draft-cavage-http-signatures)

## Sign-off

**Security Reviewer:** Claude (AI Agent)
**Date:** 2026-02-14
**Next Review:** After Edge Function migration
