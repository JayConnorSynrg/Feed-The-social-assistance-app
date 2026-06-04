/**
 * rls-is-admin-no-42501.spec.ts — RLS regression guard
 *
 * GUARDS AGAINST: migration 20260603130000_pii_hardening_revoke.sql revoked SELECT on
 * public.profiles from the `authenticated` role. 18 admin-gated RLS policies across 12
 * tables inline-read is_admin via
 *   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
 * which requires SELECT on profiles. After the revoke, that fragment raises
 * `42501 permission denied for table profiles` for EVERY authenticated user, breaking
 * Applications, Programs, Forms + 9 admin surfaces. Fix migration
 * 20260603160000_rls_is_admin_use_function.sql swaps the fragment to
 * (select public.is_current_user_admin()) (SECURITY DEFINER), which reads is_admin
 * WITHOUT the caller holding SELECT on profiles.
 *
 * WHY FUNCTIONAL (not a source-grep): a 42501 is a RUNTIME permission failure invisible
 * to static analysis — only an authenticated query against the live policy chain proves
 * the regression is closed. The real-DB harness (admin create + anon sign-in) already
 * exists in auth.spec.ts, so the cost is one short spec.
 *
 * This spec is pure-API (no browser / dev server). A confirmed NON-admin user is created
 * via the service-role admin client (handle_new_user inserts a profiles row with the
 * default is_admin=false), then an anon client signs in to obtain a real authenticated
 * JWT and reads the two surfaces most directly broken by the revoke.
 */

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN_TS = Date.now()
const EMAIL = `e2e+rls-nonadmin-${RUN_TS}@feed.local`
const PASSWORD = 'E2eRlsPass!2026#$'

function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function makeAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function deleteUserByEmail(admin: SupabaseClient, email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return
  const user = data.users.find((u) => u.email === email)
  if (user) await admin.auth.admin.deleteUser(user.id)
}

test.describe('RLS: inline is_admin EXISTS no longer 42501s for authenticated non-admins', () => {
  let admin: SupabaseClient

  test.beforeAll(async () => {
    admin = makeAdmin()
    await deleteUserByEmail(admin, EMAIL)
    const { error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`createUser failed: ${error.message}`)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(admin, EMAIL)
  })

  test('non-admin authenticated select on resources + form_submissions returns no 42501', async () => {
    const anon = makeAnon()
    const { error: signInError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
    expect(signInError, 'non-admin sign-in should succeed').toBeNull()

    // resources: the "Admins can manage all resources" FOR ALL policy inline-reads
    // is_admin; a broken policy 42501s on every authenticated read of this table.
    const resources = await anon.from('resources').select('id').eq('status', 'approved').limit(1)
    expect(resources.error?.code, `resources select 42501: ${resources.error?.message ?? ''}`).not.toBe('42501')

    // form_submissions: form_submissions_admin_select/_update inline-read is_admin;
    // a broken policy 42501s on every authenticated read of own rows too.
    const submissions = await anon.from('form_submissions').select('id').limit(1)
    expect(submissions.error?.code, `form_submissions select 42501: ${submissions.error?.message ?? ''}`).not.toBe('42501')
  })
})
