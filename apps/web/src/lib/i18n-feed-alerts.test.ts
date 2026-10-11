// apps/web/src/lib/i18n-feed-alerts.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Release 3.1 invariant 6 (language) and 9 (first-party data):
//   - parity: the 14 locales, the same keys, nothing empty, the same {placeholders}, translated;
//   - ONE source of the alert type and severity names: no other file spells them out, and the admin
//     list (English) reads the same source;
//   - the member surfaces hold no English text of their own: every JSX text and every placeholder /
//     aria-label / title comes from the dictionary;
//   - the hazard menu writes no typed address to any log.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { messages, type Locale } from './i18n'
import {
  ALERT_SEVERITIES,
  alertFailureText,
  alertMessages,
  alertName,
  alertSeverityHint,
  alertSeverityLabel,
  alertTypeLabel,
  alertUpdatedText,
  alertsT,
  stripEventText,
  type AlertMessages,
} from './i18n-feed-alerts'
import { ALERT_TYPES } from './safety-alert-rpc'

const LOCALES = Object.keys(messages) as Locale[]
const EN_KEYS = Object.keys(alertMessages.en).sort()
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('alertMessages parity', () => {
  it('covers exactly the 14 locales, with at least 140 strings each', () => {
    expect(LOCALES).toHaveLength(14)
    expect(Object.keys(alertMessages).sort()).toEqual([...LOCALES].sort())
    expect(EN_KEYS.length).toBeGreaterThanOrEqual(140)
  })

  it.each(LOCALES)('%s: same keys, non-empty, same {placeholders}', (locale) => {
    const dict = alertMessages[locale] as unknown as Record<string, string>
    expect(Object.keys(dict).sort()).toEqual(EN_KEYS)
    for (const key of EN_KEYS as Array<keyof AlertMessages>) {
      expect(dict[key].trim(), `${locale}.${key}`).not.toBe('')
      expect(placeholders(dict[key]), `${locale}.${key}`).toEqual(placeholders(alertMessages.en[key]))
    }
  })

  it('every non-English locale is translated (not an English copy) for every sentence a member reads', () => {
    // Keys whose value may legitimately coincide with English in some language (a loanword, a
    // punctuation-only template) are left out; everything else must differ.
    const MAY_MATCH = new Set<keyof AlertMessages>(['typeAndSeverity', 'suggestDescription', 'suggestWebsite', 'optional', 'sevCritical', 'sevModerate'])
    for (const locale of LOCALES.filter((l) => l !== 'en')) {
      for (const key of (EN_KEYS as Array<keyof AlertMessages>).filter((k) => !MAY_MATCH.has(k))) {
        expect(alertsT(locale, key), `${locale}.${key}`).not.toBe(alertMessages.en[key])
      }
    }
  })

  it('sentences end as sentences in every locale (they are read out one after another)', () => {
    for (const locale of LOCALES) {
      for (const key of ['annNew', 'annRaised', 'annUpdated', 'annResolved', 'annEnded', 'savedNotice', 'withdrawnNotice', 'notLiveNotice'] as const) {
        expect(alertMessages[locale][key], `${locale}.${key}`).toMatch(/[.。።!?！？]$/)
      }
    }
  })
})

