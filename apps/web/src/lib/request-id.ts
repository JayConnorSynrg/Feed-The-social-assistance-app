// apps/web/src/lib/request-id.ts
//
// The one shape a correlation id may take anywhere it is stored or forwarded:
// 1-64 characters of [A-Za-z0-9-]. A caller-supplied x-request-id is untrusted
// text; anything outside this shape is discarded (the proxy mints a UUID instead,
// and the log sink stores no request_id), so app_logs.request_id can never hold
// markup, personal data, or an unbounded string.

const REQUEST_ID_RE = /^[A-Za-z0-9-]{1,64}$/

/** Returns `value` when it is a well-formed correlation id, else undefined. */
export function safeRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && REQUEST_ID_RE.test(value) ? value : undefined
}
