# FULL-FEED W1.6a — Event hosting + two-state check-in + attendance

Wave: `feed-fullfeed-w1-6a-events-hosting`
Migration: `supabase/migrations/20261007000000_w1_6a_events_hosting_checkin.sql`
Builds on W2 orgs (`20260614120000`), W3 events (`20260614130000`), W4 check-in capture
(`20260614140000`), and the P2.0/P2.1a/P2.1b engagement ledger.

## Capability delivered

After this ships:

- A **platform admin** creates an **organization** and assigns an **org admin**
  (Admin → Organizations tab).
- An **org admin** (or platform admin) **schedules an event** with an address that is
  **geocoded** on save (Admin → Events → New Event).
- **Signed-in members** **check in early** ("I'm coming") any time before the window opens,
  and **confirm on-site** during the window (or are confirmed by the organizer kiosk).
- **Organizers** see **per-event** and **per-attendee** attendance (Admin → Events →
  Attendance).
- **Members** see their **own** attendance rate (Settings → Profile).

## Rulings (R1–R8)

| # | Ruling |
|---|--------|
| R1 | Only platform admins create orgs + assign org admins; org admins (+ platform admins) create/schedule events. No member-hosted events. |
| R2 | Two states — EARLY ("I'm coming", before the window opens) and CONFIRMED (presence). CONFIRMED is set by the member tapping again in the window `[starts_at − 30 min, ends_at]`, by a first check-in during the window (straight to CONFIRMED), or by the organizer. After `ends_at` no self actions; the organizer may confirm until `ends_at + 24h`. Cancelled rejects everything. |
| R3 | An EARLY check-in never confirmed by `ends_at` is a NO-SHOW — **derived**, never a stored cron mutation. |
| R4 | Person rate = confirmed ÷ (early-or-confirmed check-ins on ENDED occurrences). Per event: early, confirmed, no-show, show rate. |
| R5 | Org admins (+ platform admins) see per-event stats and each attendee's rate computed ONLY over that org's events. A member sees their OWN overall rate. No public / cross-org score. |
| R6 | Only CONFIRMED attendance earns the private P2.1a `event_checkin` credit — once per (user, occurrence), at confirmation. Reconcile agrees. |
| R7 | Anonymous check-ins (user_id NULL, household only) stay available for signed-in members — untracked, no credit, not part of attendance %. |
| R8 | Guests (`auth.users.is_anonymous`) cannot check in. |

## Entities

- `assistance_events` — event definition. **W1.6a adds** `geocode_accuracy`, `geocode_confidence`
  (text, mirroring `resources`); `location` is written only from a strong (precise-tier) match.
- `event_occurrences` — scheduled instances (`starts_at`, `ends_at`, `status` upcoming|cancelled|completed).
- `event_checkins` — one row per visit. **W1.6a adds** `status` (`early`|`confirmed`, default `confirmed`),
  `confirmed_at`, `confirmed_by`. Partial `UNIQUE(occurrence_id, user_id) WHERE user_id IS NOT NULL`
  keeps at most one identified row per person per occurrence. Anonymous rows carry no member
  identity: `user_id`, `checked_in_by`, `confirmed_by` are all NULL.
- `event_anonymous_claims` — **W1.6a (fix round)** private, server-only `(occurrence_id, user_id)`
  ledger. RLS on, **no policies, all grants revoked** — no client (incl. org admins) can read or
  write it. Its sole purpose is to cap a member at one anonymous check-in per occurrence while
  keeping the member↔occurrence link out of every client's reach.

## State machine (per identified member, per occurrence)

```
window opens = starts_at − 30 min

               now < window_open           window_open ≤ now ≤ ends_at        now > ends_at
no row      →  check_in ⇒ EARLY            check_in ⇒ CONFIRMED               rejected (self)
EARLY       →  stays EARLY (idempotent)    check_in ("I'm here") ⇒ CONFIRMED  organizer_confirm ⇒ CONFIRMED
                                            organizer_confirm ⇒ CONFIRMED       (until ends_at + 24h)
CONFIRMED   →  terminal (idempotent, never moves back)
cancelled   →  every path rejected
```

