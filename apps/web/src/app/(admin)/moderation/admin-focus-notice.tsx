'use client'

// apps/web/src/app/(admin)/moderation/admin-focus-notice.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The line the Manage / Businesses tab shows when an "Edit in admin" link it claimed opened nothing
// (the tab logged not_found). The status paragraph is rendered from the tab's first render (empty and
// sr-only until needed), so the line is announced politely when it appears; the Dismiss button sits
// outside the live region and, since it removes itself, hands focus to the active admin tab trigger.
// Malformed links and tabs this tier does not see are the shell's (useAdminFocusGate), not this line's.

import { Button } from '@/components/ui/button'
import { activeAdminTabTrigger } from './admin-focus-return'

/** not_found: missing / not approved / not readable. not_editable: shown, but this tier cannot save it. */
export type AdminFocusNotice = 'not_found' | 'not_editable'
export type PlaceFocusKind = 'resource' | 'business'

/** The plain line each miss shows (the Manage and Businesses tabs are English). */
export const ADMIN_FOCUS_NOTICE_TEXT: Record<AdminFocusNotice, Record<PlaceFocusKind, string>> = {
  not_found: {
    resource: "That resource couldn't be found, or it isn't editable here (only approved resources are listed in Manage).",
    business: "That business couldn't be found, or it isn't editable here (only approved businesses can be edited).",
  },
  not_editable: {
    resource: "Your admin role can't edit resources.",
    business: 'Only platform admins can edit businesses.',
  },
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
}: {
  notice: AdminFocusNotice | null
  kind: PlaceFocusKind
  onDismiss: () => void
}) {
  return (
    <div
      className={
        notice ? 'flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900' : 'contents'
      }
    >
      <p role="status" className={notice ? 'flex-1' : 'sr-only'}>
        {notice ? ADMIN_FOCUS_NOTICE_TEXT[notice][kind] : ''}
      </p>
      {notice && (
        <Button variant="outline" size="sm" className="h-6 shrink-0 text-xs" onClick={() => dismissNotice(onDismiss)}>
          Dismiss
        </Button>
      )}
    </div>
  )
}
