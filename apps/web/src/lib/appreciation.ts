// apps/web/src/lib/appreciation.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Single source of truth for the 12 peer-appreciation gift items, plus the client
// wrappers for the P2.1b appreciation feature (see supabase/migrations/20261006000000):
//   - giveAppreciation()  → the give_appreciation SECDEF RPC (idempotent per giver/item)
//   - listSentTo()        → which items the current user has already sent to a receiver
//   - myReceivedShelf()   → the receiver's own shelf (per-item counts + giver names)
//
// Pure, framework-agnostic, node-testable (see appreciation.test.ts). Every read uses
// AbortSignal.timeout(QUERY_TIMEOUT_MS) and returns a discriminated result so a timeout /
// failure is NEVER confused with a genuinely empty shelf (error ≠ empty), mirroring
// use-my-badges.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { getFriendlyErrorMessage } from '@/lib/friendly-error'
import { logger } from '@/lib/logger'

/** One appreciation gift item. `slug` matches the DB CHECK + the pixel icon slug. */
export interface AppreciationItem {
  slug: string
  label: string
  /** Accessible alt / aria text for the icon and picker button. */
  alt: string
}

/** The 12 items — the ONLY place the item list is defined on the client. Order is the
 *  picker's display order. Kept byte-identical to the migration CHECK + pixel-item-icon. */
export const APPRECIATION_ITEMS: readonly AppreciationItem[] = [
  { slug: 'heart', label: 'Heart', alt: 'A heart' },
  { slug: 'smile', label: 'Smile', alt: 'A smiling face' },
  { slug: 'cheer', label: 'Cheer', alt: 'Cheering hands' },
  { slug: 'flower', label: 'Flower', alt: 'A flower' },
  { slug: 'sunflower', label: 'Sunflower', alt: 'A sunflower' },
  { slug: 'leaf', label: 'Leaf', alt: 'A leaf' },
  { slug: 'bread', label: 'Bread', alt: 'A loaf of bread' },
  { slug: 'apple', label: 'Apple', alt: 'An apple' },
  { slug: 'soup', label: 'Soup', alt: 'A bowl of soup' },
  { slug: 'sun', label: 'Sun', alt: 'The sun' },
  { slug: 'seedling', label: 'Seedling', alt: 'A seedling' },
  { slug: 'tree', label: 'Tree', alt: 'A tree' },
] as const

/** The valid slug set (for client-side guarding before the RPC round-trip). */
export const APPRECIATION_SLUGS: readonly string[] = APPRECIATION_ITEMS.map((i) => i.slug)

/** Fast lookup by slug. */
export const APPRECIATION_BY_SLUG: Record<string, AppreciationItem> = Object.fromEntries(
  APPRECIATION_ITEMS.map((i) => [i.slug, i])
)

export function isAppreciationSlug(slug: string): boolean {
  return APPRECIATION_SLUGS.includes(slug)
}

// ---------------------------------------------------------------------------
// give_appreciation RPC
// ---------------------------------------------------------------------------

export type GiveResult =
  | { ok: true; created: boolean; giftId: string }
  | { ok: false; error: string }

/**
 * Send an appreciation gift via the SECDEF RPC. Idempotent per (giver, receiver, item):
 * a repeat returns { created: false }. Never throws — a failure resolves { ok:false }.
 */
