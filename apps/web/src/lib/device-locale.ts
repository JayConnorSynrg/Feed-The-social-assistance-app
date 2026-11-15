// apps/web/src/lib/device-locale.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The language chosen on this device (localStorage feed_preferred_language): a guest's only
// choice, and the fallback for a profile with no supported language. A store for
// useSyncExternalStore, so a choice re-renders every surface that reads the locale at once —
// in this tab (notify) and in other tabs (the storage event).

import { GUEST_LANGUAGE_KEY } from './languages'
import { isLocale } from './i18n'
import { writeLocaleCookie } from './locale-cookie'

const listeners = new Set<() => void>()

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === GUEST_LANGUAGE_KEY) listeners.forEach((l) => l())
}

export function subscribeDeviceLocale(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** The stored choice (a code from lib/languages.ts, possibly 'other'), or null. */
export function deviceLocaleSnapshot(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(GUEST_LANGUAGE_KEY)
  } catch {
    return null
  }
}

/** The server has no device: nothing chosen. */
export function deviceLocaleServerSnapshot(): string | null {
  return null
}

/**
 * Stores the choice on this device and tells every reader. A supported locale also goes into the
 * feed_locale cookie, so the next page load renders in it. Throws when storage refuses the write
 * (the caller reports the save as failed).
 */
export function rememberDeviceLocale(code: string): void {
  localStorage.setItem(GUEST_LANGUAGE_KEY, code)
  if (isLocale(code)) writeLocaleCookie(code)
  listeners.forEach((l) => l())
}
