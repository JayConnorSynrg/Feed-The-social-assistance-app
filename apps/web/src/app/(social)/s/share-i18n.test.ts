// apps/web/src/app/(social)/s/share-i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W8 — a signed-out visitor reads every public share page in their own language. The language
// is the request's, by the one rule the root layout uses (lib/request-locale-server.ts: the
// feed_locale cookie, else Accept-Language, else English). Renders the real server pages and their
// generateMetadata with the request's cookie and headers mocked:
//   - each page's root carries lang/dir of the visitor's locale (the root layout wraps every page in
//     lang="en"), Korean text in Korean, Arabic right-to-left, no English chrome left;
//   - what members wrote (names, descriptions, addresses, services, bios, eligibility) is marked
//     lang="" dir="auto", never the visitor's language; the post's own text keeps posts.lang;
//   - metadata reads in the visitor's language; the preview picture's description stays the
//     picture's own English words (lib/og-card-labels.mjs);
//   - a missing row is still notFound() in every locale; Label in Name holds in all 14 locales;
//   - the page sources use logical properties only (Arabic mirrors them).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FilteringDb } from '@/lib/__tests__/filtering-db'

const h = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  acceptLanguage: null as string | null,
  rpc: {} as Record<string, unknown>,
  business: null as Record<string, unknown> | null,
  hours: [] as unknown[],
  services: [] as unknown[],
  photos: [] as unknown[],
  orgResources: [] as unknown[],
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'feed_locale' && h.cookie !== undefined ? { name, value: h.cookie } : undefined) }),
  headers: async () => ({ get: (name: string) => (name === 'accept-language' ? h.acceptLanguage : null) }),
}))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => createElement('img', { src: props.src, alt: props.alt }),
}))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://sourcetofeed.com' }))
vi.mock('@/components/feed/post-admin-edit-link', () => ({ PostAdminEditLink: () => null }))
vi.mock('@/components/admin/client-admin-edit-link', () => ({ ClientAdminEditLink: () => null }))
vi.mock('@/lib/logger', () => ({
  logEvent: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/supabase/server', async () => {
  const { filteringDb } = await import('@/lib/__tests__/filtering-db')
  const fake = filteringDb()
  return {
    createClient: async () => ({ from: fake.client.from, rpc: async (fn: string) => ({ data: h.rpc[fn] ?? [], error: null }) }),
    __db: fake,
  }
})
vi.mock('@/lib/business-data', () => ({
  fetchApprovedBusinessById: async () => (h.business ? { ...h.business, org_type: 'business' } : null),
  fetchBusinessHours: async () => h.hours,
  fetchBusinessServices: async () => h.services,
  fetchBusinessPhotos: async () => h.photos,
}))
vi.mock('@/lib/org-data', () => ({
  fetchOrganizationById: async () => h.business,
  fetchOrgResources: async () => h.orgResources,
}))

import * as serverClient from '@/lib/supabase/server'
import { messages, type Locale } from '@/lib/i18n'
import { shareMessages, shareT } from '@/lib/i18n-share'
import { ogCardAlt } from '@/lib/og-card-kinds'
import { decodeEntities } from '@/test/markup-text'
import SocialLayout, { generateMetadata as layoutMetadata } from '../layout'
import SharedPostPage, { generateMetadata as postMetadata } from './post/[id]/page'
import EmbedWidgetPage, { generateMetadata as embedMetadata } from './embed/[id]/page'
import BusinessPage, { generateMetadata as businessMetadata } from './business/[id]/page'
import OrganizationPage, { generateMetadata as orgMetadata } from './organization/[id]/page'
import ResourcePage, { generateMetadata as resourceMetadata } from './resource/[id]/page'
import DonatePage, { generateMetadata as donateMetadata } from './donate/[id]/page'

const db = (serverClient as unknown as { __db: FilteringDb }).__db
const LOCALES = Object.keys(messages) as Locale[]
const ID = '11111111-1111-4111-8111-111111111111'
const params = Promise.resolve({ id: ID })

const NAME = 'Maria Lopez'
const BIO = 'Neighbor and gardener.'
const PLACE = 'Riverside Pantry'
const DESCRIPTION = 'Fresh food every Tuesday.'
const ADDRESS = '1 Main St'

function seed() {
  db.reset()
  h.rpc = { get_donation_handles: [{ paypal_email: 'maria@example.org', venmo_username: 'maria' }], get_petition_signature_count: 12 }
  db.tables.posts = [{
    id: ID, content: 'Free meals Saturday.', lang: 'es', post_type: 'feed', petition_id: null, is_hidden: false,
    image_url: 'https://img.example/p.jpg', image_alt: null, like_count: 3, comment_count: 1, slots_remaining: 2, max_seekers: 5,
    user: { id: 'u1', first_name: NAME, username: 'maria', avatar_url: null, admin_tier: 'moderator' },
    resource: null,
  }]
  db.tables.resources = [{
    id: ID, name: PLACE, description: DESCRIPTION, category: 'food', status: 'approved', address_line1: ADDRESS, city: 'Rutland',
    state: 'VT', zip_code: '05701', phone: '555-0100', website: 'https://pantry.example', hours_of_operation: 'Tue 9-5',
    eligibility_requirements: 'Open to all',
  }]
  db.tables.profiles = [{ id: ID, first_name: NAME, username: 'maria', avatar_url: null, bio: BIO }]
  h.business = {
    id: ID, name: PLACE, description: DESCRIPTION, org_type: 'food_bank', address: ADDRESS, city: 'Rutland', state: 'VT',
    zip_code: '05701', phone: '555-0100', email: 'hello@example.org', website: 'https://pantry.example',
    business_category: 'food', cost_model: null, attributes: { wifi: true }, social_links: {}, location: null,
  }
  h.hours = [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }]
  h.services = [{ name: 'Tax help', description: 'Free filing', sort_order: 0 }]
  h.photos = [{ kind: 'gallery', url: 'https://img.example/g.jpg', caption: null, storage_path: 'g1' }]
  h.orgResources = [{ id: 'r1', name: 'Hot meals', category: 'mental_health' }]
}

