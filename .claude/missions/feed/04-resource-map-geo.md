# MISSION 4 — Resource Map & Geo   | owner: feed-map-debugger | tier: P0
> One-line: the Mapbox map renders, a debounced viewport change fires a PostGIS `resources_in_bounds` query that returns markers, safety-alert markers overlay the same map, and the canvas resizes correctly when its container (not the window) changes — proving the geospatial discovery surface works end-to-end.

## 1. Backend surface
- RPCs:
  - `resources_in_bounds(xmin, ymin, xmax, ymax)` — PostGIS viewport query — SECDEF — `supabase/migrations/20260610230000_geo_searchpath_expand_fix.sql` (multi-schema search_path MUST be unquoted list `TO public, extensions` per searchpath-quoting pattern)
  - `safety_alerts_in_view(xmin, ymin, xmax, ymax)` — viewport alert fetch; computes own-vs-other server-side (`auth.uid() = created_by`) so `created_by` is never exposed — SECDEF
  - `place_safety_alert(lat, lng, type, description)` / `vote_safety_alert` / `update_safety_alert` / `delete_safety_alert` — alert CRUD — SECDEF
  - `set_resource_location(resource_id, lat, lng)` — volunteer places own offer on map — SECDEF
- Tables:
  - `resources` — `location geography(Point,4326)`, status enum, `resource_source` enum — RLS yes — read via RPC viewport query
  - `safety_alerts` — `location geography(Point,4326)`, `created_by` column-scoped (not exposed to anon) — RLS yes
  - `zip_centroids`, `snap_retailers` — lookup / SNAP layer

## 2. User-facing surfaces + interaction points
- MapPanel (`apps/web/src/components/panels/map-panel.tsx`) — interaction points: pan/zoom (viewport change), marker click, cluster expand, volunteer "Place Here" FAB, safety-alert place FAB, flyTo on resource select (:489), profile city/state geocode for initial viewport (:405)
- Hook `apps/web/src/hooks/use-viewport-resources.ts` — interaction points: debounced bounds→RPC (debounceMs default 300, :76)
- Hook `apps/web/src/hooks/use-safety-alerts.ts` — interaction points: viewport alert fetch + place/vote/edit/delete

## 3. Backend→Surface binding map
- Viewport change (debounced 300ms) → `useViewportResources` → `supabase.rpc('resources_in_bounds', rpcParams)` — hook import `apps/web/src/components/panels/map-panel.tsx:32`; rpc call `apps/web/src/hooks/use-viewport-resources.ts:128` (debounce `:209`, deps `:216`)
- Viewport change → `useSafetyAlerts` → `supabase.rpc('safety_alerts_in_view', {...})` — hook import `map-panel.tsx:41`; rpc `apps/web/src/hooks/use-safety-alerts.ts:78`
- Place alert FAB → `supabase.rpc('place_safety_alert', {...})` — `use-safety-alerts.ts:165`; vote :201; update :248; delete :275
- Volunteer "Place Here" FAB → `supabase.rpc('set_resource_location', { resource_id, lat, lng })`
- Resource select → `map.flyTo` (animated, not setViewState) — `map-panel.tsx:489`
- Profile city/state → Mapbox geocode (cached) → initial viewState — `map-panel.tsx:405`

## 4. Dependencies
- upstream (this feature needs): Mission 1 authenticated session (RPCs are SECDEF/auth-aware); Mission 2 profile city/state + `get_my_coordinates` for initial viewport centering; `NEXT_PUBLIC_MAPBOX_TOKEN`; PostGIS + the `geography` columns + GIST indexes; `resources_in_bounds` search_path including `extensions` schema
- downstream (depend on this): Safety Alerts (M12, shares the map layer), Volunteer Resources (M13, amber markers), SNAP layer (M21)

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "rpc('resources_in_bounds'\|debounceMs\|getBounds\|deps" apps/web/src/hooks/use-viewport-resources.ts` → expected: rpc call (:128), debounce wired (:209), default debounceMs 300 (:76), effect deps include bounds (:216)
- [ ] `grep -n "useViewportResources\|useSafetyAlerts\|flyTo\|geocode" apps/web/src/components/panels/map-panel.tsx` → expected: both hooks imported (:32, :41), flyTo on select (:489), profile geocode for initial viewport (:405)
- [ ] `grep -n "safety_alerts_in_view\|created_by\|place_safety_alert" apps/web/src/hooks/use-safety-alerts.ts` → expected: viewport rpc (:78), comment confirming created_by computed server-side (:23), place rpc (:165)
- [ ] `grep -rn "resources_in_bounds" supabase/migrations` → expected: SECDEF defn with search_path `TO public, extensions` (unquoted multi-schema list)
- [ ] `grep -rn "ResizeObserver\|\.resize()" apps/web/src/components/panels/map-panel.tsx apps/web/src/components/map` → expected: a ResizeObserver→rAF→map.resize() path exists somewhere in the map render tree (Mapbox container-resize fix, PR#134). If absent in panel, trace the Mapbox wrapper component — container-resize freeze is the known failure mode.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Reuse Mission 1 authenticated-session fixture, then `npx playwright test apps/web/e2e/geo-foundation.spec.ts apps/web/e2e/safety-pins.spec.ts` → expected: map renders, markers appear after viewport settle, safety pins overlay, no canvas freeze on container resize
- [ ] Prod SQL — confirm SECDEF + correct multi-schema search_path on the geo RPCs: `SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname IN ('resources_in_bounds','safety_alerts_in_view','place_safety_alert','set_resource_location');` → expected: `prosecdef=true` AND `proconfig` shows `search_path=public, extensions` (NOT single-quoted/empty — quoted form → empty path → 42P01)
- [ ] Prod SQL — exercise the viewport query directly over a real bounding box (CONUS): `SELECT count(*) FROM resources_in_bounds(-125, 24, -66, 50);` → expected: a non-negative count, no `42P01 relation does not exist` (proves search_path resolves PostGIS funcs). Read-only, no cleanup.
- [ ] Prod SQL — confirm `created_by` is NOT returned by the alerts viewport fn: inspect `pg_get_function_result('safety_alerts_in_view(...)'::regprocedure)` → expected: RETURNS TABLE omits `created_by` (only a derived is-own boolean)
- [ ] Place-alert round trip (Playwright, authed) → place a test safety alert via FAB → expected: appears on map → then delete it via `delete_safety_alert`. (Prod write to `safety_alerts`; cleanup: the delete RPC removes the test row.)

## 6. PASS criteria + residuals
- PASS when: MapPanel renders Mapbox; a debounced viewport change calls `resources_in_bounds` and markers render; `safety_alerts_in_view` overlays alert markers without leaking `created_by`; container resize triggers `map.resize()` (no frozen canvas); geo RPCs are SECDEF with `search_path=public, extensions`; `resources_in_bounds(...)` over a real bbox returns a count with no 42P01; geo-foundation + safety-pins specs green.
- Known residuals: Capacitor mobile gesture/geolocation handling is device-only — not covered by the Playwright web run; flag for on-device verification. SNAP/volunteer marker layers share this map but are owned by Missions 21/13.
