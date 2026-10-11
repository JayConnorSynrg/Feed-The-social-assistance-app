// apps/web/src/components/map/hazard-bubble-menu.viewers.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Who is offered what in the map's hazard menu, per viewer, on the REAL component (mini hook runtime;
// the session comes from a faked useAuth):
//   - a guest (anonymous session) gets the create-account prompt in their language INSTEAD of the four
//     report entries — nobody fills in a report the server refuses at Confirm;
//   - a member gets the four report entries and "Suggest a resource"; a provider also "Add yourself";
//   - the round button says which panel it opens and closes (aria-controls / aria-expanded);
//   - the suggest form's character count belongs to its textarea, and an out-of-range text is said in
//     words; the phone and website fields are left-to-right in every locale.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('react', async (orig) => (await import('@/test/mini-react')).miniReact(await orig()))

const h = vi.hoisted(() => ({ auth: { isAnonymous: false, profile: null as null | { user_role: string }, user: { id: 'u1' } as null | { id: string } } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => h.auth }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: async (_op: string, _a: unknown, fn: () => Promise<unknown>) => fn(),
}))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mount, findAll } from '@/test/mini-react'
import { alertsT } from '@/lib/i18n-feed-alerts'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import type { Locale } from '@/lib/i18n'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { HazardBubbleMenu, SuggestResourceDialog } from './hazard-bubble-menu'

type El = { type: unknown; props: Record<string, unknown> }
const byTestId = (tree: unknown, id: string) => findAll(tree, (e) => e.props['data-testid'] === id) as El[]
const REPORT_ENTRIES = ['hazard-weather', 'hazard-road-closure', 'hazard-speeding', 'hazard-general']

function menu(locale: Locale = 'en') {
  const seen = { wizard: [] as string[], placed: 0 }
  const c = mount(() =>
    HazardBubbleMenu({
      viewCenter: { lng: -72.97, lat: 43.61 },
      locale,
      onPlaceAlert: async () => (seen.placed++, { ok: false, failure: { kind: 'guest' }, requestId: 'r' }) as never,
      onAddResource: () => {},
      onWizardOpen: (type: string) => void seen.wizard.push(type),
      onWizardClose: () => {},
      onAddressGeocoded: () => {},
      stagingCoords: null,
      externalOpen: true,
    }),
  )
  return { c, seen }
}
const offered = (tree: unknown) => ({
  prompt: byTestId(tree, 'hazard-guest-prompt').length,
  report: REPORT_ENTRIES.filter((id) => byTestId(tree, id).length > 0),
  suggest: byTestId(tree, 'suggest-resource-entry').length,
  addSelf: byTestId(tree, 'add-resource-entry').length,
})

beforeEach(() => {
  h.auth = { isAnonymous: false, profile: null, user: { id: 'u1' } }
})

describe('the hazard menu, per viewer', () => {
  it('a guest: the create-account prompt, and no report entry to start a form the server would refuse', () => {
    h.auth = { isAnonymous: true, profile: null, user: { id: 'anon' } }
    const { c, seen } = menu()
    expect(offered(c.tree())).toEqual({ prompt: 1, report: [], suggest: 0, addSelf: 0 })
    const prompt = findAll(byTestId(c.tree(), 'hazard-guest-prompt')[0], (e) => e.type === CreateAccountPrompt)[0] as El
    expect(prompt.props).toEqual({ message: alertsT('en', 'failGuest'), linkLabel: feedChromeT('en', 'createAccount') })
    expect(seen.wizard).toEqual([])
  })

  it('a guest reads the prompt in their own language, with a link to sign up', () => {
    h.auth = { isAnonymous: true, profile: null, user: { id: 'anon' } }
    const { c } = menu('es')
    const prompt = findAll(byTestId(c.tree(), 'hazard-guest-prompt')[0], (e) => e.type === CreateAccountPrompt)[0] as El
    expect(prompt.props).toEqual({ message: alertsT('es', 'failGuest'), linkLabel: feedChromeT('es', 'createAccount') })
    expect(prompt.props.message).not.toBe(alertsT('en', 'failGuest'))
    const html = renderToStaticMarkup(createElement(CreateAccountPrompt, prompt.props as never))
    expect(html).toContain(alertsT('es', 'failGuest'))
    expect(html).toMatch(/<a [^>]*href="\/signup"/)
  })

  it('a member: the four report entries and "Suggest a resource"; no prompt', () => {
    const { c, seen } = menu()
    expect(offered(c.tree())).toEqual({ prompt: 0, report: REPORT_ENTRIES, suggest: 1, addSelf: 0 })
    ;(byTestId(c.tree(), 'hazard-road-closure')[0].props.onClick as () => void)()
    expect(seen.wizard).toEqual(['road_closure'])
  })

  it('a provider: also "Add yourself as a resource"', () => {
    h.auth = { isAnonymous: false, profile: { user_role: 'providing' }, user: { id: 'u1' } }
    expect(offered(menu().c.tree())).toEqual({ prompt: 0, report: REPORT_ENTRIES, suggest: 1, addSelf: 1 })
  })

  it('the round button names the panel it controls, in the viewer’s language', () => {
    const { c } = menu('ar')
    const trigger = byTestId(c.tree(), 'hazard-menu-trigger')[0]
    const panel = byTestId(c.tree(), 'hazard-panel')[0]
    expect(trigger.props['aria-controls']).toBe('hazard-panel')
    expect(panel.props.id).toBe('hazard-panel')
    expect(trigger.props['aria-expanded']).toBe(true)
    expect(trigger.props['aria-label']).toBe(alertsT('ar', 'hazardClose'))
    expect([trigger.props.lang, panel.props.lang, panel.props.dir]).toEqual(['ar', 'ar', 'rtl'])
  })
})

