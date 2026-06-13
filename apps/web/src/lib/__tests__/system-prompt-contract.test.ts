// apps/web/src/lib/__tests__/system-prompt-contract.test.ts
// Contract regression tests for FEED AI system prompt.
// These assertions guard the 7 behavioural contracts that external
// callers (chat-panel.tsx, supabase/functions/chat/index.ts) depend on.

import { describe, it, expect } from 'vitest'
import { SYSTEM_PROMPTS } from '../ai/system-prompts'

const base = SYSTEM_PROMPTS.base

describe('FEED system prompt — behavioural contracts', () => {
  // Contract 1: Resource card token — exact bracket/pipe syntax
  it('contains the [[RESOURCE:]] card token with pipe separators', () => {
    expect(base).toContain('[[RESOURCE:name|address|phone|website]]')
  })

  // Contract 2: Web result token
  it('contains the [[WEBRESULT:]] card token with pipe separators', () => {
    expect(base).toContain('[[WEBRESULT:title|url]]')
  })

  // Contract 3: Multilingual rule — reply in user language, never alter tokens
  it('instructs the model to reply in the same language the user writes in', () => {
    expect(base).toMatch(/reply in the same language/i)
  })

  it('instructs the model that the card format is machine-parsed and must not be altered', () => {
    expect(base).toMatch(/machine-parsed/i)
  })

  // Contract 4: Verified-data-only + 211 fallback
  it('contains the 211 fallback directive', () => {
    expect(base).toContain('211')
  })

  it('instructs the model to use only VERIFIED LOCAL RESOURCES context', () => {
    expect(base).toContain('[VERIFIED LOCAL RESOURCES]')
  })

  // Contract 5: Reading level — 8th grade / plain language
  it('specifies 8th grade reading level', () => {
    expect(base).toMatch(/8th grade/i)
  })

  // Contract 6: Crisis protocol — 988 and 911
  it('contains the 988 crisis line', () => {
    expect(base).toContain('988')
  })

  it('contains 911 for immediate emergencies', () => {
    expect(base).toContain('911')
  })

  // Contract 7: Website rule — service/application page, not org homepage
  it('instructs the model to link the specific service or application page', () => {
    expect(base).toMatch(/specific service or application page/i)
  })

  // Persona guard — warm old-friend tone is present
  it('includes the warm old-friend persona framing', () => {
    expect(base).toMatch(/old friend/i)
  })

  // Trauma-informed guard — acknowledge before help
  it('contains the trauma-informed acknowledge-before-help directive', () => {
    expect(base).toMatch(/acknowledge what they.{0,20}facing/i)
  })

  it('states the positive directive: first acknowledge, then walk beside', () => {
    expect(base).toMatch(/first acknowledge.{0,60}next step/i)
  })
})
