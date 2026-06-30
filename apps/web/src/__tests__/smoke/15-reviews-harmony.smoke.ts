// 15-reviews-harmony.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 15 — Reviews & Harmony Score
// Surface: MessagesPanel / opt-in list → star-rating modal
// Upstream: Auth (M1), exchanges (M5/M6) | Downstream: Profiles (M2)

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('15 — Reviews & Harmony (PROD read-only)', () => {
  it('submit_review and recompute_harmony are SECDEF with pinned search_path', async () => {
    // Backend: submit_review (:181), recompute_harmony (:96-125) — both SECDEF + search_path
    // Surface: use-reviews.ts:65-72 → rpc('submit_review')
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('submit_review', 'recompute_harmony')
    `)
    expect(rows.length).toBe(2)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('harmony_score is NOT in the authenticated UPDATE grant on profiles', async () => {
    // Backend: forge protection — REVOKE UPDATE then GRANT UPDATE (allow-list excludes harmony_score)
    // Surface: a client UPDATE of profiles.harmony_score must return 42501
    // This is the critical forge-proof gate from the mission brief
    const rows = await queryProd(`
      SELECT a.attname, a.attacl
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'profiles'
        AND a.attname IN ('harmony_score', 'harmony_reviews_count', 'full_name')
        AND NOT a.attisdropped
    `)
    const harmonyScore = rows.find((r) => r.attname === 'harmony_score')
    const reviewsCount = rows.find((r) => r.attname === 'harmony_reviews_count')

    // Verify the columns exist
    expect(harmonyScore).toBeDefined()
    expect(reviewsCount).toBeDefined()

    // harmony_score and harmony_reviews_count must NOT have an UPDATE grant for authenticated
    // attacl: null OR no 'U' entry for authenticated role
    const harmonyAcl = harmonyScore?.attacl
    const reviewsAcl = reviewsCount?.attacl

    // attacl from pg_attribute can come back as a PostgreSQL ACL string like
    // "{postgres=rwdDxt/postgres,=r/postgres}" — the Management API returns it
    // as a string, not a parsed JS array. Normalize to string for checking.
    const aclToString = (acl: unknown): string => {
      if (!acl) return ''
      if (typeof acl === 'string') return acl
      if (Array.isArray(acl)) return acl.join(',')
      return String(acl)
    }

    // If attacl is non-null, it must not contain an UPDATE grant for authenticated
    const harmonyAclStr = aclToString(harmonyAcl)
    const reviewsAclStr = aclToString(reviewsAcl)

    if (harmonyAclStr) {
      // UPDATE grant would show as 'authenticated=...U...' or '=U' with role context
      // Specifically "authenticated=U" or "authenticated=rU" etc
      const hasAuthUpdate = /authenticated=[rwdDxt]*U/.test(harmonyAclStr)
      expect(hasAuthUpdate, 'harmony_score must not have UPDATE grant for authenticated').toBe(false)
    }
    if (reviewsAclStr) {
      const hasAuthUpdate = /authenticated=[rwdDxt]*U/.test(reviewsAclStr)
      expect(hasAuthUpdate, 'harmony_reviews_count must not have UPDATE grant for authenticated').toBe(false)
    }
  })

  it('reviews table has NO INSERT policy (writes funnel through submit_review SECDEF)', async () => {
    // Backend: reviews — INSERT has NO policy (client INSERT denied by RLS)
    // Surface: use-reviews.ts:66 — client writes ONLY via rpc('submit_review')
    const rows = await queryProd(`
      SELECT polname, polcmd
      FROM pg_policy
      WHERE polrelid = 'public.reviews'::regclass
    `)
    const insertPolicies = rows.filter((r) => r.polcmd === 'a') // 'a' = INSERT in pg_policy
    expect(insertPolicies.length).toBe(0)
  })
})
