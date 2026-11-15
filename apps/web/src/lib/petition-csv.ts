/**
 * petition-csv.ts
 *
 * The petition signatures file an admin downloads for a petition's organizer
 * (POST /api/admin/petitions/[id]/export builds it on the server).
 *
 * Columns — only what an organizer needs to present the signatures:
 *   Full Name              who signed (the name they gave at signing)
 *   Signed At              when they signed (ISO 8601, UTC)
 *   Affirmation            the statement they agreed to when signing
 *   Petition Version Hash  which text of the petition they signed
 * IP address, device (user agent), display name and account id stay in the
 * database: they are other people's personal details an organizer does not need.
 *
 * File format:
 *   - UTF-8 with a byte-order mark, so Excel shows non-Latin names correctly;
 *   - RFC 4180: CRLF line ends; a field with a comma, double quote, CR or LF is
 *     quoted and its double quotes doubled;
 *   - formula-safe (CWE-1236): a cell starting (after any spaces) with = + - @
 *     TAB or CR gets a leading apostrophe so a spreadsheet shows it as text.
 *
 * Pure and framework-free so it is unit-testable in isolation.
 */

/** One signer row as the export reads it (a subset of export_petition_signatures' columns). */
export interface PetitionSignatureRow {
  signer_full_name: string | null
  signed_at: string | null
  affirmation_text: string | null
  petition_version_hash: string | null
}

/** Column order + headers for the exported CSV. */
export const PETITION_CSV_COLUMNS: ReadonlyArray<{ key: keyof PetitionSignatureRow; header: string }> = [
  { key: 'signer_full_name', header: 'Full Name' },
  { key: 'signed_at', header: 'Signed At' },
  { key: 'affirmation_text', header: 'Affirmation' },
  { key: 'petition_version_hash', header: 'Petition Version Hash' },
]

/** UTF-8 byte-order mark (U+FEFF). Excel reads a BOM-less CSV in the system code page. */
export const UTF8_BOM = '﻿'

/**
 * Leading characters that a spreadsheet (Excel / Google Sheets / LibreOffice)
 * interprets as the start of a formula. A user-controlled value beginning with
 * one of these can execute on open — CSV formula injection (CWE-1236).
 * Per the OWASP mitigation we prepend a single apostrophe so the cell is
 * treated as literal text. TAB (\t) and CR (\r) are included because some
 * spreadsheet importers strip them and re-evaluate the remaining payload. Leading spaces are
 * skipped first: some importers trim them, so ' =1+1' would also evaluate.
 */
const FORMULA_TRIGGER = /^[ ]*[=+\-@\t\r]/

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
 * buildPetitionSignaturesCsv — the whole file: BOM, header, one line per row,
 * CRLF line endings. Only the four columns above are written, whatever else a
 * row object carries.
 */
export function buildPetitionSignaturesCsv(rows: ReadonlyArray<PetitionSignatureRow>): string {
  const header = PETITION_CSV_COLUMNS.map((c) => escapeCsvField(c.header)).join(',')
  const lines = rows.map((row) =>
    PETITION_CSV_COLUMNS.map((c) => escapeCsvField(row[c.key])).join(',')
  )
  return UTF8_BOM + [header, ...lines].join('\r\n')
}

/**
 * The download's file name: petition id and UTC date only — never the petition
 * title or anyone's name. `petition-signatures-<uuid>-<YYYY-MM-DD>.csv`.
 */
export function petitionCsvFilename(petitionId: string, now: Date): string {
  const id = petitionId.toLowerCase().replace(/[^0-9a-f-]/g, '')
  return `petition-signatures-${id}-${now.toISOString().slice(0, 10)}.csv`
}
