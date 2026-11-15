// apps/web/src/lib/eligibility-screening.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The screening runs against the state the member means, or not at all: a 2-letter code (any case)
// or an English state name is that state; anything else is refused as unknown_state — never
// silently Vermont. The accepted codes are exactly the screening function's own set.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildScreeningRequest, US_STATE_CODES } from './eligibility-screening'

const answers = (state: string) => ({ 'household-size': '3', children: 'yes', income: '1000-2000', employment: 'part-time', state })

describe('the state the member means', () => {
  it('"CA", lowercase "ca" and "California" are screened as CA', () => {
    for (const typed of ['CA', 'ca', ' California ']) {
      const built = buildScreeningRequest(answers(typed))
      expect(built.ok && built.request.state, typed).toBe('CA')
    }
  })

  it('"Калифорния" is never screened as VT (or any state): it is refused as unknown', () => {
    expect(buildScreeningRequest(answers('Калифорния'))).toEqual({ ok: false, reason: 'unknown_state' })
  })

  it('an empty answer, a typo and a 2-letter non-state are refused, not replaced', () => {
    for (const typed of ['', 'Californa', 'ZZ', '加州']) {
      expect(buildScreeningRequest(answers(typed)), typed).toEqual({ ok: false, reason: 'unknown_state' })
    }
  })

  it('the rest of the request is unchanged', () => {
    expect(buildScreeningRequest(answers('vt'))).toEqual({
      ok: true,
      request: { household_size: 3, annual_income: 18000, state: 'VT', age: 35, has_children: true, is_disabled: false },
    })
  })

  it('accepts exactly the codes the benefits-screening function accepts', () => {
    const fn = readFileSync(fileURLToPath(new URL('../../../../supabase/functions/benefits-screening/index.ts', import.meta.url)), 'utf8')
    const block = /const US_STATES = new Set\(\[([\s\S]*?)\]\)/.exec(fn)![1]
    const codes = [...block.matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort()
    expect([...US_STATE_CODES].sort()).toEqual(codes)
  })
})
