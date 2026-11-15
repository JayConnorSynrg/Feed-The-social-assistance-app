// apps/web/src/lib/language-save.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Saving a member's language. The rule: the language in effect changes exactly when a save
// succeeds. The new language is applied at once (optimistic) and taken back when the save fails;
// a save that times out, or that updates no row, is a failure — never "Language saved".
//
// providers/auth-provider.tsx wires the account save (profiles.preferred_language, then the
// in-memory profile every surface reads its locale from); components/settings/language-section.tsx
// wires the device save for guests. Each save writes one settings.language.save.complete or
// settings.language.save.error row (withMetric), labelled from / to / outcome / scope.

import { withMetric } from './logger'

export type LanguageSaveOutcome = 'ok' | 'error' | 'aborted' | 'no_row' | 'no_profile'
export type LanguageSaveFailure = Exclude<LanguageSaveOutcome, 'ok'>

/** How long an account save may take before it counts as failed. */
export const LANGUAGE_SAVE_TIMEOUT_MS = 12_000

/** A failed save. `code` is the error class written to the log row (a SQLSTATE when there is one). */
export class LanguageSaveError extends Error {
  readonly outcome: LanguageSaveFailure
  readonly code: string
  constructor(outcome: LanguageSaveFailure, code?: string, message?: string) {
    super(message ?? outcome)
    this.name = 'LanguageSaveError'
    this.outcome = outcome
    this.code = code || outcome
  }
}

/** What the profile write answers: the updated rows (`.select('id')`), or an error. */
export interface LanguageWriteResult {
  data: unknown[] | null
  error: { message?: string; code?: string } | null
}

export interface AccountLanguageSaveIo {
  /**
   * The profile the language goes on: resolves with its current language (null when unset) when a
   * profile is in memory — reading it first when none is — or `false` when none could be loaded.
   * Without a profile in memory the screen cannot show a new language, so nothing is written.
   */
  ensureProfile: () => Promise<string | null | false>
  /** UPDATE profiles SET preferred_language … WHERE id = me RETURNING id. */
  write: (code: string, signal: AbortSignal) => PromiseLike<LanguageWriteResult>
  /** Puts a language on the in-memory profile (the locale follows). */
  apply: (code: string | null) => void
  /** Runs once the save has succeeded (the feed_locale cookie). */
  remember: (code: string) => void
  timeoutMs?: number
}

/**
 * Saves the account language. Resolves with the outcome; never throws. On 'ok' the in-memory
 * profile holds `to` (the screen switched); on any failure it holds what it held before, and
 * on 'no_profile' nothing was written.
 */
export async function saveAccountLanguage(io: AccountLanguageSaveIo, to: string): Promise<LanguageSaveOutcome> {
  const attrs = { from: 'none', to, scope: 'account', outcome: 'ok' as LanguageSaveOutcome }
  let applied = false
  let from: string | null = null
  try {
    await withMetric('settings.language.save', attrs, async () => {
      try {
        const loaded = await io.ensureProfile()
        if (loaded === false) throw new LanguageSaveError('no_profile')
        from = loaded
        attrs.from = from ?? 'none'
        io.apply(to)
        applied = true
        await writeWithin(io, to)
      } catch (e) {
        const failure = e instanceof LanguageSaveError ? e : new LanguageSaveError('error', undefined, e instanceof Error ? e.message : undefined)
        attrs.outcome = failure.outcome
        throw failure
      }
    })
  } catch {
    if (applied) io.apply(from)
    return attrs.outcome
  }
  // Applied again: a profile read that started before the write and answered after it carried
  // the old language; the saved one is what the account now holds.
  io.apply(to)
  io.remember(to)
  return 'ok'
}

async function writeWithin(io: AccountLanguageSaveIo, to: string): Promise<void> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve('timeout')
    }, io.timeoutMs ?? LANGUAGE_SAVE_TIMEOUT_MS)
  })
  let result: LanguageWriteResult | 'timeout'
  try {
    // A hung request (no answer at all) loses the race; an aborted one answers with an error.
    result = await Promise.race([Promise.resolve(io.write(to, controller.signal)), timedOut])
  } catch (e) {
    if (controller.signal.aborted) throw new LanguageSaveError('aborted', 'timeout')
    throw e
  } finally {
    clearTimeout(timer)
  }
  if (result === 'timeout' || controller.signal.aborted) throw new LanguageSaveError('aborted', 'timeout')
  if (result.error) throw new LanguageSaveError('error', result.error.code, result.error.message)
  if (!Array.isArray(result.data) || result.data.length === 0) throw new LanguageSaveError('no_row')
}

/**
 * Saves a guest's language on this device (`store` writes localStorage and the cookie). One
 * settings.language.save row with scope 'device'.
 */
export async function saveDeviceLanguage(store: (code: string) => void, from: string | null, to: string): Promise<LanguageSaveOutcome> {
  const attrs = { from: from ?? 'none', to, scope: 'device', outcome: 'ok' as LanguageSaveOutcome }
  try {
    await withMetric('settings.language.save', attrs, async () => {
      try {
        store(to)
      } catch (e) {
        attrs.outcome = 'error'
        throw new LanguageSaveError('error', undefined, e instanceof Error ? e.message : undefined)
      }
    })
    return 'ok'
  } catch {
    return attrs.outcome
  }
}
