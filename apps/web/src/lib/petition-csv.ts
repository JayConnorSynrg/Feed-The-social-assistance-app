/**
 * petition-csv.ts
 *
 * RFC-4180-aligned CSV serialization for the petition signer export
 * (admin-only full legal record). A field is quoted when it contains a
 * comma, double-quote, CR, or LF; embedded double-quotes are doubled.
 *
 * Pure + framework-free so it is unit-testable in isolation.
 */

/** A single signer row in the admin legal-record export. */
export interface PetitionSignatureRow {
  signer_full_name: string | null
  signed_at: string | null
  affirmation_text: string | null
  petition_version_hash: string | null
  ip_address: string | null
  user_agent: string | null
}

/** Column order + human headers for the exported CSV. */
const COLUMNS: ReadonlyArray<{ key: keyof PetitionSignatureRow; header: string }> = [
  { key: 'signer_full_name', header: 'Full Name' },
  { key: 'signed_at', header: 'Signed At' },
  { key: 'affirmation_text', header: 'Affirmation' },
  { key: 'petition_version_hash', header: 'Petition Version Hash' },
  { key: 'ip_address', header: 'IP Address' },
  { key: 'user_agent', header: 'User Agent' },
]

/**
 * Leading characters that a spreadsheet (Excel / Google Sheets / LibreOffice)
 * interprets as the start of a formula. A user-controlled value beginning with
 * one of these can execute on open — CSV formula injection (CWE-1236).
 * Per the OWASP mitigation we prepend a single apostrophe so the cell is
 * treated as literal text. TAB (\t) and CR (\r) are included because some
 * spreadsheet importers strip them and re-evaluate the remaining payload.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/**
 * escapeCsvField — neutralize formula injection, then quote-and-escape one
 * field per RFC 4180. null/undefined → empty string.
 *
 * Order matters: the formula-defusing apostrophe is prepended to the raw value
 * BEFORE RFC-4180 quoting, so a value like `=cmd(),x` becomes `'=cmd(),x` and
 * is then correctly wrapped as `"'=cmd(),x"`.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // CWE-1236 — defuse leading formula triggers before RFC-4180 quoting.
  if (FORMULA_TRIGGER.test(s)) {
    s = `'${s}`
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * buildPetitionSignaturesCsv — full CSV document (header + rows), CRLF line
 * endings per RFC 4180.
 */
export function buildPetitionSignaturesCsv(rows: PetitionSignatureRow[]): string {
  const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(',')
  const lines = rows.map((row) =>
    COLUMNS.map((c) => escapeCsvField(row[c.key])).join(',')
  )
  return [header, ...lines].join('\r\n')
}
