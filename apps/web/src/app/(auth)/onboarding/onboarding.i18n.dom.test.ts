// @vitest-environment jsdom
// apps/web/src/app/(auth)/onboarding/onboarding.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W8 — onboarding in the new member's language, with React's real scheduling in a real DOM
// (jsdom, createRoot, act). The locale comes as the root layout hands it over
// (InitialLocaleContext: the feed_locale cookie, else Accept-Language); the profile is not loaded.
//   - every step is in the member's language, lang/dir on the page root (Korean text, Arabic rtl);
//   - the profile row the page saves is byte-identical in English and Korean (only labels change);
//   - focus moves to each step's heading on Continue and Back, never to <body>;
//   - Continue on an unfinished step is aria-disabled (stone-200/700), stays put, and says why in
//     the one always-mounted alert; a busy Get Started is aria-disabled and a second press sends
//     nothing;
//   - a failed save shows a translated line, never the server's text, and its one existing log row
//     carries the code only;
//   - "Skip for now" (step 1 too) says what it does: it opens FEED;
//   - fields have persistent labels; Label in Name holds in all 14 locales.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const h = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  updateError: null as null | { code: string; message: string },
  gate: null as null | Promise<void>,
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => h.router }))
vi.mock('@/providers/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'user-1' }, loading: false }) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null }) }))
vi.mock('@/hooks/use-geolocation', () => ({ useGeolocation: () => ({ getCurrentPosition: async () => null }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), time: () => ({ end: vi.fn(), error: vi.fn() }) },
  logEvent: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => {
  const chain = (result: () => Promise<unknown>) => {
    const q: Record<string, unknown> = {}
    q.eq = () => q
    q.abortSignal = () => q
    q.maybeSingle = () => result()
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => result().then(ok, bad)
    return q
  }
  const client = {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        h.updates.push(payload)
        return chain(async () => {
          if (h.gate) await h.gate
          return { data: null, error: h.updateError }
        })
      },
      select: () => chain(async () => ({ data: { onboarding_completed: true }, error: null })),
    }),
  }
  return { createClient: () => client }
})

import { InitialLocaleContext } from '@/hooks/use-profile-locale'
import { logger } from '@/lib/logger'
import { messages, t, type Locale } from '@/lib/i18n'
import { onboardingT } from '@/lib/i18n-onboarding'
import { assistantT } from '@/lib/i18n-assistant'
import { formatMessage } from '@/lib/format-message'
import OnboardingPage from './page'

const LOCALES = Object.keys(messages) as Locale[]
const SERVER_TEXT = 'permission denied for table profiles (zip 05701, phone 555-0100)'

let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  h.updates = []
  h.updateError = null
  h.gate = null
  h.router.push.mockReset()
  h.router.refresh.mockReset()
  vi.mocked(logger.warn).mockClear()
  vi.mocked(logger.error).mockClear()
  vi.mocked(logger.info).mockClear()
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ features: [{ place_type: ['place'], text: 'Rutland' }, { place_type: ['region'], text: 'Vermont' }] }),
  })) as unknown as typeof fetch
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}
async function render(locale: Locale) {
  await act(async () => root.render(el(InitialLocaleContext.Provider, { value: locale }, el(OnboardingPage))))
  await settle()
}
const buttons = () => [...document.querySelectorAll('button')] as HTMLButtonElement[]
/** A button's text as assistive technology reads it: aria-hidden content (icons, emoji) left out. */
function visibleName(b: Element): string {
  const copy = b.cloneNode(true) as Element
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
  return (copy.textContent ?? '').trim()
}
const button = (text: string) => {
  const b = buttons().find((x) => visibleName(x) === text)
  expect(b, `a button reading "${text}"`).toBeTruthy()
  return b!
}
async function press(text: string) {
  await act(async () => button(text).click())
  await settle()
}
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const labelled = (text: string) => {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(text))
  expect(label, `a label "${text}"`).toBeTruthy()
  return document.getElementById(label!.htmlFor) as HTMLInputElement
}
const heading = () => document.querySelector('h1') as HTMLHeadingElement
const alertText = () => (document.querySelector('[role="alert"]')?.textContent ?? '').trim()
const pageRoot = () => container.firstElementChild as HTMLElement

