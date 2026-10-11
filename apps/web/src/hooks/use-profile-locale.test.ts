// apps/web/src/hooks/use-profile-locale.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One place resolves the viewer's locale from the profile: the rule itself, and a source guard
// that the inline copy lives nowhere else.

import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ profile: null }) }))

import { profileLocale } from './use-profile-locale'

describe('profileLocale', () => {
  it("is 'en' until the profile has loaded", () => {
    expect(profileLocale(null)).toBe('en')
    expect(profileLocale(undefined)).toBe('en')
  })

  it('is the profile language when FEED supports it', () => {
    expect(profileLocale({ preferred_language: 'vi' })).toBe('vi')
    expect(profileLocale({ preferred_language: 'hmn' })).toBe('hmn')
  })

  it('falls back to storage, browser, then English for an unsupported or missing language', () => {
    expect(profileLocale({ preferred_language: 'other' })).toBe('en')
    expect(profileLocale({ preferred_language: null })).toBe('en')
    expect(profileLocale({})).toBe('en')
  })
})

describe('the rule is written once', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path)
    }
  }
  walk(SRC)

  // The two moderation shells keep their inline copy until their owner swaps it (two lines each:
  // the resolver line and its import). Remove a row when a shell is routed through the hook.
  const INLINE_COPIES_LEFT = ['app/(admin)/moderation/admin-shell.tsx', 'app/(admin)/moderation/org/[id]/org-admin-shell.tsx']

  it('only the hook reads preferred_language off the profile to pick a locale', () => {
    const inline = files
      .filter((f) => /resolveUserLocale\(\s*\(profile as/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))
      .sort()
    expect(inline).toEqual(['hooks/use-profile-locale.ts', ...INLINE_COPIES_LEFT].sort())
  })
})
