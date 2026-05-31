/**
 * Shared helpers for inbound federation edge functions.
 *
 * Provides:
 *   - serviceClient()  — Supabase admin client (auto-injected service_role in edge runtime)
 *   - corsHeaders()    — permissive CORS for server-to-server callers (signature-gated)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Build a Supabase admin client using the runtime-injected credentials.
 *
 * In the Supabase edge runtime SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * set automatically — no explicit secret management required.
 */
export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in edge runtime')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

/**
 * Permissive CORS headers for inbound federation endpoints.
 *
 * Callers are remote FEED instances (server-to-server); they pass a
 * Signature or X-Federation-Signature header, not a browser Origin.
 * We allow * here — the cryptographic gate (signature/HMAC) is the
 * actual auth boundary.
 *
 * Rate-limit Tier 0 note: the signature/HMAC gate rejects all
 * unsigned or unknown callers before any DB write occurs, providing
 * adequate protection while federation_peers = 0.
 * First-peer upgrade path: add Upstash Redis keyed by verified
 * instance.id once federation_peers > 0.
 */
export const FEDERATION_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Signature, Digest, Date, Host, Authorization, ' +
    'X-Federation-Signature, X-Federation-Event, User-Agent, ' +
    'x-original-host, x-original-target',
  'Access-Control-Max-Age': '86400',
}

/** Return a 204 OPTIONS preflight response. */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: FEDERATION_CORS_HEADERS })
}

/** Attach CORS headers to an existing response. */
export function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(FEDERATION_CORS_HEADERS)) {
    headers.set(k, v)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
