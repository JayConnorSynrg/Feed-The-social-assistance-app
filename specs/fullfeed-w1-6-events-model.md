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
| D1 | *(round 4, user ruling)* Retiring an event cancels only occurrences that have **NOT STARTED**. An occurrence **in progress continues to its end**: members there can still confirm in the window, the organizer can confirm during the 24h grace, and it counts toward attendance normally. |
| D2 | *(round 4, user ruling)* Attendance history of an **ENDED** occurrence is permanent: an ended occurrence (`ends_at < now`, or `status='completed'`) **cannot be cancelled**; rates + per-event stats count every occurrence that actually **ran** (not cancelled before it ended), regardless of whether its event is later retired or its org later deactivated. Organizers cannot erase no-shows; members never lose attendance they earned. |

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

## Fix round 3 — truthful no-show accounting + integrity (F1–F9)

Round-3 adversarial review found several ways an early ("I'm coming") intent could be turned into
a no-show without the event actually running, dashboards inflated by unconfirmed intents, and a few
integrity gaps. All are closed and each was verified **both directions** (the forbidden action fails
AND the legitimate one still works), via the extended harness `gen6.py` + `check_r3.py`
(40/40 assertions), a local concurrency harness (`racerun.sh`), and mutation proofs.

- **F1 — a no-show is only a real ended run.** Marking an occurrence `completed` *before* its
  `starts_at` while check-ins exist is refused by the M3 guard (cancel instead). Retiring an event
  (`admin_update_event(p_is_active:=false)`, UI **Retire event**) cancels every not-yet-ended
  occurrence (in-progress included), so its early rows drop out of accounting rather than decaying
  into no-shows. Belt-and-suspenders: `my_attendance_rate` and `w1_6a_user_org_rate` count only
  occurrences whose **event and org are active**.
  **⚠ Superseded in fix round 4 (D1/D2/K4 — see below):** retire now cancels only *not-started*
  occurrences (in-progress ones continue); the "event and org active" rate filter is **removed**
  and replaced with "**ran**" semantics so ended occurrences keep counting after retire/deactivate.
  Legitimate: normal completion *after* the
  occurrence has started is still allowed; a genuine ended-occurrence early row is still a no-show;
  grace-window organizer confirm still lands the credit.
- **F2 — event reassignment is locked once check-ins exist.** The M3 guard now also blocks changing
  `event_occurrences.event_id` (same-org or cross-org) once any check-in/claim exists. Legitimate:
  reassigning an occurrence with no check-ins still works, and `capacity`/`notes` edits are allowed.
- **F3 — platform dashboards count confirmed presence only.** `dashboard_event_stats` and
  `community_people_fed` are redefined (W5 bodies verbatim + `status = 'confirmed'` on the check-in
  aggregates); their numbers equal the confirmed-only truth (e.g. `total_checkins`/`people_fed`
  reflect confirmed rows, not early intents). Consumers (`overview-tab.tsx`, `dashboard-section.tsx`)
  read the same fields unchanged.
- **F4 — concurrent anonymous + identified check-in can't both commit.** `check_in` takes a
  transaction-scoped `pg_advisory_xact_lock` on a hash of `(occurrence, member)` at entry; the loser
  re-reads and hits the once-per-member guard. Proven locally under both orderings — always exactly
  one row (member counted once), never both.
- **F5 — clients can't delete an occurrence with check-ins.** A `BEFORE DELETE` guard refuses a
  client delete when any check-in/claim exists (cancel instead); an occurrence with none is still
  deletable by org/platform admins; server-side cascades (account deletion) bypass. UI exposes
  **Cancel** (never Delete) on each occurrence.
- **F6 — the anonymous-marker smoke check is mutation-provable.** Smoke 28's
  `att_uses_is_anon_marker` now matches the actual `FILTER (WHERE is_anonymous)` expression, not the
  bare word (which also appears in comments); a mutation to `FILTER (WHERE user_id IS NULL)` flips it
  false.
