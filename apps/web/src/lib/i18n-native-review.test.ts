// apps/web/src/lib/i18n-native-review.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// docs/i18n-native-review.md lists, string by string, the Haitian Creole, Somali, Amharic and
// Hmong text awaiting a native speaker, starting with the Release 3.5 dictionaries. This test
// keeps its generated part equal to the code:
//   - every dictionary module lib/i18n-*.ts is read automatically: a new one joins the list with
//     no line added here, and this test fails until the list is regenerated;
//   - the older dictionaries, which still carry their note inline, are named in OLDER and in the
//     document's own table (kept equal), and are not itemised;
//   - a new or changed ht / so / am / hmn string with no matching row fails.
//
// To update the list after changing a string (keeps each unchanged row's date and status):
//   UPDATE_I18N_REVIEW=1 npx vitest run src/lib/i18n-native-review.test.ts

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { messages } from './i18n'
import { TIME_WORDS } from './i18n-intl'

const LOCALES = Object.keys(messages).sort()
const REVIEW_LOCALES = ['ht', 'so', 'am', 'hmn'] as const
const DRAFT = 'machine-drafted, needs native review'
const WORDING = 'wording choice, review welcome'
const TODAY = '2026-10-11'
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const DOC = fileURLToPath(new URL('../../../../docs/i18n-native-review.md', import.meta.url))
const BEGIN = '<!-- BEGIN GENERATED: lib/i18n-native-review.test.ts -->'
const END = '<!-- END GENERATED -->'

interface Row {
  file: string
  key: string
  locale: string
  en: string
  text: string
  added: string
  status: string
}
type Draft = Omit<Row, 'added' | 'status'> & { status?: string }

// Every dictionary module in lib/, loaded as it is on disk.
const MODULES = import.meta.glob<Record<string, unknown>>(['./i18n-*.ts', '!./*.test.ts'], { eager: true })
const moduleFile = (path: string) => `lib/${path.replace('./', '')}`

/**
 * Dictionaries written before this list existed. Their strings are machine-drafted too; they are
 * not itemised here yet. `marker` says whether the file carries the review note inline.
 * Itemise one by deleting its row (and its row in the document).
 */
const OLDER: Record<string, { marker: boolean }> = {
  'lib/i18n.ts': { marker: true },
  'lib/i18n-feed-chrome.ts': { marker: true },
  'lib/i18n-feed-card.ts': { marker: true },
  'lib/i18n-feed-composer.ts': { marker: true },
  'lib/i18n-feed-comments.ts': { marker: true },
  'lib/i18n-feed-edit.ts': { marker: true },
  'lib/i18n-resource-categories.ts': { marker: true },
  'lib/i18n-event-forms.ts': { marker: true },
  'lib/i18n-event-member.ts': { marker: true },
  'lib/i18n-map-member.ts': { marker: true },
  'lib/i18n-admin-nav.ts': { marker: false },
  'lib/i18n-admin-focus.ts': { marker: true },
  'lib/i18n-org-forms.ts': { marker: true },
  'lib/event-recurrence-format.ts': { marker: true },
}

const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other']
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** An export shaped Record<Locale, Record<string, string>>: a dictionary or a plural table. */
function localeTable(value: unknown): Record<string, Record<string, string>> | null {
  if (!isRecord(value) || Object.keys(value).sort().join() !== LOCALES.join()) return null
  const ok = Object.values(value).every((d) => isRecord(d) && Object.values(d).every((x) => typeof x === 'string'))
  return ok ? (value as Record<string, Record<string, string>>) : null
}

/** Every locale table a module exports, as rows in the given locales. */
function moduleRows(file: string, mod: Record<string, unknown>, locales: readonly string[], keep: (text: string) => boolean = () => true): Draft[] {
  return Object.entries(mod).flatMap(([name, value]) => {
    const table = localeTable(value)
    if (!table) return []
    const plural = Object.keys(table.en).every((k) => PLURAL_FORMS.includes(k))
    return locales.flatMap((locale) =>
      Object.entries(table[locale])
        .filter(([, text]) => keep(text))
        .map(([key, text]) => ({ file, key: plural ? `${name}.${key}` : key, locale, en: table.en[key] ?? table.en.other, text })),
    )
  })
}

const EN_TIME = {
  months: 'Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec',
  monthsLong: 'January, February, March, April, May, June, July, August, September, October, November, December',
  weekdays: 'Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday',
  weekdaysShort: 'Sun, Mon, Tue, Wed, Thu, Fri, Sat',
  am: 'AM',
  pm: 'PM',
  past: { minute: '{n} minutes ago', hour: '{n} hours ago', day: '{n} days ago' },
  future: { minute: 'In {n} minutes', hour: 'In {n} hours', day: 'In {n} days' },
}

