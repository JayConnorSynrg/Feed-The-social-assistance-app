// route.hash.test.ts — petitions signed before post editing still verify.
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Before post editing the wizard stored a petition draft's body HTML-escaped (sanitizeInput) and
// hashed that escaped body; now it stores and hashes the raw text. A signature binds to a petition by
// copying the STORED petitions.body_version_hash (route.ts — the route never reads the body and never
// re-escapes anything). Proven here with a pre-change fixture whose body contains characters
// sanitizeInput changes (& < > " '):
//   1. the hash is a pure function of the body exactly as stored (the drafts' formula, byte for byte);
//   2. the sign route stamps the stored hash verbatim on the signature, for an old and a new petition;
//   3. re-escaping at verify time WOULD break old petitions — the thing nothing does.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { sanitizeInput } from '@/lib/security'
import { petitionBodyHash } from '@/lib/petition-hash'

const h = vi.hoisted(() => ({
  petition: null as null | { id: string; body: string; body_version_hash: string; status: string },
  inserted: [] as Array<Record<string, unknown>>,
}))

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'signer', is_anonymous: false } }, error: null }) } }),
}))
vi.mock('@supabase/supabase-js', () => {
  const q = (data: () => unknown) => {
    const o: Record<string, unknown> = {}
    o.select = () => o
    o.eq = () => o
    o.abortSignal = () => o
    o.single = async () => ({ data: data(), error: null })
    return o
  }
  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === 'petitions') return q(() => h.petition)
        if (table === 'profiles') return q(() => ({ first_name: 'Ada', username: 'ada', full_name: 'Ada L' }))
        if (table === 'petition_signatures') return { insert: async (row: Record<string, unknown>) => (h.inserted.push(row), { error: null }) }
        return q(() => null)
      },
      rpc: async () => ({ data: 1, error: null }),
    }),
  }
})

import { POST } from '../route'

/** The formula every draft used, before and after this change (post-type-wizard.tsx), byte for byte. */
const DRAFT_FORMULA = (stored: string) => btoa(unescape(encodeURIComponent(stored))).slice(0, 32)

const RAW = `Free bus passes "now" & <today>'s fares`
/** What a pre-change draft stored: the escaped body. */
const PRE_CHANGE_BODY = sanitizeInput(RAW)
const PRE_CHANGE_HASH = DRAFT_FORMULA(PRE_CHANGE_BODY)

const sign = () =>
  POST({ json: async () => ({ petitionId: 'pet', affirmed: true }), headers: { get: () => null } } as unknown as Parameters<typeof POST>[0])

beforeEach(() => {
  h.inserted.length = 0
})

describe('petition hash continuity across the raw-text change', () => {
  it('the fixture really is one sanitizeInput changed', () => {
    expect(PRE_CHANGE_BODY).not.toBe(RAW)
    expect(PRE_CHANGE_BODY).toContain('&amp;')
  })

  it('the hash is a pure function of the body as stored (the drafts’ formula)', () => {
    expect(petitionBodyHash(PRE_CHANGE_BODY)).toBe(PRE_CHANGE_HASH)
    expect(petitionBodyHash(RAW)).toBe(DRAFT_FORMULA(RAW))
  })

  it('a petition drafted BEFORE the change: the signature carries its stored hash, which matches its stored body', async () => {
    h.petition = { id: 'pet', body: PRE_CHANGE_BODY, body_version_hash: PRE_CHANGE_HASH, status: 'approved' }
    expect((await sign()).status).toBe(200)
    expect(h.inserted).toHaveLength(1)
    expect(h.inserted[0].petition_version_hash).toBe(PRE_CHANGE_HASH)
    expect(h.inserted[0].petition_version_hash).toBe(petitionBodyHash(h.petition.body))
  })

  it('a petition drafted AFTER the change (raw body) verifies the same way', async () => {
    h.petition = { id: 'pet', body: RAW, body_version_hash: petitionBodyHash(RAW), status: 'approved' }
    await sign()
    expect(h.inserted[0].petition_version_hash).toBe(petitionBodyHash(h.petition.body))
  })

  it('re-escaping at verify time would break old petitions — so nothing re-escapes', () => {
    expect(petitionBodyHash(sanitizeInput(PRE_CHANGE_BODY))).not.toBe(PRE_CHANGE_HASH)
    const route = fs.readFileSync(path.resolve(__dirname, '../route.ts'), 'utf8')
    expect(route).toContain('petition_version_hash: petition.body_version_hash,')
    expect(route).not.toMatch(/sanitizeInput|petitionBodyHash/)
  })

  it('the wizard hashes exactly the body it stores (no escaping on either side)', () => {
    const wizard = fs.readFileSync(path.resolve(__dirname, '../../../../../components/panels/post-type-wizard.tsx'), 'utf8')
    expect(wizard).toMatch(/const body = description\.trim\(\)\s+const bodyVersionHash = petitionBodyHash\(body\)/)
    expect(wizard).toMatch(/\.insert\(\{[^}]*\bbody,[^}]*body_version_hash: bodyVersionHash/)
    expect(wizard).not.toMatch(/sanitizeInput/)
  })
})