describe('the report form’s fields can be seen', () => {
  it('the address field has a 3:1 edge, a readable placeholder and a focus ring that survives forced colours', () => {
    const { c } = menu()
    ;(byTestId(c.tree(), 'hazard-road-closure')[0].props.onClick as () => void)()
    c.rerender()
    const address = findAll(c.tree(), (e) => e.props.id === 'wizard-address')[0] as El
    const cls = String(address.props.className).split(' ')
    // "!": the edge colour is important, or the app's unlayered `* { border-color }` rule wins and
    // the edge renders pale grey (measured in Chromium: scratch lasttouch/run.mjs, claim 22a).
    expect(cls).toEqual(expect.arrayContaining(['border', 'border-stone-500!', 'placeholder:text-stone-500', 'focus:outline-hidden', 'focus:ring-2']))
    expect(cls.filter((x) => x.includes('outline-none') || /^border-stone-\d+$/.test(x) || x === 'placeholder:text-stone-400')).toEqual([])
    const description = findAll(c.tree(), (e) => e.props.id === 'wizard-description')[0] as El
    expect(String(description.props.className)).toContain('placeholder:text-stone-500')
  })

  it('the suggest form’s placeholders are stone-500 too', () => {
    const c = mount(() => SuggestResourceDialog({ open: true, onClose: () => {}, locale: 'en' }))
    for (const id of ['suggest-name-input', 'suggest-description-input', 'suggest-city-input', 'suggest-state-input', 'suggest-phone-input', 'suggest-website-input']) {
      const cls = String(byTestId(c.tree(), id)[0].props.className)
      expect(cls, id).toContain('placeholder:text-stone-500')
      expect(cls, id).not.toContain('placeholder:text-stone-400')
    }
  })
})

describe('the suggest-a-resource form', () => {
  function form(locale: Locale = 'en') {
    const c = mount(() => SuggestResourceDialog({ open: true, onClose: () => {}, locale }))
    const type = (testId: string, value: string) => {
      ;(byTestId(c.tree(), testId)[0].props.onChange as (e: unknown) => void)({ target: { value } })
      c.rerender()
    }
    return { c, type }
  }
  const textOf = (el: El | undefined): string => {
    const walk = (n: unknown): string => (Array.isArray(n) ? n.map(walk).join('') : typeof n === 'string' || typeof n === 'number' ? String(n) : n && typeof n === 'object' && 'props' in n ? walk((n as El).props.children) : '')
    return el ? walk(el.props.children) : ''
  }

  it('the character count is the textarea’s description; an empty field is not called invalid', () => {
    const { c } = form()
    const textarea = byTestId(c.tree(), 'suggest-description-input')[0]
    const count = byTestId(c.tree(), 'suggest-description-count')[0]
    expect(textarea.props['aria-describedby']).toBe(count.props.id)
    expect(count.props.id).toBe('suggest-description-count')
    expect(textarea.props['aria-invalid']).toBeUndefined()
    expect(byTestId(c.tree(), 'suggest-description-invalid')).toHaveLength(0)
  })

  it('a text that is too short or too long is marked invalid and said in words inside that description', () => {
    for (const [text, invalid] of [['short', true], ['x'.repeat(10), false], ['x'.repeat(500), false], ['x'.repeat(501), true]] as const) {
      const { c, type } = form()
      type('suggest-description-input', text)
      const textarea = byTestId(c.tree(), 'suggest-description-input')[0]
      const count = byTestId(c.tree(), 'suggest-description-count')[0]
      expect(textarea.props['aria-invalid'], `${text.length} chars`).toBe(invalid ? true : undefined)
      const said = findAll(count, (e) => e.props['data-testid'] === 'suggest-description-invalid') as El[]
      expect(said.map(textOf), `${text.length} chars`).toEqual(invalid ? [alertsT('en', 'suggestCountInvalid')] : [])
      expect(textOf(count)).toContain(String(text.length))
    }
  })

  it('the words are the viewer’s (es), not English', () => {
    const { c, type } = form('es')
    type('suggest-description-input', 'corto')
    expect(textOf(byTestId(c.tree(), 'suggest-description-invalid')[0])).toBe(alertsT('es', 'suggestCountInvalid'))
    expect(alertsT('es', 'suggestCountInvalid')).not.toBe(alertsT('en', 'suggestCountInvalid'))
  })

  it('phone and website are typed left to right in a right-to-left locale too; they are a telephone field and a URL field', () => {
    const { c } = form('ar')
    const phone = byTestId(c.tree(), 'suggest-phone-input')[0]
    const website = byTestId(c.tree(), 'suggest-website-input')[0]
    expect([phone.props.dir, phone.props.type]).toEqual(['ltr', 'tel'])
    expect([website.props.dir, website.props.type]).toEqual(['ltr', 'url'])
  })

  it('the URL field does not start refusing an address typed without "https://": the browser’s own validation is off', () => {
    const { c } = form()
    expect(byTestId(c.tree(), 'suggest-resource-form')[0].props.noValidate).toBe(true)
  })
})
