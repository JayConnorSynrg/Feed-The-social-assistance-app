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
  const track = (name, props) => tracks.push({ name, props })
  const logger = {
    info: (message, data) => logs.push({ level: 'info', message, data }),
    error: (message, error, data) =>
      logs.push({ level: 'error', message, error, data }),
  }

  async function withMetric(operation, attrs, fn) {
    const start = performance.now()
    try {
      const result = await fn()
      const duration_ms = Math.round(performance.now() - start)
      logger.info(`${operation}.complete`, { ...attrs, duration_ms })
      track(operation, { ...attrs, duration_ms, ok: true })
      return result
    } catch (error) {
      const duration_ms = Math.round(performance.now() - start)
      const error_code = error instanceof Error ? error.name : 'UnknownError'
      logger.error(`${operation}.error`, error, { ...attrs, duration_ms, error_code })
      if (error_code !== 'AbortError') {
        track(operation, { ...attrs, duration_ms, ok: false, error_code })
      }
      throw error
    }
  }

  return { withMetric, tracks, logs }
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
  assert.equal(typeof logs[0].data.duration_ms, 'number')
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
