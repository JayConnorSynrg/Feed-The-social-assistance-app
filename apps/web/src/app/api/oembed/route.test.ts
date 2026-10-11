// apps/web/src/app/api/oembed/route.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// /api/oembed answers for FEED's own share links on both of its addresses — the apex and www (the
// apex redirects to www, so www is what a visitor copies) — and for nobody else's. Whichever of the
// two is submitted, the URLs in the response use the app's one canonical origin. Runs the real GET.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { state } = vi.hoisted(() => ({
  state: { appUrl: 'https://sourcetofeed.com', row: null as Record<string, unknown> | null, reads: 0 },
}))

vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => state.appUrl }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.single = async () => {
        state.reads++
        return state.row ? { data: state.row, error: null } : { data: null, error: { code: 'PGRST116' } }
      }
      return q
    },
  }),
}))

import { GET } from './route'

const ID = '11111111-1111-4111-8111-111111111111'
const ask = (url: string) =>
  GET(new NextRequest(`https://www.sourcetofeed.com/api/oembed?url=${encodeURIComponent(url)}`))

beforeEach(() => {
  state.appUrl = 'https://sourcetofeed.com'
  state.row = { id: ID, content: 'Pantry open Saturday', post_type: 'feed', petition_id: null, user: { first_name: 'Ada', username: 'ada' } }
  state.reads = 0
})

describe('/api/oembed: our own addresses', () => {
  it.each([
    ['the apex post link', `https://sourcetofeed.com/s/post/${ID}`],
    ['the apex embed link', `https://sourcetofeed.com/s/embed/${ID}`],
    ['the www post link', `https://www.sourcetofeed.com/s/post/${ID}`],
    ['the www embed link', `https://www.sourcetofeed.com/s/embed/${ID}`],
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

  it('a hidden or unknown post on our own address is still 404', async () => {
    state.row = null
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
    expect(state.reads).toBe(0)
  })
})
