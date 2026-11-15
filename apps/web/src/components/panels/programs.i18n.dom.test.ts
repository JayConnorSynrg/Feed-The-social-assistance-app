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
import { act, createElement as el, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  error: null as string | null,
  isLoading: false,
  saved: [] as string[],
  setFilters: vi.fn(),
  savedRows: [] as Array<Record<string, unknown>>,
  removeOk: true,
  savedError: null as string | null,
  setActivePanel: (() => {}) as (panel: string) => void,
  selectedCategory: null as string | null,
}))
const PROGRAM = {
  id: 'p1', name: 'Calfresh Pantry', description: 'Weekly groceries for families', category: 'food', city: 'Oakland', state: 'CA',
  is_verified: true, eligibility_requirements: 'Income under 200% FPL', services_offered: ['Groceries'], phone: '+1 510 555 0100',
  email: null, website: 'https://pantry.example.org', hours_of_operation: 'Mon–Fri 9–5', application_url: 'https://apply.example.org',
  application_form_url: 'https://forms.example.org/a.pdf', address_line1: null,
}

vi.mock('@/hooks/use-program-browser', () => ({
  useProgramBrowser: () => ({
    programs: h.error || h.isLoading ? [] : [PROGRAM], categories: [{ name: 'food', count: 1234 }], isLoading: h.isLoading, error: h.isLoading ? null : h.error,
    filters: { category: h.selectedCategory, search: '', state: 'CA' }, setFilters: h.setFilters, totalCount: 1,
  }),
}))
vi.mock('@/hooks/use-resource-search', () => ({ useResourceSearch: () => ({ results: [], loading: false, error: null }), searchRowToResourceRow: (r: unknown) => r }))
vi.mock('@/hooks/use-saved-resources', () => ({
  useSavedResources: () => ({
    savedResources: h.savedRows, isLoading: false, error: h.savedError,
    removeResource: async () => { if (!h.removeOk) h.savedError = 'new row violates row-level security policy'; return h.removeOk },
    saveResource: async (r: { resource_id: string }) => { h.saved.push(r.resource_id); return true },
    isResourceSaved: () => false,
  }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ setActivePanel: (p: string) => h.setActivePanel(p), setPanelParams: vi.fn() }) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: { id: 'me' } }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/post-rpc', () => ({ createPost: async () => ({ ok: true }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { messages, type Locale } from '@/lib/i18n'
import { programsFound, programsT } from '@/lib/i18n-programs'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { formatCount } from '@/lib/i18n-intl'
import { ProgramsPanel, ShareToFeedDialog } from './programs-panel'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  h.error = null
  h.isLoading = false
  h.saved = []
  h.savedRows = []
  h.removeOk = true
  h.savedError = null
  h.setActivePanel = () => {}
  h.selectedCategory = null
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
const buttonByText = (text: string) => [...document.querySelectorAll('button, a')].find((b) => b.textContent?.trim() === text) as HTMLElement | undefined
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
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(programsT('ko', 'shareToFeed'))
    expect((dialog.querySelector('textarea') as HTMLTextAreaElement).value).toContain('확인해 보세요')
    expect(dialog.querySelectorAll('[role="alert"]')).toHaveLength(1)
    await act(async () => buttonByText(programsT('ko', 'cancel'))!.click())
    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[data-testid="share-to-feed-btn-p1"]'))
  })
})

describe('Share to Feed without a description', () => {
  it('the suggested post is in the member language too', async () => {
    const resource = { ...PROGRAM, description: null } as never
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(ShareToFeedDialog, { resource, onClose: () => {}, onShared: () => {} }))))
    await settle()
    const box = document.querySelector('textarea') as HTMLTextAreaElement
    expect(box.value).toBe(`${PROGRAM.name}을(를) 확인해 보세요`)
    expect(box.value).not.toContain('Check out')
  })
})

