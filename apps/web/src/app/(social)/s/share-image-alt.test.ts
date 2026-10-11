// apps/web/src/app/(social)/s/share-image-alt.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The preview picture of a shared item is a fixed card for its kind, so its text alternative is the
// fixed description of that card — "FEED — Request for help" — on every share page, as both
// og:image:alt and twitter:image:alt. It describes what the picture shows; the item's own name and
// text travel in og:title / og:description. Runs the real generateMetadata of the five pages.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FilteringDb } from '@/lib/__tests__/filtering-db'

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://sourcetofeed.com' }))
vi.mock('@/components/feed/post-admin-edit-link', () => ({ PostAdminEditLink: () => null }))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => ({ status: 'loading', tier: null, adminOrgIds: null }) }))
vi.mock('@/lib/logger', () => ({
  logEvent: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/supabase/server', async () => {
  const { filteringDb } = await import('@/lib/__tests__/filtering-db')
  const fake = filteringDb()
  return { createClient: async () => fake.client, __db: fake }
})

import { generateMetadata as postMetadata } from './post/[id]/page'
import { generateMetadata as embedMetadata } from './embed/[id]/page'
import { generateMetadata as resourceMetadata } from './resource/[id]/page'
import { generateMetadata as businessMetadata } from './business/[id]/page'
import { generateMetadata as organizationMetadata } from './organization/[id]/page'
import * as serverClient from '@/lib/supabase/server'
import { POST_TYPE_VALUES } from '@/components/feed/post-model'
import { ogCardAlt, OG_CARD_KINDS, type OgCardKind } from '@/lib/og-card-kinds'

const db = (serverClient as unknown as { __db: FilteringDb }).__db
const ID = '11111111-1111-4111-8111-111111111111'
const params = Promise.resolve({ id: ID })

const AUTHOR = 'Fatima Zahra'
const TEXT = 'Free hot meals this Saturday at the community center.'
const PLACE = 'Riverside Pantry and Cafe'

type Images = Array<string | { url: string; alt?: string }>
function alts(meta: { openGraph?: unknown; twitter?: unknown }) {
  const og = (meta.openGraph as { images: Images }).images
  const tw = (meta.twitter as { images: Images }).images
  expect(og).toHaveLength(1)
  expect(tw).toHaveLength(1)
  const one = (i: Images[number]) => (typeof i === 'string' ? { url: i, alt: undefined } : i)
  return { og: one(og[0]), twitter: one(tw[0]) }
}

function post(postType: string) {
  return {
    id: ID,
    content: TEXT,
    lang: 'en',
    post_type: postType,
    petition_id: null,
    is_hidden: false,
    image_url: null,
    image_alt: null,
    like_count: 0,
    comment_count: 0,
    slots_remaining: null,
    max_seekers: null,
    user: { id: 'u1', first_name: AUTHOR, username: 'fatima', avatar_url: null, admin_tier: null },
    resource: null,
  }
}
const place = (orgType: string) => ({
  id: ID, name: PLACE, description: TEXT, org_type: orgType, status: 'approved', is_active: true, address: null, city: 'Rutland', state: 'VT',
  zip_code: null, phone: null, email: null, website: null, business_category: null, cost_model: null, attributes: {}, social_links: {}, location: null,
})

beforeEach(() => db.reset())

describe.each([
  ['/s/post', postMetadata],
  ['/s/embed', embedMetadata],
] as const)('%s: the picture is described by its card, for every post type', (_page, metadata) => {
  it.each(POST_TYPE_VALUES)('post type %s', async (postType) => {
    db.tables = { posts: [post(postType)] }
    const { og, twitter } = alts(await metadata({ params }))
    const expected = ogCardAlt(postType)
    expect(og.alt).toBe(expected)
    expect(twitter.alt).toBe(expected)
    expect(og.url).toBe(`https://sourcetofeed.com/api/og/post/${ID}`)
    expect(twitter.url).toBe(og.url)
    // the description is about the picture, not the post
    expect(expected).not.toContain(AUTHOR)
    expect(expected).not.toContain(TEXT.slice(0, 10))
  })

  it('a post type this build does not know is described as the community-post card', async () => {
    db.tables = { posts: [post('a_future_type')] }
    const { og, twitter } = alts(await metadata({ params }))
    expect(og.alt).toBe('FEED — Community post')
    expect(twitter.alt).toBe('FEED — Community post')
  })
})

describe('the place pages: the picture is described by its card', () => {
  it.each([
    ['/s/resource', 'resource', resourceMetadata, { resources: [{ id: ID, name: PLACE, description: TEXT, category: 'food', status: 'approved', city: 'Rutland', state: 'VT' }] }],
    ['/s/business', 'business', businessMetadata, { organizations: [place('business')] }],
    ['/s/organization', 'organization', organizationMetadata, { organizations: [place('food_bank')] }],
  ] as const)('%s → "FEED — …" for kind %s, on both tags', async (page, kind, metadata, tables) => {
    db.tables = tables as unknown as FilteringDb['tables']
    const meta = await metadata({ params })
    const { og, twitter } = alts(meta)
    expect(og.alt).toBe(ogCardAlt(kind as OgCardKind))
    expect(twitter.alt).toBe(ogCardAlt(kind as OgCardKind))
    expect(og.alt).not.toContain(PLACE)
    expect(og.url).toBe(`https://sourcetofeed.com/api/og${page.slice(2)}/${ID}`)
    expect(twitter.url).toBe(og.url)
    // the name is still what the preview is titled with
    expect(String((meta.openGraph as { title: string }).title)).toContain(PLACE)
  })
})

describe('control', () => {
  it('the ten descriptions are ten different strings beginning "FEED — "', () => {
    const all = OG_CARD_KINDS.map((k) => ogCardAlt(k))
    expect(new Set(all).size).toBe(10)
    for (const a of all) expect(a.startsWith('FEED — ')).toBe(true)
  })
})