export async function giveAppreciation(
  supabase: SupabaseClient<Database>,
  receiverId: string,
  item: string,
  postId?: string | null
): Promise<GiveResult> {
  if (!isAppreciationSlug(item)) {
    return { ok: false, error: 'That appreciation item is not available.' }
  }
  try {
    const { data, error } = await supabase
      .rpc('give_appreciation', {
        p_receiver: receiverId,
        p_item: item,
        p_post_id: postId ?? undefined,
      })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (error) throw error
    const row = (data ?? {}) as { id?: string; created?: boolean }
    return { ok: true, created: row.created === true, giftId: row.id ?? '' }
  } catch (err: unknown) {
    if (isQueryTimeout(err)) {
      return { ok: false, error: 'Sending appreciation timed out — please try again.' }
    }
    logger.error('appreciation_give_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: getFriendlyErrorMessage(err, "Couldn't send appreciation. Please try again.") }
  }
}

// ---------------------------------------------------------------------------
// listSentTo — which items the current user already sent to a receiver
// ---------------------------------------------------------------------------

export type SentResult =
  | { ok: true; items: string[] }
  | { ok: false; error: string }

/**
 * The set of item slugs the signed-in giver has already sent to `receiverId`, so the
 * picker can mark them as sent. Filtered by BOTH giver_id (the caller) and receiver_id
 * so it is correct even for a viewer who is also a receiver. RLS additionally scopes rows
 * to the caller. Empty array = nothing sent yet (distinct from the { ok:false } error).
 */
export async function listSentTo(
  supabase: SupabaseClient<Database>,
  giverId: string,
  receiverId: string
): Promise<SentResult> {
  try {
    const { data, error } = await supabase
      .from('appreciation_gifts')
      .select('item')
      .eq('giver_id', giverId)
      .eq('receiver_id', receiverId)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (error) throw error
    return { ok: true, items: (data ?? []).map((r) => r.item as string) }
  } catch (err: unknown) {
    if (isQueryTimeout(err)) {
      return { ok: false, error: 'Loading sent gifts timed out — please try again.' }
    }
    logger.error('appreciation_list_sent_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: getFriendlyErrorMessage(err, "Couldn't load sent gifts.") }
  }
}

// ---------------------------------------------------------------------------
// myReceivedShelf — the receiver's own shelf (per-item counts + giver names)
// ---------------------------------------------------------------------------

export interface ShelfGiver {
  id: string
  name: string
  avatar: string | null
}

export interface ShelfEntry {
  slug: string
  label: string
  count: number
  /** Givers, most recent first. Owner-only (RLS-scoped to the receiver). */
  givers: ShelfGiver[]
}

export type ShelfResult =
  | { ok: true; shelf: ShelfEntry[] }
  | { ok: false; error: string }

/** Raw joined row from the shelf read (before aggregation). */
interface ShelfRow {
  item: string
  created_at: string | null
  giver: { id: string; first_name: string | null; avatar_url: string | null } | null
}

/**
 * Aggregate raw received-gift rows into per-item entries (count + givers). Pure, exported
 * for the unit test. Rows are grouped by item, givers ordered most-recent-first, and only
 * the 12 known items are surfaced (an unknown slug — e.g. a future item — is skipped so
 * the shelf never renders an unlabelled row).
 */
export function aggregateShelf(rows: ShelfRow[]): ShelfEntry[] {
  const byItem = new Map<string, { count: number; givers: ShelfGiver[] }>()
  // Most-recent-first so each item's giver list leads with the latest.
  const sorted = [...rows].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  for (const row of sorted) {
    const meta = APPRECIATION_BY_SLUG[row.item]
    if (!meta) continue
    const bucket = byItem.get(row.item) ?? { count: 0, givers: [] }
    bucket.count += 1
    bucket.givers.push({
      id: row.giver?.id ?? '',
      name: row.giver?.first_name || 'Someone',
      avatar: row.giver?.avatar_url ?? null,
    })
    byItem.set(row.item, bucket)
  }
  // Preserve the canonical item order, highest count first within that.
  return APPRECIATION_ITEMS.filter((i) => byItem.has(i.slug))
    .map((i) => {
      const b = byItem.get(i.slug)!
      return { slug: i.slug, label: i.label, count: b.count, givers: b.givers }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * The signed-in receiver's own shelf. Owner-only via RLS + the receiver_id filter. Never
 * throws; a timeout/failure resolves { ok:false } so the UI shows the error+Retry state
 * rather than the "No gifts yet" empty state on a failed read.
 */
export async function myReceivedShelf(
  supabase: SupabaseClient<Database>,
  receiverId: string
): Promise<ShelfResult> {
  try {
    const { data, error } = await supabase
      .from('appreciation_gifts')
      .select('item, created_at, giver:profiles!appreciation_gifts_giver_fk(id, first_name, avatar_url)')
      .eq('receiver_id', receiverId)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    if (error) throw error
    return { ok: true, shelf: aggregateShelf((data ?? []) as unknown as ShelfRow[]) }
  } catch (err: unknown) {
    if (isQueryTimeout(err)) {
      return { ok: false, error: 'Loading your gifts timed out — please try again.' }
    }
    logger.error('appreciation_shelf_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: getFriendlyErrorMessage(err, "Couldn't load your gifts.") }
  }
}
