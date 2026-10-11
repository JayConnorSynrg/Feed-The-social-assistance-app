// apps/web/src/app/api/oembed/route.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// /api/oembed answers for FEED's own share links on both of its addresses — the apex and www (the
// apex redirects to www, so www is what a visitor copies) — and for nobody else's. Whichever of the
// two is submitted, the URLs in the response use the app's one canonical origin and the id of the
// post row the database returned. Runs the real GET against a stand-in that applies the route's
// filters (lib/__tests__/filtering-db.ts), so a lookup finds a post only by its exact id.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FilteringDb } from '@/lib/__tests__/filtering-db'

const { state } = vi.hoisted(() => ({
  state: { appUrl: 'https://sourcetofeed.com', client: null as unknown },
}))

vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => state.appUrl }))
vi.mock('@/lib/supabase/server', async () => {
  const { filteringDb } = await import('@/lib/__tests__/filtering-db')
  const fake = filteringDb()
  return { createClient: async () => state.client ?? fake.client, __db: fake }
})

import { GET } from './route'
import * as serverClient from '@/lib/supabase/server'

const db = (serverClient as unknown as { __db: FilteringDb }).__db

const ID = '11111111-1111-4111-8111-1111aaaabbbb'
const POST = { id: ID, content: 'Pantry open Saturday', post_type: 'feed', petition_id: null, is_hidden: false, user: { first_name: 'Ada', username: 'ada' } }

const ask = (url: string, extra = '') =>
  GET(new NextRequest(`https://www.sourcetofeed.com/api/oembed?url=${encodeURIComponent(url)}${extra}`))

beforeEach(() => {
  state.appUrl = 'https://sourcetofeed.com'
  state.client = null
  db.reset()
  db.tables = { posts: [POST] }
})
afterEach(() => vi.unstubAllEnvs())

describe('/api/oembed: our own addresses', () => {
  it.each([
    ['the apex post link', `https://sourcetofeed.com/s/post/${ID}`],
    ['the apex embed link', `https://sourcetofeed.com/s/embed/${ID}`],
    ['the www post link', `https://www.sourcetofeed.com/s/post/${ID}`],
    ['the www embed link', `https://www.sourcetofeed.com/s/embed/${ID}`],
    ['a link with a trailing slash', `https://www.sourcetofeed.com/s/post/${ID}/`],
    ['a link with a query string and a fragment', `https://www.sourcetofeed.com/s/post/${ID}?utm=x#top`],
  ])('%s is answered 200', async (_label, url) => {
    const res = await ask(url)
    expect(res.status).toBe(200)
    expect((await res.json()).type).toBe('rich')
  })

  it('www and apex get the same body: every URL in it uses the one canonical origin', async () => {
    const apex = await (await ask(`https://sourcetofeed.com/s/post/${ID}`)).json()
    const www = await (await ask(`https://www.sourcetofeed.com/s/post/${ID}`)).json()
    expect(www).toEqual(apex)
    expect(www.provider_url).toBe('https://sourcetofeed.com')
    expect(www.thumbnail_url).toBe(`https://sourcetofeed.com/api/og/post/${ID}`)
    expect(www.html).toContain(`src="https://sourcetofeed.com/s/embed/${ID}"`)
    expect(JSON.stringify(www)).not.toContain('www.sourcetofeed.com')
  })

  it('when the app itself is configured on www, the apex link is accepted too', async () => {
    state.appUrl = 'https://www.sourcetofeed.com'
    const res = await ask(`https://sourcetofeed.com/s/post/${ID}`)
    expect(res.status).toBe(200)
    expect((await res.json()).provider_url).toBe('https://www.sourcetofeed.com')
  })

  it.each([
    ['a hidden post', [{ ...POST, is_hidden: true }]],
    ['an unknown id', []],
  ])('%s on our own address is 404', async (_label, rows) => {
    db.tables = { posts: rows }
    const res = await ask(`https://www.sourcetofeed.com/s/post/${ID}`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Post not found' })
  })
})

describe('/api/oembed: everyone else is refused', () => {
  it.each([
    ['a foreign origin', `https://evil.example/s/post/${ID}`],
    ['our name as a subdomain of another site', `https://www.sourcetofeed.com.evil.example/s/post/${ID}`],
    ['a host that merely ends with our name', `https://evilsourcetofeed.com/s/post/${ID}`],
    ['our name in the userinfo of another host', `https://sourcetofeed.com@evil.example/s/post/${ID}`],
    ['a different subdomain of ours', `https://admin.sourcetofeed.com/s/post/${ID}`],
    ['www twice', `https://www.www.sourcetofeed.com/s/post/${ID}`],
    ['plain http', `http://www.sourcetofeed.com/s/post/${ID}`],
    ['another port', `https://www.sourcetofeed.com:8443/s/post/${ID}`],
  ])('%s → 400, and the post is never looked up', async (_label, url) => {
    const res = await ask(url)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL origin does not match this provider' })
    expect(db.reads).toHaveLength(0)
  })
})

describe('/api/oembed: the localhost allowance is for development only', () => {
  const LOCAL = [
    ['http://localhost', `http://localhost/s/post/${ID}`],
    ['http://localhost with a port', `http://localhost:3000/s/post/${ID}`],
    ['https://localhost', `https://localhost/s/post/${ID}`],
    ['http://127.0.0.1 with a port', `http://127.0.0.1:3000/s/embed/${ID}`],
  ] as const

  it.each(LOCAL)('in production, %s → 400 and no lookup', async (_label, url) => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = await ask(url)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL origin does not match this provider' })
    expect(db.reads).toHaveLength(0)
  })

  it.each(LOCAL)('in development, %s is answered 200 with canonical URLs', async (_label, url) => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = await ask(url)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.thumbnail_url).toBe(`https://sourcetofeed.com/api/og/post/${ID}`)
    expect(JSON.stringify(body)).not.toMatch(/localhost|127\.0\.0\.1/)
  })

  it.each([
    ['a host that ends with localhost', `http://evil-localhost/s/post/${ID}`],
    ['localhost as a subdomain label of another site', `http://localhost.evil.example/s/post/${ID}`],
    ['a subdomain of localhost', `http://app.localhost/s/post/${ID}`],
    ['another loopback address', `http://127.0.0.2/s/post/${ID}`],
    ['127.0.0.1 as a prefix of another host', `http://127.0.0.1.evil.example/s/post/${ID}`],
    ['IPv6 loopback', `http://[::1]/s/post/${ID}`],
    ['localhost over another scheme', `ftp://localhost/s/post/${ID}`],
  ])('in development, %s → 400 (exact host names only)', async (_label, url) => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = await ask(url)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'URL origin does not match this provider' })
    expect(db.reads).toHaveLength(0)
  })
})