function timeWordRows(): Draft[] {
  const file = 'lib/i18n-intl.ts'
  return Object.entries(TIME_WORDS).flatMap(([locale, w]) => {
    // Somali names, day periods and past ages are CLDR 48's own data (i18n-intl.test.ts compares
    // them with Intl); its future ages are FEED's.
    const cldr = locale === 'so' ? 'CLDR 48 data; equals Intl where the runtime has Somali' : undefined
    return [
      ...(['months', 'monthsLong', 'weekdays', 'weekdaysShort'] as const).map((k) => ({ file, key: `TIME_WORDS.${k}`, locale, en: EN_TIME[k], text: w[k].join(', '), status: cldr })),
      { file, key: 'TIME_WORDS.am', locale, en: EN_TIME.am, text: w.am, status: cldr },
      { file, key: 'TIME_WORDS.pm', locale, en: EN_TIME.pm, text: w.pm, status: cldr },
      ...(['past', 'future'] as const).flatMap((direction) =>
        (['minute', 'hour', 'day'] as const).flatMap((unit) =>
          Object.entries(w[direction][unit]).map(([form, text]) => ({
            file,
            key: `TIME_WORDS.${direction}.${unit}.${form}`,
            locale,
            en: EN_TIME[direction][unit],
            text: text as string,
            status: direction === 'past' ? cldr : undefined,
          })),
        ),
      ),
    ]
  })
}

/** Arabic petition strings that carry the "confirmed signature" wording (a choice, not a draft). */
const AR_WORDING = { file: 'lib/i18n-feed-petitions.ts', has: (text: string) => text.includes('مؤكَّد') }

/** Every source this list tracks. */
function expectedRows(): Draft[] {
  const tracked = Object.entries(MODULES).filter(([path]) => !(moduleFile(path) in OLDER))
  return [
    ...timeWordRows(),
    ...tracked.flatMap(([path, mod]) => moduleRows(moduleFile(path), mod, REVIEW_LOCALES)),
    ...tracked
      .filter(([path]) => moduleFile(path) === AR_WORDING.file)
      .flatMap(([path, mod]) => moduleRows(moduleFile(path), mod, ['ar'], AR_WORDING.has).map((r) => ({ ...r, status: WORDING }))),
  ]
}

/**
 * A value as a Markdown table cell. The backslash is the escape character, so it is escaped
 * first and the pipe second: every backslash in a cell then begins a two-character pair
 * (`\\` or `\|`) and a cell has exactly one reading.
 */
const cell = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
/** The exact inverse of cell: one pass over escape pairs, left to right. */
const uncell = (s: string) => s.replace(/\\([\\|])/g, '$1')
/** The cells of a table row `| a | b |`: cut at each pipe that is not the second half of an
 *  escape pair (one pass), then decoded. The one space of padding on each side is not content. */
function rowCells(line: string): string[] {
  const raw: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && i + 1 < line.length) {
      current += line[i] + line[++i]
    } else if (line[i] === '|') {
      raw.push(current)
      current = ''
    } else {
      current += line[i]
    }
  }
  // Before the first pipe and after the last there is nothing.
  return raw.slice(1).map((c) => uncell(c.replace(/^ /, '').replace(/ $/, '')))
}
const id = (r: { file: string; key: string; locale: string }) => `${r.file}\u0000${r.key}\u0000${r.locale}`

function parse(doc: string): Row[] {
  const block = doc.slice(doc.indexOf(BEGIN) + BEGIN.length, doc.indexOf(END))
  const rows: Row[] = []
  let file = ''
  for (const line of block.split('\n')) {
    const heading = /^### `([^`]+)`/.exec(line)
    if (heading) file = heading[1]
    if (!line.startsWith('| `')) continue
    const [key, locale, en, text, added, status] = rowCells(line)
    // The key is shown as code: one backtick on each side.
    rows.push({ file, key: key.slice(1, -1), locale, en, text, added, status })
  }
  return rows
}

