'use client'

// apps/web/src/app/(admin)/moderation/admin-focus-notice.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The line a Manage / Businesses tab shows when an "Edit in admin" link opened nothing (not found,
// forbidden, invalid). The status paragraph is always mounted (empty and sr-only until needed), so the
// line is announced politely when it appears; the Dismiss button sits outside the live region.

import { Button } from '@/components/ui/button'
import { ADMIN_FOCUS_NOTICE_TEXT, type AdminFocusNotice, type PlaceFocusKind } from './admin-tab-focus'

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
        <Button variant="outline" size="sm" className="h-6 shrink-0 text-xs" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  )
}
