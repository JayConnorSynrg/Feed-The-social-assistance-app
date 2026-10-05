// apps/web/src/app/(admin)/moderation/org-panel-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where focus lands when the organization panel closes (Save, Cancel, Escape, Back, outside click):
// the control that opened it, or — when that control is gone (it was the Overview quick action on a
// tab that has since switched, or the panel was deep-linked) — the list's "Create organization".

export const ORG_CREATE_SELECTOR = '[data-org-create]'

type Focusable = { focus: () => void; isConnected: boolean }

export function restoreFocusAfterPanel(
  event: { preventDefault: () => void },
  opener: Focusable | null,
  doc: { querySelector: (s: string) => Focusable | null } = document
): void {
  event.preventDefault()
  const target = opener?.isConnected ? opener : doc.querySelector(ORG_CREATE_SELECTOR)
  target?.focus()
}