const PAGES = {
  post: () => SharedPostPage({ params }),
  embed: () => EmbedWidgetPage({ params }),
  business: () => BusinessPage({ params }),
  organization: () => OrganizationPage({ params }),
  resource: () => ResourcePage({ params }),
  donate: () => DonatePage({ params }),
} as const
type PageName = keyof typeof PAGES

// FEED's own words each page shows with the fixture above (the keys the page reads from lib/i18n-share.ts).
const WORDS: Record<PageName, Array<keyof typeof shareMessages.en>> = {
  post: ['tagline', 'postImage', 'supportBody', 'joinFeed', 'joinBody'],
  embed: ['optInOnFeed', 'poweredBy'],
  business: ['localBusiness', 'visitWebsite', 'call', 'email', 'businessFeatures', 'exploreMore', 'exploreBody'],
  organization: ['localOrganization', 'visitWebsite', 'call', 'email', 'resourcesOffered', 'exploreMore', 'exploreBody'],
  resource: ['communityResource', 'hoursInFeed', 'eligibility', 'viewDetails', 'viewDetailsBody'],
  donate: ['mutualAid', 'supportBody', 'openFeed', 'donateCtaBody'],
}

async function html(page: PageName): Promise<string> {
  return renderToStaticMarkup(await PAGES[page]())
}
/** The opening tag of a page's root element (React hoists image preload <link>s before it). */
const rootTag = (markup: string) => {
  const body = markup.replace(/^(<link\b[^>]*\/?>)+/, '')
  return body.slice(0, body.indexOf('>') + 1)
}
/** The opening tag of the element whose text content is exactly `text`. */
function tagAround(markup: string, text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
  const end = markup.indexOf(`>${escaped}<`)
  expect(end, `an element containing exactly: ${text}`).toBeGreaterThan(-1)
  return markup.slice(markup.lastIndexOf('<', end), end + 1)
}

beforeEach(() => {
  h.cookie = undefined
  h.acceptLanguage = null
  seed()
})

