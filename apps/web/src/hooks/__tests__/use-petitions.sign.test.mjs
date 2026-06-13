/**
 * use-petitions.sign.test.mjs
 *
 * Simulation-based unit tests for the sign() logic inside use-petitions.ts.
 *
 * Why simulation, not a React harness: the hook has 'use client' + TypeScript
 * syntax + @/ path aliases — none resolvable from a plain .mjs without a
 * bundler/transpiler. No @testing-library/react or jsdom is installed in this
 * repo. The approach mirrors use-viewport-resources.race.test.mjs: inline
 * an exact line-for-line faithful simulation of the async control flow and
 * assert state transitions. The simulation captures the THREE code paths in
 * the sign() catch block that the fix introduced.
 *
 * Run:
 *   node apps/web/src/hooks/__tests__/use-petitions.sign.test.mjs
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Simulation
//
// Models the sign() async function from use-petitions.ts faithfully:
//   - optimistic update (signedMap.set(id, true) + countMap.set(id, prev+1))
//   - fetch('/api/petitions/sign', ...)
//   - on abort (DOMException OR Error with 'signal' in message):
//       reconcile from server truth via has_signed_petition + get_petition_signature_count
//   - on genuine error:
//       rollback (signedMap.set(id, prevSigned), countMap.set(id, prevCount))
//       setSignError(...)
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   petitionId: string,
 *   initialSigned?: boolean,
 *   initialCount?: number,
 *   fetchImpl: () => Promise<Response>,
 *   rpcHasSigned: () => Promise<{ data: boolean | null }>,
 *   rpcGetCount: () => Promise<{ data: number | null }>,
 * }} opts
 */
async function runSign({
  petitionId,
  initialSigned = false,
  initialCount = 0,
  fetchImpl,
  rpcHasSigned,
  rpcGetCount,
}) {
  // --- State mirrors ---
  let signedMap = new Map([[petitionId, initialSigned]])
  let countMap = new Map([[petitionId, initialCount]])
  let petitions = [
    { id: petitionId, hasSigned: initialSigned, signatureCount: initialCount },
  ]
  let signingId = null
  let signError = null

  // --- Helpers (mirrors the setState calls in the hook) ---
  const setSignedMap = (fn) => { signedMap = fn(signedMap) }
  const setCountMap = (fn) => { countMap = fn(countMap) }
  const setPetitions = (fn) => { petitions = fn(petitions) }
  const setSigningId = (v) => { signingId = v }
  const setSignError = (v) => { signError = v }

  // --- sign() body (faithful translation from use-petitions.ts) ---
  setSigningId(petitionId)
  setSignError(null)

  const prevSigned = signedMap.get(petitionId) ?? false
  const prevCount = countMap.get(petitionId) ?? 0

  if (prevSigned) {
    setSigningId(null)
    return { signedMap, countMap, petitions, signingId, signError }
  }

  // Optimistic update
  setSignedMap((prev) => new Map(prev).set(petitionId, true))
  setCountMap((prev) => new Map(prev).set(petitionId, prevCount + 1))
  setPetitions((prev) =>
    prev.map((p) =>
      p.id === petitionId
        ? { ...p, hasSigned: true, signatureCount: prevCount + 1 }
        : p
    )
  )

  try {
    const res = await fetchImpl()
    const json = await res.json()

    if (!res.ok && !json.alreadySigned) {
      throw new Error(json.error || 'sign_failed')
    }

    // Reconcile server count
    if (typeof json.count === 'number') {
      const serverCount = json.count
      setCountMap((prev) => new Map(prev).set(petitionId, serverCount))
      setPetitions((prev) =>
        prev.map((p) =>
          p.id === petitionId ? { ...p, signatureCount: serverCount } : p
        )
      )
    }
  } catch (err) {
    const isAbort =
      err instanceof DOMException ||
      (err instanceof Error && err.message.includes('signal'))

    if (isAbort) {
      // Do NOT roll back — server insert likely completed.
      // Reconcile from server truth.
      try {
        const [{ data: signedTruth }, { data: countTruth }] = await Promise.all([
          rpcHasSigned(),
          rpcGetCount(),
        ])
        if (typeof signedTruth === 'boolean') {
          setSignedMap((prev) => new Map(prev).set(petitionId, signedTruth))
          setPetitions((prev) =>
            prev.map((p) =>
              p.id === petitionId ? { ...p, hasSigned: signedTruth } : p
            )
          )
        }
        if (typeof countTruth === 'number') {
          setCountMap((prev) => new Map(prev).set(petitionId, countTruth))
          setPetitions((prev) =>
            prev.map((p) =>
              p.id === petitionId ? { ...p, signatureCount: countTruth } : p
            )
          )
        }
      } catch {
        // Leave optimistic state in place — do NOT revert a likely-successful sign
      }
      return { signedMap, countMap, petitions, signingId: null, signError }
    }

    // Genuine error — roll back
    setSignedMap((prev) => new Map(prev).set(petitionId, prevSigned))
    setCountMap((prev) => new Map(prev).set(petitionId, prevCount))
    setPetitions((prev) =>
      prev.map((p) =>
        p.id === petitionId
          ? { ...p, hasSigned: prevSigned, signatureCount: prevCount }
          : p
      )
    )
    setSignError('Unable to add your signature. Please try again.')
  } finally {
    setSigningId(null)
  }

  return { signedMap, countMap, petitions, signingId: null, signError }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}

