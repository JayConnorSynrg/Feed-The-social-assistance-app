/**
 * Deterministic simulation of the setLoading state-machine inside
 * apps/web/src/hooks/use-viewport-resources.ts (fetchResources, lines 86-159).
 *
 * Purpose: prove the precise mechanism that strands the resources-list spinner
 * at `loading === true` after the map goes idle, and prove that wiring the
 * AbortController's .signal into supabase .rpc() resolves it.
 *
 * Why a pure node:test simulation (not @testing-library/react): the repo has no
 * React DOM test harness installed — `vitest` is imported by the crypto tests
 * but the binary, jsdom, and @testing-library are absent from node_modules.
 * Adding that toolchain is out of scope for a diagnosis. The simulation models
 * the EXACT control flow of fetchResources line-for-line:
 *   - line 90   abortControllerRef.current.abort()
 *   - line 93   abortControllerRef.current = new AbortController()
 *   - line 94   setLoading(true)
 *   - line 108  await supabase.rpc('resources_in_bounds', params)   [signal NOT passed]
 *   - line 151  if (err.name !== 'AbortError') setError(err)
 *   - line 155  setLoading(false)   (finally — runs for every SETTLED promise)
 *
 * KEY INSIGHT proven below: because the `finally` always runs setLoading(false)
 * for any promise that resolves OR rejects, out-of-order completion alone CANNOT
 * strand loading=true. Stranding requires an in-flight request whose promise
 * NEVER settles. Without signal wiring, abort() is a no-op, so a superseded
 * request is neither cancelled (no reject) nor guaranteed a response (the
 * browser/Next.js drops the superseded fetch). That request's finally never
 * runs. If it was the LAST writer of setLoading(true) with no surviving peer to
 * write false, the spinner is permanent.
 *
 * Run: node apps/web/src/hooks/__tests__/use-viewport-resources.race.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * Faithful model of fetchResources' loading bookkeeping + the single
 * abortControllerRef shared across calls (use-viewport-resources.ts:83).
 *
 * `loading` is a plain last-writer-wins boolean — this is exactly how React
 * resolves the final committed value of a useState boolean after a batch of
 * setLoading(...) calls settle: the last setter to run wins.
 *
 * @param {{ wireSignal: boolean }} cfg  wireSignal === true models the fix
 *        (.abortSignal(signal) on the rpc builder; confirmed via context7
 *        /supabase/postgrest-js — an already/just-aborted signal rejects the
 *        request with a message matching /^AbortError:/).
 */
function makeHookSim({ wireSignal }) {
  let loading = false
  let abortControllerRef = null
  const inflight = [] // { d: deferred, settled: bool }

  function rpc(signal) {
    const d = deferred()
    const entry = { d, settled: false }
    inflight.push(entry)
    if (wireSignal && signal) {
      const onAbort = () => {
        if (!entry.settled) {
          entry.settled = true
          const err = new Error('AbortError: signal is aborted without reason')
          err.name = 'AbortError'
          d.reject(err)
        }
      }
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort)
    }
    return entry
  }

  async function fetchResources() {
    if (abortControllerRef) abortControllerRef.abort() // line 90
    abortControllerRef = new AbortController() // line 93
    const mySignal = abortControllerRef.signal
    loading = true // line 94

    const entry = rpc(wireSignal ? mySignal : undefined) // line 108 (signal omitted when broken)
    try {
      await entry.d.promise
    } catch (err) {
      // line 151: AbortError swallowed, other errors -> setError
      void (err && err.name === 'AbortError')
    } finally {
      loading = false // line 155
    }
  }

  return {
    fetchResources,
    get loading() {
      return loading
    },
    get inflight() {
      return inflight
    },
  }
}

// === Control: out-of-order completion does NOT strand (finally always runs) ==
test('out-of-order completion alone does not strand loading (finally always clears)', async () => {
  const sim = makeHookSim({ wireSignal: false })
  const pA = sim.fetchResources() // initial bounds
  const pB = sim.fetchResources() // autocenter recenter (abort no-op)
  assert.equal(sim.loading, true)
  assert.equal(sim.inflight.length, 2)

  // Newer (B) resolves first, older (A) resolves last — out of order.
  sim.inflight[1].settled = true
  sim.inflight[1].d.resolve({ data: [], error: null })
  await pB
  sim.inflight[0].settled = true
  sim.inflight[0].d.resolve({ data: [], error: null })
  await pA

  // Both finallys ran -> loading false. Proves ordering alone is not the bug.
  assert.equal(sim.loading, false)
})

