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
  `confirmed_at`, `confirmed_by`, and **(fix round 2)** `is_anonymous` (NOT NULL, default false) — the
  authoritative anonymous marker. Partial `UNIQUE(occurrence_id, user_id) WHERE user_id IS NOT NULL`
  keeps at most one identified row per person per occurrence. Anonymous rows carry no member
  identity: `user_id`, `checked_in_by`, `confirmed_by` are all NULL, `is_anonymous=true`, and
  `checked_in_at`/`confirmed_at` are coarsened to the minute (an org admin cannot second-precision-
  match a public row against a kiosk observation to re-identify the member). Attendance counts
  anonymous by `is_anonymous` (never `user_id IS NULL`), so a deleted attendee's identified row
  (`user_id` nulled by the FK) is not miscounted as anonymous.
- `event_anonymous_claims` — **W1.6a (fix round)** private, server-only `(occurrence_id, user_id)`
  ledger. RLS on, **no policies, all grants revoked** — no client (incl. org admins) can read or
  write it. Its sole purpose is to cap a member at one anonymous check-in per occurrence while
  keeping the member↔occurrence link out of every client's reach. **(fix round 2)** the SECDEF,
  own-only `my_anonymous_claims(uuid[])` RPC lets the member — and no one else — learn which of a
  set of occurrences they have already claimed anonymously (so the UI shows "Counted anonymously ✓").

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
| `check_in(p_occurrence, p_household_size, p_anonymous)` | authenticated non-guest | member's own early/confirmed/anonymous check-in per the state machine; **(fix round 2)** refuses an identified check-in when the member already holds an anonymous claim, and an anonymous check-in when they already hold a tracked row (counted at most once, M2) |
| `my_anonymous_claims(p_occurrence_ids)` → setof uuid | authenticated (own-only) | the subset of the passed occurrences the caller has claimed anonymously; cannot reveal another member's claim (M2) |
| `organizer_confirm(p_occurrence, p_user, p_household_size)` | org admin of the event's org, or platform admin | confirm an attendee **who already has a check-in row** (never mints a row for an arbitrary id → no FK/existence oracle; uniform error), never the caller themselves, only within `[starts_at−30m, ends_at+24h]` on a live/active/non-cancelled occurrence; or add an anonymous household (`p_user` NULL, no identity stored) (I3, finding #1/#5) |
| `event_attendance(p_occurrence)` → jsonb | org admin of that org / platform admin (else NULL) | per-event {early, confirmed, no_show, anonymous_confirmed, people_confirmed, show_rate} + attendees with each rate org-scoped (I4) |
| `my_attendance_rate()` → jsonb | authenticated | the caller's OWN overall rate; takes no user arg (I4, R5) |
| `admin_create_event(...)` / `admin_update_event(...)` | org admin / platform admin | create/edit event; stores address + a geocoded `location` only from a strong match (I5). **(fix round 2)** `admin_create_event` rejects an inactive org; `admin_update_event` adds `p_is_active` (retire/reactivate) and `p_clear text[]` (explicit clear of optional text fields — COALESCE can only set, never blank) |
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
| I9 | **(fix round 2)** A member is counted at most once per occurrence (anonymous OR tracked, never both); a **platform** admin can see/change roles in/remove any org's roster (org admins still cannot touch admin membership); once any check-in exists a **client** cannot change an occurrence's start/end time nor reopen it from cancelled/completed (cancellation + new occurrences still work; server-side writers bypass); org admins of a since-retired org lose the organizer surface; events are retireable + optional fields clearable; other admin routes (`/federation/*`) redirect org admins | `check_in` anon-claim guard + `my_anonymous_claims`; `org_members_select_platform_admin`; `trg_event_occurrences_guard_checkin_bounds`; `is_org_admin_any` (active-org) + `admin_create_event` active-org guard; `admin_update_event` `p_is_active`/`p_clear`; `federation/layout.tsx` |

### Trust boundary (I5, finding #6)

Organizers are **trusted to state** a real venue: the server does not verify that an address is
the true location, only that the coordinates it stores are physically possible. `admin_create_event`
/ `admin_update_event` are the **only** writers of `assistance_events` location/address (direct
client writes and write policies are revoked), and they reject null-island `(0,0)`, `|lat|>90`,
`|lng|>180`, and unknown geocode tiers. A weak/failed match leaves `location` NULL and tags
`geocode_accuracy='approximate'` (feed shows "unknown" distance).

### Known + out of scope (documented)

`orgs_update_org_admin` still lets an org admin **rename or deactivate their own org**. R1 assigns org
creation/retirement to platform admins; tightening this policy is deferred (out of scope for W1.6a) and
recorded here so it is not mistaken for a gap. Making `is_org_admin` itself active-org-aware was
avoided for the same reason — it would change that policy's behaviour; instead `is_org_admin_any`
(shell/route reveal) and `admin_create_event` reject inactive orgs directly.

## Click paths

