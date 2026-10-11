// apps/web/src/app/(social)/s/json-ld.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The public /s/business and /s/organization pages put member-written text (name, description,
// services, contact) into an inline JSON-LD script element. That text must stay data: a name such as
// `</script><img src=x>` may not end the element or add markup to the page. Renders the real server
// pages to HTML and reads the result the way a browser's parser would see it.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { serializeJsonLd } from '@/lib/json-ld'

const { ID, BREAKOUT, DESCRIPTION, SERVICE, place } = vi.hoisted(() => {
  const ID = '11111111-1111-4111-8111-111111111111'
  const BREAKOUT = '</script><img src=x>'
  const DESCRIPTION = 'Soup & bread <b>daily</b>\u2028second line\u2029third line </SCRIPT ><script>alert(1)</script>'
  const SERVICE = 'Tax help </script><svg onload=alert(1)>'
  return {
    ID,
    BREAKOUT,
    DESCRIPTION,
    SERVICE,
    place: {
      id: ID,
      name: BREAKOUT,
      description: DESCRIPTION,
      org_type: 'food_bank',
      address: `1 Main St ${BREAKOUT}`,
      city: 'Rutland',
      state: 'VT',
      zip_code: '05701',
      phone: `555-0100 ${BREAKOUT}`,
      email: 'hello@example.org',
      website: null,
      business_category: null,
      cost_model: null,
      attributes: {},
      social_links: {},
      location: null,
    },
  }
})

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('notFound') } }))
vi.mock('@/hooks/use-admin-viewer', () => ({ useAdminViewer: () => ({ status: 'loading', tier: null, adminOrgIds: null }) }))
vi.mock('@/lib/logger', () => ({
  logEvent: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withMetric: async (_o: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/utils/url-server', () => ({ getAppUrlFromHeaders: async () => 'https://sourcetofeed.com' }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/business-data', () => ({
  fetchApprovedBusinessById: async () => ({ ...place, org_type: 'business' }),
  fetchBusinessHours: async () => [],
  fetchBusinessServices: async () => [{ name: SERVICE, description: null, sort_order: 0 }],
  fetchBusinessPhotos: async () => [],
}))
vi.mock('@/lib/org-data', () => ({
  fetchOrganizationById: async () => place,
  fetchOrgResources: async () => [],
}))

import BusinessPage from './business/[id]/page'
import OrganizationPage from './organization/[id]/page'

const params = Promise.resolve({ id: ID })

/** What an HTML parser takes as the JSON-LD element's content: everything up to the first `</script`. */
function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script/gi)].map((m) => m[1])
}

const PAGES = [
  { path: '/s/business', render: () => BusinessPage({ params }), type: 'LocalBusiness' },
  { path: '/s/organization', render: () => OrganizationPage({ params }), type: 'Organization' },
] as const

describe.each(PAGES)('$path: a name containing </script><img src=x> stays inert text', ({ render, type }) => {
  it('the server HTML holds no injected element, and the page shows the name as text', async () => {
    const html = renderToStaticMarkup(await render())
    expect(html).not.toContain('<img src=x>')
    expect(html).not.toMatch(/<svg onload/i)
    expect(html).not.toContain('<script>alert(1)</script>')
    // the visible name: React-escaped text
    expect(html).toContain('&lt;/script&gt;&lt;img src=x&gt;')
  })

  it('exactly one script element, closed exactly once', async () => {
    const html = renderToStaticMarkup(await render())
    expect(html.match(/<script/gi)).toHaveLength(1)
    expect(html.match(/<\/script/gi)).toHaveLength(1)
  })

  it('the JSON-LD the parser sees is complete and carries the original text', async () => {
    const html = renderToStaticMarkup(await render())
    const blocks = jsonLdBlocks(html)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).not.toMatch(/[<>&\u2028\u2029]/)
    const ld = JSON.parse(blocks[0]) as Record<string, unknown>
    expect(ld['@type']).toBe(type)
    expect(ld.name).toBe(BREAKOUT)
    expect(ld.description).toBe(DESCRIPTION)
    expect(ld.telephone).toBe(`555-0100 ${BREAKOUT}`)
    expect((ld.address as Record<string, string>).streetAddress).toBe(`1 Main St ${BREAKOUT}`)
  })
})

describe('/s/business: service names in the offer catalog', () => {
  it('a service name cannot end the script element either', async () => {
    const html = renderToStaticMarkup(await BusinessPage({ params }))
    const ld = JSON.parse(jsonLdBlocks(html)[0]) as { hasOfferCatalog: { itemListElement: Array<{ itemOffered: { name: string } }> } }
    expect(ld.hasOfferCatalog.itemListElement[0].itemOffered.name).toBe(SERVICE)
  })
})

describe('serializeJsonLd', () => {
  it('writes <, >, &, U+2028 and U+2029 as \\u escapes', () => {
    expect(serializeJsonLd({ a: '<>&\u2028\u2029' })).toBe('{"a":"\\u003c\\u003e\\u0026\\u2028\\u2029"}')
  })

  it('round-trips: the parsed value equals the input', () => {
    const value = { name: BREAKOUT, nested: [{ t: DESCRIPTION }], n: 3, ok: true, none: null, quote: 'a "b" \\ c', emoji: '🍲', ar: 'وجبات' }
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value)
  })

  it('escapes keys as well as values', () => {
    const out = serializeJsonLd({ '</script>': 1 })
    expect(out).not.toContain('<')
    expect(JSON.parse(out)).toEqual({ '</script>': 1 })
  })

  it('control: plain JSON.stringify leaves the closing tag in place', () => {
    expect(JSON.stringify({ name: BREAKOUT })).toContain('</script>')
  })
})
