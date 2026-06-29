# MISSION 21 — External Sync (211 / HUD / IMLS / SNAP)   | owner: feed-resources-expert | tier: P2
> One-line: scheduled edge functions pull public benefit/resource datasets (211, HUD housing counselors, IMLS libraries, USDA SNAP retailers) into `resources` / `snap_retailers`, set their PostGIS locations, and stamp a `source` so the Map and Programs surfaces can display them — without disturbing the ~19,087 already-approved rows.

## 1. Backend surface
- Edge functions (Deno; cron / admin-secret triggered):
  - `sync-211` — 211 API → `resources` upsert, taxonomy→category map, `source: '211_api'`, `status:'approved'` — `supabase/functions/sync-211/index.ts:150` (`transformLocation`), `:261` (upsert `onConflict:'external_id,source'`), `:300` (`sync_logs` insert, best-effort)
  - `hud-sync` — HUD Housing Counselor ArcGIS → `resources`, `source:'hud'`, category `housing` — `supabase/functions/hud-sync/index.ts:31` (config), `:88` (`serve(createSyncHandler(hudConfig))`)
  - `imls-sync` — IMLS public-library dataset → `resources`, `source:'imls'` (`as any` cast), `external_id: imls_<fscsKey>_<fscsSeq>` — `supabase/functions/imls-sync/index.ts:114-115`, `:153` (upsert)
  - `snap-retailer-sync` — USDA SNAP retailer ArcGIS FeatureServer → **`snap_retailers`** (separate table, not `resources`), national or per-state — `supabase/functions/snap-retailer-sync/index.ts:27` (ArcGIS URL), `:229` (`from('snap_retailers')`)
- Shared pipeline (HUD + IMLS run through it; 211 + SNAP are standalone): `supabase/functions/_shared/resource-pipeline.ts`
  - `createSyncHandler(config)` (`:290`) — OPTIONS/405/auth gate → `syncSource`
  - `authorizeRequest` (`:128`) — accepts `x-sync-secret == RESOURCE_SYNC_SECRET` (constant-time) OR `Authorization: Bearer <SERVICE_ROLE_KEY>`; **fails closed** (`:136-138`)
  - `syncSource` (`:187`) — 4 phases: fetch → transform → chunked upsert `onConflict:'external_id,source'` (`:224`) → Phase-4 `rpc('set_resource_location', {p_external_id, p_source, p_lat, p_lng})` (`:249`) from pipeline-only `_lat/_lng`
  - `constantTimeEqual` (`:115`) — null-safe XOR compare for the secret
- RPCs: `set_resource_location(p_external_id, p_source, p_lat, p_lng)` — SECDEF, writes `resources.location geography` keyed by `(external_id, source)` — called from pipeline `:249`
- Tables: `resources` (free-text `source` column; unique index `resources_external_id_source_uniq (external_id, source)` — migration `20260526000001:15`), `snap_retailers` (PostGIS `location`, separate proximity table), `sync_logs` (optional, best-effort), `resource_source` enum (extended values: `osm/snap/hrsa/hud/headstart/cdc/samhsa` in `20260526000001`, `imls` in `20260527000003`)

## 2. User-facing surfaces + interaction points
- `MapPanel` (`apps/web/src/components/panels/map-panel.tsx`) — SNAP retailer markers (distinct layer from `resources`), org markers for 211/HUD/IMLS rows
- `ProgramsPanel` (`apps/web/src/components/panels/programs-panel.tsx`) via `use-program-browser.ts` — lists synced `resources` filtered by source/category
- Admin `(admin)` ResourcesTab — sync status visible indirectly via pending/active counts; SNAP sync triggered by admin secret

## 3. Backend→Surface binding map
- 211 cron/admin → `sync-211` → upsert `resources` `source:'211_api'` (sync-211/index.ts:261)
- HUD cron/admin (`x-sync-secret` or Bearer service-role) → `hud-sync` → `syncSource` → upsert `resources` `source:'hud'` → `set_resource_location` (resource-pipeline.ts:224,249)
- IMLS cron/admin → `imls-sync` → upsert `resources` `source:'imls'` (imls-sync/index.ts:153)
- SNAP cron/admin → `snap-retailer-sync` → upsert `snap_retailers` (snap-retailer-sync/index.ts:229)
- Map SNAP layer → `supabase.from('snap_retailers').select(...)` within viewport
- Programs list → `use-program-browser.ts` → `supabase.from('resources').select(...).in('source', [...])` — **NOTE the value mismatch in §6**

