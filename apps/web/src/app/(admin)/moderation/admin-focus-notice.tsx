'use client'

// apps/web/src/app/(admin)/moderation/admin-focus-notice.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The line the Manage / Businesses tab shows when an "Edit in admin" link it claimed opened nothing
// (the tab logged not_found). The status paragraph is rendered from the tab's first render (empty and
// sr-only until needed), so the line is announced politely when it appears; the Dismiss button sits
// outside the live region and, since it removes itself, hands focus to the active admin tab trigger.
// Malformed links and tabs this tier does not see are the shell's (useAdminFocusGate), not this line's.
// The line and its Dismiss read in the admin's language (lib/i18n-admin-resources.ts, P6 W4).

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'
import { adminResourcesT, type AdminResourcesMessages } from '@/lib/i18n-admin-resources'
import { activeAdminTabTrigger } from './admin-focus-return'

/** not_found: missing / not approved / not readable. not_editable: shown, but this tier cannot save it. */
export type AdminFocusNotice = 'not_found' | 'not_editable'
export type PlaceFocusKind = 'resource' | 'business'

/** The plain line each miss shows, by key. */
const NOTICE_KEY = {
  not_found: { resource: 'noticeResourceNotFound', business: 'noticeBusinessNotFound' },
  not_editable: { resource: 'noticeResourceNotEditable', business: 'noticeBusinessNotEditable' },
} as const satisfies Record<AdminFocusNotice, Record<PlaceFocusKind, keyof AdminResourcesMessages>>

export function adminFocusNoticeText(notice: AdminFocusNotice, kind: PlaceFocusKind, locale: Locale): string {
  return adminResourcesT(locale, NOTICE_KEY[notice][kind])
}

/** Dismiss: focus moves to the active tab trigger BEFORE the button removes itself. */
export function dismissNotice(onDismiss: () => void, doc: Parameters<typeof activeAdminTabTrigger>[0] = document): void {
  activeAdminTabTrigger(doc)?.focus()
  onDismiss()
}

export function AdminFocusNoticeLine({
  notice,
  kind,
  onDismiss,
  locale,
}: {
  notice: AdminFocusNotice | null
  kind: PlaceFocusKind
  onDismiss: () => void
  locale: Locale
}) {
  return (
    <div
      className={
        notice ? 'flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900' : 'contents'
      }
    >
      <p role="status" className={notice ? 'flex-1' : 'sr-only'}>
        {notice ? adminFocusNoticeText(notice, kind, locale) : ''}
      </p>
      {notice && (
        <Button variant="outline" size="sm" className="h-6 shrink-0 border-stone-500 text-xs" onClick={() => dismissNotice(onDismiss)}>
          {adminResourcesT(locale, 'dismiss')}
        </Button>
      )}
    </div>
  )
}