describe('the label readers', () => {
  it('every type and every severity has a name in every locale; unknown values degrade, never throw', () => {
    for (const locale of LOCALES) {
      for (const type of ALERT_TYPES) expect(alertTypeLabel(type, locale).trim(), `${locale}.${type}`).not.toBe('')
      for (const level of ALERT_SEVERITIES) {
        expect(alertSeverityLabel(level, locale).trim()).not.toBe('')
        expect(alertSeverityHint(level, locale)).toContain(alertSeverityLabel(level, locale))
      }
    }
    expect(alertTypeLabel('volcano', 'en')).toBe('Safety Alert')
    expect(alertSeverityLabel(9, 'en')).toBe('9')
    expect(alertName({ alert_type: 'road_closure', severity: 3 }, 'en')).toBe('Road Closure, High')
    expect(alertName({ alert_type: 'weather', severity: 4 }, 'zh')).toBe('天气危险，危急')
  })

  it('"Updated …" keeps the age inside the sentence (no capital in the middle)', () => {
    const now = Date.parse('2026-10-11T12:00:00.000Z')
    const fiveMinutesAgo = '2026-10-11T11:55:00.000Z'
    expect(alertUpdatedText(fiveMinutesAgo, 'en', now, 'UTC')).toBe('Updated 5 minutes ago')
    expect(alertUpdatedText(fiveMinutesAgo, 'es', now, 'UTC')).toBe('Actualizada hace 5 minutos')
    expect(alertUpdatedText(fiveMinutesAgo, 'fr', now, 'UTC')).toBe('Mise à jour il y a 5 minutes')
  })

  it('a refusal reads as a sentence of its kind; a live-region event names the type and the level', () => {
    expect(alertFailureText('en', { kind: 'guest' })).toBe(alertMessages.en.failGuest)
    expect(alertFailureText('es', { kind: 'forbidden', token: 'not_alert_owner' })).toBe(alertMessages.es.failNotOwner)
    expect(alertFailureText('en', { kind: 'not_live', resolved: true })).toBe(alertMessages.en.nowResolvedNotice)
    expect(alertFailureText('en', { kind: 'not_live', resolved: false })).toBe(alertMessages.en.notLiveNotice)
    expect(alertFailureText('en', { kind: 'unknown', code: 'XX000' })).toBe(alertMessages.en.failUnknown)
    expect(stripEventText('fr', { kind: 'raised', alert_type: 'weather', severity: 4 })).toBe('L’alerte de sécurité est passée au niveau Critique : Danger météo.')
  })
})

// ---- The tree ---------------------------------------------------------------------------------

const SRC = path.join(__dirname, '..')
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') continue
      sourceFiles(full, acc)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|smoke)\.tsx?$/.test(entry.name)) acc.push(full)
  }
  return acc
}
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8')

