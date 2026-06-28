# MISSION 19 — Admin Resource Discovery   | owner: feed-edge-functions-expert + feed-resources-expert | tier: P0
> One-line: an admin types a natural-language query, the platform sources + provenance-verifies candidate resources/forms, stages them as `status='pending'`, and the admin approves a tile to flip it live and onto the map — without ever disturbing the ~19,087 approved rows.

## 1. Backend surface
- Edge functions:
  - `resource-discover` — admin NL query → Firecrawl `/v2/agent` (Spark models, server-side; degrades to `/v2/search`) → provenance `verify()` → geocode (Mapbox precise → ZIP-centroid fallback) → STAGE rows `status='pending'` with `discovery_metadata` jsonb. Browser-direct invoke; deployed `--no-verify-jwt` with JWT verified in-code + `is_current_user_admin()` cost-gate before any provider call. Service-role client used ONLY after the admin gate passes. — `supabase/functions/resource-discover/index.ts` (auth gate `:505-533`, sourcing `:568-575`, resource staging `:589-660`, form staging `:663-700`, response `:702-712`).
- RPCs:
  - `admin_list_pending_resources()` — returns `status='pending'` rows ONLY, with `st_y/st_x(location::geometry) AS lat/lng` — SECDEF, `set search_path = public`, `where r.status='pending'` (never approved) — `supabase/migrations/20260627000100_admin_resources_phasec.sql:78-145` (REVOKE public/anon + GRANT authenticated at tail).
  - `approve_resource(p_resource_id uuid, p_reason text default null)` — flips `status pending → approved`, stamps `moderated_by/at` — SECDEF, `search_path=public` — `supabase/migrations/20260620000100_approve_reject_resource_rpc.sql:1-10`.
  - `reject_resource(p_resource_id uuid, p_reason text)` — flips `status → rejected` + `rejection_reason` (used for cleanup) — SECDEF — `…20260620000100…:12-21`.
  - `approve_form_template(p_id text)` — sets `is_active=true`, stamps `moderated_by/at` — SECDEF, `search_path=public` — `supabase/migrations/20260627000100_admin_resources_phasec.sql:18-48`.
  - `set_resource_location_by_id(p_id, p_lat, p_lng)` — edge fn sets PostGIS point post-insert — `index.ts:653`.
  - `find_duplicate_resource(p_name, p_phone, p_address, p_threshold)` — fuzzy dedup of approved rows (pending dedup done by direct name `ilike`) — `index.ts:isDuplicateResource`.
  - `is_current_user_admin()` — gate in the edge fn body (`index.ts:526`) AND the route layout.
- Tables:
  - `resources` — staged rows carry `status='pending'`, `source='admin_added'`, `submitted_by`, `discovery_metadata` jsonb (`source_url`, `confidence` high|medium, `corroborating_count`, `authoritative_domain`, `content_type` resource|link, `sources[]`) — RLS yes; pending rows not in the public map layer.
  - `form_templates` — staged forms `is_active=false`, `discovery_metadata.content_type='form'`, audit cols `moderated_by/at` (added in phasec migration) — RLS yes.
  - `zip_centroids` — geocode fallback lookup (`index.ts:geocodeByZip`).

## 2. User-facing surfaces + interaction points
- `AdminShell` (`apps/web/src/app/(admin)/moderation/admin-shell.tsx`) — "Resources" tab (`value="resources"`, `Database` icon) renders `<ResourcesTab>`.
- `ResourcesTab` (`apps/web/src/app/(admin)/moderation/resources-tab.tsx`) — interaction points: NL query `Input` + "Discover" button; content filter chips (All/Resource/Link/Form); per-tile Approve / Reject buttons; "Bulk approve high-confidence"; List/Map view toggle (Mapbox markers for geocoded tiles).