function makeErrorResponse(body) {
  return {
    ok: false,
    status: 500,
    json: async () => body,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const PID = 'petition-abc'

describe('sign() — abort path (THE bug)', () => {
  test(
    '(a) DOMException AbortError → reconciles from server truth, hasSigned=true, signError=null',
    async () => {
      // Arrange: fetch rejects with DOMException AbortError
      const fetchImpl = async () => {
        const e = new DOMException('The operation was aborted.', 'AbortError')
        throw e
      }
      // Server truth: the insert DID complete
      const rpcHasSigned = async () => ({ data: true })
      const rpcGetCount = async () => ({ data: 1 })

      // Act
      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 0,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      // Assert: reconciled from server truth — NOT reverted
      assert.equal(
        result.signedMap.get(PID),
        true,
        'signedMap must be true (reconciled from server truth)'
      )
      assert.equal(
        result.countMap.get(PID),
        1,
        'countMap must be 1 (reconciled from server truth)'
      )
      const petition = result.petitions.find((p) => p.id === PID)
      assert.ok(petition, 'petition must be in derivedPetitions')
      assert.equal(petition.hasSigned, true, 'hasSigned must be true')
      assert.equal(petition.signatureCount, 1, 'signatureCount must be 1')
      assert.equal(result.signError, null, 'signError must stay null on abort path')
    }
  )

  test(
    '(a) Error with "signal" in message → reconciles from server truth, hasSigned=true, signError=null',
    async () => {
      // Next.js abort pattern: Error whose message includes 'signal'
      const fetchImpl = async () => {
        throw new Error('AbortError: signal is aborted without reason')
      }
      const rpcHasSigned = async () => ({ data: true })
      const rpcGetCount = async () => ({ data: 1 })

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 0,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      assert.equal(result.signedMap.get(PID), true, 'signedMap must be true')
      assert.equal(result.countMap.get(PID), 1, 'countMap must be 1')
      assert.equal(result.signError, null, 'signError must be null')
    }
  )

  test(
    '(a) abort but server says NOT signed → reconcile to hasSigned=false (server wins)',
    async () => {
      // Abort fire but server confirms signature did NOT land
      const fetchImpl = async () => {
        const e = new DOMException('Aborted', 'AbortError')
        throw e
      }
      const rpcHasSigned = async () => ({ data: false })
      const rpcGetCount = async () => ({ data: 0 })

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 0,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      assert.equal(result.signedMap.get(PID), false, 'server truth: not signed')
      assert.equal(result.countMap.get(PID), 0, 'server truth: count 0')
      assert.equal(result.signError, null, 'signError must be null on abort path')
    }
  )
})

describe('sign() — success path', () => {
  test(
    '(b) fetch resolves ok:true with count:1 → hasSigned=true, signatureCount=1, signError=null',
    async () => {
      const fetchImpl = async () => makeOkResponse({ ok: true, count: 1 })
      const rpcHasSigned = async () => ({ data: null }) // not called on success
      const rpcGetCount = async () => ({ data: null }) // not called on success

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 0,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      assert.equal(result.signedMap.get(PID), true, 'signedMap must be true')
      assert.equal(result.countMap.get(PID), 1, 'countMap reconciled to server count')
      const petition = result.petitions.find((p) => p.id === PID)
      assert.ok(petition, 'petition must be in derivedPetitions')
      assert.equal(petition.hasSigned, true, 'hasSigned must be true')
      assert.equal(petition.signatureCount, 1, 'signatureCount must be 1 from server')
      assert.equal(result.signError, null, 'signError must be null on success')
    }
  )

  test(
    '(b) alreadySigned response (no error thrown) → hasSigned=true stays',
    async () => {
      const fetchImpl = async () => ({
        ok: false,
        status: 409,
        json: async () => ({ alreadySigned: true, count: 2 }),
      })
      const rpcHasSigned = async () => ({ data: null })
      const rpcGetCount = async () => ({ data: null })

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 1,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      // alreadySigned → no throw → optimistic remains
      assert.equal(result.signedMap.get(PID), true, 'signedMap must be true (alreadySigned)')
      // count reconciled from server
      assert.equal(result.countMap.get(PID), 2, 'countMap reconciled to server count 2')
      assert.equal(result.signError, null, 'signError must be null')
    }
  )
})

describe('sign() — genuine error path', () => {
  test(
    '(c) fetch !ok, no alreadySigned → rollback to prevSigned=false, prevCount=0, signError set',
    async () => {
      const fetchImpl = async () => makeErrorResponse({ error: 'boom' })
      const rpcHasSigned = async () => ({ data: null }) // should not be called
      const rpcGetCount = async () => ({ data: null })  // should not be called

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 0,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      // Rolled back to prevSigned/prevCount
      assert.equal(result.signedMap.get(PID), false, 'signedMap must roll back to false')
      assert.equal(result.countMap.get(PID), 0, 'countMap must roll back to 0')
      const petition = result.petitions.find((p) => p.id === PID)
      assert.ok(petition, 'petition must be in derivedPetitions')
      assert.equal(petition.hasSigned, false, 'hasSigned must be rolled back')
      assert.equal(petition.signatureCount, 0, 'signatureCount must be rolled back')
      assert.notEqual(result.signError, null, 'signError must be set on genuine error')
      assert.match(result.signError, /Unable to add your signature/, 'signError message is user-facing')
    }
  )

  test(
    '(c) Error thrown from fetch (non-abort) → rollback + signError set',
    async () => {
      // A non-signal error (e.g. network down) that is NOT an AbortError
      const fetchImpl = async () => {
        throw new Error('Failed to fetch: network unreachable')
      }
      const rpcHasSigned = async () => ({ data: null })
      const rpcGetCount = async () => ({ data: null })

      const result = await runSign({
        petitionId: PID,
        initialSigned: false,
        initialCount: 5,
        fetchImpl,
        rpcHasSigned,
        rpcGetCount,
      })

      assert.equal(result.signedMap.get(PID), false, 'rollback: signedMap false')
      assert.equal(result.countMap.get(PID), 5, 'rollback: countMap back to 5')
      assert.notEqual(result.signError, null, 'signError must be set')
    }
  )
})

describe('sign() — idempotent guard (already signed)', () => {
  test('prevSigned=true → returns early, no state change', async () => {
    let fetchCalled = false
    const fetchImpl = async () => {
      fetchCalled = true
      return makeOkResponse({ ok: true, count: 1 })
    }
    const rpcHasSigned = async () => ({ data: null })
    const rpcGetCount = async () => ({ data: null })

    const result = await runSign({
      petitionId: PID,
      initialSigned: true,
      initialCount: 1,
      fetchImpl,
      rpcHasSigned,
      rpcGetCount,
    })

    assert.equal(fetchCalled, false, 'fetch must NOT be called when already signed')
    assert.equal(result.signedMap.get(PID), true, 'signedMap stays true (no flip)')
    assert.equal(result.countMap.get(PID), 1, 'countMap unchanged')
  })
})
