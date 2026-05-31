/**
 * Federation Single-Resource Proxy
 *
 * Thin proxy to the federation-resources edge function for single-resource GET.
 * No service_role key — all privileged logic lives in the edge function.
 *
 * The edge function detects a UUID final segment on x-original-target and
 * handles it as a single-resource lookup (same handler, different code path).
 */

import { NextRequest, NextResponse } from 'next/server'

const EDGE_FN_URL =
  process.env.FEDERATION_RESOURCES_EDGE_URL ??
  'https://ndtpovonpadugthmcntl.supabase.co/functions/v1/federation-resources'

const PROXY_TIMEOUT_MS = 30_000

/**
 * OPTIONS handler — CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Signature, Digest, Date',
      'Access-Control-Max-Age': '86400',
    },
  })
}

/**
 * GET handler — proxy to federation-resources edge function
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const originalHost = request.headers.get('host') ?? url.host
  // Preserve the full path including the resource id so the edge fn can parse it
  const originalTarget = `GET ${url.pathname}${url.search}`

  const forwardHeaders: Record<string, string> = {
    'x-original-host': originalHost,
    'x-original-target': originalTarget,
  }

  const signature = request.headers.get('signature')
  if (signature) forwardHeaders['signature'] = signature

  const date = request.headers.get('date')
  if (date) forwardHeaders['date'] = date

  const digest = request.headers.get('digest')
  if (digest) forwardHeaders['digest'] = digest

  const authorization = request.headers.get('authorization')
  if (authorization) forwardHeaders['authorization'] = authorization

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const edgeResponse = await fetch(EDGE_FN_URL, {
      method: 'GET',
      headers: forwardHeaders,
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
