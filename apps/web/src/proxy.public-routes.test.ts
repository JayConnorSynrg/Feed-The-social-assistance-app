// apps/web/src/proxy.public-routes.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// INV-I break-on-purpose: proxy.ts publicRoutes MUST list '/s/organization', so a logged-out GET of
// /s/organization/<id> reaches the SSR page (200/404) instead of a 307 login redirect. proxy.ts pulls
// in next/server + the whole request pipeline and keeps publicRoutes as a function-local const, so we
// assert against the source text — the single, load-bearing fact. Deleting the '/s/organization' entry
// (which would auth-gate the public page) turns this RED.
//
// The matcher mirrors proxy.ts's own predicate (route === pathname || pathname.startsWith(route + '/')),
// so the entry proven here is exactly what admits '/s/organization/<id>'.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const proxySource = readFileSync(fileURLToPath(new URL('./proxy.ts', import.meta.url)), 'utf8')

/** Extract the publicRoutes array literal from proxy.ts source (the region between its brackets). */
function publicRoutesLiteral(src: string): string {
  const start = src.indexOf('const publicRoutes = [')
  expect(start).toBeGreaterThan(-1)
  const close = src.indexOf(']', start)
  expect(close).toBeGreaterThan(start)
  return src.slice(start, close + 1)
}

describe('INV-I — /s/organization is a public (non-auth-gated) route', () => {
  it("publicRoutes contains '/s/organization' alongside the other /s share routes", () => {
    const literal = publicRoutesLiteral(proxySource)
    expect(literal).toContain("'/s/organization'")
    // It must sit with the other public share routes, mirroring the '/s/business' entry it forks.
    expect(literal).toContain("'/s/business'")
    expect(literal).toContain("'/s/resource'")
  })

  it("the proxy prefix predicate admits '/s/organization/<id>' from that entry", () => {
    // Re-implement proxy.ts's exact predicate to prove the listed entry admits the id route.
    const route = '/s/organization'
    const isPublic = (pathname: string) =>
      pathname === route || pathname.startsWith(route + '/')
    expect(isPublic('/s/organization/abc-123')).toBe(true)
    // And that it does NOT over-match a different top-level route.
    expect(isPublic('/settings/organization')).toBe(false)
  })
})
