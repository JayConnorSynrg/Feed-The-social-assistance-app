// apps/web/src/lib/format-message.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one place a variable enters a translated string. Dependency-free, so any dictionary, hook,
// server route or component can import it without pulling a dictionary into its bundle.
//   formatMessage  fills {name} placeholders in a dictionary value.
//   splitMessage   cuts a value around one placeholder, so the component can put its own element
//                  (a bold count, a member's name with its own direction) in the gap.
//   isolate        wraps member-written text for a plain-text channel (aria-label, title), where
//                  markup such as <bdi> is impossible.

/** Fills {name} placeholders. Unknown placeholders are left as-is. */
export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  )
}

/**
 * The text before and after `{name}` in a dictionary value: ['Signing as ', ''] for
 * 'Signing as {name}'. The element stays in JSX and only its surroundings are translated. A value
 * without the placeholder comes back whole, with an empty tail.
 */
export function splitMessage(template: string, name: string): [before: string, after: string] {
  const token = `{${name}}`
  const at = template.indexOf(token)
  return at < 0 ? [template, ''] : [template.slice(0, at), template.slice(at + token.length)]
}

/**
 * Member-written text for an attribute or other plain-text channel: FIRST STRONG ISOLATE …
 * POP DIRECTIONAL ISOLATE, the character form of dir="auto" (W3C "Inline markup and
 * bidirectional text"), so a right-to-left title cannot reorder the words around it.
 */
export function isolate(text: string): string {
  return `⁨${text}⁩`
}
