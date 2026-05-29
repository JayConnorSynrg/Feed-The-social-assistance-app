// supabase/functions/delete-account/index.ts
// Permanently deletes a user account and all associated data.
// Resilient — skips tables that don't exist, logs each step.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  try {
    // Verify the caller's JWT
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401)
    }

    const userId = user.id
    console.log(`Deleting account for user: ${userId}`)

    // Admin client for privileged operations
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const log: string[] = []

    // Helper: delete from table, skip if table doesn't exist
    async function safeDelete(table: string, column: string, value: string) {
      try {
        const { error } = await admin.from(table).delete().eq(column, value)
        if (error) {
          log.push(`${table}: skipped (${error.message})`)
        } else {
          log.push(`${table}: deleted`)
        }
      } catch (e) {
        log.push(`${table}: skipped (${e instanceof Error ? e.message : 'unknown'})`)
      }
    }

    // Helper: nullify column in table
    async function safeNullify(table: string, column: string, value: string) {
      try {
        const { error } = await admin.from(table).update({ [column]: null }).eq(column, value)
        if (error) {
          log.push(`${table}.${column}: skipped (${error.message})`)
        } else {
          log.push(`${table}.${column}: nullified`)
        }
      } catch (e) {
        log.push(`${table}.${column}: skipped (${e instanceof Error ? e.message : 'unknown'})`)
      }
    }

    // Delete in dependency order — skip missing tables
    await safeDelete('post_likes', 'user_id', userId)
    await safeDelete('post_comments', 'user_id', userId)
    await safeDelete('follows', 'follower_id', userId)
    await safeDelete('follows', 'following_id', userId)
    await safeDelete('resource_bookmarks', 'user_id', userId)
    await safeDelete('posts', 'user_id', userId)
    await safeDelete('form_signatures', 'user_id', userId)
    await safeDelete('form_submissions', 'user_id', userId)
    await safeNullify('resources', 'submitted_by', userId)
    await safeNullify('resources', 'moderated_by', userId)
    await safeNullify('federation_trust_events', 'created_by', userId)
    await safeDelete('user_documents', 'user_id', userId)
    await safeDelete('user_secure_profiles', 'id', userId)
    await safeDelete('mfa_backup_codes', 'user_id', userId)
    await safeDelete('profiles', 'id', userId)

    console.log('Data deletion log:', log.join(', '))

    // Finally delete the auth user
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      console.error('auth.admin.deleteUser failed:', deleteUserError.message)
      return json({ error: `Failed to delete auth user: ${deleteUserError.message}` }, 500)
    }

    console.log(`Account ${userId} fully deleted`)
    return json({ success: true, log })

  } catch (err) {
    console.error('delete-account unexpected error:', err)
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
})