- **F7 — an inactive org has no organizer powers, and its events are hidden from members.**
  `admin_update_event`, `event_attendance`, and the org-admin occurrence INSERT/UPDATE policies all
  require the owning org active (platform admins retain access); `events_select_active` +
  `occurrences_select_active_event` require the org active, so members no longer see a retired org's
  events. `is_org_admin` itself is unchanged (keeps `orgs_update_org_admin` out of scope).
- **F8 — clearing the address clears the pin.** `p_clear` containing `address` always nulls
  `location` + `geocode_accuracy` + `geocode_confidence`, whether or not `p_regeocode` was passed.
- **F9 — the legacy summary is dropped.** `get_occurrence_checkin_summary` (42702 ambiguous-column
  bug; counted deleted users as anonymous; zero app callers) is dropped; `event_attendance`
  supersedes it. Anonymous rows already carry minute-coarsened timestamps and are excluded from the
  identified attendees list, so no default ordering reveals their relative order beyond minute
  precision.

Verification: `gen6.py` (both directions + earlier scenarios: legit organizer confirm, grace, anon
once, retire → no no-show, reconcile parity `0/0`, account deletion, smoke 25/26/27/28 STATE,
`enforce_opt_in_transition` md5 `f3bc362…` unchanged, dashboards == confirmed truth) → `check_r3.py`
40/40; `racerun.sh` (F4, both orderings); mutation proofs killing the F1, F2, and F6 guards.

## Fix round 4 — retire/deactivate lifecycle + permanent history (D1, D2, K1–K5)

Round-4 adversarial review found a cancelled occurrence could be walked back to `completed`
(retire→reactivate→complete forged a no-show), retiring/deactivating erased genuine ended history,
and org deactivation converted refused members into no-shows. Two new user rulings (**D1**, **D2**,
recorded in the Rulings table) resolve the lifecycle; the fixes below make them hold both
directions, verified via `gen_r4.py` + `check_r4.py` (48/48), the preserved `gen6.py` + `check_r3.py`
(40/40), mutation proofs (K1/K3/K4 + the earlier F1/F2/F6), and a prod dry-run (single transaction,
trailing `RAISE` → full rollback; 48/48 against the live prod schema, `transition_md5` unchanged,
`pre_ledger_exists=false`).

**Derived consistency (K3) — retire vs deactivate.** They differ *because* their check-in
permission differs, and the difference is intentional:
- **Retire an event (D1):** the org is still operating, so an in-progress occurrence is left **live**
  — members there may still confirm and the organizer keeps the 24h grace. Only **not-started**
  occurrences are cancelled.
- **Deactivate an org (K2):** the org is suspended, so **all** check-ins to it are refused; an
  in-progress occurrence can no longer be served, so it is **cancelled** too (immediate treatment).
  Only **ended** occurrences are left untouched.

- **K1 — a cancelled occurrence stays cancelled.** Once any check-in/claim exists, the occurrence
  guard refuses leaving a terminal state to *any* other status — `cancelled→upcoming` **and**
  `cancelled→completed` (the retire→reactivate→complete path) and `completed→upcoming`. No forged
  no-show. Legitimate: cancelling a not-yet-ended occurrence still works.
- **K2 — deactivating an org cancels its not-yet-ended occurrences.** `trg_organizations_cascade_deactivate`
  (AFTER UPDATE OF `is_active`) cancels every occurrence of the org's events with
  `status NOT IN (cancelled,completed) AND ends_at > now` (not-started **and** in-progress). Ended
  occurrences are untouched. `check_in`/`organizer_confirm` refuse an inactive org (org gate checked
  first). A member who was refused therefore **never becomes a no-show** (the occurrence they were on
  is cancelled → excluded). Confirmed presence keeps its private engagement credit (granted at
  confirm, independent of occurrence status). **Show-rate accounting (superseded by G2 below):** the
  round-3 rule that a voided occurrence's confirmed row "no longer counts toward the show-rate" was
  corrected in fix round 4 — a confirmed row on a cancelled occurrence that had **already started**
  (`starts_at <= now()`) counts as **attended**, and an early row on a cancelled occurrence is never a
  no-show. Only a confirmation voided **before** its start slips out of the rate. See G2 for the exact
  rule and predicate.
