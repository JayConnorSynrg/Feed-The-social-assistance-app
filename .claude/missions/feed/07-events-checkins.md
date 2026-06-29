# MISSION 7 — Events & Check-ins   | owner: feed-programs-expert | tier: P1
> One-line: a member browses upcoming assistance-event occurrences and checks in to one (recorded once per occurrence per user); an admin can view projected turnout.

## 1. Backend surface
- RPCs:
  - `projected_turnout(...)` — AI/forecast turnout estimate for an occurrence/event — SECDEF — `supabase/migrations/20260615100000_w6_forecast_ai.sql:8` (SECDEF at :22)
  - `is_org_admin(org_id)` — org-admin gate — used by check-in/admin SELECT policies
  - `is_org_member(org_id)` — org-membership gate
- Edge functions: none in the browse/check-in path (turnout RPC is SQL-side; any AI forecast model is invoked inside the SECDEF function, not a browser edge fn).
- Tables:
  - `organizations` / `organization_members` — org + membership for gating
  - `assistance_events` — the event definition (title, org, category)
  - `event_occurrences` — scheduled instances of an event (date/time window)
  - `event_checkins` — one check-in row; UNIQUE(occurrence_id, user_id) prevents double check-in; RLS yes — table `supabase/migrations/20260614140000_w4_checkin_capture.sql:8`, unique index `:20-21`, RLS ENABLE `:79`, policies `:81+` (select_own / select_admin / select_org_admin)

## 2. User-facing surfaces + interaction points
- `EventsPanel` (`apps/web/src/components/panels/events-panel.tsx`) — reached as a subtab of FeedPanel via PANEL_ALIASES `events → feed#events`. Interaction points: occurrences list, "Check in" button (opens sheet).
- `CheckinSheet` (`apps/web/src/components/panels/checkin-sheet.tsx`) — modal check-in confirm flow; submits the check-in.
- Admin `EventScheduler` tab in AdminShell — schedule events; surfaces `projected_turnout` per occurrence.

## 3. Backend→Surface binding map
- Events list load → `supabase.from('event_occurrences').select('*, event:assistance_events(...)')` (`apps/web/src/components/panels/events-panel.tsx:82-90`)
- "Check in" button → opens CheckinSheet with the selected occurrence (`events-panel.tsx:71-72`, `:265-268`)
- Confirm check-in → `supabase.from('event_checkins').insert({ occurrence_id, user_id, ... })` (`apps/web/src/components/panels/checkin-sheet.tsx:54-56`); `23505` handled as already-checked-in (`checkin-sheet.tsx:65`)
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
