// apps/web/src/app/(admin)/moderation/admin-shell.i18n.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// An admin whose language is set reads the admin shell in that language from the first paint:
//   - the header (tier marker or "Organizer"), the organization selector and every tab name, in the
//     admin's language; the header and the tab bar marked with it, Arabic right-to-left (the tab
//     list follows reading direction); each tab's still-English content marked lang="en" dir="ltr";
//     an organization's name keeps its own direction;
//   - Label in Name: each tab's accessible name is its visible name, in the 14 locales;
//   - the locale is useProfileLocale(): the cookie the server rendered with applies before the
//     profile loads;
//   - the Settings placeholder is gone, and a link to it (?tab=settings) opens the default tab,
//     writes exactly one admin.deeplink.resolve row and drops the param.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const { state } = vi.hoisted(() => ({
  state: {
    language: 'ko' as string | null,
    tier: 'platform_admin' as string | null,
    isOrgAdmin: false,
  },
}))
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'admin' }, profile: state.language === null ? null : { preferred_language: state.language } }),
}))
vi.mock('./use-admin-orgs', () => ({ useAdminOrgs: () => ({ orgs: [{ id: 'o1', name: 'منظمة الحي' }], loading: false }) }))
vi.mock('@/hooks/use-admin-tier', () => ({ useAdminTier: () => ({ tier: state.tier, isFounder: false, loading: false }) }))
vi.mock('@/hooks/use-is-org-admin', () => ({ useIsOrgAdminState: () => ({ isOrgAdmin: state.isOrgAdmin, loaded: true }) }))
vi.mock('./use-admin-focus', () => ({ useAdminFocusGate: () => null }))
vi.mock('./org-focus', () => ({ OrgPanelFocus: () => null }))
vi.mock('./overview-tab', () => ({ OverviewTab: () => h('p', null, 'overview content') }))
vi.mock('./event-scheduler', () => ({ EventScheduler: () => null }))
vi.mock('./moderation-tab', () => ({ ModerationTab: () => null }))
vi.mock('./community-tab', () => ({ CommunityTab: () => null }))
vi.mock('./resources-tab', () => ({ ResourcesTab: () => null }))
vi.mock('./businesses-tab', () => ({ BusinessesTab: () => null }))
vi.mock('./manage-resources-tab', () => ({ ManageResourcesTab: () => null }))
vi.mock('./orgs-section', () => ({ OrgsSection: () => null }))
vi.mock('./people-tab', () => ({ PeopleTab: () => null }))
vi.mock('@/components/org-form/org-form-panel', () => ({ OrgFormPanel: () => null }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { mount, findAll } from '@/test/mini-react'
import { logEvent } from '@/lib/logger'
import { messages, type Locale } from '@/lib/i18n'
import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { adminShellT, adminTabLabel } from '@/lib/i18n-admin-shell'
import { roleLabel } from '@/lib/i18n-feed-card'
import { Tabs } from '@/components/ui/tabs'
import { TAB_ORDER } from './admin-shell-tabs'
import { AdminShell } from './admin-shell'

const LOCALES = Object.keys(messages) as Locale[]

function html(language: string | null, opts: { tier?: string | null; isOrgAdmin?: boolean; cookie?: Locale } = {}) {
  state.language = language
  state.tier = opts.tier === undefined ? 'platform_admin' : opts.tier
  state.isOrgAdmin = opts.isOrgAdmin ?? false
  const shell = h(AdminShell)
  return renderToStaticMarkup(opts.cookie ? h(InitialLocaleContext.Provider, { value: opts.cookie }, shell) : shell)
}
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim()
/** Every role="tab" button: its aria-label (if any) and its visible text. */
function tabs(markup: string) {
  return [...markup.matchAll(/<button([^>]*role="tab"[^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({
    label: /aria-label="([^"]*)"/.exec(m[1])?.[1] ?? null,
    text: strip(m[2]),
  }))
}

describe('the admin shell in the admin’s language', () => {
  it('Korean: header, selector, every tab; header and tab bar marked ko', () => {
    const out = html('ko')
    expect(out).toContain(`>${roleLabel('platform_admin', 'ko')}</h1>`)
    expect(out).toMatch(/<div lang="ko" dir="ltr"[^>]*class="bg-white border-b/)
    expect(out).toContain(`aria-label="${adminShellT('ko', 'organization')}"`)
    expect(out).toContain(`>${adminShellT('ko', 'allOrganizations')}</option>`)
    expect(out).toMatch(new RegExp(`role="tablist"[^>]*aria-label="${adminShellT('ko', 'sections')}"|aria-label="${adminShellT('ko', 'sections')}"[^>]*role="tablist"`))
    expect(out).toMatch(/lang="ko"[^>]*role="tablist"|role="tablist"[^>]*lang="ko"/)
    expect(tabs(out).map((t) => t.text)).toEqual(TAB_ORDER.map((id) => adminTabLabel(id, 'ko')))
    expect(out).not.toMatch(/>(Overview|Moderation|All Organizations|Organizer)</)
  })

  it('an organization’s name keeps its own direction and takes no page language', () => {
    expect(html('ko')).toContain('<option value="o1" lang="" dir="auto">منظمة الحي</option>')
  })

  it('a tab’s still-English content is marked English (the open Overview tab, and every other)', () => {
    const panels = [...html('ko').matchAll(/<div([^>]*role="tabpanel"[^>]*)>/g)].map((m) => m[1])
    const overview = panels.find((p) => /-content-overview"/.test(p))!
    expect(overview).toMatch(/lang="en"/)
    expect(overview).toMatch(/dir="ltr"/)
    expect(panels.length).toBeGreaterThan(0)
    for (const p of panels) expect(p).toMatch(/lang="en" dir="ltr"|dir="ltr"[^>]*lang="en"/)
  })

  it('Arabic: header and tab bar right-to-left (the tablist follows reading direction)', () => {
    const out = html('ar')
    expect(out).toMatch(/<div lang="ar" dir="rtl"[^>]*class="bg-white border-b/)
    expect(out).toMatch(/dir="rtl"[^>]*data-slot="tabs"|data-slot="tabs"[^>]*dir="rtl"/)
    expect(tabs(out)[0].text).toBe(adminTabLabel('overview', 'ar'))
  })

  it('an organizer without a tier reads "Organizer" in their language, with only the Events tab', () => {
    const out = html('es', { tier: null, isOrgAdmin: true })
    expect(out).toContain(`>${adminShellT('es', 'organizer')}</h1>`)
    expect(tabs(out).map((t) => t.text)).toEqual([adminTabLabel('events', 'es')])
  })

  it('before the profile loads, the language the server rendered with (feed_locale cookie) applies', () => {
    const out = html(null, { cookie: 'vi' })
    expect(out).toMatch(/<div lang="vi" dir="ltr"[^>]*class="bg-white border-b/)
    expect(tabs(out)[0].text).toBe(adminTabLabel('overview', 'vi'))
  })

  it.each(LOCALES)('%s: Label in Name — each tab is named by its visible words', (locale) => {
    for (const t of tabs(html(locale))) {
      expect(t.text.length).toBeGreaterThan(0)
      if (t.label !== null) expect(t.label.startsWith(t.text)).toBe(true)
    }
  })

  it('the Settings placeholder is gone', () => {
    const out = html('en')
    expect(out).not.toMatch(/coming soon/i)
    expect(tabs(out).map((t) => t.text)).not.toContain('Settings')
  })
})

describe('a link to the removed Settings tab', () => {
  const replaceState = vi.fn()
  function stubWindow(search: string) {
    vi.stubGlobal('window', {
      location: { search, pathname: '/moderation', hash: '' },
      history: { state: null, replaceState, pushState: vi.fn(), back: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  }
  function shownTab(m: { tree: () => unknown }) {
    const [tabsEl] = findAll(m.tree(), (el) => el.type === Tabs)
    return (tabsEl as ReactElement<{ value: string }> & { props: { value: string } }).props.value
  }
  const resolveRows = () => vi.mocked(logEvent).mock.calls.filter(([name]) => name === 'admin.deeplink.resolve')

  beforeEach(() => {
    vi.mocked(logEvent).mockClear()
    replaceState.mockClear()
    state.language = 'en'
    state.tier = 'platform_admin'
    state.isOrgAdmin = false
  })

  it('opens the default tab, writes exactly one row and drops the param', () => {
    stubWindow('?tab=settings')
    const m = mount(() => AdminShell())
    m.rerender()
    expect(shownTab(m)).toBe('overview')
    expect(resolveRows()).toEqual([['admin.deeplink.resolve', { kind: 'tab', outcome: 'invalid', tab: 'unknown' }]])
    expect(replaceState).toHaveBeenCalledWith(null, '', '/moderation')
    m.unmount()
  })

  it('a moderator lands on their own default tab (Moderation), still one row', () => {
    state.tier = 'community_moderator'
    stubWindow('?tab=settings')
    const m = mount(() => AdminShell())
    expect(shownTab(m)).toBe('moderation')
    expect(resolveRows()).toHaveLength(1)
    m.unmount()
  })

  it('a valid tab link writes no row and opens that tab', () => {
    stubWindow('?tab=people')
    const m = mount(() => AdminShell())
    expect(shownTab(m)).toBe('people')
    expect(resolveRows()).toHaveLength(0)
    expect(replaceState).not.toHaveBeenCalled()
    m.unmount()
  })

  it('a focus link with ?tab=settings is the focus gate’s row, not a second one here', () => {
    stubWindow('?tab=settings&focus=post:11111111-1111-4111-8111-111111111111')
    const m = mount(() => AdminShell())
    expect(resolveRows()).toHaveLength(0)
    m.unmount()
  })
})
