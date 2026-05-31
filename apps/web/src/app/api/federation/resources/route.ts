/**
 * Federation Resources Proxy
 *
 * Thin proxy to the federation-resources edge function.
 * No service_role key — all privileged logic lives in the edge function.
 *
 * Forwards the original Signature, Date, Digest headers so the edge
 * function can verify the cavage HTTP Signature that the caller produced.
 *
 * Adds two passthrough headers required for correct signature verification:
 *   x-original-host   — the Host value the signer used (this request's host)
 *   x-original-target — "<METHOD> <path+query>" the signer used
 *
 * The edge function reconstructs the exact signing string from these.
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
  const originalTarget = `GET ${url.pathname}${url.search}`

  const forwardHeaders: Record<string, string> = {
    'x-original-host': originalHost,
    'x-original-target': originalTarget,
  }

  // Forward cavage auth headers
  const signature = request.headers.get('signature')
  if (signature) forwardHeaders['signature'] = signature

  const date = request.headers.get('date')
  if (date) forwardHeaders['date'] = date

  const digest = request.headers.get('digest')
  if (digest) forwardHeaders['digest'] = digest

  const authorization = request.headers.get('authorization')
  if (authorization) forwardHeaders['authorization'] = authorization

  // Forward query string to edge function
  const edgeUrl = new URL(EDGE_FN_URL)
  url.searchParams.forEach((v, k) => edgeUrl.searchParams.set(k, v))

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    const edgeResponse = await fetch(edgeUrl.toString(), {
      method: 'GET',
      headers: forwardHeaders,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const body = await edgeResponse.text()
    const responseHeaders: Record<string, string> = {
      'Content-Type': edgeResponse.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    }

    return new NextResponse(body, {
      status: edgeResponse.status,
      headers: responseHeaders,
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
