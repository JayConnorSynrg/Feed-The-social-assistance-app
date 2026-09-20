/**
 * post-image-upload.test.ts
 *
 * The edge function returns tailored messages (413 size, 415 type, 403 guest)
 * as JSON bodies, but supabase-js wraps a non-2xx response as a
 * FunctionsHttpError whose `.context` is the raw Response — so the message is
 * only reachable by reading that Response. These tests assert the OUTCOME a user
 * sees: the tailored message is surfaced when present, and parsing failures fall
 * back cleanly to the generic path (null).
 */

import { describe, it, expect } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { extractEdgeErrorMessage } from '../post-image-upload'

function httpError(body: unknown, status = 400): FunctionsHttpError {
  const init = { status, headers: { 'Content-Type': 'application/json' } }
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  return new FunctionsHttpError(new Response(payload, init))
}

describe('extractEdgeErrorMessage — surfaces the edge fn tailored message', () => {
  it('surfaces the 413 "exceeds the 5MB limit" message', async () => {
    const msg = await extractEdgeErrorMessage(httpError({ error: 'Image exceeds the 5MB limit.' }, 413))
    expect(msg).toBe('Image exceeds the 5MB limit.')
  })

  it('surfaces the 415 "not a supported image" message', async () => {
    const msg = await extractEdgeErrorMessage(httpError({ error: 'That file is not a supported image.' }, 415))
    expect(msg).toBe('That file is not a supported image.')
  })

  it('surfaces the 403 guest-block message', async () => {
    const msg = await extractEdgeErrorMessage(
      httpError({ error: 'Create a free account to attach a photo.' }, 403)
    )
    expect(msg).toBe('Create a free account to attach a photo.')
  })

  it('returns null (→ generic fallback) when the body is not JSON', async () => {
    expect(await extractEdgeErrorMessage(httpError('<html>502</html>', 502))).toBeNull()
  })

  it('returns null when the JSON body has no usable error field', async () => {
    expect(await extractEdgeErrorMessage(httpError({ notError: 'x' }, 400))).toBeNull()
    expect(await extractEdgeErrorMessage(httpError({ error: '   ' }, 400))).toBeNull()
  })

  it('returns null for a non-FunctionsHttpError (e.g. a network error)', async () => {
    expect(await extractEdgeErrorMessage(new Error('network down'))).toBeNull()
    expect(await extractEdgeErrorMessage(null)).toBeNull()
  })
})
