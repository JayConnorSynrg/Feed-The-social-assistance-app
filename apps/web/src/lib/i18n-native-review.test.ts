// apps/web/src/lib/i18n-native-review.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// docs/i18n-native-review.md is the one list of Haitian Creole, Somali, Amharic and Hmong strings
// awaiting a native speaker. This test keeps its generated part equal to the dictionaries: a new
// or changed ht / so / am / hmn string with no matching row fails here.
//
// To update the list after changing a string (keeps each unchanged row's date and status):
//   UPDATE_I18N_REVIEW=1 npx vitest run src/lib/i18n-native-review.test.ts

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { TIME_WORDS } from './i18n-intl'

type ReviewLocale = 'ht' | 'so' | 'am' | 'hmn'
const DRAFT = 'machine-drafted, needs native review'
const TODAY = '2026-10-11'
const DOC = fileURLToPath(new URL('../../../../docs/i18n-native-review.md', import.meta.url))
const BEGIN = '<!-- BEGIN GENERATED: lib/i18n-native-review.test.ts -->'
const END = '<!-- END GENERATED -->'

interface Row {
  file: string
  key: string
  locale: ReviewLocale
  en: string
  text: string
  added: string
  status: string
}
type Draft = Omit<Row, 'added' | 'status'> & { status?: string }

const EN_TIME = {
  months: 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec',
  date: '{month} {day}, {year}',
  clock: '{hour}:{minute} {period}',
  am: 'AM',
  pm: 'PM',
  past: { minute: '{n} minutes ago', hour: '{n} hours ago', day: '{n} days ago' },
}

function timeWordRows(): Draft[] {
  const file = 'lib/i18n-intl.ts'
  return (Object.keys(TIME_WORDS) as ReviewLocale[]).flatMap((locale) => {
    const w = TIME_WORDS[locale]!
    // Somali time words are CLDR 48's own data (i18n-intl.test.ts compares them with Intl).
    const status = locale === 'so' ? 'CLDR 48 data; equals Intl where the runtime has Somali' : undefined
    return [
      { file, key: 'TIME_WORDS.months', locale, en: EN_TIME.months, text: w.months.join(', '), status },
      { file, key: 'TIME_WORDS.date', locale, en: EN_TIME.date, text: w.date, status },
      { file, key: 'TIME_WORDS.clock', locale, en: EN_TIME.clock, text: w.clock, status },
      { file, key: 'TIME_WORDS.am', locale, en: EN_TIME.am, text: w.am, status },
      { file, key: 'TIME_WORDS.pm', locale, en: EN_TIME.pm, text: w.pm, status },
      ...(['minute', 'hour', 'day'] as const).flatMap((unit) =>
        Object.entries(w.past[unit]).map(([form, text]) => ({ file, key: `TIME_WORDS.past.${unit}.${form}`, locale, en: EN_TIME.past[unit], text: text as string, status })),
      ),
    ]
  })
}

/** Every source this list tracks. A new dictionary adds one line here. */
function expectedRows(): Draft[] {
  return [...timeWordRows()]
}

const cell = (s: string) => s.replace(/\|/g, '\\|')
const uncell = (s: string) => s.replace(/\\\|/g, '|')
const id = (r: { file: string; key: string; locale: string }) => `${r.file}\u0000${r.key}\u0000${r.locale}`

function parse(doc: string): Row[] {
  const block = doc.slice(doc.indexOf(BEGIN) + BEGIN.length, doc.indexOf(END))
  const rows: Row[] = []
  let file = ''
  for (const line of block.split('\n')) {
    const heading = /^### `([^`]+)`/.exec(line)
    if (heading) file = heading[1]
    if (!line.startsWith('| `')) continue
    const cells = line.slice(2, -2).split(/ (?<!\\)\| /).map(uncell)
    const [key, locale, en, text, added, status] = cells
    rows.push({ file, key: key.replace(/`/g, ''), locale: locale as ReviewLocale, en, text, added, status })
  }
  return rows
}

function render(rows: Row[]): string {
  const out: string[] = [BEGIN, '']
  for (const file of [...new Set(rows.map((r) => r.file))]) {
    out.push(`### \`${file}\``, '', '| Key | Locale | English | Text | Added | Status |', '|---|---|---|---|---|---|')
    for (const r of rows.filter((x) => x.file === file)) {
      out.push(`| \`${r.key}\` | ${r.locale} | ${cell(r.en)} | ${cell(r.text)} | ${r.added} | ${cell(r.status)} |`)
    }
    out.push('')
  }
  out.push(END)
  return out.join('\n')
}

describe('docs/i18n-native-review.md', () => {
  const doc = readFileSync(DOC, 'utf8')
  const listed = new Map(parse(doc).map((r) => [id(r), r]))
  // A row keeps its date and status while its text is unchanged; a changed text is a new draft.
  const expected: Row[] = expectedRows().map((r) => {
    const prev = listed.get(id(r))
    const kept = prev && prev.text === r.text
    return { ...r, added: kept ? prev.added : TODAY, status: kept ? prev.status : (r.status ?? DRAFT) }
  })

  if (process.env.UPDATE_I18N_REVIEW) {
    it('rewrites the generated part', () => {
      const next = doc.slice(0, doc.indexOf(BEGIN)) + render(expected) + doc.slice(doc.indexOf(END) + END.length)
      writeFileSync(DOC, next)
      expect(parse(next)).toHaveLength(expected.length)
    })
    return
  }

  it('has the generated block', () => {
    expect(doc).toContain(BEGIN)
    expect(doc).toContain(END)
    expect(expected.length).toBeGreaterThan(0)
  })

  it('lists every tracked ht / so / am / hmn string, and nothing that no longer exists', () => {
    expect([...listed.keys()].sort()).toEqual(expected.map(id).sort())
  })

  it('each row carries the current text and its English source', () => {
    for (const r of expected) {
      const row = listed.get(id(r))
      expect(row?.text, `${r.file} ${r.key} ${r.locale}`).toBe(r.text)
      expect(row?.en, `${r.file} ${r.key} ${r.locale}`).toBe(r.en)
    }
  })

  it('each row has a date and a status; a machine draft says so in the agreed words', () => {
    for (const row of listed.values()) {
      expect(row.added).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(row.status.trim()).not.toBe('')
    }
    expect([...listed.values()].some((r) => r.status === DRAFT)).toBe(true)
  })
})
