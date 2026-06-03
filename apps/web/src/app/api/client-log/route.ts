import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withRateLimit } from '@/middleware/federation-rate-limit'

// Maximum body size accepted — prevents oversized payloads from being logged.
const MAX_BODY_BYTES = 4096
// Only accept these log levels from the client.
const ALLOWED_LEVELS = new Set(['warn', 'error'])

/**
 * POST /api/client-log
 *
 * Accepts client-side log events and persists them to app_logs using the
 * service-role client (server-only). No auth required — this is a write-only
 * append sink. Client input is sanitized and size-capped before insertion.
 *
 * Body: { level: 'warn'|'error', event: string, context?: object }
 */
export const POST = withRateLimit(async (req: NextRequest): Promise<NextResponse> => {
  try {
    // Size-cap: reject anything over MAX_BODY_BYTES
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 })
    }

    let body: unknown
    try {
      const text = await req.text()
      if (text.length > MAX_BODY_BYTES) {
        return NextResponse.json({ ok: false, error: 'payload_too_large' }, { status: 413 })
      }
      body = JSON.parse(text)
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
    }

    const { level, event, context } = body as Record<string, unknown>

    // Validate level
    if (typeof level !== 'string' || !ALLOWED_LEVELS.has(level)) {
      return NextResponse.json({ ok: false, error: 'invalid_level' }, { status: 400 })
    }

    // Validate event — must be a non-empty string, max 200 chars
    if (typeof event !== 'string' || !event.trim() || event.length > 200) {
      return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 })
    }

    // Sanitize context — only accept plain objects; never trust nested depth
    let sanitizedContext: Record<string, unknown> | undefined
    if (context !== null && context !== undefined) {
      if (typeof context === 'object' && !Array.isArray(context)) {
        // Shallow copy; stringify/parse caps value lengths and removes functions
        try {
          const json = JSON.stringify(context)
          if (json.length <= MAX_BODY_BYTES) {
            sanitizedContext = JSON.parse(json) as Record<string, unknown>
            // Tag as client-originated so queries can filter by source
            sanitizedContext._source = 'client'
          }
        } catch {
          // Non-serializable context — drop it; the event still gets logged
        }
      }
    } else {
      sanitizedContext = { _source: 'client' }
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
      // Supabase not configured in this environment — accept the request but
      // skip the insert (e.g. local dev without service role key).
      return NextResponse.json({ ok: true, sink: 'noop' })
    }

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error: insertError } = await client
      .from('app_logs')
      .insert({
        level: level as 'warn' | 'error',
        event: event.trim(),
        context: sanitizedContext,
      })

    if (insertError) {
      // Log to console (Vercel Log Drain) but do not expose DB errors to client
      console.error(JSON.stringify({ level: 'error', message: 'client-log.insert_failed', error: insertError.message }))
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ level: 'error', message: 'client-log.route_error', error: msg }))
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}, 'resource-api')