describe.each(Object.keys(PAGES) as PageName[])('/s/%s in the visitor\'s language', (page) => {
  it('Korean (feed_locale cookie): lang="ko" dir="ltr" on the root, every word in Korean, no English left', async () => {
    h.cookie = 'ko'
    const markup = await html(page)
    expect(rootTag(markup)).toContain('lang="ko"')
    expect(rootTag(markup)).toContain('dir="ltr"')
    const text = decodeEntities(markup)
    for (const key of WORDS[page]) {
      expect(text, key).toContain(shareT('ko', key))
      expect(text, key).not.toContain(shareT('en', key))
    }
  })

  it('Arabic (Accept-Language): lang="ar" dir="rtl" on the root', async () => {
    h.acceptLanguage = 'ar-EG,ar;q=0.9,en;q=0.5'
    const markup = await html(page)
    expect(rootTag(markup)).toContain('lang="ar"')
    expect(rootTag(markup)).toContain('dir="rtl"')
    expect(decodeEntities(markup)).toContain(shareT('ar', WORDS[page][0]))
  })

  it('no cookie, no header: English, as before', async () => {
    const markup = await html(page)
    expect(rootTag(markup)).toContain('lang="en"')
    for (const key of WORDS[page]) expect(decodeEntities(markup), key).toContain(shareT('en', key))
  })

  it('the cookie wins over Accept-Language (the root layout\'s rule)', async () => {
    h.cookie = 'es'
    h.acceptLanguage = 'ko'
    expect(rootTag(await html(page))).toContain('lang="es"')
  })
})

describe('what members wrote is shown as written and marked as its own language', () => {
  beforeEach(() => { h.cookie = 'ko' })

  it.each(['business', 'organization'] as const)('/s/%s: name, description, address and services carry lang="" dir="auto"', async (page) => {
    const markup = await html(page)
    for (const text of [PLACE, DESCRIPTION, `${ADDRESS}, Rutland, VT, 05701`]) {
      const tag = tagAround(markup, text)
      expect(tag, text).toContain('lang=""')
      expect(tag, text).toContain('dir="auto"')
    }
    if (page === 'business') expect(tagAround(markup, 'Tax help')).toContain('lang=""')
  })

  it('/s/resource: name, description and eligibility carry lang="" dir="auto"', async () => {
    const markup = await html('resource')
    for (const text of [PLACE, DESCRIPTION, 'Open to all']) {
      expect(tagAround(markup, text), text).toContain('lang=""')
      expect(tagAround(markup, text), text).toContain('dir="auto"')
    }
  })

  it('/s/donate: the name and bio carry lang="" dir="auto"', async () => {
    const markup = await html('donate')
    expect(tagAround(markup, BIO)).toContain('lang=""')
    expect(tagAround(markup, BIO)).toContain('dir="auto"')
    expect(markup).toMatch(new RegExp(`<[^>]*lang=""[^>]*dir="auto"[^>]*>${NAME}<`))
  })

  it('/s/post: the post keeps posts.lang, the name keeps its own direction, not the page\'s Korean', async () => {
    const markup = await html('post')
    expect(tagAround(markup, 'Free meals Saturday.')).toContain('lang="es"')
    const nameTag = tagAround(markup, NAME)
    expect(nameTag).toContain('dir="auto"')
    expect(nameTag).not.toContain('lang="ko"')
  })
})

describe('words FEED already says elsewhere come from their one source', () => {
  beforeEach(() => { h.cookie = 'ko' })

  it('/s/post: the role marker and the counts read in Korean', async () => {
    const text = decodeEntities(await html('post'))
    expect(text).toContain('좋아요 3개')
    expect(text).toContain('댓글 1개')
    expect(text).not.toMatch(/\blikes?\b|\bcomments?\b/)
  })

  it('/s/embed: spots left in Korean digits and words', async () => {
    expect(decodeEntities(await html('embed'))).toContain('5자리 중 2자리 남음')
  })

  it('/s/business: category, feature and hours in Korean', async () => {
    const text = decodeEntities(await html('business'))
    expect(text).toContain('오전 9:00 – 오후 5:00')
    expect(text).toContain('월')
    expect(text).not.toMatch(/\b(Mon|Tue|Closed|AM|PM)\b/)
  })

  it('/s/organization and /s/resource: the category label is resourceCategoryLabel\'s, never a title-cased code', async () => {
    expect(decodeEntities(await html('organization'))).not.toContain('Mental Health')
    expect(decodeEntities(await html('resource'))).not.toContain('Food')
  })
})

