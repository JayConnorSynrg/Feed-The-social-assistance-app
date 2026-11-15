// apps/web/src/lib/ai/wizard-prompt.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Assistant's first message after the Get Help wizard (moved unchanged out of chat-panel.tsx):
// the category line, only the allowlisted answers (type of help, urgency, state), the closing line —
// pinned to the exact text it sent before the move. Built from values only, so a Korean member's
// answers produce the same bytes as an English member's (wizard-panel.i18n.dom.test.ts drives the
// panel in both languages).

import { describe, it, expect } from 'vitest'
import { buildWizardPrompt, parseWizardContext } from './wizard-prompt'

describe('buildWizardPrompt', () => {
  it('the exact message: category line, allowlisted answers in answer order, closing line', () => {
    const prompt = buildWizardPrompt('food', {
      'assistance-type': ['SNAP/EBT benefits', 'food pantries'],
      'household-size': '3 people',
      state: 'California',
      contact: 'email',
    })
    expect(prompt).toBe(
      'I need help finding Food resources.\n' +
        '- Type of help: SNAP/EBT benefits, food pantries\n' +
        '- State: California\n' +
        'Please suggest relevant local programs and resources for this need.',
    )
  })

  it('urgency is kept; personal specifics never are; an empty answer is skipped', () => {
    const prompt = buildWizardPrompt('free_legal', {
      'legal-issue': ['immigration or DACA'],
      urgency: 'urgent — within the next 30 days',
      state: '',
      insurance: 'no insurance',
      'income-range': 'under $17,000',
    })
    expect(prompt).toBe(
      'I need help finding Free_legal resources.\n' +
        '- Type of help: immigration or DACA\n' +
        '- Urgency: urgent — within the next 30 days\n' +
        'Please suggest relevant local programs and resources for this need.',
    )
  })
})

describe('parseWizardContext', () => {
  it('reads the hand-over the wizard writes; anything else is null', () => {
    expect(parseWizardContext(JSON.stringify({ category: 'food', answers: { state: 'Ohio' } }))).toEqual({ category: 'food', answers: { state: 'Ohio' } })
    expect(parseWizardContext('{not json')).toBeNull()
    expect(parseWizardContext(JSON.stringify({ category: 'food' }))).toBeNull()
    expect(parseWizardContext(JSON.stringify({ answers: {} }))).toBeNull()
  })
})
