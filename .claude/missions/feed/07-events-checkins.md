# MISSION 7 — Events & Check-ins   | owner: feed-programs-expert | tier: P1
> One-line: a member browses in-progress/upcoming assistance-event occurrences and checks in with a two-state flow — EARLY ("I'm coming") then CONFIRMED (presence) — recorded once per occurrence per user; org admins host events, run an organizer kiosk, and view attendance; an admin can view projected turnout. See `specs/fullfeed-w1-6-events-model.md` (W1.6a).

## 1. Backend surface
- RPCs (W1.6a — all check-in writes are SECDEF RPC-only; clients hold NO INSERT/UPDATE/DELETE on `event_checkins`):
  - `check_in(p_occurrence, p_household_size, p_anonymous)` — member's own early/confirmed/anonymous check-in — SECDEF — `20261007000000_w1_6a_events_hosting_checkin.sql`
  - `organizer_confirm(p_occurrence, p_user, p_household_size)` — org admin confirms an attendee or adds an anonymous household; attendee=`p_user`, confirmed_by/checked_in_by=organizer — SECDEF
  - `event_attendance(p_occurrence)` → jsonb — org-scoped per-event stats + attendees with org-scoped rate — SECDEF
  - `my_attendance_rate()` → jsonb — the caller's OWN overall rate (no user arg) — SECDEF
  - `admin_create_event(...)` / `admin_update_event(...)` — org-admin event create/edit with geocode-on-save (strong-match only) — SECDEF
  - `projected_turnout(...)` — AI/forecast turnout estimate — SECDEF — `supabase/migrations/20260615100000_w6_forecast_ai.sql:8` (SECDEF at :22)
  - `is_org_admin(org_id)` / `is_org_member(org_id)` — org gates
- Edge functions: none in the browse/check-in path.
- Tables:
  - `organizations` / `organization_members` — org + membership for gating
  - `assistance_events` — event definition; W1.6a adds `geocode_accuracy`/`geocode_confidence`, `location` written only from a strong match
  - `event_occurrences` — scheduled instances (date/time window, status)
  - `event_checkins` — one check-in row; W1.6a adds `status` (early|confirmed), `confirmed_at`, `confirmed_by`. UNIQUE(occurrence_id, user_id) WHERE user_id IS NOT NULL; RLS SELECT own/admin/org-admin; writes revoked (RPC-only) — `20260614140000_w4_checkin_capture.sql:8` + `20261007000000_w1_6a_events_hosting_checkin.sql`

## 2. User-facing surfaces + interaction points
- `EventsPanel` (`apps/web/src/components/panels/events-panel.tsx`) — reached as a subtab of FeedPanel via PANEL_ALIASES `events → feed#events`. Interaction points: occurrences list, "Check in" button (opens sheet).
- `CheckinSheet` (`apps/web/src/components/panels/checkin-sheet.tsx`) — modal check-in confirm flow; submits the check-in.
- Admin `EventScheduler` tab in AdminShell — schedule events; surfaces `projected_turnout` per occurrence.

## 3. Backend→Surface binding map
- Events list load → `supabase.from('event_occurrences').select('*, event:assistance_events(...)')` filtered `status='upcoming'` AND `ends_at >= now` (in-progress events stay listed) (`apps/web/src/components/panels/events-panel.tsx`); own check-in status loaded via `event_checkins` SELECT (own rows) to drive button state (`@/lib/event-checkin` computeCheckinButton)
- Check-in button (state per `computeCheckinButton`) → opens CheckinSheet with `confirmsPresence` → `supabase.rpc('check_in', { p_occurrence, p_household_size, p_anonymous })` (`apps/web/src/components/panels/checkin-sheet.tsx`); guests → `CreateAccountPrompt`
- Organizer kiosk → `supabase.rpc('event_attendance')` (list) + `supabase.rpc('organizer_confirm', { p_occurrence, p_user, p_household_size })` (`apps/web/src/app/(admin)/moderation/organizer-checkin-display.tsx`)
- Admin event create → `supabase.rpc('admin_create_event', {...geocode})`; attendance view → `supabase.rpc('event_attendance')` (`apps/web/src/app/(admin)/moderation/event-scheduler.tsx`)
- Member own rate → `supabase.rpc('my_attendance_rate')` (Settings → Profile, `settings-panel.tsx`)
- Admin turnout → `supabase.rpc('projected_turnout', {...})` (AdminShell EventScheduler tab)

