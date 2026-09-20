/**
 * composer-guards.test.ts
 *
 * W1.2 review round. Two guards for the inline feed composer:
 *   - single-flight: a synchronous double-submit runs the create exactly once
 *     (the duplicate-post BLOCKER).
 *   - success-gated reset: a failed create (null id) keeps the user's content
 *     and surfaces an error; a success resets.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  createSingleFlight,
  composerSubmitOutcome,
  COMPOSER_POST_FAILED_MESSAGE,
} from './composer-guards'

describe('createSingleFlight — double-submit runs the create exactly once', () => {
  it('two synchronous run() calls execute the work only once', async () => {
    const gate = createSingleFlight()
    const onPost = vi.fn().mockResolvedValue('post-1')

    // Simulate a double-click: both handlers fire before the first awaits settle.
    const p1 = gate.run(() => onPost())
    const p2 = gate.run(() => onPost())
    await Promise.all([p1, p2])

    expect(onPost).toHaveBeenCalledTimes(1)
    // The blocked call resolves to undefined without running the work.
    expect(await p2).toBeUndefined()
  })

  it('allows a new run after the previous one completes', async () => {
    const gate = createSingleFlight()
    const onPost = vi.fn().mockResolvedValue('ok')

    await gate.run(() => onPost())
    await gate.run(() => onPost())

    expect(onPost).toHaveBeenCalledTimes(2)
  })

  it('releases the gate even when the work throws (finally)', async () => {
    const gate = createSingleFlight()
    await expect(gate.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    // Gate must be free again after a failure.
    const after = vi.fn().mockResolvedValue('ok')
    await gate.run(() => after())
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe('composerSubmitOutcome — success-gated reset', () => {
  it('resets and shows no error on success (non-null post id)', () => {
    expect(composerSubmitOutcome('post-123')).toEqual({ reset: true, error: null })
  })

  it('does NOT reset and surfaces an error on failure (null id) — content preserved', () => {
    expect(composerSubmitOutcome(null)).toEqual({
      reset: false,
      error: COMPOSER_POST_FAILED_MESSAGE,
    })
  })
})
