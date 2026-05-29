/**
 * Global setup: create ONE shared test user for the entire smoke suite.
 * Stores credentials in a temp file that fixtures.ts reads.
 * global-teardown.ts deletes the user afterward.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ndtpovonpadugthmcntl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const CREDS_FILE = path.join(__dirname, '.smoke-test-user.json')

async function globalSetup() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const ts = Date.now()
  const email = `smoke-shared-${ts}@feed-test.invalid`
  const password = `SmokeShared_${ts}!`

  console.log(`[global-setup] Creating shared test user: ${email}`)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Global setup: failed to create test user: ${error?.message}`)
  }

  const userId = data.user.id

  // Wait 2s for the profile trigger to fire and commit the row
  // (trigger: 20260219000000_create_profile_trigger.sql — creates row with onboarding_completed DEFAULT FALSE)
  await new Promise((r) => setTimeout(r, 2000))

  // Mark onboarding complete so middleware lets user reach /
  // First try UPDATE (row exists from trigger), fallback to UPSERT
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (updateErr) {
    console.warn(`[global-setup] Profile UPDATE warning: ${updateErr.message} — trying upsert`)
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
    if (upsertErr) {
      console.warn(`[global-setup] Profile UPSERT warning: ${upsertErr.message}`)
    }
  }

  // Verify flag was set
  const { data: verify } = await admin
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userId)
    .single()
  console.log(`[global-setup] onboarding_completed = ${verify?.onboarding_completed}`)

  if (!verify?.onboarding_completed) {
    throw new Error(`Global setup: failed to set onboarding_completed=true for ${userId}. Cannot proceed.`)
  }

  // Write creds for specs to consume
  fs.writeFileSync(CREDS_FILE, JSON.stringify({ email, password, userId }), 'utf-8')
  console.log(`[global-setup] Shared test user ready: ${userId}`)
}

export default globalSetup
