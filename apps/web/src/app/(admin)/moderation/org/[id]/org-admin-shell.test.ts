// apps/web/src/app/(admin)/moderation/org/[id]/org-admin-shell.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin shell feeds every tab the route's org id: Overview, Events and Members get
// that id, the roster is read-only for an organization admin, and Profile opens the setup panel in
// edit mode for THIS org only — without the all-organizations duplicate-name index and without the
// "Edit existing" switch to another org. Rendered with react-dom/server; the tab primitives are
// replaced by pass-throughs so every panel renders, and the tab bodies are capturing stubs.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const captured = vi.hoisted(() => ({
  overview: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  members: [] as Array<Record<string, unknown>>,
  panel: [] as Array<Record<string, unknown>>,
  nameIndexReads: 0,
  language: null as string | null,
}))

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ profile: captured.language ? { preferred_language: captured.language } : null }),
}))
vi.mock('@/components/ui/tabs', () => {
  type P = { children?: ReactNode; value?: string; className?: string; lang?: string; dir?: string; 'aria-label'?: string }
  const pass = (tag: string, role?: string) => (p: P) =>
    h(tag, { role, 'data-value': p.value, className: p.className, lang: p.lang, dir: p.dir, 'aria-label': p['aria-label'] }, p.children)
  return { Tabs: pass('div'), TabsList: pass('div', 'tablist'), TabsTrigger: pass('button', 'tab'), TabsContent: pass('section', 'tabpanel') }
})
vi.mock('../org-overview', () => ({ OrgOverview: (p: Record<string, unknown>) => (captured.overview.push(p), null) }))
vi.mock('./org-events-tab', () => ({ OrgEventsTab: (p: Record<string, unknown>) => (captured.events.push(p), null) }))
vi.mock('../../orgs-section', () => ({ OrgMembers: (p: Record<string, unknown>) => (captured.members.push(p), null) }))
vi.mock('@/components/org-form/org-form-panel', () => ({
  OrgFormPanel: (p: Record<string, unknown>) => (captured.panel.push(p), null),
}))
vi.mock('@/lib/org-data', () => ({
  fetchOrgNameIndex: async () => {
    captured.nameIndexReads++
    return []
  },
}))

import { OrgAdminShell } from './org-admin-shell'

const ORG = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Rutland Food Shelf',
  org_type: 'food_bank',
  is_active: true,
  city: 'Rutland',
  state: 'VT',
}

beforeEach(() => {
  captured.overview = []
  captured.events = []
  captured.members = []
  captured.panel = []
  captured.nameIndexReads = 0
  captured.language = null
})

describe('OrgAdminShell', () => {
  it('shows the four tabs and the org name', () => {
    const html = renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    const tabs = [...html.matchAll(/<button role="tab"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/button>/g)].map((m) => m[1])
    expect(tabs).toEqual(['Overview', 'Events', 'Profile', 'Members'])
    expect(html).toMatch(/<div role="tablist"[^>]*aria-label="Organization admin sections"/)
    expect(html).toContain('<h1')
    expect(html).toContain('Rutland Food Shelf')
  })

  it('feeds Overview, Events and Members exactly this org id; roster read-only for an org admin', () => {
    renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    expect(captured.overview).toEqual([{ orgId: ORG.id }])
    expect(captured.events).toEqual([{ orgId: ORG.id }])
    expect(captured.members).toEqual([{ orgId: ORG.id, readOnly: true }])
  })

  it('a platform admin keeps roster writes', () => {
    renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: true }))
    expect(captured.members).toEqual([{ orgId: ORG.id, readOnly: false }])
  })

  it('Profile edits this org only: edit mode, this id, no name index, no switch to another org', () => {
    renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    expect(captured.panel).toHaveLength(1)
    const p = captured.panel[0]
    expect(p).toMatchObject({ mode: 'edit', kind: 'org', orgId: ORG.id, checkDuplicateNames: false })
    expect(p.onEditExisting).toBeUndefined()
  })

  it('the organization type is read-only for an org admin and editable for a platform admin', () => {
    renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: true }))
    expect(captured.panel.map((p) => p.canChangeType)).toEqual([false, true])
  })

  it('selected tab: white text on the brand green, at least 4.5:1', () => {
    const html = renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    const triggers = html.match(/<button role="tab"[^>]*>/g) ?? []
    expect(triggers).toHaveLength(4)
    for (const t of triggers) {
      expect(t).toContain('data-[state=active]:bg-brand')
      expect(t).toContain('data-[state=active]:text-white')
    }
    expect(contrastOnWhite(brandHex())).toBeGreaterThanOrEqual(4.5)
  })

  it("carries the viewer's language and direction, and a main landmark", () => {
    captured.language = 'ar'
    const html = renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    expect(html).toMatch(/^<div [^>]*lang="ar"[^>]*dir="rtl"/)
    expect(html).toMatch(/<main[\s>]/)
    expect((html.match(/<main[\s>]/g) ?? []).length).toBe(1)
  })

  it('English-only parts read left-to-right inside a right-to-left page; translated links follow the viewer', () => {
    captured.language = 'ar'
    const html = renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    const englishIslands = html.match(/<[a-z]+ [^>]*lang="en"[^>]*>/g) ?? []
    // Back link, tab list, Profile section.
    expect(englishIslands).toHaveLength(3)
    for (const tag of englishIslands) expect(tag).toContain('dir="ltr"')
    const publicLink = html.match(/<a [^>]*href="\/s\/organization\/[^"]+"[^>]*>/)
    expect(publicLink![0]).toContain('lang="ar"')
    expect(publicLink![0]).toContain('dir="rtl"')
  })

  it('the save notice region is always present so its announcement is heard', () => {
    const html = renderToStaticMarkup(h(OrgAdminShell, { org: ORG, isPlatformAdmin: false }))
    const live = html.match(/<p aria-live="polite"[^>]*>/)
    expect(live).not.toBeNull()
    expect(live![0]).not.toContain('empty:hidden')
  })
})

describe('main admin shell tab colours', () => {
  it('selected tab uses the brand green (same 4.5:1 fix as the org shell)', () => {
    const src = fs.readFileSync(path.join(SRC, 'app/(admin)/moderation/admin-shell.tsx'), 'utf8')
    const trigger = src.match(/const TRIGGER_CLASS = '([^']+)'/)
    expect(trigger).not.toBeNull()
    expect(trigger![1]).toContain('data-[state=active]:bg-brand')
    expect(trigger![1]).not.toMatch(/data-\[state=active\]:bg-lime/)
  })
})

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')

function brandHex(): string {
  const css = fs.readFileSync(path.join(SRC, 'app/globals.css'), 'utf8')
  const m = css.match(/--color-brand:\s*(#[0-9a-fA-F]{6})/)
  expect(m).not.toBeNull()
  return m![1]
}

/** WCAG 2 contrast ratio of white text on `hex`. */
function contrastOnWhite(hex: string): number {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * ch(0) + 0.7152 * ch(1) + 0.0722 * ch(2)
  return 1.05 / (L + 0.05)
}

describe('setup panel name index', () => {
  it('scoped panel (checkDuplicateNames=false) reads no organization names', async () => {
    const { loadOrgNameIndex } = await vi.importActual<typeof import('@/components/org-form/org-form-panel')>(
      '@/components/org-form/org-form-panel'
    )
    await expect(loadOrgNameIndex({} as never, false)).resolves.toEqual([])
    expect(captured.nameIndexReads).toBe(0)
    await loadOrgNameIndex({} as never, true)
    expect(captured.nameIndexReads).toBe(1)
  })
})