- **Org admin reaches the admin surface** (finding #4): Settings (SPA sidebar) → **Administration**
  entry (shown to platform admins AND org admins via `useIsOrgAdmin` → `is_org_admin_any`) → **Open
  Organizer Tools** → `/moderation`. The route guard (`(admin)/layout.tsx`) allows platform admins
  and any org admin; the shell (`AdminShell`) renders **only the Events tab** for a non-platform-admin
  org admin (Overview/Moderation/Community/Organizations/Resources/Manage/Settings are platform-only).
  The org selector lists only the orgs the caller administers (`get_admin_org_list`, role='admin').
- **Create org + assign/manage org admins** (platform admin only): Admin → **Organizations** tab
  (`OrgsSection`) → "Create Organization" → expand the org → add member with role **admin**, change a
  member's role inline, or remove a member. **(fix round 2)** the roster read/remove/role-change work
  for a platform admin against **any** org (`org_members_select_platform_admin`), and a 0-row
  remove/change is surfaced as an error, never a silent success. (Org admins cannot manage the roster
  — membership writes are platform-admin-only.)
- **Retire / reactivate an event** (fix round 2): Admin/Organizer → **Events** tab → **Edit** →
  **Retire event** (sets `is_active=false`; drops off the member feed + scheduler). Blanking an
  optional address field on Save clears it (explicit `p_clear`).
- **Federation is platform-only** (fix round 2): `/federation/*` has its own route guard
  (`federation/layout.tsx`) that redirects a non-platform-admin org admin back to `/moderation`.
- **Schedule an event**: Admin/Organizer → **Events** tab → **New Event** → title, type, location name,
  address (autocomplete + geocode on save), organization → Create Event. Add occurrences with
  **+ Occurrence**.
- **Edit an event** (wires `admin_update_event`, finding #4): Admin/Organizer → **Events** tab →
  "All Events" list → **Edit** → change title/type/location/address → **Save changes**. Changing the
  address re-geocodes on save (strong-match-only, I5); an unchanged address does not touch `location`.
- **Organizer kiosk**: Admin → Events → occurrence **Sign-In** → confirm each waiting ("I'm coming")
  attendee or add a walk-in household.
- **Per-event attendance**: Admin → Events → occurrence **Attendance** → early/confirmed/no-show/show-rate
  + attendee rows with each attendee's org-scoped rate. **(fix round 2)** ended/completed occurrences
  (not just upcoming) are reachable in the calendar so their attendance can be reviewed.
- **Member check-in**: SPA sidebar **Events** (alias → Feed → Events subtab) → event card button:
  "Check in early" / "I'm here" / "Checked in ✓ (early)" / "Attended ✓" / "Counted anonymously ✓"
  (fix round 2, from `my_anonymous_claims`) / "Ended" / "Cancelled". The anonymous checkbox is hidden
  once the member already holds a tracked row. Guests see the create-account prompt.
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
- **(fix round 2)** A member is counted once per occurrence: after an anonymous check-in the member's
  own identified check-in on the same occurrence is refused, and `event_attendance` shows
  `anonymous_confirmed=1, confirmed=0, people_confirmed=1` (no double count). `my_anonymous_claims`
  returns the caller's own claimed occurrence (`[occAN]`) and **empty** for a different member.
  Anonymous `checked_in_at`/`confirmed_at` are minute-truncated and `is_anonymous=true`.
- **(fix round 2)** A **platform** admin (not a member) reads Org One's roster (1 row) and its
  DELETE/UPDATE…RETURNING affect 1 row; an org admin cannot change their own role or self-delete,
  and cannot see another org's roster.
- **(fix round 2)** Once a check-in exists, an org admin's direct `event_occurrences` time-slide is
  **blocked**, as is reopening a cancelled/completed occurrence; cancellation still works and an
  occurrence with **no** check-ins is still time-editable; a server-side (migration) slide bypasses
  the guard.
- **(fix round 2)** `admin_update_event` retires an event (`is_active=false`) and clears an optional
  field (`p_clear`); `is_org_admin_any` returns false for an admin of a since-deactivated org and
  `admin_create_event` on that org is rejected.
- Smoke 25/26/27/28 STATE_SQL green on the migrated state (P2.0 force trigger fires + references
  `auth.uid()`; `enforce_opt_in_transition` md5 unchanged `f3bc362…`; 16 engagement source triggers
  intact; secdef_pinned=7; fix-round-2 fields: `is_anonymous` column, `att_uses_is_anon_marker`,
  `my_anonymous_claims` authenticated-only, `org_members_select_platform_admin`, the M3 guard trigger,
  and the retire/clear `admin_update_event` signature). Two guard mutations (M2 anon-claim refusal,
  M3 occurrence-bounds lock) proved the new tests fail-closed.

Smoke `28-w1-6a-events-checkin.smoke.ts` gates on ledger row `20261007000000` (applied as a separate
post-deploy step) and asserts the state read-only.
