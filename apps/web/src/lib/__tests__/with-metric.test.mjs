import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Minimal inline replica of withMetric (src/lib/logger.ts) so the contract can
 * be exercised with node:test + no bundler. track() and logger are stubbed as
 * no-op capture sinks. Keep this replica in sync with the real implementation.
 */
function makeWithMetric() {
  const tracks = []
  const logs = []
  // `sinks` captures the persisted app_logs wide-event rows. In the real impl
  // (src/lib/logger.ts) this is sinkToSupabase — one call per outcome, the sole
  // persist path, so success writes exactly one info row and failure exactly one
  // error row, never both, never zero (I1).
  const sinks = []
  const track = (name, props) => tracks.push({ name, props })
  const emit = (entry) => logs.push(entry)
  const sinkToSupabase = (level, event, context, request_id, duration_ms) =>
    sinks.push({ level, event, context, request_id, duration_ms })

  async function withMetric(operation, attrs, fn) {
    const start = performance.now()
    try {
      const result = await fn()
      const duration_ms = Math.round(performance.now() - start)
      const event = `${operation}.complete`
      emit({ level: 'info', message: event, ...attrs, duration_ms })
      sinkToSupabase('info', event, { ...attrs }, undefined, duration_ms)
      track(operation, { ...attrs, duration_ms, ok: true })
      return result
    } catch (error) {
      const duration_ms = Math.round(performance.now() - start)
      const error_code = error instanceof Error ? error.name : 'UnknownError'
      const event = `${operation}.error`
      const ctx = {
        ...attrs,
        error_code,
        error_message: error instanceof Error ? error.message : String(error),
      }
      emit({ level: 'error', message: event, ...ctx, duration_ms })
      sinkToSupabase('error', event, ctx, undefined, duration_ms)
      if (error_code !== 'AbortError') {
        track(operation, { ...attrs, duration_ms, ok: false, error_code })
      }
      throw error
    }
  }

  return { withMetric, tracks, logs, sinks }
}

test('success path returns fn result and records duration_ms + ok:true', async () => {
  const { withMetric, tracks, logs } = makeWithMetric()
  const result = await withMetric('op.success', { category: 'all' }, async () => 42)

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
  const { withMetric, sinks } = makeWithMetric()
  await withMetric('op.success', { category: 'all' }, async () => 42)

  // Exactly once on success — one info row, no error row, never zero.
  assert.equal(sinks.length, 1)
  assert.equal(sinks[0].level, 'info')
  assert.equal(sinks[0].event, 'op.success.complete')
  assert.equal(typeof sinks[0].duration_ms, 'number')
  assert.ok(sinks[0].duration_ms >= 0)
})

test('error path re-throws and records ok:false + error_code', async () => {
  const { withMetric, tracks } = makeWithMetric()
  class BoomError extends Error {
    constructor() {
      super('boom')
      this.name = 'BoomError'
    }
  }

  await assert.rejects(
    () => withMetric('op.fail', {}, async () => {
      throw new BoomError()
    }),
    /boom/
  )

  assert.equal(tracks.length, 1)
  assert.equal(tracks[0].props.ok, false)
  assert.equal(tracks[0].props.error_code, 'BoomError')
})

test('I1: failure persists EXACTLY ONE error wide-event row with duration_ms', async () => {
  const { withMetric, sinks } = makeWithMetric()
  class BoomError extends Error {
    constructor() {
      super('boom')
      this.name = 'BoomError'
    }
  }

  await assert.rejects(
    () => withMetric('op.fail', {}, async () => {
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
  const { withMetric, tracks } = makeWithMetric()
  const abort = new Error('aborted')
  abort.name = 'AbortError'

  await assert.rejects(
    () => withMetric('op.abort', {}, async () => {
      throw abort
    }),
    /aborted/
  )

  assert.equal(tracks.length, 0)
})
