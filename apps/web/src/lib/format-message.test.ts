// apps/web/src/lib/format-message.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One formatMessage for every surface:
//   - it fills {name} placeholders exactly as both former copies did (event forms, org forms);
//   - the source tree holds one definition, and only the listed files still read it through a
//     dictionary's re-export;
//   - splitMessage and isolate, the two helpers a component uses around member-written text.

import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('./logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { formatMessage, isolate, splitMessage } from './format-message'
import * as eventForms from './i18n-event-forms'
import * as orgForms from './i18n-org-forms'

describe('formatMessage', () => {
  it('fills each placeholder, as often as it appears, with strings and numbers', () => {
    expect(formatMessage('{a} and {b}, then {a}', { a: 'x', b: 2 })).toBe('x and 2, then x')
    expect(formatMessage('no placeholders', { a: 'x' })).toBe('no placeholders')
    expect(formatMessage('{n}', { n: 0 })).toBe('0')
  })

  it('leaves a placeholder it has no value for, and reads own keys only', () => {
    expect(formatMessage('{known} {unknown}', { known: 'k' })).toBe('k {unknown}')
    expect(formatMessage('{toString} {constructor}', {})).toBe('{toString} {constructor}')
  })

  it('inserts a value as written (no replacement patterns, no second pass)', () => {
    expect(formatMessage('{title}', { title: '$& $1 {title}' })).toBe('$& $1 {title}')
  })

  it('the event-forms call site formats as before', () => {
    expect(formatMessage(eventForms.eventFormMessages.en.datesAdded, { count: 3 })).toBe('Dates added: 3.')
    expect(formatMessage(eventForms.eventFormMessages.es.zoneFixed, { zone: 'America/New_York' })).toContain('America/New_York')
  })

  it('the org-forms call site formats as before', () => {
    expect(formatMessage(orgForms.orgFormMessages.en.dirShowing, { shown: 50, total: 141 })).toBe('Showing 50 of 141')
    expect(formatMessage(orgForms.orgFormMessages.hmn.orgDeactivated, { name: 'Food Shelf' })).toBe('Food Shelf raug kaw lawm.')
  })

  it('both dictionaries hand out this same function', () => {
    expect(eventForms.formatMessage).toBe(formatMessage)
    expect(orgForms.formatMessage).toBe(formatMessage)
  })
})

describe('one definition in the source tree', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name)) files.push(path)
    }
  }
  walk(SRC)
  const read = (path: string) => readFileSync(path, 'utf8')
  const rel = (path: string) => relative(SRC, path)

  it('formatMessage is defined once, in lib/format-message.ts', () => {
    const definers = files.filter((f) => /\b(function\s+formatMessage\b|(const|let|var)\s+formatMessage\s*=)/.test(read(f))).map(rel)
    expect(definers).toEqual(['lib/format-message.ts'])
  })

  // The files this change was told to leave alone. Remove a row when its import is repointed; drop
  // the two re-exports when the list is empty.
  const STILL_THROUGH_A_DICTIONARY = [
    'app/(admin)/moderation/admin-shell.tsx',
    'app/(admin)/moderation/event-scheduler.tsx',
    'app/(admin)/moderation/extend-series-button.tsx',
    'app/(admin)/moderation/org/[id]/org-admin-shell.tsx',
    'app/(admin)/moderation/org/org-overview.tsx',
    'app/(admin)/moderation/orgs-section.tsx',
    'components/feed/post-model.ts',
    'components/panels/feed-panel.tsx',
  ]

  it('every other file imports it from lib/format-message', () => {
    const viaDictionary = files
      .filter((f) => /import\s*(type\s*)?\{[^}]*\bformatMessage\b[^}]*\}\s*from\s*['"][^'"]*i18n-(event|org)-forms['"]/.test(read(f)))
      .map(rel)
      .sort()
    expect(viaDictionary).toEqual([...STILL_THROUGH_A_DICTIONARY].sort())
  })
})

describe('splitMessage and isolate', () => {
  it('cuts a value around one placeholder', () => {
    expect(splitMessage('Signing as {name}', 'name')).toEqual(['Signing as ', ''])
    expect(splitMessage('{count} of {target} signatures', 'count')).toEqual(['', ' of {target} signatures'])
    expect(splitMessage('en attente de {name} …', 'name')).toEqual(['en attente de ', ' …'])
    expect(splitMessage('no gap', 'name')).toEqual(['no gap', ''])
  })

  it('isolates member-written text for a plain-text channel', () => {
    expect(isolate('أنقذوا الحديقة')).toBe('\u2068أنقذوا الحديقة\u2069')
  })

  it('removes directional controls already in the text, so the isolate cannot be closed or overridden from inside', () => {
    // A title that tries to end the isolate early and flip what follows it.
    expect(isolate('Save\u2069\u202e the park')).toBe('\u2068Save the park\u2069')
    for (const control of ['\u2066', '\u2067', '\u2068', '\u2069', '\u202a', '\u202b', '\u202c', '\u202d', '\u202e']) {
      expect(isolate(`a${control}b`), `U+${control.charCodeAt(0).toString(16)}`).toBe('\u2068ab\u2069')
    }
    // Marks that carry meaning stay: LRM / RLM, and the zero-width joiner of Arabic and emoji.
    expect(isolate('a\u200eb\u200fc\u200dd')).toBe('\u2068a\u200eb\u200fc\u200dd\u2069')
    expect([...isolate('x\u2069y')].filter((c) => c === '\u2068' || c === '\u2069')).toHaveLength(2)
  })
})
