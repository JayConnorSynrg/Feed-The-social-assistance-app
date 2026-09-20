// supabase/functions/delete-account/index.ts
// Permanently deletes a user account and all associated data.
// Resilient — skips tables that don't exist, logs each step.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function json(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin, 'delete-account')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401, corsHeaders)
  }

  try {
    // Verify the caller's JWT
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError?.message)
      return json({ error: 'Unauthorized' }, 401, corsHeaders)
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

    // Terminal removal of the user's post-image blobs (W1.2 INV-M5). Account
    // deletion is a terminal/hard removal, so the public blobs must go too — a
    // DB-row delete alone would orphan them in the public bucket. Every post
    // image lives under `post-images/<uid>/`, so listing that folder + removing
    // the objects deletes them all regardless of individual post rows.
    async function safeDeletePostImages(uid: string) {
      const PAGE = 1000
      const MAX_PAGES = 1000 // hard cap → guarantees termination (≤1M images)
      let deleted = 0
      try {
        // Paginate: a prolific user may have more than one page of images. Each
        // iteration deletes a page, so the next list from offset 0 returns the
        // remaining objects; stop when a page is short (folder exhausted) or the
        // cap is hit. The cap makes an infinite loop impossible if a delete were
        // ever a silent no-op.
        for (let page = 0; page < MAX_PAGES; page++) {
          const { data: objects, error: listErr } = await admin.storage
            .from('post-images')
            .list(uid, { limit: PAGE, offset: 0 })
          if (listErr) {
            log.push(`post-images: skipped (${listErr.message})`)
            return
          }
          if (!objects || objects.length === 0) break
          const paths = objects.map((o) => `${uid}/${o.name}`)
          const { error: rmErr } = await admin.storage.from('post-images').remove(paths)
          if (rmErr) {
            log.push(`post-images: skipped (${rmErr.message})`)
            return
          }
          deleted += paths.length
          if (objects.length < PAGE) break
        }
        log.push(deleted > 0 ? `post-images: deleted ${deleted}` : 'post-images: none')
      } catch (e) {
        log.push(`post-images: skipped (${e instanceof Error ? e.message : 'unknown'})`)
      }
    }
    await safeDeletePostImages(userId)

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
      return json({ error: `Failed to delete auth user: ${deleteUserError.message}` }, 500, corsHeaders)
    }

    console.log(`Account ${userId} fully deleted`)
    return json({ success: true, log }, 200, corsHeaders)

  } catch (err) {
    console.error('delete-account unexpected error:', err)
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500, corsHeaders)
  }
})
