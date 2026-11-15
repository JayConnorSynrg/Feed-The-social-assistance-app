// apps/web/src/lib/i18n-assistant.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The AI Assistant dictionary (lib/i18n-assistant.ts):
//   - parity (src/test/dictionary-parity.ts): 14 locales, English key set, no empty value, the
//     English {placeholders}, translated, English fallback with one i18n.translation_fallback row;
//   - every word of the three guided flows reads in each locale without a fallback;
//   - income bands format their dollar amounts for the locale (FEED's own en-US digits for ht/hmn);
//   - a flow still answers with its `value` and its prompt text is unchanged by the translation.
// What a member reads on screen: components/panels/chat-panel.i18n.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { logger } from './logger'
import { messages, type Locale } from './i18n'
import { assistantMessages, assistantT, flowText } from './i18n-assistant'
import { formatUsd } from './i18n-intl'
import { buildAIPrompt, eligibilityCheckerFlow, formHelpFlow, GUIDED_FLOWS, resourceFinderFlow } from './ai/guided-flows'
import { describeDictionaryParity } from '@/test/dictionary-parity'

const LOCALES = Object.keys(messages) as Locale[]

describeDictionaryParity('assistant', assistantMessages, assistantT, new Set(['Medicaid', 'Medicare', 'SSI/SSDI', 'TANF', 'WIC']))

describe('lookups', () => {
  it('reads each language', () => {
    expect(assistantT('ko', 'greetingTitle')).toBe('안녕하세요, Feed입니다.')
    expect(assistantT('es', 'cardEligibilityTitle')).toBe('Comprobar elegibilidad')
    expect(assistantT('ar', 'sendMessage')).toBe('أرسل الرسالة')
  })
})

describe('guided flows in every language', () => {
  beforeEach(() => vi.mocked(logger.warn).mockClear())

  it.each(LOCALES)('%s: every name, question, option and hint has its own text (no fallback)', (locale) => {
    for (const flow of Object.values(GUIDED_FLOWS)) {
      expect(assistantT(locale, flow.name)).toBeTruthy()
      expect(assistantT(locale, flow.description)).toBeTruthy()
      for (const step of flow.steps) {
        expect(assistantT(locale, step.question)).toBeTruthy()
        if (step.placeholder) expect(assistantT(locale, step.placeholder)).toBeTruthy()
        for (const option of step.options ?? []) expect(flowText(locale, option.label).trim()).not.toBe('')
      }
    }
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('income bands put the amounts in the locale’s number format', () => {
    const band = eligibilityCheckerFlow.steps.find((s) => s.id === 'income')!.options!.find((o) => o.value === '1000-2000')!
    // English reads exactly as before the translation.
    expect(flowText('en', band.label)).toBe('$1,000 - $2,000')
    expect(flowText('es', band.label)).toBe(`De ${formatUsd(1000, 'es')} a ${formatUsd(2000, 'es')}`)
    // Haitian Creole has no Intl data: FEED formats in US English digits, words in Creole.
    expect(flowText('ht', band.label)).toBe('Ant $1,000 ak $2,000')
    const over = eligibilityCheckerFlow.steps.find((s) => s.id === 'income')!.options!.find((o) => o.value === 'over-5000')!
    expect(flowText('en', over.label)).toBe('Over $5,000')
    expect(flowText('hmn', over.label)).toBe('Ntau tshaj $5,000')
  })

  it('a digit option reads the same in every language', () => {
    const two = eligibilityCheckerFlow.steps[0].options!.find((o) => o.value === '2')!
    for (const locale of LOCALES) expect(flowText(locale, two.label)).toBe('2')
  })
})

describe('what a flow sends is the same in every language', () => {
  it('each option answers with the value it had before the translation', () => {
    const values = (flow: typeof resourceFinderFlow) => flow.steps.map((s) => `${s.id}:${(s.options ?? []).map((o) => o.value).join(',')}`)
    expect(values(resourceFinderFlow)).toEqual([
      'category:food,housing,healthcare,utilities,employment,family,legal,mental-health,other',
      'urgency:immediate,this-week,month,exploring',
      'location:',
      'additional:',
    ])
    expect(values(eligibilityCheckerFlow)).toEqual([
      'household-size:1,2,3,4,5,6+',
      'children:yes,no',
      'children-ages:infant,toddler,child,teen',
      'pregnant:yes,no',
      'income:0,under-1000,1000-2000,2000-3000,3000-4000,4000-5000,over-5000',
      'employment:full-time,part-time,self-employed,unemployed-looking,unemployed-not-looking,disability,retired,student',
      'current-benefits:snap,medicaid,medicare,ssi-ssdi,tanf,wic,housing,none',
      'state:',
    ])
    expect(values(formHelpFlow)).toEqual([
      'form-type:snap,medicaid,tanf,housing,unemployment,ssi-ssdi,other',
      'help-type:documents,explain,section,review,general',
      'section-name:',
      'question-text:',
      'specific-question:',
      'status:not-started,in-progress,almost-done',
    ])
  })

  it('the resource-finder prompt is the English prompt, filled with values', () => {
    expect(buildAIPrompt(resourceFinderFlow, { category: 'food', urgency: 'immediate', location: '05401', additional: '' })).toBe(
      `Based on the following information, find relevant resources:
- Category: food
- Urgency: immediate
- Location: 05401
- Additional info: Not provided

Please provide 2-3 specific resources with names, addresses, contact info, and any eligibility requirements.`,
    )
  })

  it('the eligibility flow still sends nothing itself', () => {
    expect(eligibilityCheckerFlow.skipDirectSend).toBe(true)
    expect(buildAIPrompt(eligibilityCheckerFlow, { state: 'VT' })).toBeNull()
  })
})
