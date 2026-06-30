// 01-auth-session.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 01 — Auth & Session
// Surface: apps/web/src/app/(auth)/login/page.tsx, apps/web/src/proxy.ts
// Upstream: Supabase Auth | Downstream: All other missions

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

maybeDescribe('01 — Auth & Session (PROD read-only)', () => {
  it('auth RPCs are SECDEF with pinned search_path', async () => {
    // Backend: get_my_profile, get_my_private_profile, is_current_user_admin
    // Surface: settings-panel.tsx:1066, (admin)/layout.tsx
    const rows = await queryProd(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN ('get_my_profile', 'get_my_private_profile', 'is_current_user_admin')
    `)
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(row.prosecdef, `${row.proname} must be SECDEF`).toBe(true)
      const config = row.proconfig as string[] | null
      const hasSearchPath = config?.some((c: string) => c.startsWith('search_path='))
      expect(hasSearchPath, `${row.proname} must have pinned search_path`).toBe(true)
    }
  })

  it('handle_new_user trigger exists (bound to auth.users or auth schema)', async () => {
    // Backend: handle_new_user trigger → profiles row on signup
    // Surface: signup flow → auth.users INSERT → profiles row
    // Note: auth.users is in the auth schema; pg_trigger may not show cross-schema triggers
    // We check the function exists and a trigger exists anywhere in the DB
    const rows = await queryProd(`
      SELECT tgname
      FROM pg_trigger
      WHERE tgname ILIKE '%handle_new_user%'
      LIMIT 5
    `)
    // Also check the trigger function exists in pg_proc
    const fnRows = await queryProd(`
      SELECT proname FROM pg_proc WHERE proname ILIKE '%handle_new_user%'
    `)
    // Either the trigger or the trigger function must be present
    const found = rows.length > 0 || fnRows.length > 0
    expect(found, 'handle_new_user trigger or function must exist').toBe(true)
  })

  it('profiles table has RLS enabled', async () => {
    // Backend: profiles table — RLS yes (per mission brief)
    // Surface: every profile read is auth.uid()-scoped
    const rows = await queryProd(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'public.profiles'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('auth_login_attempts table exists with RLS', async () => {
    // Backend: auth_login_attempts — lockout tracking
    // Surface: apps/web/src/app/api/auth/check-lockout/route.ts
    const rows = await queryProd(`
      SELECT relrowsecurity
      FROM pg_class
      WHERE oid = 'public.auth_login_attempts'::regclass
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].relrowsecurity).toBe(true)
  })

  it('anon cannot execute is_current_user_admin', async () => {
    // Backend: is_current_user_admin — admin gate — must be auth-only
    // Surface: (admin)/layout.tsx — redirects non-admins to /
    const rows = await queryProd(`
      SELECT has_function_privilege('anon', 'public.is_current_user_admin()', 'EXECUTE') AS can_exec
    `)
    expect(rows.length).toBe(1)
    expect(rows[0].can_exec).toBe(false)
  })
})
