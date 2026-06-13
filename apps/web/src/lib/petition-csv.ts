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
 * escapeCsvField — quote-and-escape one field per RFC 4180.
 * null/undefined → empty string. Quotes only when required.
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
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
