// apps/web/src/lib/event-checkin-state.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The member's own check-in state for the event dates on screen — one loader shared by the
// community feed and the Events tab. Two reads, started together and bounded by one timeout:
//   - own tracked rows (event_checkins, RLS checkins_select_own) -> early / confirmed
//   - own anonymous claims (my_anonymous_claims SECDEF RPC; the anonymous row itself is
//     unlinkable, so this is the only way a member learns they are already counted)
// Each half settles on its own. A half that fails or times out leaves its part empty and logs
// events.checkin_state.load_failed; the cards still render and the check-in button still works
// (the check_in RPC answers a repeat check-in with already_early / already_confirmed).
// Logged-out viewers and guests have no check-ins, so nothing is read for them.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@feed/database'
import type { MyCheckinStatus } from './event-checkin'
import { logger } from './logger'

export interface CheckinState {
  /** occurrence id -> the member's tracked check-in ('early' | 'confirmed'). */
  statuses: Record<string, MyCheckinStatus>
  /** Occurrence ids the member already spent their one anonymous check-in on. */
  anonClaims: Set<string>
}

export type CheckinStateSurface = 'feed' | 'events_tab'

export const CHECKIN_STATE_TIMEOUT_MS = 12_000

export function emptyCheckinState(): CheckinState {
  return { statuses: {}, anonClaims: new Set() }
}

export interface LoadCheckinStateOptions {
  /** The signed-in member's id; null when logged out. */
  userId: string | null
  /** True for a guest (anonymous auth) session — guests cannot check in. */
  isGuest: boolean
  occurrenceIds: readonly string[]
  surface: CheckinStateSurface
  timeoutMs?: number
}

type Settled<T> = { data: T | null; error: unknown }

async function settle<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<Settled<T>> {
  try {
    const { data, error } = await query
    return { data, error }
  } catch (error) {
    return { data: null, error }
  }
}

function errorCode(error: unknown): string {
  const e = error as { code?: unknown; name?: unknown } | null
  if (e && typeof e.code === 'string' && e.code) return e.code
  if (e && typeof e.name === 'string' && e.name) return e.name
  return 'unknown'
}

export async function loadCheckinState(
  supabase: SupabaseClient<Database>,
  { userId, isGuest, occurrenceIds, surface, timeoutMs = CHECKIN_STATE_TIMEOUT_MS }: LoadCheckinStateOptions,
): Promise<CheckinState> {
  const state = emptyCheckinState()
  const ids = [...new Set(occurrenceIds)]
  if (!userId || isGuest || ids.length === 0) return state

  const signal = AbortSignal.timeout(timeoutMs)
  const [own, claims] = await Promise.all([
    settle(
      supabase
        .from('event_checkins')
        .select('occurrence_id, status')
        .eq('user_id', userId)
        .in('occurrence_id', ids)
        .abortSignal(signal),
    ),
    settle(supabase.rpc('my_anonymous_claims', { p_occurrence_ids: ids }).abortSignal(signal)),
  ])

  if (own.error) {
    logger.warn('events.checkin_state.load_failed', { surface, part: 'own', code: errorCode(own.error) })
  } else {
    for (const row of own.data ?? []) {
      state.statuses[row.occurrence_id] = (row.status as MyCheckinStatus) ?? 'confirmed'
    }
  }

  if (claims.error) {
    logger.warn('events.checkin_state.load_failed', { surface, part: 'anonymous', code: errorCode(claims.error) })
  } else {
    for (const row of claims.data ?? []) {
      if (row?.occurrence_id) state.anonClaims.add(row.occurrence_id)
    }
  }
  return state
}

/**
 * What a check_in answer means for the card's button: the member's tracked state for that date,
 * or that their anonymous check-in is spent. null when the answer is unknown (the request was cut
 * off), and the caller re-reads instead. Applying the server's own answer keeps the list (and the
 * member's place and focus in it) instead of reloading it.
 */
export function checkinResultEffect(result: string | null): { status: MyCheckinStatus } | { anonymous: true } | null {
  switch (result) {
    case 'early':
    case 'already_early':
      return { status: 'early' }
    case 'confirmed':
    case 'already_confirmed':
      return { status: 'confirmed' }
    case 'confirmed_anonymous':
      return { anonymous: true }
    default:
      return null
  }
}

/** The check-in state with one check_in answer applied; null when the answer is unknown. */
export function applyCheckinResult(state: CheckinState, occurrenceId: string, result: string | null): CheckinState | null {
  const effect = checkinResultEffect(result)
  if (!effect) return null
  if ('anonymous' in effect) return { statuses: state.statuses, anonClaims: new Set(state.anonClaims).add(occurrenceId) }
  return { statuses: { ...state.statuses, [occurrenceId]: effect.status }, anonClaims: state.anonClaims }
}
