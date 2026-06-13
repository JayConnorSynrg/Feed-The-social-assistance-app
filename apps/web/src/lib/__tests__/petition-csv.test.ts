import { describe, it, expect } from 'vitest'
import {
  escapeCsvField,
  buildPetitionSignaturesCsv,
  type PetitionSignatureRow,
} from '../petition-csv'

describe('escapeCsvField', () => {
  it('passes plain values through unquoted', () => {
    expect(escapeCsvField('Jane Doe')).toBe('Jane Doe')
    expect(escapeCsvField('192.168.0.1')).toBe('192.168.0.1')
  })

  it('renders null/undefined as empty string', () => {
    expect(escapeCsvField(null)).toBe('')
    expect(escapeCsvField(undefined)).toBe('')
  })

  it('quotes fields containing a comma', () => {
    expect(escapeCsvField('Doe, Jane')).toBe('"Doe, Jane"')
  })

  it('quotes and doubles embedded double-quotes', () => {
    expect(escapeCsvField('She said "hi"')).toBe('"She said ""hi"""')
  })

  it('quotes fields containing newlines or carriage returns', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
    expect(escapeCsvField('a\r\nb')).toBe('"a\r\nb"')
  })

  it('stringifies non-string scalars', () => {
    expect(escapeCsvField(42)).toBe('42')
  })
})

describe('buildPetitionSignaturesCsv', () => {
  it('emits a header row even with no signatures', () => {
    expect(buildPetitionSignaturesCsv([])).toBe(
      'Full Name,Signed At,Affirmation,Petition Version Hash,IP Address,User Agent'
    )
  })

  it('serializes a row in the legal-record column order with CRLF lines', () => {
    const rows: PetitionSignatureRow[] = [
      {
        signer_full_name: 'Jane Doe',
        signed_at: '2026-06-13T12:00:00Z',
        affirmation_text: 'I add my verified signature of support.',
        petition_version_hash: 'abc123',
        ip_address: '10.0.0.1',
        user_agent: 'Mozilla/5.0',
      },
    ]
    const csv = buildPetitionSignaturesCsv(rows)
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe(
      'Jane Doe,2026-06-13T12:00:00Z,I add my verified signature of support.,abc123,10.0.0.1,Mozilla/5.0'
    )
  })

  it('escapes injection-prone fields (commas, quotes, newlines) without corrupting columns', () => {
    const rows: PetitionSignatureRow[] = [
      {
        signer_full_name: 'Doe, "Jane"',
        signed_at: '2026-06-13T12:00:00Z',
        affirmation_text: 'multi\nline',
        petition_version_hash: 'h,1',
        ip_address: null,
        user_agent: 'UA, with comma',
      },
    ]
    const csv = buildPetitionSignaturesCsv(rows)
    const dataLine = csv.split('\r\n')[1]
    expect(dataLine).toBe(
      '"Doe, ""Jane""",2026-06-13T12:00:00Z,"multi\nline","h,1",,"UA, with comma"'
    )
  })
})
