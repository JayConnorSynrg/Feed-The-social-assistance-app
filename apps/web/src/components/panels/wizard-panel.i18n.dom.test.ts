// @vitest-environment jsdom
// apps/web/src/components/panels/wizard-panel.i18n.dom.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// P6 W7 — the Get Help wizard in the member's language, in a real DOM (jsdom, createRoot, act):
//   - the cards and every step read in the language, with lang/dir on the panel (Korean; Arabic
//     rtl); Medicaid / Medicare are marked English; no English sentence is left;
//   - values stay values: the same answers picked in English and in Korean hand the Assistant the
//     same wizardContext, flow and log rows, and the same message, byte for byte;
//   - Label in Name in 14 locales: every card, option, Back, Cancel and Continue is named by its
//     visible words (no aria-label);
//   - focus goes to the step's heading on open, next and Back; Back on step 1 and Cancel return it
//     to the card that opened the wizard; each step is keyed (the filter never carries over);
//   - options are a group named by the question and described by the visible hint; the status
//     and alert lines are always mounted and speak through announce(); Continue is aria-disabled,
//     never disabled, and an empty press says why without moving on;
//   - RTL and contrast by construction: logical classes, a mirrored chevron, stone-500 borders.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, createElement as el } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const h = vi.hoisted(() => ({
  language: 'en',
  setPanelParams: vi.fn(),
  setActivePanel: vi.fn(),
  info: vi.fn(),
}))
vi.mock('@/components/layout/feed-shell', () => ({
  usePanelContext: () => ({ setActivePanel: h.setActivePanel, setPanelParams: h.setPanelParams }),
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: { preferred_language: h.language } }) }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: h.info, warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from '@/lib/i18n'
import { assistantT } from '@/lib/i18n-assistant'
import { filterMatches, getHelpT, wizardCategoryLabel, wizardLabelText } from '@/lib/i18n-get-help'
import { usStateName } from '@/lib/i18n-us-states'
import { CATEGORY_WIZARDS } from '@/lib/ai/resource-wizard-config'
import { buildWizardPrompt, parseWizardContext } from '@/lib/ai/wizard-prompt'
import { WizardPanel } from './wizard-panel'
import { FILTER_ANNOUNCE_DELAY_MS } from './resource-wizard'

const LOCALES = Object.keys(messages) as Locale[]
let container: HTMLDivElement
let root: Root
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  h.setPanelParams.mockReset()
  h.setActivePanel.mockReset()
  h.info.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  document.body.innerHTML = ''
})

