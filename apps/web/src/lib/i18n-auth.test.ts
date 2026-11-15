// apps/web/src/lib/i18n-auth.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Sign in, sign up, password and two-factor words (lib/i18n-auth.ts) in the 14 FEED locales:
//   - the dictionary keeps the parity rules; each count table covers the 14 locales with {n};
//   - a failure line is chosen from the error's CODE, the same code giving the same line in every
//     locale, an unknown code the page's general line;
//   - every password hint lib/security.ts writes has a translated line.

import { describe, it, expect, vi } from 'vitest'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages, type Locale } from './i18n'
import { describeDictionaryParity } from '@/test/dictionary-parity'
import {
  ATTEMPTS_REMAINING,
  LOCKED_MINUTES,
  authCount,
  authMessages,
  authT,
  oauthErrorKey,
  passwordFailureKey,
  passwordFeedbackKey,
  signInFailureKey,
  signUpFailureKey,
  strengthKey,
} from './i18n-auth'
import { validatePasswordStrength } from './security'

const LOCALES = Object.keys(messages) as Locale[]

// "Backup code" and "Email address" are written as in English in Tagalog.
describeDictionaryParity('auth', authMessages, authT, new Set(['Backup code', 'Email address']))

describe.each([
  ['LOCKED_MINUTES', LOCKED_MINUTES],
  ['ATTEMPTS_REMAINING', ATTEMPTS_REMAINING],
] as const)('%s', (_name, table) => {
  it('covers exactly the 14 locales, each with an `other` form, every form carrying {n}', () => {
    expect(Object.keys(table).sort()).toEqual([...LOCALES].sort())
    for (const l of LOCALES) {
      expect(table[l].other, l).toBeTruthy()
      for (const form of Object.values(table[l])) expect(form, l).toContain('{n}')
    }
  })
  it.each(LOCALES.filter((l) => l !== 'en'))('%s differs from English', (l) => {
    expect(table[l].other).not.toBe(table.en.other)
  })
})

describe('counts', () => {
  it('English one / other, Russian one / few / many', () => {
    expect(authCount(LOCKED_MINUTES, 1, 'en')).toBe('Account temporarily locked. Please try again in 1 minute.')
    expect(authCount(LOCKED_MINUTES, 15, 'en')).toBe('Account temporarily locked. Please try again in 15 minutes.')
    expect(authCount(ATTEMPTS_REMAINING, 2, 'en')).toBe('Warning: 2 login attempts remaining before temporary lockout.')
    expect(authCount(LOCKED_MINUTES, 1, 'ru')).toContain('1 минуту')
    expect(authCount(LOCKED_MINUTES, 3, 'ru')).toContain('3 минуты')
    expect(authCount(LOCKED_MINUTES, 5, 'ru')).toContain('5 минут')
    expect(authCount(ATTEMPTS_REMAINING, 2, 'ar')).toContain('محاولتان')
  })
})

describe('failure lines from codes', () => {
  it.each([
    ['invalid_credentials', 'invalidCredentials'],
    ['email_not_confirmed', 'emailNotConfirmed'],
    ['captcha_failed', 'captchaFailed'],
    ['over_request_rate_limit', 'loginRateLimited'],
    ['AuthRetryableFetchError', 'signInFailed'],
    ['unknown', 'signInFailed'],
  ])('sign in: %s → %s', (code, key) => expect(signInFailureKey(code)).toBe(key))

  it.each([
    ['user_already_exists', 'accountExists'],
    ['weak_password', 'passwordTooWeak'],
    ['email_address_invalid', 'emailInvalid'],
    ['over_email_send_rate_limit', 'emailRateLimited'],
    ['signup_disabled', 'signupUnavailable'],
    ['TypeError', 'signupFailed'],
  ])('sign up: %s → %s', (code, key) => expect(signUpFailureKey(code)).toBe(key))

  it('resend falls back to its own line', () => {
    expect(signUpFailureKey('unexpected_failure', 'resendFailed')).toBe('resendFailed')
    expect(signUpFailureKey('over_email_send_rate_limit', 'resendFailed')).toBe('emailRateLimited')
  })

  it('password pages', () => {
    expect(passwordFailureKey('same_password', 'resetFailed')).toBe('samePassword')
    expect(passwordFailureKey('weak_password', 'resetFailed')).toBe('passwordTooWeak')
    expect(passwordFailureKey('x', 'resetFailed')).toBe('resetFailed')
    expect(passwordFailureKey('x', 'forgotFailed')).toBe('forgotFailed')
  })

  it('the OAuth callback codes, unknown → the general line', () => {
    expect(oauthErrorKey('oauth_provider')).toBe('oauthProvider')
    expect(oauthErrorKey('exchange_failed')).toBe('oauthExchange')
    expect(oauthErrorKey('no_code')).toBe('oauthNoCode')
    expect(oauthErrorKey('no_session')).toBe('oauthNoSession')
    expect(oauthErrorKey('confirmation_failed')).toBe('confirmationFailed')
    expect(oauthErrorKey('<script>')).toBe('oauthFailed')
  })

  it('a code that names an Object.prototype member is not a key', () => {
    expect(signInFailureKey('toString')).toBe('signInFailed')
    expect(oauthErrorKey('constructor')).toBe('oauthFailed')
  })
})

describe('password hints', () => {
  it('every hint lib/security.ts writes has a line (weak, common and empty-ish passwords)', () => {
    for (const pw of ['a', 'A', '1', '!', 'password', 'aaaaaaaaaaaaaaaa', 'ABCDEFGHIJKLMNOP123456']) {
      for (const sentence of validatePasswordStrength(pw).feedback) expect(passwordFeedbackKey(sentence), sentence).not.toBeNull()
    }
  })
  it('the strength words', () => {
    expect(authT('ko', strengthKey('weak'))).toBe('약함')
    expect(authT('ar', strengthKey('strong'))).toBe('قوية')
  })
})
