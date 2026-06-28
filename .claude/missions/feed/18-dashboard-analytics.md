# MISSION 18 — Dashboard / Analytics   | owner: feed-data-flow-analyzer | tier: P1
> One-line: an admin opening the Overview tab sees live platform metrics (adoption, resources, petitions, events, people-fed, profile completion) rendered from six parallel SECDEF RPCs, with the AI narrative summary loading non-blocking.

## 1. Backend surface
- RPCs (all SECDEF, admin-gated; authored in `supabase/migrations/20260614150000_w5_dashboard_rpcs.sql`, fixed across the 20260617xxx / 20260618xxx / 20260619xxx wave):
  - `dashboard_adoption_stats()` — total/guest/seekers/providers/facilitators + new_users_30d/7d — fix `…20260618100000_fix_adoption_stats_split_anonymous.sql`.
  - `dashboard_resource_stats()` — per-category resource_count/active_count — fix `…20260617110000_fix_dashboard_resource_stats_category.sql`.
  - `dashboard_petition_momentum()` — totals + active + top petition — fix `…20260617120000_fix_dashboard_petition_momentum.sql`.
  - `dashboard_event_stats()` — orgs/active_events/upcoming_30d/checkins_30d/people_fed_30d — fix `…20260617100000_fix_dashboard_rpc_is_active.sql`.
  - `community_people_fed(p_start_date, p_end_date)` — opt-in completions w/ small-N suppression flag.
  - `dashboard_completed_profiles()` — profile completion rate — `…20260619000700_dashboard_completed_profiles_rpc.sql`.
  - `admin_list_users()` — paginated user list w/ metadata — `…20260619000002_admin_list_users.sql`.
  - `projected_turnout(p_org_id, p_date)` — per-org Saturday attendance forecast (Events scheduler).
  - admin notes: `admin_get_user_notes(p_user_id)`, `admin_add_user_note(...)`, `admin_delete_user_note(p_note_id)`.
- Edge functions: none on the read path. AI narrative summary is a Next.js API route, not an edge fn (see §3).
- Tables (read-only aggregates by the RPCs): `profiles`, `resources`, `petitions`/`petition_signatures`, `assistance_events`/`event_occurrences`/`event_checkins`, `resource_opt_ins`, `admin_user_notes`.

## 2. User-facing surfaces + interaction points
- `AdminShell` (`apps/web/src/app/(admin)/moderation/admin-shell.tsx`) — "Overview" tab (`value="overview"`) renders `<OverviewTab>`; org `<select>` (`handleOrgChange`) scopes org-specific cards.
- `OverviewTab` (`apps/web/src/app/(admin)/moderation/overview-tab.tsx`) — metric cards, recharts `BarChart`, users `Table` w/ per-row dropdown (ban/delete), AI summary section. Interaction points: org selector, user row actions (ban/delete), AI summary auto-fetch.
- `EventScheduler` (`apps/web/src/app/(admin)/moderation/event-scheduler.tsx`) — uses `projected_turnout`.

## 3. Backend→Surface binding map
- Overview mount → six metrics in one `Promise.all([...])` → `overview-tab.tsx:349-362`:
  - `rpc('dashboard_adoption_stats')` `:350`
  - `rpc('dashboard_resource_stats')` `:351`
  - `rpc('dashboard_petition_momentum')` `:352`
  - `rpc('dashboard_event_stats')` `:353`
  - `rpc('community_people_fed', { p_start_date, p_end_date })` `:354`
  - `rpc('dashboard_completed_profiles')` `:361` + `rpc('admin_list_users')` `:362`