- NO-SHOW is derived: a `status='early'` row on an ended occurrence.
- Anonymous check-ins (`p_anonymous=true` / organizer walk-in) are `user_id NULL`,
  `status='confirmed'`, no credit, excluded from attendance %.

## Writers (all writes are SECDEF RPC-only — I1)

Clients hold **no** INSERT/UPDATE/DELETE on `event_checkins` (grants revoked; permissive write
policies dropped; the P2.0 RESTRICTIVE guest block kept). SELECT stays (own + admin + org-admin).

| RPC | Who | Effect |
|-----|-----|--------|
| `check_in(p_occurrence, p_household_size, p_anonymous)` | authenticated non-guest | member's own early/confirmed/anonymous check-in per the state machine |
| `organizer_confirm(p_occurrence, p_user, p_household_size)` | org admin of the event's org, or platform admin | confirm an attendee **who already has a check-in row** (never mints a row for an arbitrary id → no FK/existence oracle; uniform error), never the caller themselves, only within `[starts_at−30m, ends_at+24h]` on a live/active/non-cancelled occurrence; or add an anonymous household (`p_user` NULL, no identity stored) (I3, finding #1/#5) |
| `event_attendance(p_occurrence)` → jsonb | org admin of that org / platform admin (else NULL) | per-event {early, confirmed, no_show, anonymous_confirmed, people_confirmed, show_rate} + attendees with each rate org-scoped (I4) |
| `my_attendance_rate()` → jsonb | authenticated | the caller's OWN overall rate; takes no user arg (I4, R5) |
| `admin_create_event(...)` / `admin_update_event(...)` | org admin / platform admin | create/edit event; stores address + a geocoded `location` only from a strong match (I5) |
| `w1_6a_user_org_rate(p_user, p_org)` | internal only (no client EXECUTE) | org-scoped rate helper used inside `event_attendance` |

Credit (R6): `trg_engagement_event_checkin` (AFTER INSERT OR UPDATE) records the private
`event_checkin` engagement event only when the row is `confirmed`, identified, and this statement
is the confirming transition; idempotent via the ledger's `UNIQUE(actor,kind,target)`.
`reconcile_engagement` iterates `status='confirmed'` rows so the nightly self-heal matches.

## Invariants

| # | Invariant | Site |
|---|-----------|------|
| I1 | Check-in writes are RPC-only; clients cannot INSERT/UPDATE/DELETE `event_checkins` | REVOKE + dropped write policies; SECDEF RPCs |
| I2 | ≤1 identified row per (user, occurrence); state only early→confirmed; confirm exactly-once credit | partial UNIQUE + RPC logic + ledger UNIQUE |
| I3 | Kiosk records the attendee, never the organizer; confirmed_by/checked_in_by = organizer | `organizer_confirm` takes `p_user`; P2.0 force trigger |
| I4 | Org-admin numbers are org-scoped; a member reads only their own; args can't address another org/user | `event_attendance` gate + `w1_6a_user_org_rate`; `my_attendance_rate` takes no arg |
| I5 | Event location stored only from a strong match; weak/failed leaves NULL, tags `approximate` | `admin_create_event` / `admin_update_event` precise-tier gate |
| I6 | P2.0/P2.1a/P2.1b invariants hold; account deletion still succeeds | force trigger + guest block untouched; `enforce_opt_in_transition` md5 unchanged; 16 source triggers intact; FKs SET NULL/CASCADE |
| I7 | Every UI element activates a real capability; in-progress events stay listed with the correct button state | events-panel + checkin-sheet + kiosk + scheduler |
| I8 | Anonymous rows are unlinkable (user_id/checked_in_by/confirmed_by NULL) and capped at one per member per occurrence; `assistance_events` location/address is RPC-only (direct client writes revoked, coords/tier validated); org **membership** writes are platform-admin-only (R1); a non-platform-admin org admin can reach an **events-only** admin surface; `check_in` rejects inactive events/orgs and treats `completed` as ended | private `event_anonymous_claims`; adjusted P2.0 force trigger; `admin_create_event`/`admin_update_event` + `w1_6a_validate_geo`; platform-admin-only membership policies; `is_org_admin_any` + events-only `AdminShell` |

### Trust boundary (I5, finding #6)

