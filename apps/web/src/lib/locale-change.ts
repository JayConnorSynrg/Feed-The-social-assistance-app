// apps/web/src/lib/locale-change.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// What one observed locale step means (providers/locale-sync.tsx calls this on every render where
// the locale, the device choice or the profile may have changed): whether to write an
// i18n.locale_changed row, and whether the feed_locale cookie needs correcting.
//
// Sources:
//   cookie        the page loaded in the language of a valid feed_locale cookie
//   boot          the page loaded with no usable cookie (English)
//   save          a save applied the language, or took it back when it failed
//   profile_read  a profile read brought a supported preferred language
//   fallback      a profile read (or sign-out) left no supported preferred language, so the
//                 device choice, the browser, or English decided

import type { Locale } from './i18n'

export type LocaleChangeSource = 'save' | 'profile_read' | 'boot' | 'cookie' | 'fallback'
/** What last set the in-memory profile (auth-provider's profileOrigin). */
export type ProfileOrigin = 'read' | 'save' | 'clear' | null

export interface LocaleObservation {
  locale: Locale
  /** The device choice (lib/device-locale.ts snapshot). */
  device: string | null
  origin: ProfileOrigin
  /** A profile is loaded. */
  hasProfile: boolean
  /** The loaded profile's preferred language is one of the 14 locales. */
  profileHasLocale: boolean
}

export interface LocaleStep {
  log: { from: string; to: Locale; source: LocaleChangeSource } | null
  /** The cookie should be rewritten to `locale`. */
  writeCookie: boolean
}

/**
 * `before` is the previous observation (null on the first one after the page loads);
 * `initialFromCookie` says whether the server rendered from a valid cookie; `cookie` is the
 * cookie's value now.
 */
export function decideLocaleStep(
  before: LocaleObservation | null,
  now: LocaleObservation,
  initialFromCookie: boolean,
  cookie: Locale | null
): LocaleStep {
  let log: LocaleStep['log'] = null
  if (!before) {
    log = { from: 'none', to: now.locale, source: initialFromCookie ? 'cookie' : 'boot' }
  } else if (before.locale !== now.locale) {
    const source: LocaleChangeSource =
      before.device !== now.device || now.origin === 'save'
        ? 'save'
        : now.hasProfile && now.profileHasLocale
          ? 'profile_read'
          : 'fallback'
    log = { from: before.locale, to: now.locale, source }
  }
  // The cookie follows the account, not a save in flight (the save writes it when it succeeds):
  // corrected only while a profile decides the locale.
  const writeCookie = now.hasProfile && now.origin !== 'save' && cookie !== now.locale
  return { log, writeCookie }
}
