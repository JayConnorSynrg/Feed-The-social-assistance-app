import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runWithMetric } from '../with-metric-core.mjs'

/**
 * Exercises the REAL withMetric body. The shipped withMetric (src/lib/logger.ts)
 * delegates to `runWithMetric` in with-metric-core.mjs, wiring the real
 * emit/sink/track. This suite imports that SAME module and injects capture
 * stubs, so a regression in the shipped persist path (a double-write or a
 * dropped sink call) turns these assertions RED. `sinks` captures the
 * app_logs wide-event rows — one call per outcome, the sole persist path (I1).
 */
function makeStubDeps() {
  const tracks = []
  const logs = []
  const sinks = []
  const deps = {
    track: (name, props) => tracks.push({ name, props }),
    emit: (entry) => logs.push(entry),
    sink: (level, event, context, request_id, duration_ms) =>
      sinks.push({ level, event, context, request_id, duration_ms }),
  }
  return { deps, tracks, logs, sinks }
}

test('success path returns fn result and records duration_ms + ok:true', async () => {
  const { deps, tracks, logs } = makeStubDeps()
  const result = await runWithMetric(deps, 'op.success', { category: 'all' }, async () => 42)

  assert.equal(result, 42)
  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].name, 'op.success')
  assert.equal(tracks[0].props.ok, true)
  assert.equal(typeof tracks[0].props.duration_ms, 'number')
  assert.equal(tracks[0].props.category, 'all')
  assert.equal(logs[0].message, 'op.success.complete')
  assert.equal(typeof logs[0].duration_ms, 'number')
})

test('I1: success persists EXACTLY ONE info wide-event row with duration_ms', async () => {
  const { deps, sinks } = makeStubDeps()
  await runWithMetric(deps, 'op.success', { category: 'all' }, async () => 42)

  // Exactly once on success — one info row, no error row, never twice, never zero.
  assert.equal(sinks.length, 1)
  assert.equal(sinks[0].level, 'info')
  assert.equal(sinks[0].event, 'op.success.complete')
  assert.equal(typeof sinks[0].duration_ms, 'number')
  assert.ok(sinks[0].duration_ms >= 0)
})

test('error path re-throws and records ok:false + error_code', async () => {
  const { deps, tracks } = makeStubDeps()
  class BoomError extends Error {
    constructor() {
      super('boom')
      this.name = 'BoomError'
    }
  }

  await assert.rejects(
    () => runWithMetric(deps, 'op.fail', {}, async () => {
      throw new BoomError()
    }),
    /boom/
  )

  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].props.ok, false)
  assert.equal(tracks[0].props.error_code, 'BoomError')
})

test('I1: failure persists EXACTLY ONE error wide-event row with duration_ms', async () => {
  const { deps, sinks } = makeStubDeps()
  class BoomError extends Error {
    constructor() {
      super('boom')
      this.name = 'BoomError'
    }
  }

  await assert.rejects(
    () => runWithMetric(deps, 'op.fail', {}, async () => {
      throw new BoomError()
    }),
    /boom/
  )

  // Exactly once on failure — one error row, no info row, never twice, never zero.
  assert.equal(sinks.length, 1)
  assert.equal(sinks[0].level, 'error')
  assert.equal(sinks[0].event, 'op.fail.error')
  assert.equal(sinks[0].context.error_code, 'BoomError')
  assert.equal(typeof sinks[0].duration_ms, 'number')
})

test('AbortError path re-throws but skips the metric event', async () => {
  const { deps, tracks } = makeStubDeps()
  const abort = new Error('aborted')
  abort.name = 'AbortError'

  await assert.rejects(
    () => runWithMetric(deps, 'op.abort', {}, async () => {
      throw abort
    }),
    /aborted/
  )

  assert.equal(tracks.length, 0)
})

test('I5: a supplied correlation id is threaded to the persisted row (success and failure)', async () => {
  // Client withMetric mints a per-op id and passes it here; the sink forwards it
  // to /api/client-log which writes it to app_logs.request_id (non-null row).
  const ok = makeStubDeps()
  await runWithMetric(ok.deps, 'op.ok', {}, async () => 1, 'op-abc123')
  assert.equal(ok.sinks.length, 1)
  assert.equal(ok.sinks[0].request_id, 'op-abc123')

  const bad = makeStubDeps()
  class BoomError extends Error {
    constructor() {
      super('boom')
      this.name = 'BoomError'
    }
  }
  await assert.rejects(
    () => runWithMetric(bad.deps, 'op.bad', {}, async () => {
      throw new BoomError()
    }, 'op-def456'),
    /boom/
  )
  assert.equal(bad.sinks.length, 1)
  assert.equal(bad.sinks[0].request_id, 'op-def456')
})