describe('/api/oembed: the path is exactly /s/post/<uuid> or /s/embed/<uuid>', () => {
  const PATH_ERROR = { error: 'URL does not match a supported FEED embed or post path (/s/embed/{id} or /s/post/{id})' }

  it.each([
    ['a prefix before /s', `/x/s/post/${ID}`],
    ['a segment after the id', `/s/post/${ID}/edit`],
    ['characters after the id', `/s/post/${ID}abc`],
    ['two trailing slashes', `/s/post/${ID}//`],
    ['another surface', `/s/resource/${ID}`],
    ['a similar surface name', `/s/posts/${ID}`],
    ['a different letter case in the route', `/S/Post/${ID}`],
    ['36 dashes', `/s/post/${'-'.repeat(36)}`],
    ['a non-hex character', `/s/post/${ID.replace('a', 'g')}`],
    ['hex in the wrong grouping', `/s/post/1111111-11111-4111-8111-1111aaaabbbb`],
    ['an id that is too short', `/s/post/${ID.slice(0, 35)}`],
    ['no id', '/s/post/'],
  ])('%s → 400 and no lookup', async (_label, path) => {
    const res = await ask(`https://www.sourcetofeed.com${path}`)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual(PATH_ERROR)
    expect(db.reads).toHaveLength(0)
  })

  it('an id written in uppercase is the same post: looked up in lowercase, answered with the stored id', async () => {
    const res = await ask(`https://www.sourcetofeed.com/s/post/${ID.toUpperCase()}`)
    expect(res.status).toBe(200)
    expect(db.reads[0].filters).toContainEqual({ op: 'eq', column: 'id', value: ID })
    const body = await res.json()
    expect(body.thumbnail_url).toBe(`https://sourcetofeed.com/api/og/post/${ID}`)
    expect(body.html).toContain(`src="https://sourcetofeed.com/s/embed/${ID}"`)
    expect(JSON.stringify(body)).not.toContain(ID.toUpperCase())
  })

  it('both response URLs carry the id of the row the database returned, not the submitted text', async () => {
    // a database that answers every lookup with its own row, whatever id was asked for
    const STORED = '99999999-9999-4999-8999-999999999999'
    const q: Record<string, unknown> = {}
    Object.assign(q, { select: () => q, eq: () => q, single: async () => ({ data: { ...POST, id: STORED }, error: null }) })
    state.client = { from: () => q }
    const body = await (await ask(`https://www.sourcetofeed.com/s/post/${ID}`)).json()
    expect(body.thumbnail_url).toBe(`https://sourcetofeed.com/api/og/post/${STORED}`)
    expect(body.html).toContain(`src="https://sourcetofeed.com/s/embed/${STORED}"`)
    expect(JSON.stringify(body)).not.toContain(ID)
  })
})

describe('/api/oembed: maxwidth and maxheight', () => {
  const sized = async (extra: string) => (await ask(`https://www.sourcetofeed.com/s/post/${ID}`, extra)).json()

  it.each([
    ['not sent', '', 480, 270],
    ['smaller than the default', '&maxwidth=300&maxheight=200', 300, 200],
    ['larger than the default', '&maxwidth=99999&maxheight=99999', 480, 270],
    ['one pixel', '&maxwidth=1&maxheight=1', 1, 1],
    ['negative', '&maxwidth=-5&maxheight=-1', 480, 270],
    ['zero', '&maxwidth=0&maxheight=0', 480, 270],
    ['not a number', '&maxwidth=abc&maxheight=', 480, 270],
    ['a fraction', '&maxwidth=300.9&maxheight=200.2', 300, 200],
    ['only a width', '&maxwidth=120', 120, 270],
  ])('%s → %s', async (_label, extra, width, height) => {
    const body = await sized(extra)
    expect({ width: body.width, height: body.height }).toEqual({ width, height })
    expect(body.html).toContain(`width="${width}" height="${height}"`)
  })

  it('the iframe never carries a negative or zero size', async () => {
    for (const extra of ['&maxwidth=-5', '&maxheight=-5', '&maxwidth=0&maxheight=0', '&maxwidth=-0', '&maxwidth=-999999999999']) {
      const body = await sized(extra)
      expect(body.width).toBeGreaterThanOrEqual(1)
      expect(body.height).toBeGreaterThanOrEqual(1)
      expect(body.html).not.toMatch(/(width|height)="(-|0")/)
    }
  })
})
