# MISSION 13 — Volunteer Resources   | owner: feed-volunteer-expert | tier: P1
> One-line: a provider-role user opens the FAB speed-dial, picks one of the volunteer categories, registers an offer that becomes an active resource at their profile location (amber map marker), and can withdraw it again.

## 1. Backend surface
- RPCs:
  - `set_resource_location_by_id(p_id uuid, p_lat float8, p_lng float8)` — stamps `resources.location geography(Point,4326)` from caller-supplied coords after insert — SECDEF — `supabase/migrations/` (called from `use-volunteer-resource.ts:96`).
  - (read path) `resources_in_bounds(xmin,ymin,xmax,ymax)` — viewport fetch that returns volunteer rows for the map layer — SECDEF.
- Edge functions: none — volunteer create/withdraw is a direct client table mutation, not an edge call.
- Tables:
  - `resources` — volunteer offers stored with `is_volunteer_resource = true` + `submitted_by = auth.uid()` + `source = 'user_submitted'` + `status='approved'` — RLS yes (row-scoped insert/update by `submitted_by`); realtime via viewport RPC (not channel) — anchor: insert at `apps/web/src/hooks/use-volunteer-resource.ts:74-90`.
  - NOTE: inventory said `resource_source='volunteer'`; the LIVE contract is the boolean column `is_volunteer_resource` + `submitted_by`. Trust the code.

## 2. User-facing surfaces + interaction points
- `VolunteerResourceFab` (`apps/web/src/components/volunteer/volunteer-resource-fab.tsx`) — interaction points: FAB toggle button, category speed-dial chips, description/contact/directions/availability inputs, "Add" submit, success card. Role gate at `:87` (`isProvider = ['providing','facilitator','both'].includes(profile?.user_role)`).
- `MapPanel` (`apps/web/src/components/panels/map-panel.tsx`) — renders amber volunteer markers vs blue org markers; hosts the FAB.

## 3. Backend→Surface binding map
- FAB category chip click → `handleCategoryClick` sets selectedCategory (`volunteer-resource-fab.tsx:90`)
- "Add" submit → `registerResource(formData)` → `supabase.from('resources').insert({ is_volunteer_resource:true, submitted_by:user.id, category, status:'approved', ... })` (`use-volunteer-resource.ts:74-90`)
- post-insert location stamp → `supabase.rpc('set_resource_location_by_id', { p_id, p_lat: profile.latitude, p_lng: profile.longitude })` (`use-volunteer-resource.ts:96-100`) — gated on `profile.latitude && profile.longitude`
- "Withdraw" → `withdrawResource(id)` → `supabase.from('resources').update({ status:'archived' }).eq('id',id).eq('submitted_by',user.id)` (`use-volunteer-resource.ts:117-122`)
- my-offers list → `supabase.from('resources').select(...).eq('submitted_by',user.id).eq('is_volunteer_resource',true).neq('status','archived')` (`use-volunteer-resource.ts:41-47`)
- map amber layer → `resources_in_bounds` returns volunteer rows → rendered by `MapPanel`

## 4. Dependencies
- upstream (this feature needs): authenticated user with `profile.user_role ∈ {providing,facilitator,both}`; `profile.latitude/longitude` populated (else offer registers without a map location — `hasLocation` flag at `:139`); `set_resource_location_by_id` RPC deployed; PostGIS.
- downstream (depend on this): Mission 4 Resource Map (amber markers), Mission 6 Messages (seekers message volunteer offers), Mission 16 Notifications (`notify_seekers_near_resource` fires on new resource).

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "is_volunteer_resource|submitted_by" apps/web/src/hooks/use-volunteer-resource.ts` → expected: insert at :86-87 sets both; fetch filters at :44-45.
- [ ] `grep -n "set_resource_location_by_id" apps/web/src/hooks/use-volunteer-resource.ts` → expected: RPC call at :96 guarded by `profile?.latitude && profile?.longitude`.
- [ ] `grep -nE "providing|facilitator|both" apps/web/src/components/volunteer/volunteer-resource-fab.tsx` → expected: role gate at :87.
- [ ] `grep -nE "finally" apps/web/src/hooks/use-volunteer-resource.ts` → expected: BOTH `registerResource` (:108) AND `withdrawResource` (:127) reset their loading flags in `finally` (regression guard — historical bug was a missing finally on withdraw; confirm it is present).
- [ ] `grep -n "status: 'archived'" apps/web/src/hooks/use-volunteer-resource.ts` → expected: withdraw sets archived (soft-delete, not hard delete) at :119.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL (read-only, MCP `execute_sql`): `select count(*) filter (where status='approved') approved, count(*) filter (where status='archived') archived, count(*) filter (where location is not null) located from public.resources where is_volunteer_resource;` → expected: located ≈ approved (offers carry a geography point); archived rows exist if any withdrawals.
- [ ] Prod SQL: verify RLS column contract — `select has_table_privilege('authenticated','public.resources','INSERT');` → expected: true (insert allowed; row scoping enforced by policy on `submitted_by`).
- [ ] Playwright E2E: no dedicated volunteer spec ships today — closest live coverage is the map/geo path. Drive a manual probe via `apps/web/e2e/geo-foundation.spec.ts` (resource location plumbing) OR author `apps/web/e2e/volunteer-fab.spec.ts` driving: sign in as a `providing` user → open FAB → register a category offer → assert success card → assert amber marker → withdraw. PROD-WRITE: creates a `resources` row; CLEANUP: call `withdrawResource` (sets archived) then admin-API hard-delete the test row by `submitted_by=<test uid>`.

## 6. PASS criteria + residuals
- PASS when: a provider-role user registers an offer that lands in `resources` with `is_volunteer_resource=true`, `submitted_by=auth.uid()`, `status='approved'`, and a non-null `location`; the offer appears as an amber marker in viewport; withdraw flips it to `archived` and removes it from the user's active list; both mutation hooks reset loading state in `finally`.
- Known residuals: no dedicated `volunteer-fab.spec.ts` E2E (covered only indirectly via geo specs) — author one to reach 100%. Offers registered before `profile.latitude/longitude` exist will lack a map location (silent — `hasLocation=false` is surfaced in UI but the insert still succeeds).
