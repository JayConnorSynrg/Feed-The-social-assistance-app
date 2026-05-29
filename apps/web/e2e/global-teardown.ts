/**
 * Global teardown: delete the shared test user created in global-setup.ts.
 * Also cleans up any residual smoke-test users by email pattern.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ndtpovonpadugthmcntl.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const CREDS_FILE = path.join(__dirname, '.smoke-test-user.json')

async function globalTeardown() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Delete the shared user
  if (fs.existsSync(CREDS_FILE)) {
    const { userId, email } = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'))
    console.log(`[global-teardown] Deleting shared test user: ${email} (${userId})`)
    await admin.from('profiles').delete().eq('id', userId)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.warn(`[global-teardown] Delete warning: ${error.message}`)
    fs.unlinkSync(CREDS_FILE)
    console.log(`[global-teardown] Cleanup complete`)
  }
}

export default globalTeardown
