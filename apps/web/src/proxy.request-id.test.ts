// proxy.request-id.test.ts — the proxy forwards and echoes only a well-formed
// x-request-id; caller text outside /^[A-Za-z0-9-]{1,64}$/ is replaced by a UUID.
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

import { proxy } from './proxy'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function idFor(inbound: string | null): Promise<string | null> {
  const headers: Record<string, string> = {}
  if (inbound !== null) headers['x-request-id'] = inbound
  const res = await proxy(new NextRequest('http://localhost/s/resource/1', { headers }))
  return res.headers.get('x-request-id')
}

describe('proxy x-request-id', () => {
  it('replaces an attacker-supplied id with a fresh UUID', async () => {
    const attack = '<script>alert(1)</script>' + 'a@b.org'.repeat(70)
    const id = await idFor(attack)
    expect(id).toMatch(UUID)
    expect(id).not.toBe(attack)
  })

  it.each([['<b>x</b>'], ['a@b.org'], ['abc_123'], ['a b']])('replaces a short id with a disallowed character: %s', async (bad) => {
    const id = await idFor(bad)
    expect(id).toMatch(UUID)
    expect(id).not.toBe(bad)
  })

  it('replaces an over-long id (65 chars)', async () => {
    expect(await idFor('a'.repeat(65))).toMatch(UUID)
  })

  it('control: reuses a well-formed inbound id', async () => {
    expect(await idFor('rid-abc-123')).toBe('rid-abc-123')
  })

  it('mints a UUID when none is sent', async () => {
    expect(await idFor(null)).toMatch(UUID)
  })
})
