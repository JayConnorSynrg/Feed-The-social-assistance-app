// apps/web/src/app/globals.tokens.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// PR #259 (P6 W9 fix round, B7): the light theme's primary and destructive tokens carry readable
// text — every Button default / destructive, Badge, Checkbox, Switch and chat bubble draws its
// words in --*-foreground on these. WCAG 1.4.3: at least 4.5:1, at rest and at the hover tint the
// shared Button and Badge use (/90 over white).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8')
const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')))
const token = (name: string) => {
  const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`))
  if (!m) throw new Error(`--${name} missing`)
  return [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100] as const
}
function rgb([h, s, l]: readonly [number, number, number]): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const over = (c: number[], alpha: number) => c.map((v) => v * alpha + 255 * (1 - alpha))

describe('theme tokens', () => {
  it.each([['primary'], ['destructive']])('--%s with its foreground: ≥ 4.5:1 at rest and at the /90 hover', (name) => {
    const bg = rgb(token(name))
    const fg = rgb(token(`${name}-foreground`))
    expect(ratio(bg, fg)).toBeGreaterThanOrEqual(4.5)
    expect(ratio(over(bg, 0.9), fg)).toBeGreaterThanOrEqual(4.5)
  })

  it('primary is the brand green #4a5d23', () => {
    expect(rgb(token('primary')).map(Math.round)).toEqual([74, 93, 35])
  })

  it('Button and Badge hover at /90 (never a lighter tint that drops below 4.5:1)', () => {
    for (const file of ['../components/ui/button.tsx', '../components/ui/badge.tsx']) {
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      expect(src, file).not.toMatch(/hover:bg-(primary|destructive)\/[0-8]0\b/)
    }
  })
})

describe('focus ring', () => {
  it('--ring is the primary green and stays ≥ 3:1 on white and on cream (#faf9f6)', () => {
    expect(token('ring')).toEqual(token('primary'))
    const ring = rgb(token('ring'))
    expect(ratio(ring, [255, 255, 255])).toBeGreaterThanOrEqual(3)
    expect(ratio(ring, [0xfa, 0xf9, 0xf6])).toBeGreaterThanOrEqual(3)
  })

  it('packages/ui/tokens/colors.ts carries the same light values', () => {
    const src = readFileSync(fileURLToPath(new URL('../../../../packages/ui/tokens/colors.ts', import.meta.url)), 'utf8')
    for (const name of ['primary', 'primary-foreground', 'destructive', 'destructive-foreground', 'ring']) {
      const [h, s, l] = token(name)
      expect(src, name).toContain(`'--${name}': '${h} ${+(s * 100).toFixed(1)}% ${+(l * 100).toFixed(1)}%'`)
    }
  })
})