- Per-org turnout forecast → `Promise.all(orgs.map(... supabase.rpc('projected_turnout', { p_org_id, p_date: satDate }) ...))` → `overview-tab.tsx:406-408`.
- AI narrative summary (non-blocking, separate `useEffect`, PR#143) → `fetch('/api/community-summary', ...)` → `overview-tab.tsx:442-465`; route at `apps/web/src/app/api/community-summary/route.ts`. Decoupled from the metric render path (`cancelled` guard at `:459`).
- User row ban → `fetch('/api/admin/users/${id}/ban')` `:244`; delete → `fetch('/api/admin/users/${id}/delete', {method:'DELETE'})` `:270`.
- User notes → `rpc('admin_get_user_notes')` `:293`, `rpc('admin_add_user_note')` `:304`, `rpc('admin_delete_user_note')` `:321`.

## 4. Dependencies
- upstream (this feature needs): admin route guard (Mission 17 §`is_current_user_admin`); populated `resources`/`petitions`/`events`/`opt_ins`/`profiles`; OpenRouter key for the AI summary route; data from external sync (Mission 21) for resource_stats to be non-empty.
- downstream (depend on this): operator decision-making only; no other feature reads these aggregates.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "Promise.all\|rpc('dashboard_\|community_people_fed\|dashboard_completed_profiles" "apps/web/src/app/(admin)/moderation/overview-tab.tsx"` → expected: a single `Promise.all` batching all six metric RPCs (lines 349-362) — no N+1 sequential awaits.
- [ ] `grep -n "fetchAiSummary\|/api/community-summary\|cancelled" "apps/web/src/app/(admin)/moderation/overview-tab.tsx"` → expected: AI summary lives in its own `useEffect` (`:442/:465`) with a `cancelled` guard (`:459`) — proves non-blocking decouple (PR#143).
- [ ] `grep -rln "dashboard_adoption_stats\|dashboard_resource_stats\|dashboard_petition_momentum\|dashboard_event_stats\|community_people_fed\|dashboard_completed_profiles" supabase/migrations/` → expected: base authoring file `20260614150000_w5_dashboard_rpcs.sql` + the 20260617/18/19 fix migrations present.
- [ ] `grep -n "security definer\|is_current_user_admin" supabase/migrations/20260614150000_w5_dashboard_rpcs.sql` → expected: SECDEF + admin gate in each RPC body.
- [ ] read `apps/web/src/app/api/community-summary/route.ts` → expected: OpenRouter call with `AbortSignal.timeout(...)` and admin check (server-side), key never sent to client.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] prod SQL — hardening for all six: `select proname, prosecdef, proconfig from pg_proc where proname in ('dashboard_adoption_stats','dashboard_resource_stats','dashboard_petition_momentum','dashboard_event_stats','community_people_fed','dashboard_completed_profiles')` → expected: each `prosecdef=true`, `proconfig` has `search_path=public`.
- [ ] prod SQL — anon locked out: `select has_function_privilege('anon','dashboard_adoption_stats()','execute')` → expected `false`; `'authenticated'` → `true`.
- [ ] prod SQL — contract smoke (read-only): `select * from dashboard_resource_stats()` (run as admin via service key) → expected: returns rows with `category, resource_count, active_count` matching the OverviewTab `ResourceStat` type — guards the W5 RPC contract gap (six cascading bugs in PRs #121-126).
- [ ] Playwright E2E — `apps/web/e2e/admin-tab-restyle.spec.ts` → expected: Overview tab renders metric cards + chart without error.
- [ ] HTTP probe — `GET /api/community-summary` as admin session → expected: 200 with a `summary` string; as non-admin → 401/403; latency does not block initial metric render.

## 6. PASS criteria + residuals
- PASS when: all six metric RPCs are SECDEF + `search_path=public` + anon-exec=false; OverviewTab fetches them in one `Promise.all` (5a confirmed); the AI summary is in a separate non-blocking `useEffect` with a `cancelled` guard; `dashboard_resource_stats()` returns the typed shape (5b contract smoke); `admin-tab-restyle.spec.ts` passes.
- Known residuals: `community_people_fed` applies small-N suppression (`suppressed` flag) so low-traffic windows show suppressed rather than exact counts — expected privacy behavior, not a failure; AI summary depends on a live OpenRouter key (degrades gracefully — metrics render regardless).
