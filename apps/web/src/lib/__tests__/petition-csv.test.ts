import { describe, it, expect } from 'vitest'
import {
  escapeCsvField,
  buildPetitionSignaturesCsv,
  petitionCsvFilename,
  PETITION_CSV_COLUMNS,
  UTF8_BOM,
  type PetitionSignatureRow,
} from '../petition-csv'
import { collectAllPages } from '../petition-export'

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

  // CWE-1236 — CSV formula injection. signer_full_name is user-controlled, so
  // a leading =/+/-/@/TAB/CR must be defused with a prepended apostrophe.
  describe('formula injection (CWE-1236)', () => {
    it('prefixes a leading = with an apostrophe', () => {
      expect(escapeCsvField('=cmd()')).toBe("'=cmd()")
    })

    it('prefixes a leading @ (and RFC-quotes embedded parens payload)', () => {
      expect(escapeCsvField('@SUM(1+1)')).toBe("'@SUM(1+1)")
    })

    it('prefixes a leading +', () => {
      expect(escapeCsvField('+1')).toBe("'+1")
    })

    it('prefixes a leading -', () => {
      expect(escapeCsvField('-1')).toBe("'-1")
    })

    it('prefixes a leading TAB and RFC-quotes (TAB is harmless but \\r/\\n force quoting)', () => {
      // A leading TAB triggers the apostrophe; TAB itself needs no RFC quoting.
      expect(escapeCsvField('\tcmd')).toBe("'\tcmd")
    })

    it('prefixes a leading CR and RFC-quotes it (CR forces quoting)', () => {
      // Apostrophe is prepended first, then RFC-4180 quoting wraps the CR.
      expect(escapeCsvField('\r=cmd')).toBe('"\'\r=cmd"')
    })

    it('combines formula-prefix with comma quoting', () => {
      expect(escapeCsvField('=cmd(),x')).toBe('"\'=cmd(),x"')
    })

    it('does NOT prefix a normal name', () => {
      expect(escapeCsvField('Jane Doe')).toBe('Jane Doe')
    })

    it('does NOT prefix an INTERNAL hyphen (only leading chars are dangerous)', () => {
      expect(escapeCsvField('Anne-Marie')).toBe('Anne-Marie')
    })

    it('does NOT prefix an INTERNAL plus', () => {
      expect(escapeCsvField('A+B Corp')).toBe('A+B Corp')
    })
  })
})

describe('buildPetitionSignaturesCsv', () => {
  it('starts with a UTF-8 BOM and emits a header row even with no signatures', () => {
    expect(buildPetitionSignaturesCsv([])).toBe(
      UTF8_BOM + 'Full Name,Signed At,Affirmation,Petition Version Hash'
    )
    expect(buildPetitionSignaturesCsv([]).charCodeAt(0)).toBe(0xfeff)
  })

  it('serializes a row in column order with CRLF lines', () => {
    const rows: PetitionSignatureRow[] = [
      {
        signer_full_name: 'Jane Doe',
        signed_at: '2026-06-13T12:00:00Z',
        affirmation_text: 'I add my verified signature of support.',
        petition_version_hash: 'abc123',
      },
    ]
    const lines = buildPetitionSignaturesCsv(rows).split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('Jane Doe,2026-06-13T12:00:00Z,I add my verified signature of support.,abc123')
  })

  it('writes only the four organizer columns, whatever else a row carries (IP, device, display name)', () => {
    const row = {
      signer_full_name: 'Jane Doe',
      signed_at: '2026-06-13T12:00:00Z',
      affirmation_text: 'ok',
      petition_version_hash: 'h',
      ip_address: '10.0.0.1',
      user_agent: 'Mozilla/5.0',
      signer_display_name: 'jdoe',
    }
    const csv = buildPetitionSignaturesCsv([row])
    expect(csv).not.toMatch(/10\.0\.0\.1|Mozilla|jdoe|IP Address|User Agent/)
    expect(PETITION_CSV_COLUMNS.map((c) => c.key)).toEqual([
      'signer_full_name',
      'signed_at',
      'affirmation_text',
      'petition_version_hash',
    ])
  })

  it('keeps non-Latin names intact', () => {
    const csv = buildPetitionSignaturesCsv([
      { signer_full_name: '张伟', signed_at: null, affirmation_text: null, petition_version_hash: null },
      { signer_full_name: 'ወይዘሮ አበበች', signed_at: null, affirmation_text: null, petition_version_hash: null },
    ])
    expect(csv.split('\r\n').slice(1)).toEqual(['张伟,,,', 'ወይዘሮ አበበች,,,'])
  })

  it('escapes injection-prone fields (commas, quotes, newlines, formulas) without corrupting columns', () => {
    const rows: PetitionSignatureRow[] = [
      {
        signer_full_name: 'Doe, "Jane"',
        signed_at: '2026-06-13T12:00:00Z',
        affirmation_text: 'multi\nline',
        petition_version_hash: '=1+1',
      },
    ]
    const dataLine = buildPetitionSignaturesCsv(rows).split('\r\n')[1]
    expect(dataLine).toBe('"Doe, ""Jane""",2026-06-13T12:00:00Z,"multi\nline",\'=1+1')
  })
})

describe('petitionCsvFilename', () => {
  it('names the file by petition id and UTC date only', () => {
    expect(petitionCsvFilename('AB12CD34-0000-4000-8000-000000000000', new Date('2026-11-15T23:30:00Z'))).toBe(
      'petition-signatures-ab12cd34-0000-4000-8000-000000000000-2026-11-15.csv'
    )
  })

  it('drops anything that is not part of a uuid', () => {
    expect(petitionCsvFilename('x/../"name"', new Date('2026-01-02T00:00:00Z'))).toBe('petition-signatures-ae-2026-01-02.csv')
  })
})

describe('collectAllPages (reads past the 1,000-row response cap)', () => {
  const source = (n: number, cap = 1000) => {
    const calls: Array<[number, number]> = []
    const all = Array.from({ length: n }, (_, i) => i)
    const fetchPage = async (from: number, to: number) => {
      calls.push([from, to])
      return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null }
    }
    return { calls, fetchPage }
  }

  it('reads 2,500 rows in three pages', async () => {
    const { calls, fetchPage } = source(2500)
    const r = await collectAllPages(fetchPage, 2500)
    expect(r.ok && r.rows.length).toBe(2500)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('exactly 1,000 rows needs a second (empty) page to know it is done', async () => {
    const { calls, fetchPage } = source(1000)
    const r = await collectAllPages(fetchPage, 1000)
    expect(r.ok && r.rows.length).toBe(1000)
    expect(calls).toHaveLength(2)
  })

  it('a cap below the page size is caught by the count: incomplete, never a silent partial', async () => {
    const { fetchPage } = source(1500, 400)
    expect(await collectAllPages(fetchPage, 1500)).toEqual({ ok: false, code: 'incomplete', read: 400 })
  })

  it('a page error stops the read', async () => {
    const r = await collectAllPages(async () => ({ data: null, error: { message: 'boom' } }), 3)
    expect(r).toEqual({ ok: false, code: 'read_failed', message: 'boom', read: 0 })
  })

  it('more rows than counted (a signature added during the read) is fine', async () => {
    const { fetchPage } = source(1001)
    const r = await collectAllPages(fetchPage, 1000)
    expect(r.ok && r.rows.length).toBe(1001)
  })
})