// === THE BUG: a superseded request that never settles strands loading=true ===
test('BROKEN: superseded request never settles -> loading STUCK true permanently', async () => {
  const sim = makeHookSim({ wireSignal: false })

  // A starts on initial bounds (handleLoad, map-view.tsx:84): loading=true.
  const pA = sim.fetchResources()
  // B starts on the autocenter recenter (map-panel.tsx:277/302/320 -> camera
  // move -> handleMoveEnd:73 -> onBoundsChange). abort() on A's controller is a
  // NO-OP because the signal was never passed to rpc(). loading=true again.
  const pB = sim.fetchResources()
  void pA
  void pB
  assert.equal(sim.loading, true)
  assert.equal(sim.inflight.length, 2)

  // Map is now idle: bounds stop changing, so NO further fetch will fire.
  // The LIVE request B's fetch is aborted by Next.js's global fetch patching
  // during the recenter re-render (project MEMORY.md: "signal is aborted
  // without reason"). With no AbortController wired to reject it, B's promise
  // is dropped — it never resolves and never rejects. A, superseded, likewise
  // never settles. NEITHER finally runs.
  // (We simply never settle either inflight entry — that IS the scenario.)

  // Drain microtasks to prove nothing clears loading.
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(sim.loading, true, 'PERMANENT spinner: no settle, no finally, loading stuck')
})

// === THE FIX (part 1): wiring the signal guarantees every superseded request
//     SETTLES (rejects) so its finally runs. After the whole burst settles,
//     loading is FALSE — no permanent stranding is possible. ===
test('FIXED: signal wired -> every superseded request settles -> final loading FALSE', async () => {
  const sim = makeHookSim({ wireSignal: true })

  const pA = sim.fetchResources() // initial bounds
  // Autocenter recenter: abort(A) now REJECTS A's rpc with AbortError (signal
  // wired). A is guaranteed to settle -> its finally is guaranteed to run.
  const pB = sim.fetchResources()

  // Live request B settles normally.
  sim.inflight[1].settled = true
  sim.inflight[1].d.resolve({ data: [], error: null })

  await Promise.all([pA, pB])

  assert.equal(sim.inflight[0].settled, true, 'A was aborted -> settled')
  assert.equal(sim.inflight[1].settled, true, 'B resolved')
  // CRITICAL: after the full startup burst settles, loading is FALSE. The
  // permanent-stuck-true state (proven in the BROKEN test) is now impossible
  // because there is no longer an un-settling request.
  assert.equal(sim.loading, false, 'FIXED: burst fully settled -> loading false')
})

test('FIXED: 3 rapid bounds emissions (load + recenter + geolocation) end loading FALSE', async () => {
  const sim = makeHookSim({ wireSignal: true })
  const pA = sim.fetchResources()
  const pB = sim.fetchResources() // aborts A
  const pC = sim.fetchResources() // aborts B

  sim.inflight[2].settled = true
  sim.inflight[2].d.resolve({ data: [], error: null })

  await Promise.all([pA, pB, pC])
  assert.equal(sim.inflight[0].settled, true)
  assert.equal(sim.inflight[1].settled, true)
  assert.equal(sim.inflight[2].settled, true)
  assert.equal(sim.loading, false, 'every request in the burst settled -> loading false')
})

// === THE FIX (part 2): signal wiring ALONE has a residual LATE-WRITER hazard.
//     A superseded request's finally can run AFTER a newer live request set
//     loading=true, producing a transient false flicker (spinner blinks off
//     while data is still loading). It does NOT strand true, but for a fully
//     correct fix the finally must be guarded by a request id so only the
//     current request mutates loading. This test documents that residual. ===
test('residual: signal-wired finally is a late writer (transient flicker, not stranding)', async () => {
  const sim = makeHookSim({ wireSignal: true })

  const pA = sim.fetchResources() // A live, loading=true
  const pB = sim.fetchResources() // aborts A (A.reject queued), B live, loading=true

  // Microtask order: B's synchronous body already set loading=true. A's
  // rejection handler + finally run on the next microtask, setting loading=false
  // while B is STILL in flight -> a transient incorrect false.
  await pA
  const transientWhileBLive = sim.loading

  // B then resolves and its finally sets loading=false (correct terminal state).
  sim.inflight[1].settled = true
  sim.inflight[1].d.resolve({ data: [], error: null })
  await pB

  // Document the residual: loading briefly read false while B was live...
  assert.equal(transientWhileBLive, false, 'late-writer flicker: A.finally cleared while B live')
  // ...but the TERMINAL state is correct (false), and it is never stuck TRUE.
  assert.equal(sim.loading, false, 'terminal state correct')
})