## 4. Dependencies
- upstream (this feature needs): secrets `API_211_KEY` (+ optional `API_211_BASE_URL`), `RESOURCE_SYNC_SECRET` (HUD/IMLS shared pipeline), `SNAP_SYNC_SECRET` (SNAP), `SUPABASE_SERVICE_ROLE_KEY`; external API availability (211, `data.hud.gov`, IMLS dataset, `services2.arcgis.com`); `resource_source` enum values applied; `set_resource_location` RPC; `resources_external_id_source_uniq` index
- downstream (depend on this): Resource Map (Mission 4), Programs browser (Mission 11), Saved Resources (Mission 14) — all read the rows these syncs write

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "authorizeRequest\|constantTimeEqual\|Fail closed" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/_shared/resource-pipeline.ts"` → expected: secret-or-service-role gate, constant-time compare, fail-closed default (`:128-138`)
- [ ] `grep -n "onConflict" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/_shared/resource-pipeline.ts" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/sync-211/index.ts"` → expected: every upsert uses `onConflict:'external_id,source'` (pipeline `:224`, sync-211 `:264`) — so re-runs UPDATE matching rows, never duplicate the 19k approved rows
- [ ] `grep -n "source:" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/sync-211/index.ts" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/hud-sync/index.ts" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/imls-sync/index.ts"` → expected: `'211_api'`, `'hud'`, `'imls'` respectively — capture exact strings to cross-check Programs/Map filters
- [ ] `grep -n "from('snap_retailers')\|from('resources')" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/snap-retailer-sync/index.ts"` → expected: SNAP writes ONLY `snap_retailers`, never `resources`
- [ ] `grep -n "set_resource_location\|_lat\|_lng" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/functions/_shared/resource-pipeline.ts"` → expected: Phase-4 RPC call (`:249`) keyed by `(p_external_id, p_source)`; `_lat/_lng` stripped before upsert (`:221`)
- [ ] `grep -rn "ADD VALUE IF NOT EXISTS" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/migrations/20260526000001_extend_resource_source_enum.sql" "/Users/jelalconnor/CODING/CURSOR/FEED./supabase/migrations/20260527000003_add_resource_sources.sql"` → expected: `snap/hud/...` (`20260526000001`) and `imls` (`20260527000003`) — confirm enum supports the labels (the `resources.source` column is free-text so this gates only enum-typed callers)
- [ ] Cross-check: read `use-program-browser.ts` filter values against the exact `source:` strings from sync fns → expected: filter list uses the SAME literals the syncs write (`'211_api'` not `'211'`) — see §6 residual

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / supabase logs
- [ ] Prod SQL (read-only baseline — capture BEFORE any trigger): `SELECT source, count(*) FROM resources GROUP BY source ORDER BY 2 DESC;` and `SELECT count(*) FROM resources WHERE status='approved';` → expected: ~19,087 approved rows; record per-source counts (e.g. `211_api`, `hud`, `imls`) so a later sync can be proven non-destructive by re-comparing
- [ ] Prod SQL: `SELECT count(*) FROM snap_retailers;` and `SELECT count(*) FROM snap_retailers WHERE location IS NOT NULL;` → expected: location populated for the bulk of rows (proves Phase-4 geocoding worked)
- [ ] Cron config: `SELECT jobname, schedule, command FROM cron.job WHERE command ILIKE '%sync-211%' OR command ILIKE '%hud-sync%' OR command ILIKE '%imls-sync%' OR command ILIKE '%snap-retailer-sync%';` → expected: a schedule per source, OR explicitly absent — record which syncs are cron-scheduled vs manual-only
- [ ] Last-run via logs: `get_logs` for each of `sync-211 / hud-sync / imls-sync / snap-retailer-sync` → expected: most recent invocation completed `success:true` (or `207` partial) with a sane `upserted` count and no recurring `[upsert-error]` lines; structured `complete` log present (resource-pipeline.ts:275)
- [ ] Auth gate probe (no write): POST to a pipeline sync (e.g. `hud-sync`) with NO `x-sync-secret` and NO Bearer → expected: `401 Unauthorized` (resource-pipeline.ts:306) — proves fail-closed without touching data
- [ ] **Non-destructive guard for any live trigger**: if a real sync is invoked, run the §5b baseline `GROUP BY source` query immediately AFTER and assert approved-row count is `>=` baseline and only the triggered source's bucket changed (upsert UPDATEs, never deletes). Treat any drop in approved count or in an untouched source bucket as FAIL. Prefer per-state SNAP (`?state=XX`) over national for a bounded blast radius. No cleanup needed for idempotent upserts.

## 6. PASS criteria + residuals
- PASS when: (5a) all four syncs upsert on `(external_id, source)` (idempotent, no-duplicate), SNAP isolated to `snap_retailers`, pipeline auth fails closed, enum labels present, Phase-4 location wiring intact; AND (5b) baseline ~19,087 approved rows confirmed, `snap_retailers` locations populated, each sync's last run succeeded with no recurring upsert errors, unauthenticated probe returns `401`, and any live trigger leaves the approved-row count `>=` baseline with only the triggered source bucket changed.
- Known residuals:
  - **Source-label drift to verify**: `sync-211` writes `source:'211_api'` (sync-211/index.ts:154) while the inventory's Programs query references `'211'`. If `use-program-browser.ts` filters on `'211'`, 211-sourced rows silently never render in Programs. The 5a cross-check + 5b `GROUP BY source` confirm the live label; reconcile filter↔writer if they diverge.
  - `imls-sync` casts `source: 'imls' as any` (imls-sync/index.ts:115) — relies on the free-text `resources.source` column; enum value exists (`20260527000003`) but the cast bypasses type-checking.
  - `sync_logs` insert is best-effort (`.catch(() => {})`, sync-211/index.ts:305) — absence of a `sync_logs` row is NOT evidence a sync failed; use `get_logs` as the authoritative last-run signal.
  - External API availability is an upstream dependency outside this repo — a 0-row fetch may be an empty/blocked external API, not a code fault; distinguish via the `fetch` phase log.
