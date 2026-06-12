/**
 * onboarding-name-split.spec.ts — Audit hole #9 EXPAND: signup name split.
 *
 * GUARDS:
 *  1. A real signUp() carrying first_name/last_name/full_name metadata produces
 *     a profiles row where the handle_new_user trigger populated first_name and
 *     last_name (the new privacy columns).
 *  2. The onboarding-style profile UPDATE completes with NO 42501 (the upsert
 *     grant-trinity regression class — PR#68) under the new schema.
 *  3. get_my_profile() (the own-row SECDEF accessor that auth-provider now uses)
 *     returns first_name/last_name/full_name/city/state for the caller.
 *
 * Pure-API (no browser): mirrors rls-is-admin-no-42501.spec.ts harness.
 */

import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const RUN_TS = Date.now()
const EMAIL = `e2e+namesplit-${RUN_TS}@feed.local`
const PASSWORD = 'E2eNameSplit!2026#$'
const FIRST = 'Anastasia'
const LAST = 'Vandermolen'

function makeAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
function makeAnon(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
async function deleteUserByEmail(admin: SupabaseClient, email: string) {
  const { data } = await admin.auth.admin.listUsers()
  const u = data?.users?.find((x) => x.email === email)
  if (u) await admin.auth.admin.deleteUser(u.id)
}

test.describe('signup name split → first_name/last_name populated, no 42501', () => {
  let admin: SupabaseClient
  let userId: string | undefined

  test.beforeAll(async () => {
    admin = makeAdmin()
    await deleteUserByEmail(admin, EMAIL)
  })

  test.afterAll(async () => {
    await deleteUserByEmail(admin, EMAIL)
  })

  test('signUp metadata first/last → trigger populates profile name parts', async () => {
    const anon = makeAnon()
    // Mirror signup/page.tsx: pass first_name + last_name + composed full_name.
    const { data, error } = await anon.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
      options: {
        data: {
          first_name: FIRST,
          last_name: LAST,
          full_name: `${FIRST} ${LAST}`,
        },
      },
    })
    expect(error, `signUp error: ${error?.message ?? ''}`).toBeNull()
    userId = data.user?.id
    expect(userId).toBeTruthy()

    // The handle_new_user trigger should have written first_name/last_name/full_name.
    const { data: row, error: readErr } = await admin
      .from('profiles')
      .select('first_name, last_name, full_name')
      .eq('id', userId!)
      .single()
    expect(readErr, `profile read error: ${readErr?.message ?? ''}`).toBeNull()
    expect(row?.first_name).toBe(FIRST)
    expect(row?.last_name).toBe(LAST)
    expect(row?.full_name).toBe(`${FIRST} ${LAST}`)
  })

  test('onboarding-style profile UPDATE completes with NO 42501', async () => {
    const anon = makeAnon()
    const { error: signInError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
    expect(signInError, `sign-in: ${signInError?.message ?? ''}`).toBeNull()

    // The onboarding flow writes phone/city/state/onboarding_completed via .update().
    const { error: updErr } = await anon
      .from('profiles')
      .update({
        phone: '5550001234',
        location_city: 'Burlington',
        location_state: 'Vermont',
        onboarding_completed: true,
      })
      .eq('id', userId!)
    expect(updErr?.code, `onboarding update 42501: ${updErr?.message ?? ''}`).not.toBe('42501')
    expect(updErr, `onboarding update error: ${updErr?.message ?? ''}`).toBeNull()
  })

  test('get_my_profile() returns own name parts + city/state for the caller', async () => {
    const anon = makeAnon()
    const { error: signInError } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
    expect(signInError).toBeNull()

    const { data, error } = await anon.rpc('get_my_profile')
    expect(error, `get_my_profile error: ${error?.message ?? ''}`).toBeNull()
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.first_name).toBe(FIRST)
    expect(row?.last_name).toBe(LAST)
    expect(row?.full_name).toBe(`${FIRST} ${LAST}`)
    expect(row?.location_city).toBe('Burlington')
    expect(row?.location_state).toBe('Vermont')
  })
})
