// apps/web/src/app/(admin)/moderation/admin-focus-return.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where keyboard focus lands in the Manage / Businesses tabs when something an "Edit in admin" link
// opened goes away, so it never drops to <body>:
//   - the resource edit dialog closes (a link-opened dialog has no trigger for Radix to return to):
//     that resource's row Edit button when the row is listed, else the active admin tab trigger;
//   - the "link opened nothing" notice's Dismiss button removes itself: the active admin tab trigger.

type Focusable = { focus: (options?: FocusOptions) => void }
export interface FocusDoc {
  querySelector: (selector: string) => Focusable | null
}

/** The data attribute on a Manage row's Edit button (value = the resource id). */
export const RESOURCE_EDIT_BUTTON_ATTR = 'data-resource-edit'

/** The admin shell's selected tab (Radix Tabs: role="tab", aria-selected="true"). */
export function activeAdminTabTrigger(doc: FocusDoc): Focusable | null {
  return doc.querySelector('[role="tab"][aria-selected="true"]')
}

/** The edit dialog closed: focus the resource's row Edit button, else the active tab trigger. */
export function restoreFocusAfterResourceEdit(
  event: { preventDefault: () => void },
  resourceId: string | null,
  doc: FocusDoc
): void {
  event.preventDefault()
  const row = resourceId ? doc.querySelector(`[${RESOURCE_EDIT_BUTTON_ATTR}="${resourceId}"]`) : null
  ;(row ?? activeAdminTabTrigger(doc))?.focus()
}
