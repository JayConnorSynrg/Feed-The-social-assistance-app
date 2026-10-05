// apps/web/src/lib/map-marker-colors.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Keeps the marker hex constants and the globals.css @theme tokens in parity. The control case proves
// the check goes RED when either side changes.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ORG_MARKER_HEX, BUSINESS_MARKER_HEX } from './map-marker-colors'

const CSS = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

function token(css: string, name: string): string | null {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  return m ? m[1].toLowerCase() : null
}

function parityMismatches(css: string, constants: Record<string, string>): string[] {
  return Object.entries(constants)
    .filter(([name, hex]) => token(css, name) !== hex.toLowerCase())
    .map(([name]) => name)
}

const MARKERS = { org: ORG_MARKER_HEX, business: BUSINESS_MARKER_HEX }

describe('marker color parity', () => {
  it('globals.css tokens equal the TS marker constants', () => {
    expect(token(CSS, 'org')).toBe(ORG_MARKER_HEX)
    expect(token(CSS, 'business')).toBe(BUSINESS_MARKER_HEX)
    expect(parityMismatches(CSS, MARKERS)).toEqual([])
  })

  it('declares the brand + cream tokens', () => {
    expect(token(CSS, 'brand')).toBe('#4a5d23')
    expect(token(CSS, 'brand-hover')).toBe('#3d4d1c')
    expect(token(CSS, 'cream')).toBe('#faf9f6')
  })

  it('control: a changed CSS value or a changed constant is detected', () => {
    const edited = CSS.replace('--color-org: #6b2d5c', '--color-org: #000000')
    expect(edited).not.toBe(CSS)
    expect(parityMismatches(edited, MARKERS)).toEqual(['org'])
    expect(parityMismatches(CSS, { ...MARKERS, business: '#134e4b' })).toEqual(['business'])
  })
})
