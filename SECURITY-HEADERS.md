# Security Headers Implementation

This document describes the security headers implemented in the FEED platform.

## Implementation Date
2026-02-14

## Changes Made

### 1. Next.js Security Headers (apps/web/next.config.ts)

Added comprehensive security headers to all routes:

#### Content Security Policy (CSP)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

**Rationale:**
- `script-src 'unsafe-inline' 'unsafe-eval'`: Required for Next.js in dev mode and some UI libraries. For production, consider implementing nonces.
- `style-src 'unsafe-inline'`: Required for Tailwind CSS and Radix UI components that inject inline styles.
- `img-src`: Allows images from Supabase storage and Mapbox tiles.
- `connect-src`: Allows API calls to Supabase (REST + Realtime) and Mapbox.
- `frame-ancestors 'none'`: Prevents clickjacking attacks (same as X-Frame-Options: DENY).

#### HTTP Strict Transport Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Forces HTTPS for 1 year, including all subdomains. The `preload` directive allows inclusion in browser HSTS preload lists.

#### Additional Security Headers
- `X-DNS-Prefetch-Control: off` - Disables DNS prefetching to prevent information leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=()` - Restricts browser features (updated to include payment restriction)

### 2. Edge Function CORS Restriction

**Files Updated:**
- `/supabase/functions/chat/index.ts`
- `/supabase/functions/sync-211/index.ts`
- `/supabase/functions/federation-sync/index.ts`
- `/supabase/functions/federation-webhook/index.ts`
- `/supabase/functions/federation-health-check/index.ts`

**Changes:**
Replaced wildcard CORS (`Access-Control-Allow-Origin: *`) with origin validation:

```typescript
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'capacitor://localhost',  // Mobile app (iOS)
  'http://localhost',       // Mobile app (Android webview)
  'ionic://localhost',      // Ionic dev
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] // Default to APP_URL

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}
```

Each Edge Function now:
1. Reads the `Origin` header from the incoming request
2. Validates it against the allowed origins list
3. Returns the matching origin (or default to APP_URL)
4. Includes `Access-Control-Allow-Credentials: true` for authenticated requests

## Environment Variables Required

For production deployment, set the following environment variable:

```bash
APP_URL=https://your-production-domain.com
```

This will be used as:
1. The primary allowed CORS origin for Edge Functions
2. The default origin when no matching origin is found

## Testing

### Local Development
Security headers work correctly in development:
- ✅ Next.js build passes
- ✅ CSP allows localhost resources
- ✅ CORS allows localhost:3000, Capacitor, and Ionic origins
- ✅ Mapbox map rendering works
- ✅ Supabase auth flows work

### Production Checklist
Before deploying to production:

1. **Set APP_URL environment variable** in Supabase Edge Functions
   ```bash
   # In Supabase Dashboard > Settings > Environment Variables
   APP_URL=https://feed.app
   ```

2. **Verify CSP doesn't block resources**
   - Check browser console for CSP violations
   - Test all features: auth, map, images, API calls

3. **Test mobile app CORS**
   - Run iOS build and verify Edge Function calls work
   - Run Android build and verify Edge Function calls work

4. **Verify HSTS works**
   - Access site via HTTPS
   - Check response headers include `Strict-Transport-Security`
   - Verify HTTP redirects to HTTPS

## Security Benefits

### Before Implementation
- ❌ No CSP - vulnerable to XSS attacks
- ❌ No HSTS - vulnerable to SSL stripping attacks
- ❌ Wildcard CORS - any website could call Edge Functions
- ❌ DNS prefetching enabled - potential information leakage

### After Implementation
- ✅ CSP prevents unauthorized script execution and data exfiltration
- ✅ HSTS enforces HTTPS for all connections
- ✅ CORS restricted to app domains only
- ✅ DNS prefetching disabled
- ✅ Additional browser feature restrictions via Permissions-Policy

## Known Limitations

1. **CSP uses 'unsafe-inline' and 'unsafe-eval'**
   - Required for Next.js and UI libraries
   - Future improvement: Implement CSP nonces for scripts
   - Future improvement: Remove 'unsafe-eval' if possible

2. **Mobile origin validation**
   - Capacitor apps use custom origins (`capacitor://localhost`)
   - These are added to allowed origins list
   - Consider adding dynamic origin validation based on app signature

3. **Federation webhook origins**
   - Federation webhooks from other FEED instances won't match CORS origins
   - These endpoints should validate via signature instead of CORS
   - Current implementation allows default APP_URL for unmatched origins

## Future Improvements

1. **Implement CSP nonces** for inline scripts (requires Next.js middleware)
2. **Add Subresource Integrity (SRI)** for external dependencies
3. **Implement Certificate Transparency** monitoring
4. **Add Rate Limiting** headers to Edge Functions
5. **Implement API key rotation** for external services
6. **Add Security.txt** file for vulnerability disclosure

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [MDN Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [W3C CORS Specification](https://www.w3.org/TR/cors/)