describe('PR #256 review fixes', () => {
  async function openShare(locale: Locale = 'ko') {
    await render(locale)
    await expand()
    await act(async () => (container.querySelector('[data-testid="share-to-feed-btn-p1"]') as HTMLButtonElement).click())
    await settle()
    return document.querySelector('[role="dialog"]') as HTMLElement
  }
  const tabbables = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>('button, textarea, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.hasAttribute('disabled'))

  it('F1: Tab wraps inside the Share dialog (last → first, Shift+Tab first → last); focus starts in the post box', async () => {
    const dialog = await openShare()
    // Modal: the page behind is hidden from assistive tech while the dialog is open.
    expect(container.closest('[aria-hidden="true"]') ?? container.getAttribute('aria-hidden')).toBeTruthy()
    expect(document.activeElement).toBe(dialog.querySelector('textarea'))
    const list = tabbables(dialog)
    const first = list[0]
    const last = list[list.length - 1]
    last.focus()
    await act(async () => { last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(first)
    await act(async () => { first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(last)
  })

  it('F1: Escape closes the dialog and focus returns to the button that opened it', async () => {
    const dialog = await openShare()
    await act(async () => { (dialog.querySelector('textarea') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('[data-testid="share-to-feed-btn-p1"]'))
  })

  it('P3: after a successful share, focus goes to the feed in the panel host', async () => {
    // The host is the shell's panel region; switching panels replaces its content.
    function Host() {
      const [panel, setPanel] = useState('programs')
      useEffect(() => {
        h.setActivePanel = setPanel
      }, [])
      return el('div', { role: 'region', 'aria-label': 'Panel' }, panel === 'programs' ? el(ProgramsPanel) : el('h1', null, 'Feed'))
    }
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(Host))))
    await settle()
    await expand()
    await act(async () => (container.querySelector('[data-testid="share-to-feed-btn-p1"]') as HTMLButtonElement).click())
    await settle()
    await act(async () => (document.querySelector('[data-testid="share-to-feed-submit"]') as HTMLButtonElement).click())
    await settle()
    expect(document.activeElement?.tagName).toBe('H1')
    expect(document.activeElement?.textContent).toBe('Feed')
  })

  it('P1: Retry — once the reload settles, focus is on the search box (the Retry button is gone)', async () => {
    h.error = 'Failed to load programs. Please try again.'
    await render('ko')
    const retry = buttonByText(programsT('ko', 'retry')) as HTMLButtonElement
    retry.focus()
    await act(async () => retry.click())
    expect(h.setFilters).toHaveBeenCalled()
    h.isLoading = true
    await render('ko')
    h.isLoading = false
    h.error = null
    await render('ko')
    expect(document.activeElement).toBe(container.querySelector('#programs-search'))
  })

  it('P2: a failed unsave keeps the list and says so in the status line; focus stays on Unsave', async () => {
    h.savedRows = [{ id: 's1', resource_name: 'Pantry', resource_category: 'food', resource_address: null, resource_phone: '+1 555', resource_website: 'https://x.example' }]
    h.removeOk = false
    await render('ko')
    await act(async () => buttonByText(programsT('ko', 'tabSaved'))!.click())
    await settle()
    const unsave = container.querySelector('[data-testid="unsave-btn-s1"]') as HTMLButtonElement
    unsave.focus()
    await act(async () => unsave.click())
    await settle()
    await render('ko')
    expect(container.querySelector('[data-testid="saved-program-card-s1"]')).not.toBeNull()
    expect(container.textContent).not.toContain('row-level security')
    expect(container.querySelector('[role="status"]')?.textContent).toBe(programsT('ko', 'unsaveFailed'))
    expect(document.activeElement).toBe(container.querySelector('[data-testid="unsave-btn-s1"]'))
  })

  it('P5 / P6: the selected chip count is dark on the brand fill; saved-tile links are 24px high', async () => {
    h.savedRows = [{ id: 's1', resource_name: 'Pantry', resource_category: 'food', resource_address: null, resource_phone: '+1 555', resource_website: 'https://x.example' }]
    await render('ko')
    const all = buttonByText(programsT('ko', 'allCategories'))!
    expect(all.getAttribute('aria-pressed')).toBe('true')
    // The category is selected through setFilters (mocked): render the selected state directly.
    h.selectedCategory = 'food'
    await render('ko')
    const chips = container.querySelector(`[role="group"][aria-label="${programsT('ko', 'categoriesLabel')}"]`) as HTMLElement
    const count = chips.querySelector('button[aria-pressed="true"] span:last-child') as HTMLElement
    expect(count.className).toMatch(/bg-black\/20/)
    expect(count.className).not.toMatch(/bg-white\/20/)
    h.selectedCategory = null
    await act(async () => buttonByText(programsT('ko', 'tabSaved'))!.click())
    await settle()
    for (const a of container.querySelectorAll('[data-testid="saved-program-card-s1"] a')) expect(a.className).toMatch(/\bmin-h-6\b/)
  })

  it('P8: the one status line says loading, then how many were found', async () => {
    h.isLoading = true
    await render('ko')
    const region = container.querySelector('[role="status"]') as HTMLElement
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(region.textContent).toBe(programsT('ko', 'loadingPrograms'))
    h.isLoading = false
    await render('ko')
    expect(region.textContent).toBe(programsFound(1, 'ko'))
  })
})