Organizers are **trusted to state** a real venue: the server does not verify that an address is
the true location, only that the coordinates it stores are physically possible. `admin_create_event`
/ `admin_update_event` are the **only** writers of `assistance_events` location/address (direct
client writes and write policies are revoked), and they reject null-island `(0,0)`, `|lat|>90`,
`|lng|>180`, and unknown geocode tiers. A weak/failed match leaves `location` NULL and tags
`geocode_accuracy='approximate'` (feed shows "unknown" distance).

## Click paths

- **Org admin reaches the admin surface** (finding #4): Settings (SPA sidebar) → **Administration**
  entry (shown to platform admins AND org admins via `useIsOrgAdmin` → `is_org_admin_any`) → **Open
  Organizer Tools** → `/moderation`. The route guard (`(admin)/layout.tsx`) allows platform admins
  and any org admin; the shell (`AdminShell`) renders **only the Events tab** for a non-platform-admin
  org admin (Overview/Moderation/Community/Organizations/Resources/Manage/Settings are platform-only).
  The org selector lists only the orgs the caller administers (`get_admin_org_list`, role='admin').
- **Create org + assign org admin** (platform admin only): Admin → **Organizations** tab (`OrgsSection`)
  → "Create Organization" → expand the org → add member with role **admin**. (Org admins cannot manage
  the roster — membership writes are platform-admin-only.)
- **Schedule an event**: Admin/Organizer → **Events** tab → **New Event** → title, type, location name,
  address (autocomplete + geocode on save), organization → Create Event. Add occurrences with
  **+ Occurrence**.
- **Edit an event** (wires `admin_update_event`, finding #4): Admin/Organizer → **Events** tab →
  "All Events" list → **Edit** → change title/type/location/address → **Save changes**. Changing the
  address re-geocodes on save (strong-match-only, I5); an unchanged address does not touch `location`.
- **Organizer kiosk**: Admin → Events → occurrence **Sign-In** → confirm each waiting ("I'm coming")
  attendee or add a walk-in household.
- **Per-event attendance**: Admin → Events → occurrence **Attendance** → early/confirmed/no-show/show-rate
  + attendee rows with each attendee's org-scoped rate.
- **Member check-in**: SPA sidebar **Events** (alias → Feed → Events subtab) → event card button:
  "Check in early" / "I'm here" / "Checked in ✓ (early)" / "Attended ✓" / "Ended" / "Cancelled".
  Guests see the create-account prompt.
- **Member's own rate**: Settings → **Profile** → "Event attendance" (hidden until there is data).

## Verification

Validated on prod (PG 17.6) inside `BEGIN … RAISE→ROLLBACK` transactions on 2026-09-24 (fix round):
every fix-round scenario passed **both directions** — the forbidden action fails AND the legitimate
one still works:

- Anonymous rows carry no member identity (`user_id`/`checked_in_by`/`confirmed_by` all NULL);
  a second anonymous check-in by the same member is refused; an anonymous check-in on top of a
  tracked row is refused; org admins cannot read `event_anonymous_claims`.
- `organizer_confirm`: rejects a too-early confirm, a never-checked-in real user AND a random UUID
  with the *same* uniform error (no oracle), and a self-confirm; still confirms an early member in
  window and an early member during the ended-grace window (credit lands once at confirmation).
- `event_attendance` returns `first_name` (never `full_name`), computes no-show + org-scoped rates,
  denies cross-org and member callers, and treats `status='completed'` as ended.
- `admin_create_event`/`admin_update_event` reject null-island / out-of-range coords + unknown tiers,
  store a strong match, and are the only writers (direct `assistance_events` writes revoked).
- Org admins can no longer mint org admins (membership writes platform-admin-only); a platform admin
  still can. `check_in` rejects inactive events/orgs.
- Reconcile parity `0/0`, no ledger failures, account deletion of an attendee + organizer succeeds.
- Smoke 25/26/27/28 STATE_SQL green on the migrated state (P2.0 force trigger fires + references
  `auth.uid()`; `enforce_opt_in_transition` md5 unchanged `f3bc362…`; 16 engagement source triggers
  intact; secdef_pinned=7). Two guard mutations proved the new tests fail-closed.

Smoke `28-w1-6a-events-checkin.smoke.ts` gates on ledger row `20261007000000` (applied as a separate
post-deploy step) and asserts the state read-only.
