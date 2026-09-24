// event-checkin.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure, node-testable window/state + attendance-rate math for W1.6a two-state
// check-in. The DB (check_in / organizer_confirm / event_attendance /
// my_attendance_rate SECDEF RPCs) is the source of truth; these functions mirror
// its rules so the UI can render the right button state and the right numbers
// without a round trip, and so the logic is unit-testable in isolation.
//
// Rules (verbatim from the migration header, R2/R3/R4):
//   - EARLY window opens 30 minutes before starts_at.
//   - now <  starts_at - 30m            -> EARLY   ("Check in early")
//   - starts_at - 30m <= now <= ends_at -> in window ("I'm here" -> confirmed)
//   - now >  ends_at                    -> ended
//   - a person's rate = confirmed / (early-or-confirmed on ENDED occurrences)
//   - a no-show is an EARLY row on an ended occurrence.

export const EARLY_WINDOW_MINUTES = 30
export const HOUSEHOLD_MIN = 1
export const HOUSEHOLD_MAX = 20

export type OccurrenceStatus = 'upcoming' | 'cancelled' | 'completed'
export type MyCheckinStatus = 'none' | 'early' | 'confirmed'
export type CheckinRowStatus = 'early' | 'confirmed'

export type CheckinButtonKind =
  | 'cancelled'
  | 'ended'
  | 'early'
  | 'in_window'
  | 'checked_early'
  | 'attended'
  | 'anonymous'

export interface CheckinButtonModel {
  kind: CheckinButtonKind
  label: string
  /** Whether the button triggers a check-in action (opens the sheet). */
  actionable: boolean
  /** True when a check-in now records CONFIRMED presence (in-window); false for an early "I'm coming". */
  confirmsPresence: boolean
}

/** The instant the check-in window opens (30 min before start), in epoch ms. */
export function windowOpensAtMs(startsAtMs: number): number {
  return startsAtMs - EARLY_WINDOW_MINUTES * 60_000
}

/** True when `nowMs` is inside [starts_at - 30m, ends_at] (inclusive both ends). */
export function isInWindow(nowMs: number, startsAtMs: number, endsAtMs: number): boolean {
  return nowMs >= windowOpensAtMs(startsAtMs) && nowMs <= endsAtMs
}

/** True when the occurrence is over: cancelled/completed status or past ends_at. */
export function isEnded(status: OccurrenceStatus, nowMs: number, endsAtMs: number): boolean {
  return status === 'completed' || nowMs > endsAtMs
}

export interface CheckinButtonInput {
  status: OccurrenceStatus
  startsAtMs: number
  endsAtMs: number
  myStatus: MyCheckinStatus
  nowMs: number
  /**
   * True when the member already spent their one anonymous check-in on this occurrence
   * (from my_anonymous_claims). They are already counted; the server refuses a second,
   * identified, check-in (M2), so the UI shows a terminal "Counted anonymously" state.
   */
  anonymousClaimed?: boolean
}

/**
 * The button model for a member viewing one occurrence. Drives label + whether a
 * tap is actionable and whether it confirms presence. Mirrors the server so the
 * UI never invites an action the RPC will reject.
 */
export function computeCheckinButton(input: CheckinButtonInput): CheckinButtonModel {
  const { status, startsAtMs, endsAtMs, myStatus, nowMs, anonymousClaimed } = input

  if (status === 'cancelled') {
    return { kind: 'cancelled', label: 'Cancelled', actionable: false, confirmsPresence: false }
  }
  // Already counted anonymously (M2): terminal, non-actionable — a second check-in is refused.
  if (anonymousClaimed) {
    return { kind: 'anonymous', label: 'Counted anonymously ✓', actionable: false, confirmsPresence: false }
  }
  // Confirmed is terminal for the member: state never moves back.
  if (myStatus === 'confirmed') {
    return { kind: 'attended', label: 'Attended ✓', actionable: false, confirmsPresence: false }
  }
  if (isEnded(status, nowMs, endsAtMs)) {
    if (myStatus === 'early') {
      // Ended with an unconfirmed early = a no-show; still show they said they'd come.
      return { kind: 'checked_early', label: 'Checked in ✓ (early)', actionable: false, confirmsPresence: false }
    }
    return { kind: 'ended', label: 'Ended', actionable: false, confirmsPresence: false }
  }
  if (nowMs >= windowOpensAtMs(startsAtMs)) {
    // In window: a first check-in OR an early row both become CONFIRMED presence.
    return { kind: 'in_window', label: "I'm here", actionable: true, confirmsPresence: true }
  }
  // Before the window opens.
  if (myStatus === 'early') {
    return { kind: 'checked_early', label: 'Checked in ✓ (early)', actionable: false, confirmsPresence: false }
  }
  return { kind: 'early', label: 'Check in early', actionable: true, confirmsPresence: false }
}

/** Clamp a household size to the DB-enforced [1, 20] range. */
export function clampHousehold(n: number): number {
  if (!Number.isFinite(n)) return HOUSEHOLD_MIN
  return Math.max(HOUSEHOLD_MIN, Math.min(HOUSEHOLD_MAX, Math.round(n)))
}

export interface CheckinRow {
  status: CheckinRowStatus
  user_id: string | null
  household_size?: number
}

export interface OccurrenceStats {
  /** Identified early rows not yet confirmed. */
  early: number
  /** Identified confirmed rows. */
  confirmed: number
  /** No-shows: identified early rows on an ENDED occurrence (0 until ended). */
  noShow: number
  /** confirmed / (confirmed + noShow) once ended and there is data, else null. */
  showRate: number | null
}

/**
 * Per-occurrence stats over its IDENTIFIED check-ins (anonymous rows excluded from
 * the attendance figures). `ended` decides whether early rows count as no-shows and
 * whether a show rate is defined.
 */
export function computeOccurrenceStats(rows: CheckinRow[], ended: boolean): OccurrenceStats {
  const identified = rows.filter((r) => r.user_id !== null)
  const early = identified.filter((r) => r.status === 'early').length
  const confirmed = identified.filter((r) => r.status === 'confirmed').length
  const noShow = ended ? early : 0
  const denom = confirmed + noShow
  const showRate = ended && denom > 0 ? confirmed / denom : null
  return { early, confirmed, noShow, showRate }
}

/**
 * A person's attendance rate = confirmed / total, where `total` is their
 * early-or-confirmed check-ins on ENDED occurrences. Null when there is no data.
 */
export function computeAttendanceRate(confirmed: number, total: number): number | null {
  return total > 0 ? confirmed / total : null
}

/** Render a rate (0..1) as a whole-percent string; em dash when there is no data. */
export function formatRatePct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—'
  return `${Math.round(rate * 100)}%`
}
