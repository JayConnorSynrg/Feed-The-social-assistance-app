// @vitest-environment jsdom
// apps/web/src/components/panels/programs.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W6 — Browse Programs in the member's language, in a real DOM (jsdom, createRoot, act):
//   - the panel is in the member's language with lang/dir on its root (Korean; Arabic rtl); category
//     chips via resourceCategoryLabel, counts in the locale's digits; the state picker shows names
//     in the locale while every option value stays the 2-letter code;
//   - program text is the program's own (lang="" dir="auto"); phones and links dir="ltr";
//   - a hook's database text is never shown — the translated general line is;
//   - Label in Name in 14 locales for Save to My Plan, Start Application, Apply Online, Download Form,
//     Share to Feed (no aria-label that differs from the words on the control);
//   - one always-mounted status line, one new node per save; the Share to Feed dialog carries its own
//     lang/dir, and closing it returns focus to the button that opened it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  error: null as string | null,
  saved: [] as string[],
  setFilters: vi.fn(),
}))
const PROGRAM = {
  id: 'p1', name: 'Calfresh Pantry', description: 'Weekly groceries for families', category: 'food', city: 'Oakland', state: 'CA',
  is_verified: true, eligibility_requirements: 'Income under 200% FPL', services_offered: ['Groceries'], phone: '+1 510 555 0100',
  email: null, website: 'https://pantry.example.org', hours_of_operation: 'Mon–Fri 9–5', application_url: 'https://apply.example.org',
  application_form_url: 'https://forms.example.org/a.pdf', address_line1: null,
}

vi.mock('@/hooks/use-program-browser', () => ({
  useProgramBrowser: () => ({
    programs: h.error ? [] : [PROGRAM], categories: [{ name: 'food', count: 1234 }], isLoading: false, error: h.error,
    filters: { category: null, search: '', state: 'CA' }, setFilters: h.setFilters, totalCount: 1,
  }),
}))
vi.mock('@/hooks/use-resource-search', () => ({ useResourceSearch: () => ({ results: [], loading: false, error: null }), searchRowToResourceRow: (r: unknown) => r }))
vi.mock('@/hooks/use-saved-resources', () => ({
  useSavedResources: () => ({
    savedResources: [], isLoading: false, error: null, removeResource: async () => true,
    saveResource: async (r: { resource_id: string }) => { h.saved.push(r.resource_id); return true },
    isResourceSaved: () => false,
  }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ setActivePanel: vi.fn(), setPanelParams: vi.fn() }) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: { id: 'me' } }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/post-rpc', () => ({ createPost: async () => ({ ok: true }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { messages, type Locale } from '@/lib/i18n'
import { programsT } from '@/lib/i18n-programs'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { formatCount } from '@/lib/i18n-intl'
import { ProgramsPanel, ShareToFeedDialog } from './programs-panel'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  h.error = null
  h.saved = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

// Four turns of the event loop, then one frame (focus moves after layout: row-focus afterLayout).
const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}
async function render(locale: Locale) {
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, el(ProgramsPanel))))
  await settle()
}
const buttonByText = (text: string) => [...container.querySelectorAll('button, a')].find((b) => b.textContent?.trim() === text) as HTMLElement | undefined
async function expand() {
  await act(async () => (container.querySelector('[data-testid="program-card-p1"] button') as HTMLButtonElement).click())
  await settle()
}

