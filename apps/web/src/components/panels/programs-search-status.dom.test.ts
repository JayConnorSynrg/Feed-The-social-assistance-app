// @vitest-environment jsdom
// apps/web/src/components/panels/programs-search-status.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W6 (PR #256 round 3): Browse Programs' search status never says anything false. With the REAL
// useResourceSearch (debounced search_resources RPC, faked at the client): while the member types
// and before the search for that exact query has answered, the one status line reads "Searching…";
// "No results" appears only after the search for the current query has finished and returned none.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  calls: [] as string[],
  release: [] as Array<() => void>,
}))

vi.mock('@/hooks/use-program-browser', () => ({
  useProgramBrowser: () => ({
    programs: [], categories: [], isLoading: false, error: null,
    filters: { category: null, search: '', state: 'CA' }, setFilters: vi.fn(), totalCount: 0,
  }),
}))
vi.mock('@/hooks/use-saved-resources', () => ({
  useSavedResources: () => ({ savedResources: [], isLoading: false, error: null, removeResource: async () => true, saveResource: async () => true, isResourceSaved: () => false }),
}))
vi.mock('@/components/layout/feed-shell', () => ({ usePanelContext: () => ({ setActivePanel: vi.fn(), setPanelParams: vi.fn() }) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null, user: { id: 'me' } }) }))
vi.mock('@/lib/post-rpc', () => ({ createPost: async () => ({ ok: true }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))
// search_resources answers [] only when the test releases it.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (_fn: string, args: { p_query: string }) => ({
      abortSignal: () => {
        h.calls.push(args.p_query)
        return new Promise((resolve) => h.release.push(() => resolve({ data: [], error: null })))
      },
    }),
  }),
}))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { formatMessage } from '@/lib/format-message'
import { programsT } from '@/lib/i18n-programs'
import { ProgramsPanel } from './programs-panel'

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  h.calls = []
  h.release = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
function type(value: string) {
  const input = container.querySelector('#programs-search') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('search status line', () => {
  it('typing two characters with no results: "Searching…" until the search for "ab" answers, then "No results" for "ab"', async () => {
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(ProgramsPanel))))
    await wait(0)
    const status = container.querySelector('[role="status"]') as HTMLElement
    const seen: string[] = []
    const observer = new MutationObserver(() => seen.push(status.textContent ?? ''))
    observer.observe(status, { childList: true, subtree: true, characterData: true })
    const noResults = (q: string) => formatMessage(programsT('ko', 'noResults'), { query: q })

    type('a')
    await wait(0)
    type('ab')
    await wait(0)
    expect(status.textContent).toBe(programsT('ko', 'searching'))
    await wait(350) // the debounce fires: the search for "ab" is in flight
    expect(h.calls).toEqual(['ab'])
    expect(status.textContent).toBe(programsT('ko', 'searching'))
    expect(seen.some((t) => t.includes(noResults('a')) || t.includes(noResults('ab')))).toBe(false)

    await act(async () => { h.release.forEach((r) => r()); await Promise.resolve() })
    await wait(0)
    observer.disconnect()
    expect(status.textContent).toBe(noResults('ab'))
    expect(seen.some((t) => t.includes(noResults('a')))).toBe(false)
  })

  it('a new keystroke while a search is in flight returns to "Searching…" (the older answer is dropped)', async () => {
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(ProgramsPanel))))
    await wait(0)
    const status = container.querySelector('[role="status"]') as HTMLElement
    type('ab')
    await wait(350)
    expect(h.calls).toEqual(['ab'])
    type('abc')
    await wait(0)
    await act(async () => { h.release[0](); await Promise.resolve() }) // the "ab" answer arrives late
    await wait(0)
    expect(status.textContent).toBe(programsT('ko', 'searching'))
    expect(status.textContent).not.toContain(formatMessage(programsT('ko', 'noResults'), { query: 'abc' }))
  })
})
