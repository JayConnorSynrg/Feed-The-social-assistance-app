/**
 * use-volunteer-resource.withdraw.test.mjs
 *
 * Simulation-based unit tests for the withdrawResource() logic inside
 * use-volunteer-resource.ts (P3.0 / I1b fix).
 *
 * Why simulation, not a React harness: the hook has 'use client' + TypeScript
 * syntax + @/ path aliases — none resolvable from a plain .mjs without a
 * bundler/transpiler, and no @testing-library/react or jsdom is installed.
 * This mirrors use-petitions.sign.test.mjs: inline a line-for-line faithful
 * simulation of the async control flow and assert the state transitions.
 *
 * The fix: withdrawResource now selects the affected rows and treats a
 * zero-row result as a failure (surfaced via setError) instead of a silent
 * success. Before the fix, a zero-row update (the pre-P3.0 policy matched
 * only pending rows, so archiving an approved listing matched nothing)
 * returned no error and the UI reported success while doing nothing.
 *
 * Run:
 *   node apps/web/src/hooks/__tests__/use-volunteer-resource.withdraw.test.mjs
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Faithful translation of withdrawResource() from use-volunteer-resource.ts.
 * The supabase update chain is modelled by `updateResult` ({ data, error }).
 *
 * @param {{
 *   userId?: string | null,
 *   updateResult: { data: Array<{id:string}> | null, error: { message: string } | null },
 * }} opts
 */
async function runWithdraw({ userId = 'user-1', updateResult }) {
  let isLoading = false
  let error = null
  let fetchCalled = false

  const setIsLoading = (v) => { isLoading = v }
  const setError = (v) => { error = v }
  const fetchMyResources = async () => { fetchCalled = true }

  // --- withdrawResource() body (faithful) ---
  if (!userId) {
    return { isLoading, error, fetchCalled, earlyReturn: true }
  }
  setIsLoading(true)
  setError(null)
  try {
    const { data, error: updateError } = updateResult
    if (updateError) throw new Error(updateError.message)
    if (!data || data.length === 0) {
      throw new Error(
        'Could not withdraw this listing — it may already be withdrawn, or you are not its owner.'
      )
    }
    await fetchMyResources()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to withdraw resource')
  } finally {
    setIsLoading(false)
  }
  return { isLoading, error, fetchCalled, earlyReturn: false }
}

describe('withdrawResource() — success path', () => {
  test('one affected row → no error, list refetched, spinner reset', async () => {
    const r = await runWithdraw({ updateResult: { data: [{ id: 'res-1' }], error: null } })
    assert.equal(r.error, null, 'no error on a real withdrawal')
    assert.equal(r.fetchCalled, true, 'fetchMyResources must run after a successful withdraw')
    assert.equal(r.isLoading, false, 'isLoading reset in finally')
  })
})

describe('withdrawResource() — zero affected rows (THE silent-no-op bug)', () => {
  test('empty data array → surfaces an error, does NOT refetch', async () => {
    const r = await runWithdraw({ updateResult: { data: [], error: null } })
    assert.notEqual(r.error, null, 'zero affected rows must surface as an error, not silent success')
    assert.match(r.error, /Could not withdraw this listing/, 'user-facing message')
    assert.equal(r.fetchCalled, false, 'must not refetch when nothing was withdrawn')
    assert.equal(r.isLoading, false, 'isLoading reset in finally')
  })

  test('null data → surfaces the same error', async () => {
    const r = await runWithdraw({ updateResult: { data: null, error: null } })
    assert.notEqual(r.error, null, 'null data must surface as an error')
    assert.match(r.error, /Could not withdraw this listing/, 'user-facing message')
    assert.equal(r.fetchCalled, false, 'must not refetch on a null result')
  })
})

describe('withdrawResource() — failed result (RLS / network)', () => {
  test('update returns an error → surfaces that message, does NOT refetch', async () => {
    const r = await runWithdraw({
      updateResult: { data: null, error: { message: 'new row violates row-level security policy' } },
    })
    assert.equal(r.error, 'new row violates row-level security policy', 'the update error is surfaced verbatim')
    assert.equal(r.fetchCalled, false, 'must not refetch on a failed update')
    assert.equal(r.isLoading, false, 'isLoading reset in finally')
  })
})

describe('withdrawResource() — signed-out guard', () => {
  test('no user id → early return, no state change', async () => {
    const r = await runWithdraw({ userId: null, updateResult: { data: [{ id: 'x' }], error: null } })
    assert.equal(r.earlyReturn, true, 'returns early when signed out')
    assert.equal(r.fetchCalled, false, 'no refetch when signed out')
    assert.equal(r.error, null, 'no error set on the signed-out guard')
  })
})
