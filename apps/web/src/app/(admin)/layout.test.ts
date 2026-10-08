// apps/web/src/app/(admin)/layout.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// I1: every admin page shows exactly ONE "Back to feed" link, in the same place, to /#feed in the same
// tab. The bar lives in (admin)/layout.tsx, so it is proven on the layout's real output (the server
// gate mocked to admit a tier), with an ordinary page and with the admin error screen as its child;
// and no page or component under app/(admin) renders a second one. I5: one click = one row.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const state = vi.hoisted(() => ({
  tier: 'platform_admin' as string | null,
  orgAdmin: false,
  language: null as string | null,
  linkProps: [] as Array<Record<string, unknown>>,
  events: [] as Array<{ name: string; attrs: Record<string, unknown> }>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc: async (fn: string) => ({ data: fn === 'current_user_tier' ? state.tier : state.orgAdmin }),
  }),
}))
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`)
  },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ profile: state.language ? { preferred_language: state.language } : null }),
}))
// Record the Link props (so the click handler can be fired) and render a plain <a>.
vi.mock('next/link', () => ({
  default: (p: { href: string; children?: ReactNode; className?: string }) => {
    state.linkProps.push(p as unknown as Record<string, unknown>)
    return h('a', { href: p.href, className: p.className }, p.children)
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: (name: string, attrs: Record<string, unknown>) => state.events.push({ name, attrs }),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import AdminLayout from './layout'
import AdminError from './error'

const HERE = path.dirname(fileURLToPath(import.meta.url))

async function renderLayout(children: ReactNode): Promise<string> {
  const tree = (await AdminLayout({ children })) as ReactElement
  return renderToStaticMarkup(tree)
}
const feedLinks = (html: string) => html.match(/<a [^>]*href="\/#feed"[^>]*>/g) ?? []

beforeEach(() => {
  state.tier = 'platform_admin'
  state.orgAdmin = false
  state.language = null
  state.linkProps.length = 0
  state.events.length = 0
})

describe('admin layout — Back to feed bar', () => {
  it('an admin page shows exactly one Back to feed link, to /#feed, in the same tab, before the page', async () => {
    const html = await renderLayout(h('main', null, 'PAGE'))
    expect(feedLinks(html)).toHaveLength(1)
    expect(feedLinks(html)[0]).not.toMatch(/target=/)
    expect(html.match(/Back to feed/g)).toHaveLength(1)
    expect(html.indexOf('Back to feed')).toBeLessThan(html.indexOf('PAGE'))
    expect(html).toMatch(/^<nav aria-label="Community feed"/)
  })

  it('the admin error screen (rendered inside the layout) still shows exactly one, and offers Try again', async () => {
    const html = await renderLayout(h(AdminError, { error: Object.assign(new Error('x'), { digest: 'd1' }), reset: () => {} }))
    expect(feedLinks(html)).toHaveLength(1)
    // One link labelled Back to feed (the card's hint text points up at it; it is not a link).
    expect(html.match(/<a [^>]*>(?:(?!<\/a>).)*Back to feed<\/a>/g)).toHaveLength(1)
    expect(html).toContain('use Back to feed above')
    expect(html).toContain('Try again')
  })

  it('the error screen alone renders no second way home', () => {
    const html = renderToStaticMarkup(h(AdminError, { error: new Error('x'), reset: () => {} }))
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('Go home')
  })

  it("follows the viewer's profile language", async () => {
    state.language = 'es'
    const html = await renderLayout(h('main', null, 'PAGE'))
    expect(html).toContain('Volver al feed')
    expect(feedLinks(html)).toHaveLength(1)
  })

  it('an org admin without a tier gets the bar too; a non-admin is redirected (no bar)', async () => {
    state.tier = null
    state.orgAdmin = true
    expect(feedLinks(await renderLayout(h('main', null, 'PAGE')))).toHaveLength(1)
    state.orgAdmin = false
    await expect(renderLayout(h('main', null, 'PAGE'))).rejects.toThrow('redirect:/')
  })

  it('one click writes exactly one admin.nav.back_to_feed row (source only)', async () => {
    await renderLayout(h('main', null, 'PAGE'))
    const bar = state.linkProps.find((p) => p.href === '/#feed')!
    ;(bar.onClick as () => void)()
    expect(state.events).toEqual([{ name: 'admin.nav.back_to_feed', attrs: { source: 'admin_bar' } }])
    ;(bar.onAuxClick as (e: { button: number }) => void)({ button: 1 })
    expect(state.events).toHaveLength(2)
  })
})

describe('I1 — no admin page renders a second Back to feed', () => {
  function filesUnder(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) return filesUnder(p)
      return /\.tsx$/.test(e.name) ? [p] : []
    })
  }

  it('only layout.tsx renders the bar, and no admin file links to the feed home itself', () => {
    const files = filesUnder(HERE)
    // CONTROL: the scan sees the real admin tree (layout, moderation, federation).
    expect(files.some((f) => f.endsWith(path.join('(admin)', 'layout.tsx')))).toBe(true)
    expect(files.some((f) => f.includes(`${path.sep}federation${path.sep}`))).toBe(true)
    expect(fs.readFileSync(path.join(HERE, 'layout.tsx'), 'utf8')).toContain("rpc('current_user_tier')")

    const renderers = files.filter((f) => /<BackToFeedBar\b/.test(fs.readFileSync(f, 'utf8')))
    expect(renderers.map((f) => path.relative(HERE, f))).toEqual(['layout.tsx'])
    // A link to the feed home ('/' or '/#…') or a memberUrl feed_home target anywhere else.
    const feedHome = files.filter((f) => /feed_home|href=\{?['"`]\/(#[^'"`]*)?['"`]/.test(fs.readFileSync(f, 'utf8')))
    expect(feedHome.map((f) => path.relative(HERE, f))).toEqual([])
  })
})
