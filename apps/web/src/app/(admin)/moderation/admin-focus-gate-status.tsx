'use client'

// apps/web/src/app/(admin)/moderation/admin-focus-gate-status.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The visible, announced line when a followed "Edit in admin" link opened nothing (the shell gate
// wrote forbidden / invalid). One role="status" region rendered from the shell's first render, so
// the line is announced when it appears; empty (and visually hidden) otherwise.

import type { Locale } from '@/lib/i18n'
import { adminFocusT } from '@/lib/i18n-admin-focus'
import type { AdminDeeplinkRow } from './admin-focus-session'

/** The line for a gate row (forbidden / invalid), or null. */
export function adminFocusGateText(row: AdminDeeplinkRow | null, locale: Locale): string | null {
  if (row?.outcome === 'forbidden') return adminFocusT(locale, 'forbidden')
  if (row?.outcome === 'invalid') return adminFocusT(locale, 'invalid')
  return null
}

export function AdminFocusGateStatus({ row, locale }: { row: AdminDeeplinkRow | null; locale: Locale }) {
  const text = adminFocusGateText(row, locale)
  return (
    <p
      role="status"
      data-testid="admin-focus-gate-status"
      className={text ? 'mb-3 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800' : 'sr-only'}
    >
      {text}
    </p>
  )
}