/** Walk all five steps the same way in any locale; returns the saved payload. */
async function completeAll(locale: Locale) {
  const o = (k: Parameters<typeof onboardingT>[1]) => onboardingT(locale, k)
  const next = assistantT(locale, 'flowContinue')
  await render(locale)
  await press(`${o('roleBoth')}${o('roleBothBody')}`)
  await press(next)
  type(labelled(o('zipCode')), '05701')
  await press(next)
  await press(o('needFood'))
  await press(o('needLegal'))
  await press(next)
  type(labelled(o('phone')), '555-0100')
  await press(next)
  await press(o('getStarted'))
}

describe('the page is in the member\'s language', () => {
  it('Korean: lang="ko" dir="ltr" on the root, and step 1 reads in Korean', async () => {
    await render('ko')
    expect(pageRoot().getAttribute('lang')).toBe('ko')
    expect(pageRoot().getAttribute('dir')).toBe('ltr')
    expect(heading().textContent).toBe(onboardingT('ko', 'step1Title'))
    const text = container.textContent ?? ''
    for (const k of ['step1Body', 'roleSeeker', 'roleSourcer', 'roleBoth', 'skipForNow'] as const) expect(text, k).toContain(onboardingT('ko', k))
    expect(text).toContain(assistantT('ko', 'flowContinue'))
    for (const english of ["I'm here to", 'Seeker', 'Continue', 'Skip for now']) expect(text).not.toContain(english)
  })

  it('Arabic: dir="rtl"; the arrows mirror', async () => {
    await render('ar')
    expect(pageRoot().getAttribute('dir')).toBe('rtl')
    for (const svg of container.querySelectorAll('svg.lucide-arrow-right, svg.lucide-arrow-left')) {
      expect(svg.getAttribute('class')).toContain('rtl:-scale-x-100')
    }
  })
})

describe('only labels change: the saved profile is identical in English and Korean', () => {
  it('en vs ko: the same user_role, needs, zip, phone, language and flags', async () => {
    await completeAll('en')
    const en = { ...h.updates.at(-1) }
    act(() => root.unmount())
    root = createRoot(container)
    h.updates = []
    await completeAll('ko')
    const ko = { ...h.updates.at(-1) }
    delete en.updated_at
    delete ko.updated_at
    expect(ko).toEqual(en)
    expect(en).toMatchObject({ user_role: 'both', needs: ['food', 'legal'], zip_code: '05701', phone: '555-0100', preferred_language: 'en', onboarding_completed: true })
    expect(h.router.push).toHaveBeenCalledWith('/')
  })
})

describe('focus follows the step', () => {
  it('Continue and Back move focus to the new step\'s heading; the step line names it', async () => {
    await render('ko')
    await press(`${onboardingT('ko', 'roleSeeker')}${onboardingT('ko', 'roleSeekerBody')}`)
    await press(assistantT('ko', 'flowContinue'))
    expect(document.activeElement).toBe(heading())
    expect(heading().textContent).toBe(onboardingT('ko', 'step2Title'))
    const line = document.getElementById(heading().getAttribute('aria-describedby') ?? '')
    expect(line?.textContent).toBe(formatMessage(assistantT('ko', 'flowStep'), { current: '2', total: '5' }))
    await press(assistantT('ko', 'flowBack'))
    expect(document.activeElement).toBe(heading())
    expect(heading().textContent).toBe(onboardingT('ko', 'step1Title'))
  })
})

describe('an unfinished step says why', () => {
  it('Continue before a choice: aria-disabled (never disabled), stone-200/700, stays on step 1, the alert explains', async () => {
    await render('ko')
    const next = button(assistantT('ko', 'flowContinue'))
    expect(next.getAttribute('aria-disabled')).toBe('true')
    expect(next.disabled).toBe(false)
    expect(next.className).toContain('bg-stone-200')
    expect(next.className).toContain('text-stone-700')
    // No dimming: the only opacity rule left is the base :disabled one, and the button is never disabled.
    expect(next.className).not.toMatch(/(^|\s)opacity-/)
    await press(assistantT('ko', 'flowContinue'))
    expect(heading().textContent).toBe(onboardingT('ko', 'step1Title'))
    expect(alertText()).toBe(onboardingT('ko', 'chooseRole'))
  })

  it('the alert region is mounted from the first render, and each failure inserts a new node', async () => {
    await render('ko')
    const region = document.querySelector('[role="alert"]')!
    expect(region).toBeTruthy()
    await press(assistantT('ko', 'flowContinue'))
    const first = region.firstElementChild
    await press(assistantT('ko', 'flowContinue'))
    expect(region.firstElementChild).not.toBe(first)
    expect(region.textContent).toBe(onboardingT('ko', 'chooseRole'))
  })
})

