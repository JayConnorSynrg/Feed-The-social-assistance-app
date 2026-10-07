// i18n-event-member.test.ts
// Member event copy (Events tab heading, capacity, check-in sheet): parity across the 14 locales,
// placeholders kept, check_in refusals mapped to translated messages, and the check-in sheet
// rendering through the dictionaries instead of English literals.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null }) }))

import { checkinErrorKey, eventMemberMessages, eventMemberT, type EventMemberMessages } from './i18n-event-member'
import { messages, type Locale } from './i18n'
import { checkinResultOnClose } from '@/components/panels/checkin-sheet'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(eventMemberMessages.en).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('eventMemberMessages parity', () => {
  it('covers exactly the 14 locales', () => {
    expect(Object.keys(eventMemberMessages).sort()).toEqual([...LOCALES].sort())
    expect(LOCALES).toHaveLength(14)
  })
  it.each(LOCALES)('%s: same keys, non-empty, same {placeholders}', (locale) => {
    const dict = eventMemberMessages[locale] as unknown as Record<string, string>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS as Array<keyof EventMemberMessages>) {
      expect(dict[key].trim(), `${locale}.${key}`).not.toBe('')
      expect(placeholders(dict[key]), `${locale}.${key}`).toEqual(placeholders(eventMemberMessages.en[key]))
    }
  })
  it('non-English locales are translated (not copies of English) for the check-in labels', () => {
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      expect(eventMemberT(locale, 'householdDecrease'), locale).not.toBe(eventMemberMessages.en.householdDecrease)
      expect(eventMemberT(locale, 'householdIncrease'), locale).not.toBe(eventMemberMessages.en.householdIncrease)
    }
  })
})

describe('check_in refusals reach the member translated (checkinErrorKey)', () => {
  it.each([
    ['Sign in to check in.', 'errSignIn'],
    ['Create a free account to check in.', 'errCreateAccount'],
    ['Household size must be between 1 and 20.', 'errHousehold'],
    ['Event not found.', 'errNotFound'],
    ['This organization is not currently active.', 'errInactive'],
    ['This event is not currently active.', 'errInactive'],
    ['This event was cancelled.', 'errCancelled'],
    ['This event has ended.', 'errEnded'],
    ['Anonymous check-in opens 30 minutes before the event starts.', 'errAnonWindow'],
    ['You already have a check-in for this event; you cannot also check in anonymously.', 'errAlreadyCounted'],
    ['You are already counted anonymously for this event.', 'errAlreadyCounted'],
    ['duplicate key value violates unique constraint "x"', 'errGeneric'],
    [undefined, 'errGeneric'],
  ])('%s → %s', (message, key) => {
    expect(checkinErrorKey(message)).toBe(key)
  })
})

describe('check-in sheet copy comes from the dictionaries', () => {
  const sheet = readFileSync(fileURLToPath(new URL('../components/panels/checkin-sheet.tsx', import.meta.url)), 'utf8')
  it('uses the existing check-in keys and the member dictionary', () => {
    expect(sheet).toMatch(/eventFormT\(locale, confirmsPresence \? 'checkinHere' : 'checkinEarly'\)/)
    expect(sheet).toMatch(/aria-label=\{t\('householdDecrease'\)\}/)
    expect(sheet).toMatch(/aria-label=\{t\('householdIncrease'\)\}/)
    expect(sheet).toMatch(/setError\(checkinErrorKey\(rpcError\.message\)\)/)
    expect(sheet).toMatch(/lang=\{locale\}\s+dir=\{dir\(locale\)\}/)
  })
  it('has no English literals left in the member-facing text', () => {
    const code = sheet.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // M-S1 (break-it): restoring any of these literals fails here.
    for (const literal of [
      'Decrease household size', 'Increase household size', 'Household size', 'Check in anonymously',
      "I'm here", 'Check in early', 'Checking in', 'Counted anonymously', 'on the list', 'checked in!',
      'Thank you for being here', 'Create a free account', "'person'", "'people'", 'Failed to check in',
    ]) {
      expect(code, literal).not.toContain(literal)
    }
    expect(sheet).not.toMatch(/setError\(rpcError\.message\)/)
    expect(code).not.toContain("'Close'")
    expect(sheet).not.toMatch(/text-stone-(400|500)/)
  })
})

describe('check-in sheet: translated chrome, confirmation stays until dismissed', () => {
  const sheet = readFileSync(fileURLToPath(new URL('../components/panels/checkin-sheet.tsx', import.meta.url)), 'utf8')

  it('replaces the English default close button with a translated one; no empty description', () => {
    // M-B1 (break-it): dropping hideDefaultClose brings back the English "Close".
    expect(sheet).toMatch(/hideDefaultClose\n/)
    expect(sheet).toMatch(/aria-describedby=\{undefined\}/)
    expect(sheet).toMatch(/<span className="sr-only">\{t\('closeSheet'\)\}<\/span>/)
    expect(sheet).toMatch(/linkLabel=\{t\('createAccount'\)\}/)
  })

  it('the guest link renders the translated label (English stays the default for other callers)', () => {
    const es = renderToStaticMarkup(h(CreateAccountPrompt, { message: 'm', linkLabel: eventMemberT('es', 'createAccount') }))
    expect(es).toContain('>Crear cuenta gratuita</a>')
    expect(renderToStaticMarkup(h(CreateAccountPrompt, {}))).toContain('>Create free account</a>')
  })

  it('reports the check-in only when the sheet closes after success', () => {
    // M-H1 (break-it): reporting on submit (or on open) reloads the list under the open sheet.
    expect(checkinResultOnClose(true, true, 'early')).toBeNull()
    expect(checkinResultOnClose(false, false, null)).toBeNull()
    expect(checkinResultOnClose(false, true, 'early')).toEqual({ result: 'early' })
    expect(checkinResultOnClose(false, true, null)).toEqual({ result: null })
    const submit = sheet.slice(sheet.indexOf('const handleSubmit'), sheet.indexOf('const handleOpenChange'))
    expect(submit).not.toMatch(/onSuccess/)
  })

  it('the confirmation is announced once: its heading takes focus (no extra live region), with a visible focus ring', () => {
    // M-S4 (break-it): a role="status" wrapper on top of the focus move reads the title twice.
    expect(sheet).not.toMatch(/role="status"/)
    expect(sheet.match(/ref=\{successHeadingRef\} tabIndex=\{-1\} className="[^"]*focus-visible:ring-2 focus-visible:ring-lime-700[^"]*"/g)).toHaveLength(3)
    expect(sheet).toMatch(/if \(success\) successHeadingRef\.current\?\.focus\(\)/)
  })
})
