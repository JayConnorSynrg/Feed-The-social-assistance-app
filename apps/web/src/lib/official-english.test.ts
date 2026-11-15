// apps/web/src/lib/official-english.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ledger of text marked English because it mirrors an official English form (lib/official-
// english.ts; owner decision pending on showing translations beside it). P6 W9:
//   - exactly the Applications hub and the form wizard use the mark, each the counted number of
//     times — a new use, or a use left behind, fails until this table says so;
//   - those two files hold no other English mark (FEED's own words there are translated);
//   - the official text itself is unchanged: the SNAP and Medicaid templates still render the
//     counted strings (the number the owner's decision is about).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allTemplates } from './form-templates'
import { OFFICIAL_ENGLISH } from './official-english'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(relative(SRC, path))
  }
}
walk(SRC)
const code = (file: string) =>
  readFileSync(join(SRC, file), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const uses = (file: string) => (code(file).match(/\bOFFICIAL_ENGLISH\b/g) ?? []).length - (/import \{ OFFICIAL_ENGLISH \}/.test(code(file)) ? 1 : 0)

// Each file that marks official text, and how many times.
const LEDGER: Record<string, number> = {
  'components/panels/forms-panel.tsx': 10,
  'components/forms/form-wizard.tsx': 21,
}

describe('official English text', () => {
  it('is marked English and left to right', () => {
    expect(OFFICIAL_ENGLISH).toEqual({ lang: 'en', dir: 'ltr' })
  })

  it('only the listed files use the mark, each exactly its count', () => {
    const using = files.filter((f) => f !== 'lib/official-english.ts' && uses(f) > 0).sort()
    expect(using).toEqual(Object.keys(LEDGER).sort())
    for (const [file, n] of Object.entries(LEDGER)) expect([file, uses(file)]).toEqual([file, n])
  })

  it('those files hold no fixed English mark of their own', () => {
    for (const file of Object.keys(LEDGER)) expect([file, code(file).match(/\blang=(?:"en"|'en'|\{'en'\}|\{"en"\})/g) ?? []]).toEqual([file, []])
  })

  it('the templates still carry their official strings (the owner decision covers these)', () => {
    const strings = allTemplates.flatMap((t) => [
      t.name,
      t.description ?? '',
      ...t.sections.flatMap((s) => [s.title, s.description ?? '']),
      ...t.fields.flatMap((f) => [f.label, f.helpText ?? '', f.placeholder ?? '', ...(f.options ?? []).map((o) => o.label)]),
      ...(t.metadata?.requiredDocuments ?? []),
    ]).filter(Boolean)
    expect(allTemplates.map((t) => t.id)).toEqual(['snap-application-v1', 'medicaid-application-v1'])
    expect(strings).toHaveLength(282)
    expect(new Set(strings).size).toBe(228)
  })
})