describe('a failed save', () => {
  it('shows the translated line, never the server\'s text, and logs the code only in its existing row', async () => {
    h.updateError = { code: '42501', message: SERVER_TEXT }
    await completeAll('ko')
    expect(alertText()).toContain(onboardingT('ko', 'saveFailed'))
    expect(container.textContent).not.toContain('permission denied')
    expect(button(t('ko', 'tryAgain'))).toBeTruthy()
    const rows = [...vi.mocked(logger.error).mock.calls, ...vi.mocked(logger.warn).mock.calls]
    expect(JSON.stringify(rows)).not.toContain('permission denied')
    expect(JSON.stringify(rows)).not.toContain('05701')
    const failed = vi.mocked(logger.error).mock.calls.filter(([event]) => String(event).startsWith('onboarding.'))
    expect(failed).toHaveLength(1)
    expect(failed[0][0]).toBe('onboarding.save.failed')
    expect(failed[0][1]).toEqual({ code: '42501' })
    expect(failed[0][2]).toMatchObject({ code: '42501', step: 'main_write' })
    expect(h.router.push).not.toHaveBeenCalled()
  })

  it('a busy Get Started is aria-disabled and a second press sends nothing', async () => {
    let release = () => {}
    h.gate = new Promise<void>((r) => { release = r })
    const o = (k: Parameters<typeof onboardingT>[1]) => onboardingT('ko', k)
    await render('ko')
    await press(`${o('roleSeeker')}${o('roleSeekerBody')}`)
    await press(assistantT('ko', 'flowContinue'))
    type(labelled(o('zipCode')), '05701')
    await press(assistantT('ko', 'flowContinue'))
    await press(o('needFood'))
    await press(assistantT('ko', 'flowContinue'))
    await press(assistantT('ko', 'flowContinue'))
    await act(async () => button(o('getStarted')).click())
    const busy = button(o('saving'))
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect(busy.disabled).toBe(false)
    const sent = h.updates.length
    await act(async () => busy.click())
    expect(h.updates.length).toBe(sent)
    expect(document.activeElement === document.body).toBe(false)
    await act(async () => release())
    await settle()
  })
})

describe('Skip for now opens FEED, and says so', () => {
  it('step 1 offers "Skip for now", which saves the flag and goes to /', async () => {
    await render('ko')
    await press(onboardingT('ko', 'skipForNow'))
    expect(h.updates.at(-1)).toMatchObject({ onboarding_completed: true })
    expect(h.router.push).toHaveBeenCalledWith('/')
  })
})

describe('fields keep a persistent label', () => {
  it('ZIP, City, State, Phone and the language select are each named by a visible label', async () => {
    await render('ko')
    await press(`${onboardingT('ko', 'roleSeeker')}${onboardingT('ko', 'roleSeekerBody')}`)
    await press(assistantT('ko', 'flowContinue'))
    for (const k of ['zipCode', 'city', 'stateLabel'] as const) expect(labelled(onboardingT('ko', k)).tagName).toBe('INPUT')
  })
})

describe('Label in Name, all 14 locales', () => {
  it.each(LOCALES)('%s: every button\'s accessible name starts with its visible text', async (locale) => {
    await render(locale)
    for (const b of buttons()) {
      const visible = visibleName(b)
      expect(visible, 'a button has visible text').not.toBe('')
      const name = b.getAttribute('aria-label')
      if (name) expect(name.startsWith(visible)).toBe(true)
    }
    const roleButtons = buttons().filter((b) => b.hasAttribute('aria-pressed'))
    expect(roleButtons).toHaveLength(3)
  })
})