describe('metadata in the visitor\'s language', () => {
  beforeEach(() => { h.cookie = 'ko' })

  it('/s/post and /s/embed: "{name} on FEED" in Korean; og:locale stays the post\'s language', async () => {
    for (const metadata of [postMetadata, embedMetadata]) {
      const meta = await metadata({ params })
      expect(meta.title).toBe(`FEED의 ${NAME}`)
      expect((meta.openGraph as { locale?: string }).locale).toBe('es_LA')
    }
  })

  it('the preview picture\'s description stays the picture\'s own words (English)', async () => {
    const meta = await businessMetadata({ params })
    expect((meta.openGraph as { images: Array<{ alt: string }> }).images[0].alt).toBe(ogCardAlt('business'))
  })

  it('a place with no description: the fallback sentence is Korean', async () => {
    h.business = { ...h.business!, description: null }
    expect((await businessMetadata({ params })).description).toBe(`${PLACE} - FEED의 지역 업체`)
    expect((await orgMetadata({ params })).description).toBe(`${PLACE} - FEED의 지역 단체`)
  })

  it('/s/donate: title and description in Korean', async () => {
    const meta = await donateMetadata({ params })
    expect(meta.title).toBe(`${NAME} 님 후원하기 - FEED`)
    expect(meta.description).toContain('FEED 상호부조 플랫폼')
  })

  it('missing rows: the "not found" titles are Korean', async () => {
    db.reset()
    h.business = null
    expect((await postMetadata({ params })).title).toBe(shareT('ko', 'postNotFound'))
    expect((await embedMetadata({ params })).title).toBe(shareT('ko', 'postNotFound'))
    expect((await businessMetadata({ params })).title).toBe(shareT('ko', 'businessNotFound'))
    expect((await orgMetadata({ params })).title).toBe(shareT('ko', 'organizationNotFound'))
    expect((await resourceMetadata({ params })).title).toBe(shareT('ko', 'resourceNotFound'))
  })

  it('the (social) layout: site title and description in Korean, and a lang-free wrapper', async () => {
    const meta = await layoutMetadata()
    expect(meta.title).toBe(shareT('ko', 'siteTitle'))
    expect(meta.description).toBe(shareT('ko', 'siteDescription'))
    expect(renderToStaticMarkup(SocialLayout({ children: 'x' }))).not.toContain('lang=')
  })
})

describe('public access is unchanged', () => {
  it.each(['en', 'ko', 'ar'] as const)('%s: a missing row is notFound() on every page', async (locale) => {
    h.cookie = locale
    db.reset()
    h.business = null
    for (const page of Object.keys(PAGES) as PageName[]) await expect(PAGES[page](), page).rejects.toThrow('notFound')
  })

  it('a donate page with no payment handle is still notFound()', async () => {
    h.rpc.get_donation_handles = [{ paypal_email: null, venmo_username: null }]
    await expect(DonatePage({ params })).rejects.toThrow('notFound')
  })
})

describe('Label in Name, all 14 locales', () => {
  it.each(LOCALES)('%s: every link\'s name is its visible text (no aria-label replaces it)', async (locale) => {
    h.cookie = locale
    for (const page of Object.keys(PAGES) as PageName[]) {
      const markup = await html(page)
      for (const [, attrs] of markup.matchAll(/<a\b([^>]*)>/g)) expect(attrs, page).not.toContain('aria-label')
      // No placeholder is left unfilled (the JSON-LD script is data, not text).
      expect(decodeEntities(markup.replace(/<script[\s\S]*?<\/script>/g, ''))).not.toMatch(/\{\w+\}/)
    }
  })
})

describe('right-to-left by construction', () => {
  const SOURCES = ['post', 'embed', 'business', 'organization', 'resource', 'donate'].map((p) => `./${p}/[id]/page.tsx`)
  it.each(SOURCES)('%s uses logical properties and mirrors its arrows', (file) => {
    const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
    expect(src).not.toMatch(/\b(ml|mr|pl|pr|left|right)-\d|\btext-(left|right)\b/)
    for (const m of src.matchAll(/<ArrowRight\b[^>]*>/g)) expect(m[0]).toContain('rtl:-scale-x-100')
  })
})
