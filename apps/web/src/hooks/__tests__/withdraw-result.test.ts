// withdraw-result.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Exercises the REAL withdraw result-interpretation logic that use-volunteer-resource.ts
// runs (both import interpretWithdrawResult from withdraw-result.ts). Covers the
// `.select('id')` zero-row path: deleting the zero-row branch in the source makes the
// zero-row / null-data tests fail.
//
// Run (non-smoke, targeted — never plain `vitest run`, which would execute smoke files):
//   npx vitest run src/hooks/__tests__/withdraw-result.test.ts

import { describe, it, expect } from 'vitest'
import {
  interpretWithdrawResult,
  WITHDRAW_ZERO_ROW_MESSAGE,
} from '../withdraw-result'

describe('interpretWithdrawResult — success', () => {
  it('one affected row → ok, no error', () => {
    expect(interpretWithdrawResult({ data: [{ id: 'res-1' }], error: null })).toEqual({
      ok: true,
      error: null,
    })
  })

  it('multiple affected rows → ok', () => {
    expect(
      interpretWithdrawResult({ data: [{ id: 'a' }, { id: 'b' }], error: null }).ok
    ).toBe(true)
  })
})

describe('interpretWithdrawResult — zero affected rows (the silent-no-op bug)', () => {
  it('empty data array → NOT ok, surfaces the zero-row message', () => {
    const r = interpretWithdrawResult({ data: [], error: null })
    expect(r.ok).toBe(false)
    expect(r.error).toBe(WITHDRAW_ZERO_ROW_MESSAGE)
  })

  it('null data → NOT ok, surfaces the zero-row message', () => {
    const r = interpretWithdrawResult({ data: null, error: null })
    expect(r.ok).toBe(false)
    expect(r.error).toBe(WITHDRAW_ZERO_ROW_MESSAGE)
  })
})

describe('interpretWithdrawResult — failed result', () => {
  it('PostgREST error → NOT ok, surfaces the error verbatim', () => {
    const r = interpretWithdrawResult({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('new row violates row-level security policy')
  })

  it('error takes precedence even when data rows are present', () => {
    const r = interpretWithdrawResult({
      data: [{ id: 'x' }],
      error: { message: 'boom' },
    })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('boom')
  })
})
