#!/usr/bin/env npx tsx
/**
 * sync-government-forms.ts
 *
 * Pre-syncs allowlisted government PDFs into the 'government-forms' Supabase
 * Storage bucket so the FEED client can download them without hitting
 * government servers (which block CORS + some block datacenter IPs).
 *
 * Usage:
 *   npx tsx apps/web/scripts/sync-government-forms.ts [--dry-run]
 *
 * Environment (read from apps/web/.env.local — never printed):
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS for storage writes)
 *
 * Exit codes:
 *   0 — at least one form uploaded (partial success counts)
 *   1 — zero forms uploaded (total failure)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GOVERNMENT_FORMS, type GovernmentForm } from '../src/lib/government-forms'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Load .env.local without requiring dotenv as a runtime dep
// ---------------------------------------------------------------------------
function loadEnv(): void {
  // .env.local is gitignored and only exists in the main checkout, not worktrees.
  // Check the direct path first, then walk up to find the main checkout.
  const candidates = [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '..', '..', '..', 'apps', 'web', '.env.local'),
    '/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local',
  ]
  const envPath = candidates.find(fs.existsSync)
  if (!envPath) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[sync-gov-forms] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('  Source: apps/web/.env.local')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SyncStatus = 'OK' | 'SKIP' | 'FAIL'

interface SyncResult {
  form: GovernmentForm
  status: SyncStatus
  reason?: string
  bytes?: number
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const BUCKET = 'government-forms'

// ---------------------------------------------------------------------------
// Ensure bucket exists (storage API — not DDL — safe to call at runtime)
// ---------------------------------------------------------------------------
async function ensureBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
  if (listErr) {
    console.warn(`[sync-gov-forms] WARN: could not list buckets: ${listErr.message}`)
    return
  }
  const exists = buckets?.some((b) => b.id === BUCKET)
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: false })
    if (createErr && !createErr.message.includes('already exists')) {
      console.warn(`[sync-gov-forms] WARN: createBucket failed: ${createErr.message}`)
    } else {
      console.log(`[sync-gov-forms] Created storage bucket '${BUCKET}'`)
    }
  }
}

// ---------------------------------------------------------------------------
// Fetch a PDF and validate it starts with the %PDF magic bytes
// ---------------------------------------------------------------------------
async function fetchPdf(url: string): Promise<Buffer | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/pdf,*/*',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return null
    }

    const ct = res.headers.get('content-type') ?? ''
    // Accept application/pdf or octet-stream (some agencies use the latter)
    if (!ct.includes('pdf') && !ct.includes('octet-stream')) {
      return null
    }

    const buf = Buffer.from(await res.arrayBuffer())
    // Validate %PDF magic bytes
    if (buf.slice(0, 4).toString('ascii') !== '%PDF') {
      return null
    }
    return buf
  } catch {
    clearTimeout(timeout)
    return null
  }
}

// ---------------------------------------------------------------------------
// Sync a single form entry
// ---------------------------------------------------------------------------
async function syncForm(
  supabase: SupabaseClient,
  form: GovernmentForm
): Promise<SyncResult> {
  console.log(`  → ${form.formNumber} (${form.storagePath})`)

  if (DRY_RUN) {
    return { form, status: 'SKIP', reason: 'dry-run' }
  }

  // Fetch the PDF
  const buf = await fetchPdf(form.sourceUrl)
  if (!buf) {
    return {
      form,
      status: 'FAIL',
      reason: `fetch failed or non-PDF content-type from ${form.sourceUrl}`,
    }
  }

  // Upload to bucket (upsert — idempotent)
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(form.storagePath, buf, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (upErr) {
    return { form, status: 'FAIL', reason: `upload error: ${upErr.message}` }
  }

  return { form, status: 'OK', bytes: buf.length }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`\n[sync-gov-forms] Starting${DRY_RUN ? ' (DRY RUN)' : ''} — ${GOVERNMENT_FORMS.length} forms\n`)

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

  await ensureBucket(supabase)

  const results: SyncResult[] = []
  for (const form of GOVERNMENT_FORMS) {
    const result = await syncForm(supabase, form)
    results.push(result)
  }

  // Summary table
  const pad = (s: string, n: number) => s.padEnd(n)
  console.log('\n' + '─'.repeat(72))
  console.log(
    `${pad('Form', 24)} ${pad('Status', 8)} ${pad('Bytes', 10)} Reason`
  )
  console.log('─'.repeat(72))
  for (const r of results) {
    const bytes = r.bytes ? `${Math.round(r.bytes / 1024)}KB` : ''
    const reason = r.reason ?? ''
    console.log(
      `${pad(r.form.formNumber, 24)} ${pad(r.status, 8)} ${pad(bytes, 10)} ${reason}`
    )
  }
  console.log('─'.repeat(72))

  const ok = results.filter((r) => r.status === 'OK').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const skip = results.filter((r) => r.status === 'SKIP').length
  console.log(`\nSummary: ${ok} OK  ${fail} FAIL  ${skip} SKIP\n`)

  if (ok === 0 && fail > 0) {
    console.error('[sync-gov-forms] Total failure — zero forms uploaded.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[sync-gov-forms] Unexpected error:', err)
  process.exit(1)
})
