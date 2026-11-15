// @vitest-environment jsdom
// apps/web/src/app/error-screens.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W6 — the error screens in the viewer's language, in a real DOM: app/error.tsx and the panel
// fallback (components/layout/panel-error-boundary.tsx) read useProfileLocale, carry lang/dir on their
// own root, show the shared heading / body / Try again / Go home of lib/i18n.ts and the reference line,
// and still put focus on their heading / message. A source scan keeps the W6 pages free of the
// patterns earlier waves removed (raw error text, `disabled` busy buttons, the OAuth detail).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logEvent: vi.fn() }))

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { t } from '@/lib/i18n'
import { errorsT } from '@/lib/i18n-errors'
import AppError from './error'
import { PanelErrorBoundary } from '@/components/layout/panel-error-boundary'

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function Boom(): never {
  throw new Error('boom')
}

describe('error screens in the viewer language', () => {
  it('app/error.tsx in Korean: lang on its card, the shared words, the reference line, focus on the heading', async () => {
    const error = Object.assign(new Error('x'), { digest: 'abc123' })
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ko' }, el(AppError, { error, reset: () => {} }))))
    const card = container.querySelector('[lang]') as HTMLElement
    expect(card).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(container.querySelector('h1')?.textContent).toBe(t('ko', 'heading'))
    expect(container.textContent).toContain(t('ko', 'body'))
    expect(container.textContent).toContain(errorsT('ko', 'errorRef').replace('{digest}', 'abc123'))
    expect(container.textContent).toContain(t('ko', 'tryAgain'))
    expect(container.textContent).toContain(t('ko', 'goHome'))
    expect(container.textContent).not.toMatch(/Something went wrong|ref:/)
    expect(document.activeElement).toBe(container.querySelector('h1'))
  })

  it('the panel fallback in Arabic: rtl, translated, the message focused', async () => {
    await act(async () => root.render(el(InitialLocaleContext.Provider, { value: 'ar' }, el(PanelErrorBoundary, null, el(Boom)))))
    const fallback = container.querySelector('[lang]') as HTMLElement
    expect(fallback).toMatchObject({ lang: 'ar', dir: 'rtl' })
    expect(container.querySelector('p')?.textContent).toBe(errorsT('ar', 'panelError'))
    expect(container.querySelector('button')?.textContent).toBe(t('ar', 'tryAgain'))
    expect(document.activeElement).toBe(container.querySelector('p'))
  })
})

describe('source guards on the W6 pages', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const AUTH = ['./(auth)/login/page.tsx', './(auth)/signup/page.tsx', './(auth)/forgot-password/page.tsx', './(auth)/reset-password/page.tsx']

  it.each(AUTH)('%s: no raw error text on screen, no `disabled` busy controls, lang on its root', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(/setError\(\s*err(or)?\s+instanceof\s+Error\s*\?\s*err(or)?\.message/)
    expect(src).not.toMatch(/(?<![-\w])disabled=\{/)
    expect(src).toMatch(/lang=\{locale\}\s+dir=\{dir\(locale\)\}/)
    expect(src).not.toMatch(/oauthDetail|searchParams\.get\('detail'\)/)
  })

  it('the programs panel shows no hook text as is and no English placeholder of its own', () => {
    const src = read('../components/panels/programs-panel.tsx')
    expect(src).not.toMatch(/\{error\}|\{programSearchError\.message\}/)
    expect(src).not.toMatch(/placeholder="[A-Z]/)
    expect(src).toMatch(/lang=\{locale\} dir=\{dir\(locale\)\}/)
  })
})
