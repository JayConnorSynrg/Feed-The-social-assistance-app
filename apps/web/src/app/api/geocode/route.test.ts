// apps/web/src/app/api/geocode/route.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// /api/geocode: signed-in non-guest only, Census Exact / Non_Exact / No_Match mapping, the 8 s
// timeout, and logs that never carry the address.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { getUser, logEvent } = vi.hoisted(() => ({ getUser: vi.fn(), logEvent: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser } }) }))
vi.mock('@/lib/logger', () => ({ logEvent }))

import { POST } from './route'
import { rateLimiter } from '@/middleware/federation-rate-limit'
import { buildBatchCsv, parseBatchResponse, parseCsvLine } from '@/lib/census-geocode'

const ADDRESS = { street: '128 Merchants Row', city: 'Rutland', state: 'VT', zip: '05701' }
const req = (body: unknown) =>
  new NextRequest('http://localhost/api/geocode', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9' },
    body: JSON.stringify(body),
  })
const EXACT = '"1","128 Merchants Row, Rutland, VT, 05701","Match","Exact","128 MERCHANTS ROW, RUTLAND, VT, 05701","-72.97291,43.60612","63052542","L"\n'
const APPROX = '"1","128 Merchants Row, Rutland, VT, 05701","Match","Non_Exact","100 MERCHANTS ROW, RUTLAND, VT, 05701","-72.9731,43.6060","63052542","R"\n'
const NOMATCH = '"1","nowhere, Rutland, VT, 05701","No_Match"\n'

const fetchMock = vi.fn()
beforeEach(() => {
  rateLimiter.clear()
  getUser.mockReset()
  logEvent.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  getUser.mockResolvedValue({ data: { user: { id: 'u1', is_anonymous: false } } })
})
afterEach(() => vi.unstubAllGlobals())

describe('auth', () => {
  it('401 when signed out, without calling the geocoder', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(req(ADDRESS))
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('403 for a guest (anonymous) session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'g', is_anonymous: true } } })
    const res = await POST(req(ADDRESS))
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Census mapping', () => {
  it('Exact -> exact with lng/lat', async () => {
    fetchMock.mockResolvedValue(new Response(EXACT, { status: 200 }))
    const res = await POST(req(ADDRESS))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      match: 'exact',
      lng: -72.97291,
      lat: 43.60612,
      matched_address: '128 MERCHANTS ROW, RUTLAND, VT, 05701',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://geocoding.geo.census.gov/geocoder/locations/addressbatch')
    expect((init.body as FormData).get('benchmark')).toBe('Public_AR_Current')
  })
  it('Non_Exact -> non_exact', async () => {
    fetchMock.mockResolvedValue(new Response(APPROX, { status: 200 }))
    expect((await (await POST(req(ADDRESS))).json()).match).toBe('non_exact')
  })
  it('No_Match -> none with null coordinates', async () => {
    fetchMock.mockResolvedValue(new Response(NOMATCH, { status: 200 }))
    expect(await (await POST(req(ADDRESS))).json()).toEqual({ match: 'none', lat: null, lng: null, matched_address: null })
  })
  it('400 without a street', async () => {
    const res = await POST(req({ city: 'Rutland' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('timeout + failure', () => {
  it('passes an 8 s abort signal and maps a timeout to 504', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockRejectedValue(Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' }))
    const res = await POST(req(ADDRESS))
    expect(spy).toHaveBeenCalledWith(8000)
    expect(res.status).toBe(504)
    expect(logEvent).toHaveBeenCalledWith('geocode.resolve', { outcome: 'timeout', source: 'census' })
    spy.mockRestore()
  })
  it('maps an upstream error status to 502', async () => {
    fetchMock.mockResolvedValue(new Response('busy', { status: 503 }))
    expect((await POST(req(ADDRESS))).status).toBe(502)
  })
})

describe('privacy', () => {
  it('logs outcome + source only — never the address text', async () => {
    fetchMock.mockResolvedValue(new Response(EXACT, { status: 200 }))
    await POST(req(ADDRESS))
    expect(logEvent).toHaveBeenCalledWith('geocode.resolve', { outcome: 'exact', source: 'census' })
    const logged = JSON.stringify(logEvent.mock.calls)
    for (const part of [ADDRESS.street, 'Merchants', 'MERCHANTS', ADDRESS.zip, '-72.97']) expect(logged).not.toContain(part)
  })
})

describe('rate limit', () => {
  it('429 after 30 requests from one user in a minute', async () => {
    fetchMock.mockImplementation(async () => new Response(NOMATCH, { status: 200 }))
    for (let i = 0; i < 30; i++) expect((await POST(req(ADDRESS))).status).toBe(200)
    expect((await POST(req(ADDRESS))).status).toBe(429)
  })
})

describe('CSV helpers', () => {
  it('quotes fields and escapes embedded quotes', () => {
    expect(buildBatchCsv({ street: '1 "A" St', city: 'X', state: 'VT', zip: '' })).toBe('"1","1 ""A"" St","X","VT",""\n')
    expect(parseCsvLine('"a","b, c","d""e"')).toEqual(['a', 'b, c', 'd"e'])
  })
  it('rejects a Match row with unusable coordinates', () => {
    expect(parseBatchResponse('"1","x","Match","Exact","X","bad","1","L"').match).toBe('none')
    expect(parseBatchResponse('"1","x","Tie"').match).toBe('none')
    expect(parseBatchResponse('').match).toBe('none')
  })
})