async function render(locale: Locale) {
  h.language = locale
  await act(async () => root.render(el(WizardPanel)))
}
const buttons = () => [...container.querySelectorAll('button')] as HTMLButtonElement[]
const byText = (text: string) => buttons().find((b) => b.textContent?.trim() === text)
async function click(b: Element | undefined) {
  expect(b, 'button to click').toBeTruthy()
  await act(async () => (b as HTMLButtonElement).click())
}
const card = (id: string) => buttons().find((b) => b.textContent?.startsWith(wizardCategoryLabel(id, h.language as Locale)))
const heading = () => container.querySelector('h2') as HTMLHeadingElement
const group = () => container.querySelector('[role="group"]') as HTMLElement
const optionButtons = () => [...group().querySelectorAll('button')] as HTMLButtonElement[]
const continueButton = () => byText(assistantT(h.language as Locale, 'flowContinue'))
// Wait out the filter's pause in short act() slices, so each timer that fires renders on its own
// (one act() around the whole wait would batch several announcements into one).
async function pause() {
  for (let t = 0; t < FILTER_ANNOUNCE_DELAY_MS + 100; t += 25) await act(async () => { await new Promise((r) => setTimeout(r, 25)) })
}
async function typeFilter(value: string) {
  const input = container.querySelector('input') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** Food: two pantries-type answers, 3 people, California, email — chosen by position, not by words. */
async function completeFood(locale: Locale) {
  await render(locale)
  await click(card('food'))
  await click(optionButtons()[0])
  await click(optionButtons()[1])
  await click(continueButton())
  await click(optionButtons()[2])
  await click(optionButtons().find((b) => b.textContent === usStateName('CA', locale)))
  await click(optionButtons()[2])
}

describe('the cards and the steps in the member’s language', () => {
  it('Korean: heading, subtitle, every card; the panel is marked ko', async () => {
    await render('ko')
    expect(container.firstElementChild).toMatchObject({ lang: 'ko', dir: 'ltr' })
    expect(container.querySelector('h1')?.textContent).toBe(assistantT('ko', 'rfName'))
    expect(container.textContent).toContain(getHelpT('ko', 'subtitle'))
    for (const c of CATEGORY_WIZARDS) {
      expect(card(c.id)?.textContent).toBe(wizardCategoryLabel(c.id, 'ko') + getHelpT('ko', c.description))
    }
    expect(container.textContent).not.toMatch(/Find Resources|Select a category|SNAP, food pantries/)
    expect(container.querySelector('[lang="en"]')).toBeNull()
    // One column on a narrow phone, two from 420px, three from md.
    expect(container.querySelector('[role="group"]')?.className).toContain('grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3')
  })

  it('Korean: a step — Back, Step line, Cancel, question, hint, options, Continue', async () => {
    await render('ko')
    await click(card('food'))
    expect(container.firstElementChild).toMatchObject({ lang: 'ko' })
    expect(heading().textContent).toBe(getHelpT('ko', 'qTypeFoodAssistance'))
    expect(container.textContent).toContain('4단계 중 1단계')
    expect(byText(assistantT('ko', 'flowBack'))).toBeTruthy()
    expect(byText(assistantT('ko', 'flowCancel'))).toBeTruthy()
    expect(container.textContent).toContain(getHelpT('ko', 'hintChooseAll'))
    expect(optionButtons()[1].textContent).toBe('푸드 팬트리')
    expect(container.textContent).not.toMatch(/What type|Food pantries|Continue|Step 1 of/)
  })

  it('Arabic: right-to-left on the cards and on the wizard; the chevron is mirrored', async () => {
    await render('ar')
    expect(container.firstElementChild).toMatchObject({ lang: 'ar', dir: 'rtl' })
    await click(card('housing'))
    expect(container.firstElementChild).toMatchObject({ lang: 'ar', dir: 'rtl' })
    const back = byText(assistantT('ar', 'flowBack'))!
    expect(back.querySelector('svg')?.getAttribute('class')).toContain('rtl:-scale-x-100')
  })

  it('the state step: names in the locale; Medicaid and Medicare marked English', async () => {
    await render('es')
    await click(card('healthcare'))
    await click(optionButtons()[0])
    await click(continueButton())
    const medicaid = [...group().querySelectorAll('[lang="en"]')].map((n) => n.textContent)
    expect(medicaid).toEqual(['Medicaid', 'Medicare'])
    await click(optionButtons()[0])
    expect(optionButtons().map((b) => b.textContent)).toContain('Carolina del Norte')
  })
})

describe('values stay values: English and Korean hand the Assistant the same bytes', () => {
  async function outbound(locale: Locale) {
    await completeFood(locale)
    expect(h.setPanelParams).toHaveBeenCalledTimes(1)
    const params = h.setPanelParams.mock.calls[0][0] as { flow: string; wizardContext: string }
    const ctx = parseWizardContext(params.wizardContext)!
    return { params, prompt: buildWizardPrompt(ctx.category, ctx.answers), log: h.info.mock.calls, panel: h.setActivePanel.mock.calls }
  }

  it('wizardContext, flow, panel switch, log rows and the Assistant message are identical', async () => {
    const en = await outbound('en')
    act(() => root.unmount())
    root = createRoot(container)
    h.setPanelParams.mockReset()
    h.setActivePanel.mockReset()
    h.info.mockReset()
    const ko = await outbound('ko')
    expect(ko.params).toEqual(en.params)
    expect(ko.params.wizardContext).toBe(en.params.wizardContext)
    expect(ko.prompt).toBe(en.prompt)
    expect(ko.log).toEqual(en.log)
    expect(ko.panel).toEqual([['chat']])
    expect(JSON.parse(en.params.wizardContext)).toEqual({
      category: 'food',
      answers: { 'assistance-type': ['SNAP/EBT benefits', 'food pantries'], 'household-size': '3 people', state: 'California', contact: 'email' },
    })
    expect(en.prompt).toBe(
      'I need help finding Food resources.\n- Type of help: SNAP/EBT benefits, food pantries\n- State: California\n' +
        'Please suggest relevant local programs and resources for this need.',
    )
  })
})

describe('Label in Name', () => {
  it.each(LOCALES)('%s: cards, options, Back, Cancel, Continue are named by their words', async (l) => {
    await render(l)
    for (const b of buttons()) expect(b.getAttribute('aria-label')).toBeNull()
    for (const c of CATEGORY_WIZARDS) expect(card(c.id)?.textContent?.startsWith(wizardCategoryLabel(c.id, l))).toBe(true)
    await click(card('food'))
    for (const b of buttons()) expect(b.getAttribute('aria-label')).toBeNull()
    expect(byText(assistantT(l, 'flowBack'))).toBeTruthy()
    expect(byText(assistantT(l, 'flowCancel'))).toBeTruthy()
    expect(continueButton()).toBeTruthy()
    const food = CATEGORY_WIZARDS[0].steps[0]
    expect(optionButtons().map((b) => b.textContent)).toEqual(food.options.map((o) => wizardLabelText(o.label, l)))
  })
})

describe('focus', () => {
  it('opening, each answer and Back put focus on the step heading', async () => {
    await render('ko')
    await click(card('jobs'))
    expect(document.activeElement).toBe(heading())
    expect(heading().tabIndex).toBe(-1)
    await click(optionButtons()[0])
    await click(continueButton())
    expect(heading().textContent).toBe(getHelpT('ko', 'qWouldDescribeWorkExperience'))
    expect(document.activeElement).toBe(heading())
    await click(byText(assistantT('ko', 'flowBack')))
    expect(heading().textContent).toBe(getHelpT('ko', 'qTypeCareer'))
    expect(document.activeElement).toBe(heading())
  })

  it('Back on the first step returns focus to the card that opened the wizard', async () => {
    await render('ko')
    await click(card('legal'))
    await click(byText(assistantT('ko', 'flowBack')))
    expect(heading()).toBeNull()
    expect(document.activeElement).toBe(card('legal'))
  })

  it('Cancel, on any step, returns focus to the card', async () => {
    await render('fr')
    await click(card('free_camping'))
    await click(optionButtons()[0])
    await click(continueButton())
    await click(byText(assistantT('fr', 'flowCancel')))
    expect(document.activeElement).toBe(card('free_camping'))
  })
})

describe('each step is its own', () => {
  it('a filter typed on the state step is gone after Back and forward again', async () => {
    await render('en')
    await click(card('food'))
    await click(optionButtons()[0])
    await click(continueButton())
    await click(optionButtons()[0])
    await typeFilter('cal')
    expect(optionButtons().map((b) => b.textContent)).toEqual(['California'])
    await click(byText('Back'))
    await click(optionButtons()[0])
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('')
    expect(optionButtons()).toHaveLength(51)
  })
})

describe('groups, hints and live regions', () => {
  it('options are a group named by the question and described by the visible hint', async () => {
    await render('vi')
    await click(card('transportation'))
    const g = group()
    expect(g.getAttribute('aria-labelledby')).toBe(heading().id)
    const hint = document.getElementById(g.getAttribute('aria-describedby')!)!
    expect(hint.textContent).toBe(getHelpT('vi', 'hintChooseAll'))
    await click(optionButtons()[0])
    expect(optionButtons()[0].getAttribute('aria-pressed')).toBe('true')
    expect(optionButtons()[1].getAttribute('aria-pressed')).toBe('false')
    await click(continueButton())
    const hint2 = document.getElementById(group().getAttribute('aria-describedby')!)!
    expect(hint2.textContent).toBe(getHelpT('vi', 'hintChooseOne'))
  })

  it('the status and alert lines are mounted before anything happens', async () => {
    await render('ko')
    await click(card('food'))
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('')
  })

  it('Continue with nothing chosen: aria-disabled (never disabled), stays on the step, says why — once per press', async () => {
    await render('ko')
    await click(card('food'))
    const cont = continueButton()!
    expect(cont.getAttribute('aria-disabled')).toBe('true')
    expect(cont.hasAttribute('disabled')).toBe(false)
    expect(cont.className).toContain('bg-stone-200')
    expect(cont.className).toContain('text-stone-700')
    expect(cont.className).not.toMatch(/opacity/)
    const alert = container.querySelector('[role="alert"]')!
    const inserted: Node[] = []
    const obs = new MutationObserver((ms) => ms.forEach((m) => inserted.push(...m.addedNodes)))
    obs.observe(alert, { childList: true, subtree: true })
    await click(cont)
    await click(cont)
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    obs.disconnect()
    expect(heading().textContent).toBe(getHelpT('ko', 'qTypeFoodAssistance'))
    expect(alert.textContent).toBe(getHelpT('ko', 'chooseAtLeastOne'))
    expect(inserted.filter((n) => n.nodeType === 1)).toHaveLength(2)
    await click(optionButtons()[0])
    expect(alert.textContent).toBe('')
    expect(continueButton()!.getAttribute('aria-disabled')).toBe('false')
  })

  it('the filter has a visible label and speaks its result in the status line', async () => {
    await render('ru')
    await click(card('housing'))
    await click(optionButtons()[0])
    await click(continueButton())
    await click(optionButtons()[0])
    const input = container.querySelector('input') as HTMLInputElement
    expect(container.querySelector(`label[for="${input.id}"]`)?.textContent).toBe(getHelpT('ru', 'filterLabel'))
    expect(input.getAttribute('placeholder')).toBeNull()
    await typeFilter('Нью')
    await pause()
    const n = optionButtons().length
    expect(n).toBeGreaterThan(1)
    expect(container.querySelector('[role="status"]')?.textContent).toBe(filterMatches(n, 'ru'))
    await typeFilter('zzz')
    await pause()
    expect(container.querySelector('[role="status"]')?.textContent).toBe(getHelpT('ru', 'filterNone'))
    expect(container.textContent).toContain(getHelpT('ru', 'filterNone'))
  })
})

describe('the filter, typed fast (P6 W7 review F2)', () => {
  async function toStateStep(locale: Locale) {
    await render(locale)
    await click(card('food'))
    await click(optionButtons()[0])
    await click(continueButton())
    await click(optionButtons()[0])
  }

  it('four quick keystrokes: nothing spoken while typing, then exactly one status node with the final count', async () => {
    await toStateStep('en')
    const status = container.querySelector('[role="status"]')!
    const inserted: Node[] = []
    const obs = new MutationObserver((ms) => ms.forEach((m) => inserted.push(...[...m.addedNodes].filter((n) => n.nodeType === 1))))
    obs.observe(status, { childList: true, subtree: true })
    for (const v of ['N', 'Ne', 'New', 'New ']) {
      await typeFilter(v)
      await act(async () => { await new Promise((r) => setTimeout(r, 40)) })
    }
    expect(status.textContent).toBe('')
    await pause()
    obs.disconnect()
    expect(optionButtons()).toHaveLength(4)
    expect(inserted).toHaveLength(1)
    expect(status.textContent).toBe(filterMatches(4, 'en'))
  })

  it('clearing the box before the pause speaks nothing', async () => {
    await toStateStep('en')
    await typeFilter('Tex')
    await typeFilter('')
    await pause()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('')
  })

  it('a Russian member typing the English name finds the state (matched on the value too)', async () => {
    await toStateStep('ru')
    await typeFilter('Texas')
    expect(optionButtons().map((b) => b.textContent)).toEqual([usStateName('TX', 'ru')])
    await pause()
    expect(container.querySelector('[role="status"]')?.textContent).toBe(filterMatches(1, 'ru'))
  })
})

describe('RTL and contrast by construction (source)', () => {
  const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
  it.each(['./wizard-panel.tsx', './resource-wizard.tsx'])('%s: logical spacing, no dimmed or low-contrast classes', (f) => {
    const src = read(f)
    expect(src).not.toMatch(/\b(text-left|text-right|left-\d|right-\d|pl-\d|pr-\d|ml-\d|mr-\d)\b/)
    expect(src).not.toMatch(/\btext-stone-(300|400|500)\b|\bborder-stone-(200|300)\b|opacity-|(?<![-\w])disabled=\{/)
  })
})
