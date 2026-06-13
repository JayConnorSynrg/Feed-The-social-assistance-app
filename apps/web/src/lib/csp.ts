/**
 * Per-request CSP nonce + policy builder (Wave 6b).
 *
 * Owns the Content-Security-Policy that was previously declared statically in
 * next.config.ts `async headers()`. CSP is now stamped per-request by the
 * proxy (apps/web/src/proxy.ts) so each response carries a fresh single-use
 * nonce. This removes production `script-src 'unsafe-inline'` as an
 * inline-script execution grant.
 *
 * Mechanism (Next.js 16.2.6, official docs — content-security-policy.mdx,
 * https://nextjs.org/docs/app/guides/content-security-policy, fetched via
 * context7 /vercel/next.js/v16.2.2, 2026):
 *   The proxy sets `script-src 'nonce-<n>' 'strict-dynamic'` on BOTH the
 *   forwarded REQUEST header `Content-Security-Policy` and the RESPONSE
 *   header. Next.js reads the nonce out of the REQUEST CSP header
 *   (getScriptNonceFromHeader in server/render.tsx) and auto-applies it to
 *   every framework/hydration script, page bundle, inline style/script, and
 *   <Script> component. The browser enforces the RESPONSE header.
 *
 * 'unsafe-inline' DROP DECISION (web.dev "Mitigate XSS with a strict CSP",
 * https://web.dev/articles/strict-csp): with a nonce + 'strict-dynamic'
 * present, CSP3-capable browsers IGNORE 'unsafe-inline' and host allowlists
 * entirely — so keeping 'unsafe-inline' would NOT weaken modern browsers, but
 * it also buys nothing here: FEED targets evergreen browsers and ships no
 * hand-written inline scripts (all inline scripts are Next hydration scripts,
 * which the nonce covers). We therefore DROP 'unsafe-inline' from script-src
 * outright. This makes the policy fail-closed: a browser too old to honor the
 * nonce gets no inline-script execution at all, rather than silently falling
 * back to 'unsafe-inline'. style-src KEEPS 'unsafe-inline' (Tailwind runtime
 * utility classes; style injection cannot execute JS in compliant browsers).
 *
 * The host allowlist (va.vercel-scripts.com, challenges.cloudflare.com) is
 * retained in script-src for the same back-compat reason: 'strict-dynamic'
 * makes CSP3 browsers ignore it, while CSP2-only browsers still get the
 * allowlist. Both are loaded programmatically by already-trusted bundle code
 * (Vercel Analytics injector; @marsidev/react-turnstile script injection), so
 * 'strict-dynamic' propagates trust to them on modern browsers.
 *
 * ACCEPTED COST: a per-request nonce forces dynamic rendering on matched
 * routes (no static optimization / ISR / PPR). This is inherent to nonce-based
 * CSP and is intentional — see the matched routes in proxy.ts `config.matcher`.
 */

const isDev = process.env.NODE_ENV === 'development'

/**
 * Generate a fresh, single-use base64 nonce using Web Crypto, which is
 * available in the Edge/Node proxy runtime. crypto.randomUUID() yields 122
 * bits of entropy; base64-encoding it produces the token form CSP expects.
 */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}

export interface BuildCspOptions {
  /** true → the public embed-widget policy (/s/embed/:id); false → main app. */
  embed?: boolean
}

/**
 * Build the full Content-Security-Policy string for one request.
 *
 * Only script-src is rewritten to the nonce + strict-dynamic form. Every other
 * directive is preserved byte-for-byte from the pre-Wave-6b next.config.ts
 * policy for the relevant profile (main vs embed).
 */
export function buildCsp(nonce: string, { embed = false }: BuildCspOptions = {}): string {
  if (embed) {
    return [
      "default-src 'self'",
      // Embed has no third-party script hosts; nonce + strict-dynamic only.
      `script-src 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self'",
      // Allow any origin to embed this widget in an iframe.
      'frame-ancestors *',
      "base-uri 'self'",
      "form-action 'none'",
    ].join('; ')
  }

  return [
    "default-src 'self'",
    // nonce + strict-dynamic replaces the old 'unsafe-inline'. The host
    // allowlist stays as a CSP2 back-compat fallback (ignored by CSP3 browsers
    // under strict-dynamic). 'unsafe-eval' is dev-only (React Fast Refresh).
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.mapbox.com https://va.vercel-scripts.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "font-src 'self'",
    // Turnstile renders its challenge in an iframe from challenges.cloudflare.com.
    'frame-src https://challenges.cloudflare.com',
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
