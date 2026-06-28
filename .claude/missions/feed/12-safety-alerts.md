# MISSION 12 — Safety Alerts   | owner: feed-map-debugger | tier: P1
> One-line: any user places a PostGIS safety pin on the map, votes confirm/clear, sees viewport-bounded alerts refresh on pan/zoom — and the reporter's identity (created_by) NEVER reaches any client over REST, RPC, or the realtime WAL.

## 1. Backend surface
- RPCs (all in `supabase/migrations/`):
  - `place_safety_alert(type, severity, description, lat, lng)` — create pin (stamps `created_by = auth.uid()`) — SECDEF — `20260608000400_safety_alerts.sql:104,140`; REVOKE PUBLIC+anon, GRANT authenticated (`:151-153`)
  - `safety_alerts_in_view(xmin, ymin, xmax, ymax)` — viewport fetch; RETURNS TABLE computes `is_mine = (created_by = auth.uid())` server-side and does NOT return `created_by` (current form) — SECDEF — `20260619000200_safety_alert_is_mine.sql:12,18,53`; GRANT anon+authenticated+service_role (`:67-69`)
  - `vote_safety_alert(alert_id, vote)` — confirm/clear, returns the raw alert row — SECDEF — `20260608000400_safety_alerts.sql:221`; REVOKE PUBLIC (`:283`)
  - `update_safety_alert(alert_id, ...)` — owner-only edit, guarded `auth.uid() <> created_by` raises — SECDEF — `20260618000001_safety_alert_crud.sql:6,26`; REVOKE PUBLIC / GRANT authenticated (`:51-52`)
  - `delete_safety_alert(alert_id)` — owner-only delete, same guard — SECDEF — `20260618000001_safety_alert_crud.sql:57,72`; (`:80-81`)
  - `admin_verify_safety_alert(alert_id)` — staff-only ENDORSE (sets `verified`/`verified_by`/`verified_at`); guards anon + `is_staff` — SECDEF, `SET search_path` — `20260619000001_safety_alert_verify.sql:14-56`
  - `admin_remove_safety_alert(alert_id)` — staff-only remove — SECDEF — referenced `safety-alerts-review.tsx:114`
- Edge functions: none (all access via RPC)
- Tables:
  - `safety_alerts` — `location geography(Point,4326)`, `created_by uuid REFERENCES profiles(id) ON DELETE SET NULL`, `verified`, vote counts — RLS — `20260608000400_safety_alerts.sql:38`
    - **created_by privacy (load-bearing):** table-wide SELECT grant DROPPED, replaced by a column-scoped grant that OMITS `created_by` — `20260619000500_safety_alert_created_by_column_grant.sql` (REVOKE SELECT ON safety_alerts; GRANT SELECT (id, alert_type, severity, description, location, status, confirm_count, clear_count, expires_at, created_at, verified, verified_by, verified_at))
    - **realtime WAL privacy:** `safety_alerts` DROPPED from `supabase_realtime` publication so `created_by` never transits the WAL payload — `20260619000400_drop_safety_alerts_from_realtime.sql`
  - `safety_alert_votes` — per-user vote dedupe — `20260608000400_safety_alerts.sql`

## 2. User-facing surfaces + interaction points
- `MapPanel` — safety-alert markers overlaid on the resource map; interaction: place-alert FAB, tap marker → vote confirm/clear, owner edit/delete
- `safety-alert-marker.tsx` (`apps/web/src/components/map/safety-alert-marker.tsx`) — marker + popup
- Hook `use-safety-alerts.ts` (`apps/web/src/hooks/use-safety-alerts.ts`) — viewport fetch + 60s poll for stationary viewer; consumes `is_mine`
- Admin `SafetyAlertsReview` (`apps/web/src/app/(admin)/moderation/safety-alerts-review.tsx`) — verify/remove queue

## 3. Backend→Surface binding map
- Map viewport change (debounced) + 60s poll → `useSafetyAlerts` → `supabase.rpc('safety_alerts_in_view', { xmin, ymin, xmax, ymax })` (`apps/web/src/hooks/use-safety-alerts.ts:78`); maps `is_mine` (`:102`)
- Place-alert FAB → `supabase.rpc('place_safety_alert', { ... })` (`apps/web/src/hooks/use-safety-alerts.ts:165`)
- Vote confirm/clear → `supabase.rpc('vote_safety_alert', { alert_id, vote })`; preserves `is_mine` client-side from existing entry (`apps/web/src/hooks/use-safety-alerts.ts:201,214-225`)
- Owner edit → `supabase.rpc('update_safety_alert', { ... })` (`:248`); owner delete → `supabase.rpc('delete_safety_alert', { ... })` (`:275`)
- Admin verify → `supabase.rpc('admin_verify_safety_alert', { p_alert_id })` (`safety-alerts-review.tsx:93`); admin remove → `admin_remove_safety_alert` (`:114`)
- Admin queue load → `supabase.from('safety_alerts').select('id, alert_type, severity, description, confirm_count, clear_count, created_at, expires_at, verified')` — NOTE: select list does NOT include `created_by` (`safety-alerts-review.tsx:70-71`)