describe('one source of the alert type and severity names', () => {
  it('no other file spells out a type or a severity option', () => {
    const literals = ['Weather Hazard', 'Road Closure', 'Speeding Area', 'Low — heads-up', 'Critical — avoid area', 'Moderate — use caution']
    const offenders = sourceFiles(SRC)
      .map((file) => ({ rel: path.relative(SRC, file).split(path.sep).join('/'), text: readFileSync(file, 'utf8') }))
      .filter((f) => f.rel !== 'lib/i18n-feed-alerts.ts')
      .filter((f) => literals.some((l) => f.text.includes(l)))
      // Code only: a comment may quote a name as an example.
      .filter((f) => {
        const code = ts.createPrinter({ removeComments: true }).printFile(ts.createSourceFile(f.rel, f.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))
        return literals.some((l) => code.includes(l))
      })
      .map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('the strip, the marker and the admin list all read the dictionary', () => {
    for (const rel of ['components/feed/safety-strip.tsx', 'components/map/safety-alert-marker.tsx', 'app/(admin)/moderation/safety-alerts-review.tsx', 'components/alerts/alert-parts.tsx']) {
      const text = read(rel)
      expect(text, rel).toMatch(/alertTypeLabel\(/)
      expect(text, rel).toMatch(/alertSeverityLabel\(|alertName\(/)
      expect(text, rel).not.toMatch(/const \w*(ALERT|SEVERITY)_LABELS\b/)
    }
    // The admin list is English: it asks the same source for 'en'.
    expect(read('app/(admin)/moderation/safety-alerts-review.tsx')).toMatch(/alertTypeLabel\(alert\.alert_type, 'en'\)/)
  })
})

/** Every English-looking text a component file renders on its own: JSX text and the string literal
 *  of an attribute a person reads or hears. */
function ownText(rel: string): string[] {
  const file = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const READ_ALOUD = new Set(['placeholder', 'aria-label', 'title', 'alt', 'aria-description'])
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (/\p{L}{2,}/u.test(text)) found.push(text)
    }
    if (ts.isJsxAttribute(node) && READ_ALOUD.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (/\p{L}{2,}/u.test(node.initializer.text)) found.push(`${node.name.getText()}="${node.initializer.text}"`)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

describe('the member surfaces hold no text of their own', () => {
  it.each([
    'components/feed/safety-strip.tsx',
    'components/map/safety-alert-marker.tsx',
    'components/alerts/alert-editor-dialog.tsx',
    'components/alerts/alert-history-dialog.tsx',
    'components/alerts/alert-parts.tsx',
    'components/alerts/alert-dialogs.tsx',
    'components/map/staging-alert-pin.tsx',
  ])('%s', (rel) => {
    expect(ownText(rel)).toEqual([])
  })

  it('the hazard menu: only two format examples are literal (a phone number and a URL scheme)', () => {
    expect(ownText('components/map/hazard-bubble-menu.tsx')).toEqual(['placeholder="https://..."'])
    expect(read('components/map/hazard-bubble-menu.tsx')).toContain('placeholder="(802) 555-0100"')
  })

  it('control: the scan does find English JSX text and attributes (the English admin list has them)', () => {
    const admin = ownText('app/(admin)/moderation/safety-alerts-review.tsx')
    expect(admin).toEqual(expect.arrayContaining(['Safety Alerts Review', 'Remove alert']))
  })

  it('the popup and the hazard menu set their own lang and dir; the strip’s English island is gone', () => {
    expect(read('components/map/safety-alert-marker.tsx')).toMatch(/<div lang=\{locale\} dir=\{dir\(locale\)\}/)
    const menu = read('components/map/hazard-bubble-menu.tsx')
    expect(menu.match(/lang=\{locale\}/g)?.length).toBeGreaterThanOrEqual(3) // the button, the panel, the dialog
    expect(menu.match(/dir=\{dir\(locale\)\}/g)?.length).toBeGreaterThanOrEqual(2)
    const panel = read('components/panels/feed-panel.tsx')
    expect(panel).toMatch(/<div data-testid="feed-safety-region">\s*<SafetyStrip\b/)
    expect(panel).not.toMatch(/lang="en"[^>]*data-testid="feed-safety-region"/)
    expect(panel).not.toMatch(/getRelativeTime/)
  })
})

describe('first-party data: the hazard menu logs no typed address', () => {
  const menu = read('components/map/hazard-bubble-menu.tsx')
  const code = ts
    .createPrinter({ removeComments: true })
    .printFile(ts.createSourceFile('m.tsx', menu, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX))

  it('no logger call in the file receives the address, and the geocode log line is gone', () => {
    const logCalls = code.match(/\b(logger\.(debug|info|warn|error)|logEvent|console\.\w+)\([\s\S]*?\)/g) ?? []
    expect(logCalls.length).toBeGreaterThan(0) // control: the menu still logs its opening (a type, no text)
    expect(logCalls.filter((call) => /\baddress\b|description|stagingCoords|lng|lat/.test(call))).toEqual([])
    expect(code).not.toContain('hazard.geocode')
  })

  it('the address goes to the geocoder only when the member asks (Find or Enter), never while typing', () => {
    expect(code.match(/resolveGeoPointV6\(/g)).toHaveLength(1)
    expect(code).toMatch(/const handleGeocode = async \(\) => \{[\s\S]*?resolveGeoPointV6\(address, token\)/)
    // The input's onChange only stores the text.
    expect(code).toMatch(/onChange=\{\(e\) => \{ setAddress\(e\.target\.value\); setGeocodeSuccess\(false\); \}\}/)
  })
})
