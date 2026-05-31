/**
 * Federation Webhook Proxy
 *
 * Thin proxy to the federation-inbox edge function.
 * No service_role key — all privileged logic lives in the edge function.
 *
 * Forwards the X-Federation-Signature and X-Federation-Event headers
 * verbatim. The edge function performs HMAC verification and processes
 * the event (upsert / delete federated_resources + sync log insert).
 *
 * Adds two passthrough headers:
 *   x-original-host   — original Host (informational for the edge fn)
 *   x-original-target — "POST /api/federation/webhook"
 */

import { NextRequest, NextResponse } from 'next/server'

const EDGE_FN_URL =
  process.env.FEDERATION_INBOX_EDGE_URL ??
  'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/federation-inbox'

const PROXY_TIMEOUT_MS = 30_000

/**
 * OPTIONS handler — CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, X-Federation-Signature, X-Federation-Event, User-Agent',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * POST handler — proxy to federation-inbox edge function
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const originalHost = request.headers.get('host') ?? url.host

  const forwardHeaders: Record<string, string> = {
    'x-original-host': originalHost,
    'x-original-target': `POST ${url.pathname}`,
    'Content-Type': 'application/json',
  }

  // Forward HMAC auth + event headers
  const fedSig = request.headers.get('x-federation-signature')
  if (fedSig) forwardHeaders['x-federation-signature'] = fedSig

  const fedEvent = request.headers.get('x-federation-event')
  if (fedEvent) forwardHeaders['x-federation-event'] = fedEvent

  const userAgent = request.headers.get('user-agent')
  if (userAgent) forwardHeaders['user-agent'] = userAgent

  // Read body once and forward raw
  const bodyText = await request.text()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const edgeResponse = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: forwardHeaders,
      body: bodyText,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const body = await edgeResponse.text()
    return new NextResponse(body, {
      status: edgeResponse.status,
      headers: {
        'Content-Type': edgeResponse.headers.get('content-type') ?? 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    clearTimeout(timeoutId)
    return NextResponse.json(
      {
        error: 'Federation proxy error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
}