## 3. Backend→Surface binding map
- Discover button / Enter → `fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resource-discover`, { method:'POST', Bearer token, body:{ query } })` with `AbortController` + 35s timeout → `resources-tab.tsx:152-176` (abort treated as soft outcome `:204-208`).
- Pending queue load (mount + after discover) → `supabase.rpc('admin_list_pending_resources')` → `resources-tab.tsx:117`.
- Approve tile (resource/link) → `supabase.rpc('approve_resource', { p_resource_id: item.id, p_reason })` → `resources-tab.tsx:215-219`.
- Approve tile (form) → `supabase.rpc('approve_form_template', { p_id: item.id })` → `resources-tab.tsx:211-213`.
- Reject tile → `supabase.rpc('reject_resource', { p_resource_id, p_reason })` → `resources-tab.tsx:237-240`.
- Bulk approve → iterates `handleApprove` over `confidence==='high'` items → `resources-tab.tsx:294-301`.
- Map view → geocoded pending tiles → `<MapView>` + `<ResourceMarker>` via `toMarkerResource` → `resources-tab.tsx` map block.
- content_type stamp: edge fn sets `'resource'` when geocode resolves a point, else `'link'` (informational URL) → `index.ts:625-627`; forms stamped `'form'` → `index.ts:686`.

## 4. Dependencies
- upstream (this feature needs): admin route guard; edge-function secrets `FIRECRAWL_API_KEY` (required — 503 if absent, `index.ts:558`), `SUPABASE_SERVICE_ROLE_KEY`, optional `MAPBOX_TOKEN` (precise geocode; absent → ZIP-centroid); `zip_centroids` populated; resource/form enums current (`RESOURCE_CATEGORIES`/`FORM_TYPES` mirrors live enums, fetched 2026-06-26); `resource-discover` deployed `--no-verify-jwt`.
- downstream (depend on this): Resource Map (Mission 4) renders approved rows; Programs (Mission 11) reads approved program resources; Forms (Mission 10) lists activated `form_templates`.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "where r.status = 'pending'\|status = 'pending'" supabase/migrations/20260627000100_admin_resources_phasec.sql` → expected: `admin_list_pending_resources` filters pending ONLY (approved rows never returned).
- [ ] `grep -n "st_y(r.location::geometry)\|st_x(r.location::geometry)" supabase/migrations/20260627000100_admin_resources_phasec.sql` → expected: lat/lng derived from PostGIS for the map.
- [ ] `grep -n "is_current_user_admin\|user.is_anonymous\|--no-verify-jwt\|getUser(token)" "supabase/functions/resource-discover/index.ts"` → expected: in-code JWT verify + anon reject + admin gate BEFORE any Firecrawl call (`:519-533`).
- [ ] `grep -n "FIRECRAWL_API_KEY\|SUPABASE_SERVICE_ROLE_KEY\|MAPBOX_TOKEN" "supabase/functions/resource-discover/index.ts"` → expected: read from `Deno.env`; never serialized into a client response.
- [ ] `grep -n "status: 'pending'\|content_type: contentTypeStamp\|geo ? 'resource' : 'link'" "supabase/functions/resource-discover/index.ts"` → expected: staged rows always pending; content_type derived from geocode result (`:625-627`).
- [ ] `grep -n "rpc('admin_list_pending_resources')\|rpc('approve_resource'\|rpc('approve_form_template'\|rpc('reject_resource'\|AbortController\|35_000" "apps/web/src/app/(admin)/moderation/resources-tab.tsx"` → expected: all four RPC bindings + 35s AbortController present.
- [ ] `grep -n "security definer\|set search_path = public" supabase/migrations/20260620000100_approve_reject_resource_rpc.sql supabase/migrations/20260627000100_admin_resources_phasec.sql` → expected: SECDEF + pinned search_path on approve_resource / reject_resource / approve_form_template / admin_list_pending_resources.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] prod SQL — **SECDEF hardening** (the DoD gate) for all four RPCs: `select proname, prosecdef, proconfig from pg_proc where proname in ('admin_list_pending_resources','approve_resource','reject_resource','approve_form_template')` → expected: each `prosecdef=true` and `proconfig` contains `search_path=public`.
- [ ] prod SQL — **exec grants**: for each of the four, `has_function_privilege('anon', '<sig>', 'execute') = false` AND `has_function_privilege('authenticated', '<sig>', 'execute') = true`.
- [ ] prod SQL — **approved rows MUST NOT be disturbed / never returned**: `select count(*) from resources where status='approved'` → expected ≈ 19,087 (record exact baseline before any live test, re-check identical after). AND assert `admin_list_pending_resources()` returns `status='pending'` ONLY — run as admin: `select distinct status from admin_list_pending_resources()` → expected: `{pending}` (or empty), never `approved`.
- [ ] **Live end-to-end DoD smoke** (cost + prod-write — gate behind explicit go): from an authenticated admin browser session, type a query (e.g. "food banks in Burlington VT") → Discover → expected: response `{ staged:{resources,forms}, deduped, rejected, via }`, new `status='pending'` tiles appear with confidence/provenance chips. COST: small Firecrawl `/v2/agent` spend. CLEANUP MANDATORY: every row staged by the test must be removed via `reject_resource(p_resource_id, 'verification cleanup')` (sets `status='rejected'`, leaves the 19,087 approved untouched) — do NOT delete and do NOT approve test rows.
- [ ] edge-fn auth probe (no cost): invoke `resource-discover` with (a) no Bearer → expected 401; (b) anonymous/non-admin token → expected 403 BEFORE any provider call (`discover.forbidden` log); (c) missing `query` → 400.
- [ ] Approve→live verification: approve one genuine staged tile via `approve_resource` → expected `status='approved'`, `moderated_by`/`moderated_at` stamped, and the row enters the public map layer (Mission 4 viewport RPC). (If used only for verification, prefer reject-cleanup over approve to keep the approved baseline exact.)
- [ ] Playwright E2E — `apps/web/e2e/suggest-resource.spec.ts` + `apps/web/e2e/resource-linked-posts.spec.ts` → expected: resource staging/linking UI renders and binds without error.

## 6. PASS criteria + residuals
- PASS when: `admin_list_pending_resources`, `approve_resource`, `reject_resource`, `approve_form_template` are all `prosecdef=true` + `search_path=public` + anon-exec=false / auth-exec=true (5b probe 1-2); `admin_list_pending_resources()` returns `status='pending'` ONLY and the approved baseline (~19,087) is byte-identical before/after verification (5b probe 3); the edge fn rejects no-token/non-admin/empty-query (5b auth probe); ResourcesTab binds Discover→edge-fn and Approve/Reject→the correct RPC by `content_type` (5a confirmed); live DoD smoke stages pending tiles with provenance and the test rows are reject-cleaned.
- Known residuals: precise street-level geocoding requires the `MAPBOX_TOKEN` edge secret — when absent, candidates degrade to ZIP-centroid (or stamp `content_type='link'` with no point), so map placement accuracy is the single closeable gap (set `MAPBOX_TOKEN` to close it); Firecrawl `/v2/agent` availability depends on the plan (degrades to `/v2/search`, which only survives provenance when the host is authoritative .gov/.org — strict-by-design).