- **K3 — documented above** (retire keeps in-progress live; deactivate cancels it).
- **K4 — "ran" replaces the is_active filter.** `w1_6a_user_org_rate` and `my_attendance_rate` now
  count every occurrence that **ran** — `status <> 'cancelled' AND (status='completed' OR ends_at < now)`
  — with the round-3 `ae.is_active AND o.is_active` filter **removed**. Confirmed history and no-shows
  of an ended occurrence survive a later event retire or org deactivation (D2). `event_attendance`
  already used ran semantics for its per-event stats. A client cannot cancel an **ended** occurrence
  (D2): the occurrence guard refuses `→ cancelled` when `OLD` is completed or past `ends_at`
  (ungated on check-ins). Both a **platform** admin and (since G1 below) the **org admin** reach the
  row and hit the explicit D2 guard.
- **K5 — reachability + hygiene.**
  - **Cancel** is offered on **both** the desktop calendar chip and the mobile day view, and **only**
    on a not-yet-ended, not-already-cancelled occurrence (an ended occurrence's history is permanent).
  - Cancelled **and** past occurrences' **Attendance** stays reachable in the scheduler via a
    dedicated **"Past & cancelled"** section (the week/day calendar hides cancelled ones to stay clean).
  - `get_occurrence_checkin_summary` is removed from `packages/database/types.ts` (the migration drops
    the function; it had zero app callers).
  - **F5 org delete (documented, kept refusing):** a platform admin deleting an **organization** that
    has any check-in history is **refused** — the `organizations → assistance_events → event_occurrences`
    cascade DELETE trips the `BEFORE DELETE` occurrence guard (`event_occurrences_guard_delete`) inside
    the same client transaction, aborting the org delete. Cancellation (not deletion) is the intended
    path; history is never silently erased. Server-side cascades (account deletion, auth.uid() NULL)
    still bypass.

Verification: `gen_r4.py` → `check_r4.py` 48/48 (S1 K1 no-forge; S2 D1 retire-in-progress; S3 D2
ended-permanent + K1 cancelled-stays; S4 K2 org deactivate — refused members never no-show, ended
still counts; S5 complete-mid-event + D2 no completed-cancel; S6 F5 both directions + org-delete
refused; S7 F8 clear-address; S8 retire-after-end keeps both). `gen6.py` → `check_r3.py` 40/40
preserved (retire/deactivate flows reordered so the org-deactivation cascade no longer voids
occurrences the finale rates). Mutation proofs: disabling the reopen guard, blocking the in-progress
retired-event confirm, and re-adding the is_active rate filter each flip their probe (K1/K3/K4);
the earlier F1/F2/F6 mutants still die.

## Fix round 4 follow-up — reachability (G1) + confirmed-never-drops (G2)

Round-4 review found two ways D1/D2 were satisfied server-side but not honoured end-to-end.

- **G1 — reachability of a retired event's live/ended occurrences.** D1 keeps an in-progress
  occurrence of a *retired* event live, but the people D1 says can still act could not **see** it:
  `events_select_active` / `occurrences_select_active_event` require the event active, and because
  the pre-existing `occurrences_org_admin_select` joins `assistance_events` under RLS, hiding the
  retired event also hid its occurrences from the org admin (scheduler/kiosk/attendance went blind).
  Fix: two extra **permissive** `SELECT` policies (`events_select_reachable_authed`,
  `occurrences_select_reachable_authed`), `TO authenticated`, backed by SECDEF helpers
  (`w1_6a_event_authed_reachable` / `w1_6a_occ_authed_reachable`, which compute reachability against
  the base tables so they never re-trip the nested-RLS filtering). They add exactly: a signed-in,
  **non-guest** member sees an *in-progress* occurrence of a retired event (org active) **and** its
  parent event — enough to render the Events list "I'm here"; an **org admin of an active org** sees
  **all** of their org's events + occurrences regardless of the event's `is_active`, so a retired
  event's in-progress occurrence is reachable in the scheduler/kiosk and its **ended** occurrences
  stay reachable for Attendance (D2 history). No one sees a retired event's **future (cancelled)**
  occurrences as check-in-able; anon/guest read exposure is unchanged (authenticated-only, guest
  excluded via the `auth.users.is_anonymous` guard). The org admin now **reaches** a retired event's
  ended occurrence and hits the explicit D2 guard (supersedes the round-4 "silent no-op" note). UI:
  `event-scheduler.tsx` drops its `.eq('is_active', true)` filter (RLS scopes it) so retired events
  with a reachable occurrence surface in the calendar/Past-&-cancelled; the events-panel needs no
  change (it already lists `status='upcoming' AND ends_at>=now`, gated only by RLS). Retire is hidden
  in the edit modal for an already-retired event (dead action). **Known behaviour:** an org admin can
  still **add occurrences to a retired event** — the occurrence-create path is not gated on the parent
  event's `is_active`. This is intentional and equivalent to the reactivation power the org admin
  already holds (they can flip `is_active` back on via Edit), so it grants no capability beyond what
  they can already do; a retired event with a future occurrence simply becomes reachable again for
  that occurrence.
- **G2 — a member's confirmed presence never drops out of their rate.** Deactivating an org **still
  cancels** its in-progress occurrences (K2/K3 unchanged): a suspended org refuses every check-in,
  so an in-progress occurrence can no longer be served and must not be left live (its early intents
  would rot into no-shows), and relaxing `check_in` for a suspended org contradicts "a deactivated
  org refuses all check-ins" — that is the concrete reason org deactivation cannot follow the D1
  retire rule. **Rule chosen:** keep the cancellation and fix the accounting — a **confirmed** row on
  a since-voided (cancelled) occurrence that had already **started** counts as **attended** in
  `w1_6a_user_org_rate` + `my_attendance_rate`, and an early row on any cancelled occurrence is never
  a no-show. So confirmed presence the member earned survives an org deactivation mid-occurrence
  (previously it was dropped — the "confirmed-on-voided" bug). **Actual predicate** — the `attended`
  branch for a cancelled occurrence is `eo.status = 'cancelled' AND eo.starts_at <= now()`, i.e. the
  gate is *"has the start time passed"*, not the row's own timing. Note a **confirmed row can exist
  before `starts_at`**: the confirmation window opens at `starts_at − 30 min`, so a member (or an
  organizer) can hold a `confirmed` row during `[starts_at − 30m, starts_at)`. Such a **pre-start
  confirmation counts only once `starts_at` passes** — if the event is retired or the org deactivated
  and the occurrence is voided **before** `starts_at`, that pre-start confirmed row does **not** count
  (a not-started cancelled occurrence is never counted); the same confirmation counts as attended the
  moment `starts_at` is reached even though the occurrence was voided.

Verification: `gen_r4.py` → `check_r4.py` **69/69** (adds S9 G1 reachability — member sees + checks
in the in-progress retired occ, future occ hidden + refused, guest sees none, org admin reaches it in
the scheduler query + Attendance for both the in-progress and the ended occ, ended occ hidden from
plain members; S10 G2 — confirmed presence on a voided in-progress occ still counts, early-only member
never a no-show, credit idempotent, no forged no-show, and an occ that already ran survives a later
deactivate). `gen6.py` → `check_r3.py` 40/40 preserved. F4 race test passes (member counted once).
Mutation proofs: nulling the voided-confirmed branch of `my_attendance_rate` drops S10_X_rate to
`confirmed=0` (G2); forcing the member in-progress reachability window false hides S9_M_see_inprog
(G1). Prod dry-run (single rolled-back tx via the Management API SQL endpoint, trailing `RAISE`):
**69/69** against the live prod schema, `pre_ledger_exists=false`, `transition_md5` unchanged
(`f3bc362…`), backfill-safe (0 orgs/events/occ/checkins), anon = member = guest reads (no broadened
exposure). Smoke 07/25/26/27/28 STATE clean on migrated state; P2.0 `enforce_opt_in_transition`
`prosrc` md5 unchanged; tsc 0, eslint 0 on changed files; non-smoke vitest green.

---

# FULL-FEED W1.6b — Events mixed into the ranked community feed

Wave: `feed-fullfeed-w1-6b-events-in-feed`
Migration: `supabase/migrations/20261008000000_w1_6b_events_in_feed.sql`
Builds on W1.3 (`ranked_feed`, `20260929000000`) and W1.6a (this file, above).

## Capability delivered

After this ships, anyone browsing **Community → Feed** (guests included, read-only)
sees upcoming and in-progress community events ranked in among posts, and signed-in
members can check in right from the event card ("Check in early" / "I'm here").

## Backend — `ranked_feed_v2`

New `public.ranked_feed_v2(p_lat, p_lng, p_limit=25, p_cursor_score, p_cursor_id)
RETURNS TABLE(id uuid, kind text, score real, distance_bucket text)`, STABLE
SECURITY DEFINER, `search_path=public,pg_temp`, EXECUTE revoked from PUBLIC and
granted to anon/authenticated/service_role (identical grants to `ranked_feed`).

- **Posts branch** is **byte-identical** to the deployed `ranked_feed` (the `cfg /
  caller / origin / visible / base / scored` CTEs + the bucket `CASE` are pasted
  verbatim), tagged `kind='post'`. **I5:** `ranked_feed` (v1) is left untouched
  (prosrc md5 `2cca92d907df6b60fbc840214a9df485`) — the deployed client keeps
  calling v1 until the W1.6b client deploys (schema-first).
- **Events branch** emits one row per eligible event = its **next** occurrence
  (`DISTINCT ON (event_id) … ORDER BY starts_at ASC`) where the occurrence is
  `status='upcoming' AND ends_at>=now() AND starts_at<=now()+30d` — matching the
  events-panel horizon. `kind='event'`, row `id = occurrence id`.
  - Ranking (LOCKED rulings): engagement term = `1.0` (events have no
    likes/comments); `age_h = |now - starts_at|` in hours (peaks around the start,
    same half-life fading before **and** after); the **same** quantized distance
    bucket factor as posts, from `assistance_events.location` (representative km
    1/6/30/75; `unknown` when null); **never pinned**.
  - **Anti-oracle:** the exact `dist_km` is computed once per row but NEVER
    returned; the distance factor is the discrete per-bucket step, so two events in
    the same bucket at different exact distances score identically — no
    multilateration (same guarantee as W1.3, re-proved for events in smoke 29).
  - **Visibility (caller-could-SELECT):** the RPC reproduces the union of the four
    `event_occurrences` SELECT policies — `is_current_user_admin()` OR
    `is_org_admin(org_id)` OR `(event active AND org active)` OR
    `(auth.uid() IS NOT NULL AND w1_6a_occ_authed_reachable(occ))`. The
    `auth.uid() IS NOT NULL` gate is load-bearing: the reachable policies are
    `TO authenticated`, and the helper's guest-exclusion is vacuously true for a
    null uid, so without the gate a true anon would wrongly gain the in-progress-
    retired path.
- **Single cross-kind keyset:** `posts_ranked UNION ALL events_ranked`, then
  `WHERE p_cursor_score IS NULL OR (score, id) < (p_cursor_score, p_cursor_id)
  ORDER BY score DESC, id DESC LIMIT …` — one page across both kinds; post/occ
  UUIDs are distinct so the `(score, id)` key is unique.

## Client

- `feed-panel.tsx` ranked path calls `ranked_feed_v2`, partitions the page into post
  ids / event (occurrence) ids, hydrates posts via `FEED_POST_SELECT` (unchanged) and
  events via the events-panel occurrence select (joined `assistance_events` +
  `organizations(name)`), and loads the member's own check-in status + anonymous
  claims for the event occurrences (RLS `checkins_select_own` + `my_anonymous_claims`).
- Pure model (`post-model.ts`): `Post.score?`, `RankedFeedV2Row`, `EventFeedItem`,
  `FeedItem` union, `partitionRankedRows`, `feedIncludesEvents`, `mergeRankedFeedItems`
  (two-pointer merge; a score-less live-inserted post stays on top; post order never
  regresses — I4), `eventTimingLabel`, `distanceBucketLabel`.
- `EventFeedCard` reuses `computeCheckinButton` + `CheckinSheet` + `check_in` exactly
  as the Events panel; guests get the create-account prompt from the sheet.
- **Filter rules:** events appear ONLY in **ranked** mode under the **All** filter.
  **Recent mode shows posts only** (decision: the chronological keyset is over
  `posts.created_at`; events have no place in it — recommended and adopted).
  Following / My Posts / Announcements are author-scoped, so events are excluded.
- **Realtime unaffected:** events are not in the realtime publication; a post insert/
  update patches only the posts list, and the next feed refresh picks up event changes.
  Motion follows W1.5 (enter/exit + whileTap only; no `layout`).

## Invariants

| # | Invariant | Proof |
|---|-----------|-------|
| I1 | Posts rank byte-identically to `ranked_feed` (same id/score/bucket sequence for post rows) | prod rolled-back harness compares v1 vs v2 post rows |
| I2 | One event row per eligible event; correct status/horizon filtering; only what the caller could SELECT (anon vs member vs org admin vs platform admin); event score per ruling; bucket quantized; no distance oracle | harness across 4 roles + anti-oracle probe; smoke 29 |
| I3 | Cross-kind keyset paging — no duplicates or gaps | harness pages `p_limit=2` == single full call |
| I4 | Every ranked row renders once in rank order; events only under All; Recent posts-only; card check-in works; no regression to posts/filters/realtime/optimistic/W1.5 motion/P2.1b badges | `mergeRankedFeedItems` unit tests (post subsequence + drop-none) + reused Events-panel logic |
| I5 | `ranked_feed` v1 unchanged (prosrc md5 equal) | harness + smoke 29 assert md5 `2cca92d907df…` |

## Verification

Prod dry-run (single Management-API request, DO block seeding org/events/occurrences/
posts + users, RAISE → full rollback, net-zero writes) on 2026-09-24 (PG 17.6):
**17/17** checks — I5 (v1 md5 unchanged), I1 (post rows byte-identical to v1),
anti-oracle (A.score==B.score, `<2km`, geo/no-geo ratio == `exp(-1/decay)`),
one-row-per-event, event visibility for anon (active only) / member (+ in-progress
retired, not future-retired, not inactive-org) / org admin (+ own-org future retired,
not other org) / platform admin (+ inactive-org), and I3 cross-kind keyset paging ==
single call. tsc 0; eslint 0 errors on changed files; `event-feed.test.ts` 12/12
(incl. 2 mutation proofs: live-post-stays-on-top, id-DESC tiebreak). Smoke 29 is
ledger-gated on `20261008000000` (skips pre-deploy; asserts signature/grants/v1-present-
and-unchanged/live-call/events-anti-oracle once applied). Prod currently has 0
orgs/events, so the feed UI could not be browser-verified with live event data; it is
covered by the unit tests + the rolled-back role-scoped harness instead.
