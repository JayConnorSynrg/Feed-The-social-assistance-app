import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runWithMetric, serializeError } from '../with-metric-core.mjs'

/**
 * Exercises the REAL withMetric body. The shipped withMetric (src/lib/logger.ts)
 * delegates to `runWithMetric` in with-metric-core.mjs, wiring the real
 * emit/sink. This suite imports that SAME module and injects capture
 * stubs, so a regression in the shipped persist path (a double-write or a
 * dropped sink call) turns these assertions RED. `sinks` captures the
 * app_logs wide-event rows — one call per outcome, the sole persist path (I1).
 */
function makeStubDeps() {
  const logs = []
  const sinks = []
  const deps = {
    emit: (entry) => logs.push(entry),
    sink: (level, event, context, request_id, duration_ms) =>
      sinks.push({ level, event, context, request_id, duration_ms }),
  }
  return { deps, logs, sinks }
}

test('success path returns fn result and records duration_ms + labels', async () => {
  const { deps, logs, sinks } = makeStubDeps()
  const result = await runWithMetric(deps, 'op.success', { category: 'all' }, async () => 42)

  assert.equal(result, 42)
  assert.equal(sinks[0].context.category, 'all')
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

test('error path re-throws and records error_code', async () => {
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

  assert.equal(sinks.length, 1)
  assert.equal(sinks[0].context.error_code, 'BoomError')
  assert.equal(sinks[0].context.error_message, 'boom')
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

test('a Supabase/PostgREST {code,message} rejection persists its SQLSTATE as error_code', async () => {
  const { deps, sinks } = makeStubDeps()
  await assert.rejects(
    () => runWithMetric(deps, 'op.rpc', {}, async () => {
      throw { code: '42501', message: 'permission denied for function current_user_tier' }
    }),
  )
  assert.equal(sinks[0].context.error_code, '42501')
  assert.equal(sinks[0].context.error_message, 'permission denied for function current_user_tier')
  assert.notEqual(sinks[0].context.error_message, '[object Object]')
})

test('serializeError: SQLSTATE wins over name; absent error never yields "undefined"', () => {
  const wrapped = Object.assign(new Error('x'), { name: 'PrivilegedRpcError', code: '23505' })
  assert.equal(serializeError(wrapped).error_code, '23505')
  assert.equal(serializeError(new TypeError('t')).error_code, 'TypeError')
  assert.deepEqual(serializeError(undefined), { error_code: 'UnknownError' })
  assert.equal(serializeError('x'.repeat(500)).error_message.length, 120)
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