## 4. Dependencies
- upstream (this feature needs): Resource Map & Geo (Mission 4) for the Mapbox map + viewport bounds; PostGIS extension; Auth (Mission 1) for `auth.uid()` in SECDEF guards; staff flag (`profiles.is_staff`) for admin verify/remove
- downstream (depend on this): Content Moderation (Mission 17) — `SafetyAlertsReview` lives in the admin ModerationTab

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -rn "created_by" apps/web/src/hooks/use-safety-alerts.ts apps/web/src/app/\(admin\)/moderation/safety-alerts-review.tsx apps/web/src/components/panels/feed-panel.tsx` → expected: NO client SELECT of `created_by` (only `is_mine` consumed) — proves reporter anonymity on the client (`use-safety-alerts.ts:23-26`)
- [ ] `grep -n "created_by" supabase/migrations/20260619000500_safety_alert_created_by_column_grant.sql` → expected: `created_by` appears only in the explanatory comment and the REVOKE rationale — it is ABSENT from the `GRANT SELECT (...)` column list
- [ ] `read supabase/migrations/20260619000400_drop_safety_alerts_from_realtime.sql` → expected: `ALTER PUBLICATION supabase_realtime DROP TABLE public.safety_alerts` (created_by off the WAL)
- [ ] `grep -n "is_mine\|created_by = auth.uid" supabase/migrations/20260619000200_safety_alert_is_mine.sql` → expected: `is_mine` computed server-side, `created_by` not in RETURNS TABLE (`:53`)
- [ ] `grep -nE "SECURITY DEFINER|SET search_path|is_staff" supabase/migrations/20260619000001_safety_alert_verify.sql` → expected: admin verify is SECDEF, pins search_path, gates on `is_staff` (`:16-19` body guards)
- [ ] `grep -n "geography(Point,4326)\|ON DELETE SET NULL" supabase/migrations/20260608000400_safety_alerts.sql` → expected: PostGIS point + FK nullify on profile delete (`:38`)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] **Privacy probe — column grant (authoritative via pg_attribute.attacl):** read-only
      `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relname='safety_alerts' AND a.attname='created_by' AND has_column_privilege('authenticated','public.safety_alerts','created_by','SELECT');` → expected: ZERO rows (authenticated has NO SELECT on created_by). Repeat for `anon`.
- [ ] **Privacy probe — REST direct:** as an authenticated non-admin JWT, `GET /rest/v1/safety_alerts?select=created_by` → expected: error / column not selectable (created_by not in grant). And `select=*` → expected: response omits `created_by`.
- [ ] **Privacy probe — realtime:** `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='safety_alerts';` → expected: ZERO rows (table not published)
- [ ] **RPC probe:** `supabase.rpc('safety_alerts_in_view', { xmin, ymin, xmax, ymax })` over a populated viewport → expected: rows include `is_mine` boolean, NO `created_by` key in any returned object
- [ ] Playwright E2E: `apps/web/e2e/safety-pins.spec.ts` → expected: place pin → marker appears; vote updates counts; pan refetches; owner sees edit/delete (prod-write: inserts a `safety_alerts` row + vote for the test user — CLEANUP: `delete_safety_alert(alert_id)` as the owner after run)

## 6. PASS criteria + residuals
- PASS when: a placed pin renders as a PostGIS marker and persists; `safety_alerts_in_view` returns viewport-bounded rows with `is_mine` and never `created_by`; voting updates confirm/clear counts; owner-only edit/delete enforced server-side; staff-only verify/remove enforced; AND all three privacy probes (column grant via attacl = 0, REST omits created_by, table not in realtime publication) pass — reporter anonymity is the hard gate.
- Known residuals: stationary-viewer freshness relies on a 60s poll (no realtime, by design for privacy) — accept a ≤60s staleness window for a non-panning viewer; verify the poll interval in `use-safety-alerts.ts` matches the 60s noted in the WAL-drop migration comment.
