# Federation Edge Function Migration Guide

**Priority:** HIGH
**Estimated Effort:** 3-4 hours
**Blockers:** None

## Overview

Migrate federation API routes from Next.js to Supabase Edge Functions to eliminate service role key exposure in client-accessible code.

## Routes to Migrate

### 1. Webhook Receiver
**Current:** `/apps/web/src/app/api/federation/webhook/route.ts`
**Target:** `supabase/functions/federation-webhook/index.ts`

**Required Functionality:**
- Validate HMAC signature
- Verify instance exists and is active
- Fetch resource from partner instance
- Upsert/delete federated_resources
- Log to federation_sync_log

**Environment Variables:**
```bash
FEDERATION_PRIVATE_KEY
NEXT_PUBLIC_APP_URL
```

**Dependencies:**
- `@feed/shared/lib/http-signatures` - Import signing utilities
- `crypto` (Deno) - For HMAC verification

### 2. Resources API
**Current:** `/apps/web/src/app/api/federation/resources/route.ts`
**Target:** `supabase/functions/federation-resources/index.ts`

**Required Functionality:**
- Verify HTTP signature
- Check trust level (minimum: pending)
- Filter resources (approved, verified)
- Extract PostGIS lat/lng
- Paginate with cursor
- Return unified format

**Dependencies:**
- HTTP signature verification
- PostGIS query support

### 3. Signature Verification Library
**Current:** `/apps/web/src/lib/federation/verify-federation.ts`
**Options:**
1. Create RPC function: `verify_federation_signature(keyId, signature, components)`
2. Inline into Edge Functions
3. Create shared Edge Function utility

**Recommended:** Create shared utility module for Edge Functions

## Implementation Steps

### Step 1: Create Edge Function Boilerplate

```bash
cd /Users/jelalconnor/CODING/CURSOR/FEED.
npx supabase functions new federation-webhook
npx supabase functions new federation-resources
```

### Step 2: Port Webhook Receiver

**File:** `supabase/functions/federation-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Validate HMAC signature (port from route.ts line 59-82)
  // 2. Parse and validate payload (port from route.ts line 87-166)
  // 3. Verify instance (port from route.ts line 467-503)
  // 4. Process event (port from route.ts line 230-345)
  // 5. Log result (port from route.ts line 350-403)

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Implementation here...
})
```

### Step 3: Port Resources API

**File:** `supabase/functions/federation-resources/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Verify HTTP signature
  // 2. Check trust level
  // 3. Parse query params
  // 4. Execute PostGIS query
  // 5. Format and return results

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Implementation here...
})
```

### Step 4: Create Shared Utilities

**File:** `supabase/functions/_shared/federation-auth.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function verifyFederationRequest(
  req: Request,
  supabaseUrl: string,
  supabaseKey: string
) {
  // Port from verify-federation.ts
  // Return verified instance or throw error
}

export function requireTrustLevel(
  instance: any,
  minimumLevel: string
): boolean {
  // Port from verify-federation.ts line 251-259
}
```

### Step 5: Update Next.js Routes

Replace existing routes with Edge Function calls:

**File:** `/apps/web/src/app/api/federation/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Forward to Edge Function
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/federation-webhook`

  const response = await fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'X-Federation-Signature': request.headers.get('X-Federation-Signature') || '',
      'X-Federation-Event': request.headers.get('X-Federation-Event') || '',
    },
    body: await request.text(),
  })

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: response.headers,
  })
}
```

### Step 6: Deploy Edge Functions

```bash
# Test locally
npx supabase functions serve federation-webhook
npx supabase functions serve federation-resources

# Deploy to production
npx supabase functions deploy federation-webhook
npx supabase functions deploy federation-resources

# Set environment variables
npx supabase secrets set FEDERATION_PRIVATE_KEY=xxx
```

### Step 7: Remove Service Role from Next.js

```bash
# Remove from .env.local
# SUPABASE_SERVICE_ROLE_KEY=xxx  # DELETE THIS LINE

# Verify build still works
npm run build
```

## Testing Plan

### Unit Tests
- [ ] HMAC signature verification
- [ ] HTTP signature verification
- [ ] Trust level checks
- [ ] Resource filtering

### Integration Tests
- [ ] Webhook receiver accepts valid webhooks
- [ ] Webhook receiver rejects invalid signatures
- [ ] Resources API returns correct data
- [ ] Resources API enforces trust levels
- [ ] Pagination works correctly

### Security Tests
- [ ] Service role key not accessible from browser
- [ ] Invalid signatures rejected
- [ ] Blocked instances cannot access
- [ ] RLS policies enforced on user routes

## Rollback Plan

1. Revert Next.js route changes
2. Re-add service role key to `.env.local`
3. Delete Edge Functions
4. Document issues for investigation

## Success Criteria

- [x] No service role key in Next.js codebase
- [ ] All federation routes functional
- [ ] No RLS bypasses in user-facing routes
- [ ] Security audit passes
- [ ] Performance maintained or improved

## References

- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [HTTP Signatures in Edge Functions](https://supabase.com/docs/guides/functions/examples/webhook-signatures)

## Notes

- Edge Functions run on Deno, not Node.js (different APIs)
- Use `esm.sh` for npm package imports
- Environment variables accessed via `Deno.env.get()`
- Service role key is safe in Edge Functions (server-side only)
- Consider caching instance public keys for performance
