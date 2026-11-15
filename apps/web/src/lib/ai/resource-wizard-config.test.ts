// apps/web/src/lib/ai/resource-wizard-config.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Values stay values: every category id, step id, step type and option value of the Get Help wizard
// is exactly what it was before the wizard was translated (resource-wizard-config.values.json, taken
// from the English-only config) — these are what the Assistant receives. Only labels are translated:
// in every locale each option, question and description reads from the dictionary with no English
// fallback, and no two options of a step read the same.

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { logger } from '@/lib/logger'
import { messages, type Locale } from '@/lib/i18n'
import { getHelpT, wizardCategoryLabel, wizardLabelText } from '@/lib/i18n-get-help'
import { CATEGORY_WIZARDS } from './resource-wizard-config'
import VALUES from './resource-wizard-config.values.json'

const LOCALES = Object.keys(messages) as Locale[]

describe('values stay values', () => {
  it('ids, step types and every option value equal the English-only config', () => {
    const now = CATEGORY_WIZARDS.map((c) => [c.id, c.steps.map((s) => [s.id, s.type, s.options.map((o) => o.value)])])
    expect(now).toEqual(VALUES)
  })

  it('every step is a choice (the unreachable free-text step is gone)', () => {
    for (const c of CATEGORY_WIZARDS) for (const s of c.steps) expect(['single-select', 'multi-select']).toContain(s.type)
  })
})

describe('only labels are translated', () => {
  it.each(LOCALES)('%s: every label reads without an English fallback, distinct within its step', (l) => {
    vi.mocked(logger.warn).mockClear()
    for (const c of CATEGORY_WIZARDS) {
      expect(wizardCategoryLabel(c.id, l)).toBeTruthy()
      expect(getHelpT(l, c.description)).toBeTruthy()
      for (const s of c.steps) {
        expect(getHelpT(l, s.question)).toBeTruthy()
        const labels = s.options.map((o) => wizardLabelText(o.label, l))
        expect(new Set(labels).size, `${l} ${c.id}/${s.id}`).toBe(labels.length)
      }
    }
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('Korean labels are not the English values', () => {
    const food = CATEGORY_WIZARDS.find((c) => c.id === 'food')!
    const step = food.steps[0]
    expect(step.options.map((o) => wizardLabelText(o.label, 'ko'))).not.toContain(step.options[1].value)
    expect(wizardLabelText(step.options[1].label, 'ko')).toBe('푸드 팬트리')
  })
})