describe('Browse Programs in the member language', () => {
  it('Korean: words, lang on the root, category label and count in the locale', async () => {
    await render('ko')
    const panel = container.firstElementChild as HTMLElement
    expect(panel).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(container.querySelector('h1')?.textContent).toBe(programsT('ko', 'title'))
    const chips = container.querySelector(`[role="group"][aria-label="${programsT('ko', 'categoriesLabel')}"]`) as HTMLElement
    expect(chips.textContent).toContain(resourceCategoryLabel('food', 'ko'))
    expect(chips.textContent).toContain(formatCount(1234, 'ko'))
    expect(chips.textContent).not.toContain('Food')
    expect(container.textContent).not.toMatch(/Find benefits|Select your state|Search programs/)
  })

  it('Arabic: dir="rtl" on the panel', async () => {
    await render('ar')
    expect(container.firstElementChild).toMatchObject({ lang: 'ar', dir: 'rtl' })
  })

  it('the state picker: names in the locale, values the 2-letter codes, a visible label', async () => {
    await render('ko')
    const select = container.querySelector('#programs-state') as HTMLSelectElement
    expect(container.querySelector('label[for="programs-state"]')?.textContent).toBe(programsT('ko', 'stateLabel'))
    const ca = [...select.options].find((o) => o.value === 'CA')!
    expect(ca.textContent).toBe('캘리포니아')
    expect([...select.options].slice(1).every((o) => /^[A-Z]{2}$/.test(o.value))).toBe(true)
    expect(select.value).toBe('CA')
  })

  it('program text keeps its own language and direction; phones and links are LTR', async () => {
    await render('ko')
    await expand()
    const name = [...container.querySelectorAll('[lang=""]')].find((n) => n.textContent === PROGRAM.name)
    expect(name?.getAttribute('dir')).toBe('auto')
    const phone = [...container.querySelectorAll('[dir="ltr"]')].find((n) => n.textContent === PROGRAM.phone)
    expect(phone).toBeDefined()
    expect(container.querySelector('[data-testid="program-card-p1"] button')?.getAttribute('aria-expanded')).toBe('true')
  })

  it('a database message from the hook is never shown; the translated line is', async () => {
    h.error = 'permission denied for table resources'
    await render('ko')
    expect(container.textContent).not.toContain('permission denied')
    expect(container.textContent).toContain(programsT('ko', 'programsLoadFailed'))
  })

  it.each(LOCALES)('%s: Label in Name — each program action is named by the words on it', async (l) => {
    await render(l)
    await expand()
    for (const key of ['saveToPlan', 'startApplication', 'applyOnline', 'downloadForm', 'shareToFeed'] as const) {
      const control = buttonByText(programsT(l, key))
      expect(control, `${l}.${key}`).toBeDefined()
      const name = control!.getAttribute('aria-label')
      expect(name === null || name.startsWith(programsT(l, key)), `${l}.${key}`).toBe(true)
    }
  })
})

describe('keyboard and screen reader', () => {
  it('a save is announced in the one always-mounted status line; two saves insert two nodes', async () => {
    await render('ko')
    await expand()
    const region = container.querySelector('[role="status"]') as HTMLElement
    expect(region).not.toBeNull()
    const inserted: string[] = []
    const observer = new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) inserted.push(n.textContent ?? '') })
    observer.observe(region, { childList: true, subtree: true })
    for (let i = 0; i < 2; i++) {
      await act(async () => buttonByText(programsT('ko', 'saveToPlan'))!.click())
      await settle()
    }
    observer.disconnect()
    expect(h.saved).toEqual(['p1', 'p1'])
    expect(inserted).toEqual([programsT('ko', 'savedToPlan'), programsT('ko', 'savedToPlan')])
  })

  it('Share to Feed: the dialog is in the member language, prefilled in it; Cancel returns focus to the opener', async () => {
    await render('ko')
    await expand()
    const opener = container.querySelector('[data-testid="share-to-feed-btn-p1"]') as HTMLButtonElement
    await act(async () => opener.click())
    await settle()
    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(dialog.getAttribute('aria-labelledby')).toBe('share-to-feed-title')
    expect((dialog.querySelector('textarea') as HTMLTextAreaElement).value).toContain('확인해 보세요')
    expect(dialog.querySelectorAll('[role="alert"]')).toHaveLength(1)
    await act(async () => buttonByText(programsT('ko', 'cancel'))!.click())
    await settle()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[data-testid="share-to-feed-btn-p1"]'))
  })
})

describe('Share to Feed without a description', () => {
  it('the suggested post is in the member language too', async () => {
    const resource = { ...PROGRAM, description: null } as never
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(ShareToFeedDialog, { resource, onClose: () => {}, onShared: () => {} }))))
    await settle()
    const box = container.querySelector('textarea') as HTMLTextAreaElement
    expect(box.value).toBe(`${PROGRAM.name}을(를) 확인해 보세요`)
    expect(box.value).not.toContain('Check out')
  })
})
