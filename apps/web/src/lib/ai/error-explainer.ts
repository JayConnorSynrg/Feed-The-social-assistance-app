/**
 * error-explainer.ts
 *
 * Safe error-to-summary mapper for the AI error-explainer feature.
 *
 * SECURITY CONTRACT (OWASP LLM09):
 *  - NEVER passes raw Error.message, stack traces, SQL identifiers, table names,
 *    tokens, URLs, or any internal detail to the AI chat.
 *  - Maps structured error descriptors to a SAFE, sanitized summary string.
 *  - Only the safe summary string ever reaches the LLM — not the raw error.
 *  - Contains NO user PII.
 */

export type ErrorSource = 'map' | 'programs' | 'documents' | 'feed' | 'forms' | 'unknown'
export type ErrorKind = 'network' | 'server' | 'auth' | 'permission' | 'timeout' | 'unknown'

export interface ErrorDescriptor {
  source: ErrorSource
  code?: string
  kind?: ErrorKind
}

export interface SafeErrorContext {
  source: ErrorSource
  code?: string
  safeSummary: string
}

// Human-friendly summary strings by source + kind.
// These are the ONLY strings that flow into chat — no raw internals.
const SOURCE_LABELS: Record<ErrorSource, string> = {
  map: 'the resource map',
  programs: 'the benefits and programs list',
  documents: 'your documents',
  feed: 'the community feed',
  forms: 'the forms system',
  unknown: 'a section of the app',
}

const KIND_SUMMARIES: Record<ErrorKind, (sourceLabel: string) => string> = {
  network: (s) =>
    `We couldn't reach ${s} — it may be a connection issue. Your internet connection might be slow or temporarily interrupted.`,
  timeout: (s) =>
    `Loading ${s} took too long and was stopped. This can happen on slower connections or when our servers are busy.`,
  server: (s) =>
    `${capitalize(s)} ran into a problem on our end. Our team is notified automatically when this happens.`,
  auth: (_s) =>
    `Your session may have expired. Signing out and back in usually fixes this.`,
  permission: (_s) =>
    `You don't have access to that right now. If you think this is a mistake, try refreshing the page.`,
  unknown: (s) =>
    `Something unexpected happened while loading ${s}. This is usually temporary.`,
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Build a safe, sanitized summary from a structured error descriptor.
 * The returned string contains NO raw error internals and is safe to pass
 * into the AI chat as part of an explain-request.
 */
export function buildSafeErrorContext(descriptor: ErrorDescriptor): SafeErrorContext {
  const { source, code, kind = 'unknown' } = descriptor
  const sourceLabel = SOURCE_LABELS[source] ?? SOURCE_LABELS.unknown
  const summaryFn = KIND_SUMMARIES[kind] ?? KIND_SUMMARIES.unknown
  const safeSummary = summaryFn(sourceLabel)

  return {
    source,
    ...(code ? { code } : {}),
    safeSummary,
  }
}

/**
 * Compose the system/user explain-request message that is sent to the AI chat.
 * This is the message that instructs the assistant to explain the situation warmly.
 * The safe summary is embedded — the raw error is NEVER included.
 */
export function buildExplainRequest(ctx: SafeErrorContext): string {
  const codePart = ctx.code ? ` (code: ${ctx.code})` : ''
  return (
    `The user just ran into a problem: ${ctx.safeSummary}${codePart}. ` +
    `Please explain in simple, calm, warm terms what this means and what they can try next. ` +
    `Keep it brief — two or three sentences at most.`
  )
}
