/**
 * Open-redirect guard (CWE-601: URL Redirection to Untrusted Site).
 *
 * Returns `raw` only when it is a safe same-origin relative path; otherwise
 * returns `fallback`. A relative path is "safe" only if every vector that
 * escapes origin under `new URL(value, origin)` or a browser `router.push`
 * is rejected. Each clause below is load-bearing (empirically verified
 * against `new URL` resolution):
 *
 *   - must be a non-empty string starting with '/'      → blocks
 *     `https://evil.com`, `http:evil.com`, `javascript:alert(1)`,
 *     ` //evil.com` (leading whitespace shifts off the '/').
 *   - must NOT start with '//'                           → blocks the
 *     protocol-relative `//evil.com` (resolves to https://evil.com/).
 *   - must NOT contain a backslash                       → browsers
 *     normalize '\' to '/', so `/\evil.com` and `\\evil.com` resolve
 *     off-origin.
 *   - must NOT contain control chars (\x00-\x1f, \x7f)   → browsers strip
 *     embedded TAB/LF/CR then re-evaluate, so `/\t/evil.com` resolves to
 *     https://evil.com/.
 */
export function safeRelativePath(
  raw: string | null | undefined,
  fallback = '/'
): string {
  if (typeof raw !== 'string') return fallback
  if (raw.length === 0) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (raw.includes('\\')) return fallback
  // Control chars (TAB/LF/CR/NUL/DEL) are themselves the attack vector here:
  // browsers strip them then re-evaluate, so `/\t/evil.com` resolves off-origin.
  if (/[\x00-\x1f\x7f]/.test(raw)) return fallback
  return raw
}
