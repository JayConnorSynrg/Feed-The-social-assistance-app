// apps/web/src/lib/language-save.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The language in effect changes exactly when a save succeeds. Outcomes, in both directions:
// a successful save applies the new language at once and keeps it; a failed one (an error, no
// answer within the time limit, or an update that matched no row) puts the old language back and
// never reports success. Each save writes exactly one settings.language.save row, through the real
// withMetric core (with-metric-core.mjs) with capture stubs for the console and the app_logs sink.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const rows = vi.hoisted(() => [] as Array<{ level: string; event: string; context: Record<string, unknown> }>)

vi.mock('./logger', async () => {
  const core = await import('./with-metric-core.mjs')
  return {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    logEvent: vi.fn(),
    withMetric: (op: string, attrs: Record<string, string | number | boolean | null>, fn: () => Promise<unknown>) =>
      core.runWithMetric(
        {
          emit: () => {},
          sink: (level: string, event: string, context?: Record<string, unknown>) => rows.push({ level, event, context: context ?? {} }),
        },
        op,
        attrs,
        fn,
        'req-1'
      ),
  }
})

import { saveAccountLanguage, saveDeviceLanguage, type AccountLanguageSaveIo, type LanguageWriteResult } from './language-save'

/** An in-memory profile language, the remembered (cookie) value, and a scripted write. */
function harness(write: AccountLanguageSaveIo['write'], timeoutMs?: number, start: string | null = 'en') {
  const state = { language: start, applied: [] as Array<string | null>, remembered: [] as string[], writes: 0 }
  const io: AccountLanguageSaveIo = {
    ensureProfile: async () => state.language,
    write: (code, signal) => {
      state.writes += 1
      return write(code, signal)
    },
    apply: (code) => {
      state.language = code
      state.applied.push(code)
    },
    remember: (code) => state.remembered.push(code),
    timeoutMs,
  }
  return { state, io }
}

const answer = (r: LanguageWriteResult) => async () => r

beforeEach(() => {
  rows.length = 0
})

describe('saveAccountLanguage', () => {
  it('ok: the new language is applied before the write answers, kept after it, and remembered once', async () => {
    let seenDuringWrite: string | null = null
    const { state, io } = harness(async () => {
      seenDuringWrite = state.language
      return { data: [{ id: 'u1' }], error: null }
    })
    expect(await saveAccountLanguage(io, 'ko')).toBe('ok')
    expect(seenDuringWrite).toBe('ko') // optimistic: every surface switched at once
    expect(state.language).toBe('ko')
    expect(state.remembered).toEqual(['ko'])
    expect(rows).toEqual([{ level: 'info', event: 'settings.language.save.complete', context: { from: 'en', to: 'ko', scope: 'account', outcome: 'ok' } }])
  })

  it('error: the old language comes back, nothing is remembered, one error row with the SQLSTATE', async () => {
    const { state, io } = harness(answer({ data: null, error: { code: '42501', message: 'permission denied for table profiles' } }))
    expect(await saveAccountLanguage(io, 'ko')).toBe('error')
    expect(state.language).toBe('en')
    expect(state.remembered).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ level: 'error', event: 'settings.language.save.error', context: { from: 'en', to: 'ko', outcome: 'error', error_code: '42501' } })
  })

  it('no_row: an update that matched no row is a failure, not "saved"', async () => {
    const { state, io } = harness(answer({ data: [], error: null }), undefined, 'es')
    expect(await saveAccountLanguage(io, 'ko')).toBe('no_row')
    expect(state.language).toBe('es')
    expect(state.remembered).toEqual([])
    expect(rows.map((r) => [r.event, r.context.outcome])).toEqual([['settings.language.save.error', 'no_row']])
  })

  describe('timeouts', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('aborted: a write that never answers fails at the time limit and the old language comes back', async () => {
      const { state, io } = harness(() => new Promise<LanguageWriteResult>(() => {}), 1000, null)
      const done = saveAccountLanguage(io, 'ko')
      await vi.advanceTimersByTimeAsync(0)
      expect(state.language).toBe('ko')
      await vi.advanceTimersByTimeAsync(1000)
      expect(await done).toBe('aborted')
      expect(state.language).toBe(null)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ event: 'settings.language.save.error', context: { from: 'none', outcome: 'aborted', error_code: 'timeout' } })
    })

    it('aborted: a write that answers with an error because it was aborted counts as aborted', async () => {
      const { state, io } = harness(
        (_code, signal) =>
          new Promise<LanguageWriteResult>((resolve) => {
            signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'AbortError: signal is aborted' } }))
          }),
        1000
      )
      const done = saveAccountLanguage(io, 'ko')
      await vi.advanceTimersByTimeAsync(1000)
      expect(await done).toBe('aborted')
      expect(state.language).toBe('en')
    })
  })
})

describe('no profile in memory', () => {
  it('no_profile: nothing is written, nothing applied, one error row — the screen could not show it', async () => {
    const { state, io } = harness(answer({ data: [{ id: 'u1' }], error: null }))
    io.ensureProfile = async () => false
    expect(await saveAccountLanguage(io, 'ko')).toBe('no_profile')
    expect(state.writes).toBe(0)
    expect(state.applied).toEqual([])
    expect(state.remembered).toEqual([])
    expect(rows.map((r) => [r.event, r.context.outcome, r.context.error_code])).toEqual([['settings.language.save.error', 'no_profile', 'no_profile']])
  })

  it('a profile read first (ensureProfile) gives the language to take back to', async () => {
    const { state, io } = harness(answer({ data: null, error: { message: 'boom' } }), undefined, null)
    io.ensureProfile = async () => {
      state.language = 'vi'
      return 'vi'
    }
    expect(await saveAccountLanguage(io, 'ko')).toBe('error')
    expect(state.language).toBe('vi')
    expect(rows[0].context.from).toBe('vi')
  })
})

describe('saveDeviceLanguage', () => {
  it('ok: stores the choice and writes one device row', async () => {
    const stored: string[] = []
    expect(await saveDeviceLanguage((c) => stored.push(c), null, 'vi')).toBe('ok')
    expect(stored).toEqual(['vi'])
    expect(rows).toEqual([{ level: 'info', event: 'settings.language.save.complete', context: { from: 'none', to: 'vi', scope: 'device', outcome: 'ok' } }])
  })

  it('error: storage refusing the write is a failure', async () => {
    expect(
      await saveDeviceLanguage(() => {
        throw new Error('QuotaExceededError')
      }, 'en', 'vi')
    ).toBe('error')
    expect(rows.map((r) => [r.event, r.context.outcome])).toEqual([['settings.language.save.error', 'error']])
  })
})