## 4. Dependencies
- upstream (this feature needs): Mission 1 Auth (`auth.uid()` for `checkins_select_own` RLS); Mission 2 Profiles (org membership/admin gates resolve from profile/org tables); events seeded into `assistance_events` + `event_occurrences` (W3 timings migration `20260614130000_w3_events_timings.sql`).
- downstream (depend on this): Mission 18 Dashboard (`dashboard_event_stats`, `projected_turnout` consume check-in counts).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "from\('event_occurrences'\)|assistance_events" apps/web/src/components/panels/events-panel.tsx` → expected: occurrences SELECT joining assistance_events (:82-90)
- [ ] `grep -nE "from\('event_checkins'\)\s*\.insert|occurrence_id|23505" apps/web/src/components/panels/checkin-sheet.tsx` → expected: insert with `occurrence_id` (:54-56) + 23505 already-checked-in branch (:65)
- [ ] `grep -nE "UNIQUE INDEX.*event_checkins|occurrence_id, user_id" supabase/migrations/20260614140000_w4_checkin_capture.sql` → expected: unique index on (occurrence_id, user_id) at :20-21 (one check-in per occurrence per user)
- [ ] `grep -nE "ENABLE ROW LEVEL SECURITY|CREATE POLICY \"checkins_" supabase/migrations/20260614140000_w4_checkin_capture.sql` → expected: RLS enabled (:79) + select_own / select_admin / select_org_admin policies (:81+)
- [ ] `grep -nE "FUNCTION projected_turnout|SECURITY DEFINER" supabase/migrations/20260615100000_w6_forecast_ai.sql` → expected: function declared (:8) as SECDEF (:22)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Occurrences readable (prod SQL, read-only): `select id, starts_at from event_occurrences order by starts_at limit 5;` → expected: ≥1 upcoming occurrence row (panel has data to render).
- [ ] Double check-in guard (prod SQL): `insert into event_checkins(occurrence_id, user_id) values ($occ, $uid);` twice for the same test user/occurrence → expected: second insert raises `23505` (unique). Cleanup: `delete from event_checkins where occurrence_id=$occ and user_id=$uid;` (prod write, self-reversing — use a disposable test occurrence + test user).
- [ ] Turnout RPC (prod SQL): `select projected_turnout($occ);` → expected: a non-error numeric/JSON estimate (forecast path executes under SECDEF without anon priv-esc). Read-only.
- [ ] Check-in privacy (prod SQL): as a non-admin non-org-admin test user, `select * from event_checkins where user_id <> auth.uid();` → expected: 0 rows (checkins_select_own scopes visibility to own rows only).
- [ ] Playwright: no dedicated events/checkin E2E spec exists (`ls apps/web/e2e | grep -iE "event|checkin"` → none). RECOMMEND authoring `apps/web/e2e/events-checkin.spec.ts` covering list-render → check-in → 23505 idempotency; until then this mission's runtime proof rests on the SQL probes above.

## 6. PASS criteria + residuals
- PASS when: EventsPanel renders occurrences joined to assistance_events; CheckinSheet inserts into `event_checkins` keyed by `occurrence_id` and handles `23505`; the unique index prevents double check-in; RLS scopes check-in reads to owner/admin/org-admin; `projected_turnout` returns an estimate under SECDEF.
- Known residuals: NO Playwright E2E coverage for events/check-in (recommended spec named above) — the only runtime evidence today is SQL probes. Events are realtime-OFF (no live occurrence updates by design); browse requires a refresh after admin scheduling.
