// apps/web/src/app/(admin)/moderation/event-focus.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Which control opened an event dialog, so focus can return to it on close. Safari and Firefox
// on macOS do not focus a button on mouse click, so document.activeElement is <body> then: prefer
// the clicked element (the click event's currentTarget); else the focused element unless it is
// <body> / missing; else null — the caller then falls back to "New event".

export interface FocusTarget {
  focus: () => void
}

function isFocusTarget(v: unknown): v is FocusTarget {
  return typeof v === 'object' && v !== null && typeof (v as { focus?: unknown }).focus === 'function'
}

export function pickOpener(
  clicked: unknown,
  active: unknown,
  body: unknown,
): FocusTarget | null {
  if (isFocusTarget(clicked) && clicked !== body) return clicked
  if (isFocusTarget(active) && active !== body) return active
  return null
}