function render(rows: Row[]): string {
  const out: string[] = [BEGIN, '']
  for (const file of [...new Set(rows.map((r) => r.file))]) {
    out.push(`### \`${file}\``, '', '| Key | Locale | English | Text | Added | Status |', '|---|---|---|---|---|---|')
    for (const r of rows.filter((x) => x.file === file)) {
      out.push(`| ${cell(`\`${r.key}\``)} | ${cell(r.locale)} | ${cell(r.en)} | ${cell(r.text)} | ${cell(r.added)} | ${cell(r.status)} |`)
    }
    out.push('')
  }
  out.push(END)
  return out.join('\n')
}

describe('table cells: encode and decode', () => {
  // CodeQL js/incomplete-sanitization (2026-10-11): escaping the pipe alone left "\\|" and "|"
  // with the same encoding once a backslash stood before a pipe.
  const TRICKY = ['|', '\\', '\\|', '\\\\|', 'ends with a backslash\\', 'a | b', '\\\\', '|\\|\\\\||', 'x \\| y \\\\ z', '', ' padded ', 'plain {n} text']

  it.each(TRICKY)('uncell(cell(%j)) is the string itself', (s) => {
    expect(uncell(cell(s))).toBe(s)
  })

  it('every backslash in a cell begins an escape pair, and no pipe stands unescaped', () => {
    for (const s of TRICKY) {
      const rest = cell(s).replace(/\\[\\|]/g, '')
      expect(rest, JSON.stringify(s)).not.toMatch(/[\\|]/)
    }
    expect(cell('\\')).toBe('\\\\')
    expect(cell('|')).toBe('\\|')
    expect(cell('\\|')).toBe('\\\\\\|')
  })

  it('different strings never share an encoding', () => {
    expect(new Set(TRICKY.map(cell)).size).toBe(TRICKY.length)
  })

  it('a whole row comes back cell for cell: render, then parse', () => {
    const rows: Row[] = TRICKY.map((text, i) => ({ file: 'lib/i18n-x.ts', key: `key${i}`, locale: 'ht', en: `en ${text}`, text, added: TODAY, status: `status | ${text}` }))
    expect(parse(render(rows))).toEqual(rows)
  })

  it('rowCells cuts only at a pipe that is not escaped', () => {
    expect(rowCells('| a | b |')).toEqual(['a', 'b'])
    expect(rowCells('| a \\| b | c\\\\ | d |')).toEqual(['a | b', 'c\\', 'd'])
  })
})

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

  it('the Arabic petition wording is listed as a wording choice', () => {
    const ar = [...listed.values()].filter((r) => r.locale === 'ar')
    expect(ar.length).toBeGreaterThanOrEqual(10)
    for (const row of ar) {
      expect(row.file).toBe('lib/i18n-feed-petitions.ts')
      expect(row.status).toBe(WORDING)
    }
  })
})

describe('which dictionaries the list covers', () => {
  const doc = readFileSync(DOC, 'utf8')

  it('every lib/i18n-*.ts dictionary module is itemised, or named as an older one', () => {
    const files = Object.keys(MODULES).map(moduleFile)
    expect(files.length).toBeGreaterThanOrEqual(17)
    const itemised = [...new Set(parse(doc).map((r) => r.file))]
    for (const file of files) {
      const exportsTable = Object.values(MODULES[`./${file.replace('lib/', '')}`]).some((v) => localeTable(v) !== null)
      if (file in OLDER) continue
      // lib/i18n-intl.ts holds TIME_WORDS (three locales), read by timeWordRows.
      if (exportsTable || file === 'lib/i18n-intl.ts') expect(itemised, file).toContain(file)
    }
    // The four Release 3.5 dictionaries and the time words are where the list starts.
    for (const file of ['lib/i18n-intl.ts', 'lib/i18n-feed-organizations.ts', 'lib/i18n-feed-petitions.ts', 'lib/i18n-feed-messages.ts', 'lib/i18n-feed-businesses.ts']) {
      expect(itemised).toContain(file)
    }
  })

  it('the document names exactly the older dictionaries, and says truthfully which carry the note inline', () => {
    const section = doc.slice(doc.indexOf('## Older dictionaries'))
    const rows = [...section.matchAll(/^\| `(lib\/[^`]+)` \| ([^|]+) \| (yes|no) \|/gm)].map((m) => ({ file: m[1], marker: m[3] === 'yes' }))
    expect(rows.map((r) => r.file).sort()).toEqual(Object.keys(OLDER).sort())
    for (const row of rows) {
      expect(row.marker, row.file).toBe(OLDER[row.file].marker)
      const hasNote = /native[- ]speaker review|needs? native review/i.test(read(`../${row.file}`))
      expect(hasNote, row.file).toBe(row.marker)
    }
  })

  it('every itemised dictionary points at this list from its header', () => {
    for (const file of [...new Set(parse(doc).map((r) => r.file))]) {
      expect(read(`../${file}`), file).toContain('docs/i18n-native-review.md')
    }
  })
})
