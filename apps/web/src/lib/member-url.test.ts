// apps/web/src/lib/member-url.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// memberUrl is the single source of every member URL admin code uses (I3): each target kind maps to
// the member route that actually serves it, a business never routes to the organization page (which
// 404s for business rows), and no admin file builds a member path by hand.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { memberUrl } from './member-url'

const ID = '11111111-1111-4111-8111-111111111111'
const SRC = fileURLToPath(new URL('..', import.meta.url))

describe('memberUrl — each kind maps to its member route', () => {
  it('feed home is the community feed panel of the single-page shell', () => {
    expect(memberUrl({ kind: 'feed_home' })).toBe('/#feed')
  })
  it('post / organization / business / resource / profile', () => {
    expect(memberUrl({ kind: 'post', id: ID })).toBe(`/s/post/${ID}`)
    expect(memberUrl({ kind: 'organization', id: ID })).toBe(`/s/organization/${ID}`)
    expect(memberUrl({ kind: 'business', id: ID })).toBe(`/s/business/${ID}`)
    expect(memberUrl({ kind: 'resource', id: ID })).toBe(`/s/resource/${ID}`)
    expect(memberUrl({ kind: 'profile', username: 'riverside_ann' })).toBe('/profile/riverside_ann')
  })
  it('a business never routes to /s/organization', () => {
    expect(memberUrl({ kind: 'business', id: ID })).not.toContain('/s/organization/')
  })
  it('path segments are encoded (a username cannot inject a path or query)', () => {
    expect(memberUrl({ kind: 'profile', username: 'a/b?c' })).toBe('/profile/a%2Fb%3Fc')
  })
  it('every target route exists in the app', () => {
    for (const route of ['app/(social)/s/post/[id]/page.tsx', 'app/(social)/s/organization/[id]/page.tsx',
      'app/(social)/s/business/[id]/page.tsx', 'app/(social)/s/resource/[id]/page.tsx', 'app/profile/[username]/page.tsx']) {
      expect(fs.existsSync(path.join(SRC, route)), route).toBe(true)
    }
  })
})

// ---- I3: admin code builds no member URL by hand --------------------------------------------------
// A string/template literal that starts with a member path: '/s/…', '/profile/…', '/#…'.
const HAND_BUILT = /['"`]\/(s\/|profile\/|#)/

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return filesUnder(p)
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : []
  })
}

describe('I3 — admin files get member URLs only from memberUrl', () => {
  const adminFiles = [...filesUnder(path.join(SRC, 'app/(admin)')), ...filesUnder(path.join(SRC, 'components/admin'))]

  it('CONTROL: the scan covers the admin surfaces and the pattern catches a hand-built path', () => {
    expect(adminFiles.some((f) => f.endsWith('reports-queue.tsx'))).toBe(true)
    expect(adminFiles.some((f) => f.endsWith('member-view-link.tsx'))).toBe(true)
    expect(adminFiles.length).toBeGreaterThan(40)
    expect(HAND_BUILT.test("href={`/s/organization/${org.id}`}")).toBe(true)
    expect(HAND_BUILT.test("href='/#feed'")).toBe(true)
    expect(HAND_BUILT.test("href={orgAdminHref(org.id)}")).toBe(false)
  })

  it('no admin file contains a hand-built member path', () => {
    const offenders = adminFiles.filter((f) => HAND_BUILT.test(fs.readFileSync(f, 'utf8')))
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([])
  })
})
