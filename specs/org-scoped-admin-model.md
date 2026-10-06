# Org-Scoped Admin + Org Events — Empirical System Model

Objective (user's words): "we need to make an orgnization version of the admin page that you can
click on the organization in the regualr admin and it will take you to an almost identical admin
but it will only be for that organization, and it will allow you to create events and those events
will show on the community feed."

Baseline: `origin/develop` @ `d561777` (worktree `feature/feed-org-scoped-admin-events`).
Prod: `ndtpovonpadugthmcntl`, read 2026-10-06 17:36 UTC as `supabase_read_only_user`
(`rolbypassrls = true`, so every count below is unfiltered by RLS).

Every claim carries a `file:line`, a live catalog query, or a prod count. All 22 live function
bodies cited here were compared whitespace-normalised against `supabase/migrations/*.sql` and each
one appears verbatim in the migration cited (no drift). `ranked_feed_v2` was diffed byte-for-byte
against `W16B:58-235`: identical.

### Path legend

| Short | Path |
|---|---|
| `W2` | `supabase/migrations/20260614120000_w2_org_foundation.sql` |
| `RLS914` | `supabase/migrations/20260914120000_rls_scope_admin_policies_to_authenticated.sql` |
| `SPINE` | `supabase/migrations/20260928000000_ranked_feed_schema_spine.sql` |
| `W16A` | `supabase/migrations/20261007000000_w1_6a_events_hosting_checkin.sql` |
| `W16B` | `supabase/migrations/20261008000000_w1_6b_events_in_feed.sql` |
| `P30` | `supabase/migrations/20261009000000_p3_0_moderation_guards.sql` |
| `P31` | `supabase/migrations/20261010000000_p3_1_admin_tiers.sql` |
| `P4A` | `supabase/migrations/20261012000000_p4a_local_business.sql` |
| `SAVE` | `supabase/migrations/20261017000000_org_admin_save.sql` |
| `PHOTO` | `supabase/migrations/20261018000000_org_photos_and_guest_block.sql` |
| `MOD/` | `apps/web/src/app/(admin)/moderation/` |
| `SRC/` | `apps/web/src/` |
| `SMOKE/` | `apps/web/src/__tests__/smoke/` |

---

## 1. Entities and their rows

### 1.1 Tables (live `information_schema.columns`, `pg_constraint`, `pg_indexes`)

| Table | Columns that matter | Constraints | Indexes |
|---|---|---|---|
| `organizations` | `id` uuid PK · `name` NN · `org_type` NN default `'food_bank'` · `is_active` NN default true · `status` NN default `'approved'` · `submitted_by` uuid FK auth.users SET NULL · `created_by` FK SET NULL · `location` geography · `address/city/state/zip_code` · `moderated_by/moderated_at/rejection_reason` · `resource_id` UNIQUE FK · business-only: `business_category, cost_model, service_radius_miles, attributes, social_links`. **No** geocode_accuracy column, **no** timezone column. | `org_type IN (food_bank, pantry, shelter, clinic, mutual_aid, other, business, community, nonprofit, government)`; `status IN (pending, approved, rejected)`; `cost_model` NULL or free/sliding_scale/paid | pkey; `idx_organizations_is_active`; GIST `idx_organizations_location`; `idx_organizations_created_by`; unique `resource_id` |
| `organization_members` | `id` PK · `org_id` NN FK organizations **CASCADE** · `user_id` NN FK auth.users CASCADE · `role` NN default `'member'` · `invited_by` FK SET NULL · `joined_at` | `role IN ('admin','member')`; UNIQUE `(org_id, user_id)` | `idx_org_members_org_id`, `_user_id`, `_org_user`, unique `(org_id,user_id)` |
| `assistance_events` | `id` PK · `org_id` NN FK organizations **CASCADE** · `title` NN · `description` · `event_type` NN default `'distribution'` · `location_name, address, city, state, zip_code` · `location` geography · `rrule` text · `default_capacity` · `requires_registration` NN false · `is_active` NN true · `created_by` FK SET NULL · `geocode_accuracy`, `geocode_confidence` (added `W16A:217-219`) | `event_type IN (distribution, meal, pantry, clinic, other)` | `idx_assistance_events_active (is_active, org_id)`, `_org_id`, GIST `_location` |
| `event_occurrences` | `id` PK · `event_id` NN FK assistance_events **CASCADE** · `starts_at` NN · `ends_at` NN · `capacity` · `notes` · `status` NN default `'upcoming'` · `rrule_dtstart` | `status IN (upcoming, cancelled, completed)`. **No** `ends_at > starts_at` CHECK. **No** UNIQUE `(event_id, starts_at)` | `_event_id`, `_starts_at`, partial `(status, starts_at) WHERE status='upcoming'` |
| `event_checkins` (check-in rows) | `id` · `occurrence_id` NN FK CASCADE · `user_id` FK SET NULL · `household_size` NN 1 · `status` NN `'confirmed'` · `is_anonymous` NN false · `checked_in_by`, `confirmed_by` FK SET NULL · `confirmed_at` | `household_size 1..20`; `status IN (early, confirmed)` (`W16A:206-211`) | partial UNIQUE `(occurrence_id,user_id) WHERE user_id IS NOT NULL`; `(occurrence_id, status)`; others |
| `event_anonymous_claims` | `(occurrence_id, user_id)` PK, both FK CASCADE | RLS on, **no policies**, `REVOKE ALL` from anon/authenticated/PUBLIC (`W16A:230-240`) | pkey |
| `admin_actions` | `id` bigint · `created_at` · `actor_id` · `actor_tier` admin_tier (nullable) · `action` NN · `target_type` NN · `target_id` · `target_tier` · `outcome` NN · `reason` · `details` jsonb NN `{}` · `request_id` | `outcome IN (ok, denied, error)` | `created_at DESC`; `(target_type, target_id)` |
| `app_logs` | `id` · `created_at` · `level` NN · `event` NN · `context` jsonb · `request_id` · `duration_ms` · `user_id` | pkey only | `created_at DESC`; `(event, created_at DESC)` |
| `ranking_config` | `singleton_guard` PK bool · `half_life_hours` NN default 24 · `distance_decay_km` NN 20 · `comment_weight` NN 2 · `updated_at` | `CHECK (singleton_guard)` | pkey |

Live repo-wide probe: `information_schema.columns WHERE column_name ~* 'time_?zone|^tz$|_tz$|idempot'` → **0 rows** (no timezone and no idempotency column anywhere in `public`).

### 1.2 Grants and RLS flags (live `pg_class.relacl`, `pg_attribute.attacl`)

| Table | RLS | anon | authenticated | service_role | Column ACLs |
|---|---|---|---|---|---|
| organizations | on | `arwdDxtm` | `arwdDxtm` | `arwdDxtm` | none |
| organization_members | on | `arwdDxtm` | `arwdDxtm` | `arwdDxtm` | none |
| assistance_events | on | `rxtm` | `rxtm` (writes revoked `W16A:1218`) | `arwdDxtm` | none |
| event_occurrences | on | **`arwdDxtm`** | **`arwdDxtm`** | `arwdDxtm` | none |
| event_checkins | on | `rxtm` | `rxtm` (writes revoked `W16A:256`) | `arwdDxtm` | none |
| event_anonymous_claims | on | — | — | `arwdDxtm` | none |
| admin_actions | on | — | `r` | `rxtm` (append-only, `P31:166-168`) | none |
| app_logs | on | — | — (`REVOKE ALL` in `20260603140000_lockdown_security_table_grants.sql:12`) | `arwdDxtm` | none |
| ranking_config | on | `rm` | `rm` (`SPINE:214-223`) | `arwdDxtm` | none |

### 1.3 Roles of a user relative to an org

| Signal | Source | Notes |
|---|---|---|
| Platform admin | `profiles.is_admin`, derived from `admin_tier = 'platform_admin'` by trigger (`P31:34-57`) | Live: 2 profiles, both `platform_admin` + `is_admin=true` |
| Tier (CM/RA/PA) | `profiles.admin_tier` via `current_user_tier()` (`P31:105`) | |
| Org admin | `organization_members.role = 'admin'` | Live: **0** member rows |
| Business owner | `organizations.submitted_by = auth.uid()` (business rows) | Live: the one business row has `submitted_by NULL` |

---

## 2. Writers (every path that creates or changes each row)

### 2.1 SECURITY DEFINER RPCs (owner `postgres`, all `search_path=public, pg_temp` unless noted)

| RPC | Defined | EXECUTE | Gate (first check) | Writes |
|---|---|---|---|---|
| `admin_save_organization(uuid, jsonb)` | `SAVE:56-481` (search_path also `extensions`) | authenticated | `IF NOT is_current_user_admin() → 42501 'org_save_denied: platform admin only'` (`SAVE:117-119`) | INSERT or UPDATE organizations (`SAVE:372-419`; lock `FOR UPDATE` `:135-136`; UPDATE never writes created_by/submitted_by/is_active/status/moderated_* `:396-414`); type switch business↔non-business rejected (`:159-162`); business-only keys rejected on non-business (`:196-202`); replace `business_hours` (`:421-426`), `business_photos` (`:428-441`, returns own-folder `removed_photo_paths` `:429-434`), `org_resources` (`:442-447`), `business_services` (business only `:449-454`); exactly one `record_admin_action('org.create'|'org.update'|'business.*', …, request_id())` (`:463-471`) |
| `admin_set_org_active(uuid, bool)` | `SAVE:486-523` | authenticated | platform admin only (`:497`) | UPDATE organizations.is_active (`:506-511`) → fires cascade trigger; audit `org.deactivate`/`org.reactivate` (`:513-520`) |
| `admin_create_event(16 args)` | `W16A:852-917` | authenticated (not anon) | `is_current_user_admin() OR is_org_admin(p_org_id)`; org must be active (P0001); title required (22004); `w1_6a_validate_geo` | INSERT assistance_events only — **no occurrence**, **no audit row**, **no idempotency**, stores `rrule`, stores `location` from caller lat/lng when tier ∈ rooftop/parcel/point |
| `admin_update_event(19 args)` | `W16A:928-1041` | authenticated | event exists (P0002); platform admin OR `is_org_admin(org)`; non-platform needs active org | UPDATE assistance_events (COALESCE/`p_clear` semantics, `rrule`, `is_active`); when `p_is_active=false` UPDATE event_occurrences SET cancelled WHERE `starts_at > now()`. **No audit row** |
| `check_in(uuid,int,bool)` | `W16A:348-504` | authenticated | signed in, non-guest; org active (`:395-397`); retired event blocks only before start (`:401-403`) | INSERT event_checkins / event_anonymous_claims |
| `organizer_confirm(uuid,uuid,int)` | `W16A:510-612` | authenticated | platform admin OR `is_org_admin(org)` (`W16A:542-543`) | INSERT/UPDATE event_checkins |
| `record_admin_action(8 args)` | `P31:177` | **postgres + service_role only** (live ACL) | caps request_id/reason | INSERT admin_actions (`actor_tier := tier_of(actor)`) |
| `approve_business`, `reject_business` | `P4A` | authenticated | tier-gated | UPDATE organizations (business moderation) + audit |

Live writer scan (`pg_proc.prosrc ~* '(insert into|update|delete from) <table>'`):
`assistance_events` ← admin_create_event, admin_update_event · `event_occurrences` ← admin_update_event, organizations_cascade_deactivate · `event_checkins` ← check_in, organizer_confirm · `organizations` ← admin_save_organization, admin_set_org_active, approve_business, reject_business · `admin_actions` ← record_admin_action · `app_logs` ← log_engagement_failure. `rrule` is referenced only by admin_create_event and admin_update_event (nothing expands it). `ranking_config` is read by ranked_feed / ranked_feed_v2 only; no writer RPC. Cron: `cron.job WHERE command ~* 'event|occurrence|organization|ranking'` → 0 rows. Nothing ever sets `status='completed'`.

### 2.2 Triggers (live `pg_trigger`)

| Table | Trigger | Timing | Function | Effect |
|---|---|---|---|---|
| organizations | `trg_organizations_cascade_deactivate` | AFTER UPDATE OF is_active | `organizations_cascade_deactivate()` SECDEF (`W16A:1581-1606`) | true→false cancels the org's occurrences with `status NOT IN (cancelled,completed) AND ends_at > now()` (in-progress included) |
| organizations | `trg_organizations_guard_org_admin` | BEFORE UPDATE | `guard_organizations_org_admin_update()` INVOKER (`P30:196-219`) | Returns early unless `current_user IN (authenticated, anon)` (so it is a no-op inside any SECDEF RPC); platform admin passes; blocks inactive-org edits and changes to `is_active, created_by, id, created_at`. **Does not** check `org_type`, `submitted_by`, `status`, `moderated_*` |
| organizations | `trg_organizations_guard_business_insert` | BEFORE INSERT | `P4A:55` | business-submission field guard |
| organizations / events / occurrences | `trg_*_updated_at` | BEFORE UPDATE | updated_at stamp | — |
| event_occurrences | `trg_event_occurrences_guard_checkin_bounds` | BEFORE UPDATE | SECDEF `W16A:1320-1403` | Skips when `auth.uid() IS NULL`. Always refuses cancelling an ended/completed occurrence. With any check-in/claim: refuses time change, event reassignment, leaving cancelled/completed, completing before start |
| event_occurrences | `trg_event_occurrences_guard_delete` | BEFORE DELETE | SECDEF `W16A:1415-1437` | Refuses delete when check-ins/claims exist |
| event_checkins | `trg_event_checkins_force_checked_in_by` (BEFORE) · `trg_engagement_event_checkin` (AFTER INSERT/UPDATE) | | `P20`/`W16A:271,312-337` | stamps checker; engagement credit |

No INSERT trigger exists on `assistance_events` or `event_occurrences`.

### 2.3 RLS policies by command (live `pg_policies`; defining migration)

**organizations**

| Policy | Cmd | Roles | USING | WITH CHECK | Defined |
|---|---|---|---|---|---|
| `orgs_select_active` | SELECT | public | `is_active AND (org_type<>'business' OR status='approved')` | — | `W2:119`, altered `P4A:128-129` |
| `orgs_admin_select` | SELECT | authenticated | `is_current_user_admin()` | — | `RLS914:282` |
| `orgs_select_own_submission` | SELECT | authenticated | `submitted_by = auth.uid()` | — | `P4A:118` |
| `orgs_admin_insert` | INSERT | authenticated | — | `is_current_user_admin()` | `RLS914:285` |
| `orgs_business_insert` | INSERT | authenticated | — | `org_type='business'` | `P4A:108` |
| `orgs_admin_update` | UPDATE | authenticated | `is_current_user_admin()` | same | `RLS914:288` |
| **`orgs_update_org_admin`** | UPDATE | **public** | `is_org_admin(id)` | `is_org_admin(id)` | `W2:128-131` |
| `orgs_admin_delete` | DELETE | authenticated | `is_current_user_admin()` | — | `RLS914:292` |
| `organizations_block_anon_{insert,update,delete}` | RESTRICTIVE | authenticated | `jwt.is_anonymous IS NOT TRUE` | same | `PHOTO:90-99` |

Consequence (live): an org admin's direct PostgREST UPDATE passes `orgs_update_org_admin` + table grant `arwdDxtm` + the guard, which does not block `org_type → 'business'` or `submitted_by = self`. `submitted_by = self` then satisfies `business_*_owner_all` policies and `can_manage_org_photos`'s business-submitter branch. Dormant today: 0 `organization_members` rows.

**organization_members**

| Policy | Cmd | USING / CHECK | Defined |
|---|---|---|---|
| `org_members_select_own_or_org` | SELECT | `user_id = auth.uid() OR is_org_member(org_id)` | `RLS914:262` |
| `org_members_select_platform_admin` | SELECT | `is_current_user_admin()` | `W16A:1252-1255` |
| `org_members_{insert,update,delete}_platform_admin` | I/U/D | `is_current_user_admin()` | `W16A:1234-1245` |

**assistance_events** (no write policies; writes revoked `W16A:1213-1218`)

| Policy | Cmd | Roles | USING | Defined |
|---|---|---|---|---|
| `events_select_active` | SELECT | public | `is_active AND org.is_active` | `W16A:1446-1451` |
| `events_admin_select` | SELECT | authenticated | `is_current_user_admin()` | `RLS914:41` |
| `events_select_reachable_authed` | SELECT | authenticated | `w1_6a_event_authed_reachable(id)` = org active AND (`is_org_admin(org)` OR non-guest with an in-progress occurrence) | `W16A:1487-1529` |

**event_occurrences**

| Policy | Cmd | USING | WITH CHECK | Defined |
|---|---|---|---|---|
| `occurrences_select_active_event` | SELECT (public) | `ae.is_active AND o.is_active` | — | `W16A:1453-1458` |
| `occurrences_admin_select` | SELECT | `is_current_user_admin()` | — | `RLS914:104` |
| `occurrences_org_admin_select` | SELECT | `is_org_admin(ae.org_id)` (no active check) | — | `RLS914:119` |
| `occurrences_select_reachable_authed` | SELECT | `w1_6a_occ_authed_reachable(id)` | — | `W16A:1532` |
| `occurrences_admin_insert` | INSERT | — | `is_current_user_admin()` | `RLS914:107` |
| `occurrences_org_admin_insert` | INSERT | — | `is_org_admin(ae.org_id) AND o.is_active` (**no** `ae.is_active` check) | `W16A:1541-1546` |
| `occurrences_admin_update` | UPDATE | `is_current_user_admin()` | same | `RLS914:110` |
| `occurrences_org_admin_update` | UPDATE | `is_org_admin AND o.is_active` | same | `W16A:1548-1557` |
| `occurrences_admin_delete` | DELETE | `is_current_user_admin()` | — | `RLS914:114` |
| `occurrences_org_admin_delete` | DELETE | `is_org_admin(ae.org_id)` | — | `RLS914:137` |

No repo test outside migrations names any of these six write policies or `orgs_update_org_admin` (`git grep` → only spec prose).

**event_checkins**: SELECT `checkins_select_own` (`user_id = auth.uid()`), `checkins_select_admin`, `checkins_select_org_admin`; RESTRICTIVE `event_checkins_block_anon_insert`; no permissive write policy; writes revoked (`W16A:248-256`).
**admin_actions**: `admin_actions_select_pa` SELECT authenticated USING `is_current_user_admin()` (`P31:169`). Org admins read nothing.
**ranking_config**: `ranking_config_select_all` SELECT anon+authenticated USING true (`SPINE:208-212`).
**app_logs**: RLS on, no policies; service_role only.
**Child tables** (`business_hours`, `business_photos`, `business_services`): `*_admin_all` (platform), `*_owner_all` (`o.submitted_by = auth.uid()`), `*_public_select` (active, non-business or approved), RESTRICTIVE guest blocks. `org_resources`: `org_resources_admin_all`, `org_resources_public_select`, guest blocks — no owner/org-admin policy.

### 2.4 Client-side direct writes (`git grep -A4 "from('<table>')" | grep insert|update|delete|upsert`)

| Table | Site | Operation | Wrapper / log |
|---|---|---|---|
| organization_members | `MOD/orgs-section.tsx:351-356` | INSERT `{org_id,user_id,role,invited_by}` | none; error shown inline |
| organization_members | `MOD/orgs-section.tsx:372` | DELETE `.eq('id').select('id')` | 0-row check `:377-379` |
| organization_members | `MOD/orgs-section.tsx:389-393` | UPDATE role | 0-row check `:398-400` |
| event_occurrences | `MOD/event-scheduler.tsx:352-355` | UPDATE `status='cancelled'` | `logger.error('admin.occurrence.cancel_failed')` / `logger.info('admin.occurrence.cancelled')` |
| event_occurrences | `MOD/event-scheduler.tsx:380-389` | INSERT `{event_id, starts_at: new Date(datetime-local).toISOString(), ends_at, status:'upcoming'}` | `logger.info('admin.occurrence.created')` `:396-400` |
| organizations (business) | `SRC/lib/business-data.ts:365-374` | INSERT `org_type:'business'` | `withMetric('business.submit')` |
| organizations (business) | `SRC/lib/business-data.ts:596-600`, `:626-635` | UPDATE is_active / descriptive fields | `withMetric('business.admin.*')` |
| app_logs | `SRC/app/api/client-log/route.ts:144`, `SRC/lib/logger.ts:104` | INSERT (service role) | sanitized by registry |

No client write exists to assistance_events, event_checkins, admin_actions or ranking_config.

### 2.5 Edge function: `post-image-upload` → `can_manage_org_photos`

| Step | Evidence |
|---|---|
| Caller JWT asks `rpc('can_manage_org_photos', {p_folder: org_id})` | `supabase/functions/post-image-upload/index.ts:117-123` |
| Only an error-free literal `true` grants | `post-image-upload/target.ts:70-72`; tests `target.test.ts:96-105` |
| service_role writes `org-photos/<org_id>/<uuid>.<ext>` | `index.ts:155-172`; `target.ts:50-52` |
| `can_manage_org_photos(text)` (`PHOTO:41-70`, STABLE SECDEF, authenticated only) | false for no uid, guest, non-UUID; true for platform admin (any UUID); else true only when `org_type='business' AND submitted_by = auth.uid()` (no is_active check). **Org admins: false** |
| storage.objects policies | `org_photos_manager_select`, `org_photos_manager_delete` (authenticated, `bucket='org-photos' AND can_manage_org_photos(foldername[1])`); no INSERT/UPDATE policy; bucket public, 5 MB |
| Client cleanup | `SRC/lib/org-photo-upload.ts:88` `deleteOrgPhotos` → `storage.remove` under user JWT |

---

## 3. Access predicates

| Predicate | Definition (live) | Defined | EXECUTE |
|---|---|---|---|
| `is_current_user_admin()` | `COALESCE((SELECT is_admin FROM profiles WHERE id=auth.uid()), false)`; STABLE SECDEF | `20260603120000_pii_hardening_expand.sql:150` | authenticated, service_role (anon: **false**, live `has_function_privilege`) |
| `is_org_admin(uuid)` | uid NULL → false; EXISTS member row `role='admin'`. **No org is_active check.** VOLATILE plpgsql | `W2:73` | authenticated (anon: false) |
| `is_org_admin_any()` | EXISTS member `role='admin'` JOIN org `is_active`. STABLE | `W16A:1266-1275` | authenticated |
| `is_org_member(uuid)` | EXISTS member row (any role) | `W2:95` | authenticated |
| `get_admin_org_list()` | platform admin (`profiles.is_admin`) → all active non-business orgs; else orgs where caller `role='admin'`, active, non-business; ordered by name | `P4A:234` | authenticated |
| `current_user_tier()` / `tier_of(uuid)` | `profiles.admin_tier` | `P31:105`, `P31:122` | tier_of: postgres+service_role only |
| `SRC/lib/admin-tier.ts` | `tierRank`/`tierAtLeast` (`:25-44`); `canCreateOrganizations(tier) = tier==='platform_admin'` (`:107-109`) | | |
| `MOD/admin-shell-tabs.ts:29-47` | `visibleTabs`: overview/community/organizations/settings = PA; events = PA OR orgAdmin; moderation ≥ CM; resources/businesses/manage/people ≥ RA | | |
| `(admin)/layout.tsx:9-32` | `getUser()` else `/login`; `current_user_tier()` non-null OR `is_org_admin_any()` true, else redirect `/` | | |
| `(admin)/federation/layout.tsx:19-22` | nested tightening: `is_current_user_admin()` else redirect `/moderation` | | |
| `SRC/hooks/use-is-org-admin.ts` | client `rpc('is_org_admin_any')`; logs `logger.warn('org_admin.check.failed')` | | |
| `SRC/proxy.ts` | `/moderation` is not in `publicRoutes` (`:134-150`) → unauthenticated request redirects to `/login?redirectTo=` (`:206-210`). MFA list `['/', '/onboarding', '/settings']` with `pathname.startsWith(route)` (`:113-114`) matches every path because `'/'` prefixes all | | |

---

## 4. Admin UI map (`/moderation`)

### 4.1 Route and shell

| Piece | Evidence |
|---|---|
| Page | `MOD/page.tsx:1-5` renders `<AdminShell/>` only |
| `selectedOrgId` | `useState('all')` `MOD/admin-shell.tsx:53`; set only by the header `<select>` (`:204-219`, options = `useAdminOrgs()` = `get_admin_org_list`); change logs `logger.info('admin.shell.org_switch')` (`:189-192`). Not in the URL |
| Tabs | `visibleTabs(tier, isOrgAdmin)` `:51`; fallback to first entitled tab `:56`; header label `tierLabel(tier) ?? 'Organizer'` `:59` |
| URL params | `?tab=organizations` and `?org=new|<uuid>` only (`MOD/org-panel-url.ts:13-24`); read once on mount `:134-140`; popstate `:144-164`. `?org` opens the **org setup panel**, it does not set `selectedOrgId`. No other `?tab` value is read |
| Setup panel owner | `<OrgFormPanel>` rendered once, gated `canManageOrgs` (`:355-371`); `handleOrgSaved` sets notice, bumps `orgListKey`, closes (`:175-182`) |
| Settings tab | `PlaceholderTab label="Settings"` → "Settings — coming soon" (`:35-41`, `:347-351`) |

### 4.2 Which tabs honour an org id

| Tab | Receives | Behaviour | Evidence |
|---|---|---|---|
| Events | `selectedOrgId` | **Scoped**: `.eq('org_id', id)` or `.in('org_id', adminOrgs)` for `'all'` | `MOD/event-scheduler.tsx:182-189` |
| Overview | `selectedOrgId` | **Not scoped.** Stats effect has `[]` deps and runs platform-wide RPCs (`MOD/overview-tab.tsx:395-505`, `Promise.all` `:418-431`). The id is only sent to `/api/community-summary` (`:507-536`), whose handler reads `body.groups` only (`SRC/app/api/community-summary/route.ts:25-31`) and is platform-admin-gated (`:22-23`) | |
| Moderation | `selectedOrgId` | ignored: `void selectedOrgId` | `MOD/moderation-tab.tsx:17-18` |
| Community | `selectedOrgId` | logged only (`logger.info('admin.community.tab.viewed')`) | `MOD/community-tab.tsx:7-10` |
| Organizations, Resources, Businesses, Manage, People, Settings | nothing | platform-wide | `MOD/admin-shell.tsx:316-351` |

### 4.3 Organizations tab — `MOD/orgs-section.tsx`

| Element | Evidence |
|---|---|
| List source | `fetchAdminOrgList` = `organizations` SELECT `.in('org_type', NON_BUSINESS_ORG_TYPES)` ordered by name, active + inactive (`SRC/lib/org-data.ts:233-248`); RLS `orgs_admin_select` |
| Row name | plain `<p>` text, **not a link or button** (`:190`) |
| Edit | `onEdit(org.id)` → shell `openOrgPanel(id)` (`:204-211`) |
| Members | toggles inline `OrgMembers` expansion (`:212-222`, `:268-272`) |
| More menu | Deactivate/Reactivate → confirm dialog → `adminSetOrgActive` (privilegedRpc) truthful optimistic toggle (`:106-123`, `:251-253`, `:280-312`); View public page `/s/organization/<id>` active only (`:254-262`) |
| `OrgMembers` | **not exported** (`:321-494`); reads `organization_members (id,user_id,role,joined_at)` ignoring errors (`:331-339`); add by raw User UUID + role (`:345-367`, `:411-429`); role change and remove (`:369-405`); renders `user_id` UUIDs, English only (`:408-492`) |

### 4.4 Setup panel — `SRC/components/org-form/org-form-panel.tsx`

| Load / action | Evidence |
|---|---|
| Edit prefill | `fetchAdminOrgDetail` (`org-data.ts:298-337`): org by id `.in(NON_BUSINESS…)`, hours, photos, `org_resources→resources` |
| Duplicate-name index | `fetchOrgNameIndex` (`org-data.ts:348-363`) reads `id,name,org_type,status` of every org the caller can SELECT; called on every panel mount (`org-form-panel.tsx:500-509`); "Edit existing" only when `onEditExisting` given (`:752-758`) |
| Org types offered | `NON_BUSINESS_ORG_TYPES` (`:771`) |
| Save | `adminSaveOrganization` → `privilegedRpc('admin.org.save','admin_save_organization')` (`SRC/lib/org-admin-rpc.ts:98-123`); photos via `uploadOrgPhoto` (edge fn), cleanup via `deleteOrgPhotos` (`org-form-panel.tsx:626-628`) |
| Location | no Mapbox geocoding: `/api/geocode` → US Census (`SRC/app/api/geocode/route.ts:6-27`), pin on `OrgPinMap` (`:65`, `:907`) |
| Logging | `logEvent('admin.org.panel.close')` (`:179`), `admin.org.duplicate_warning` (`:512`, `:636`, `:757`) |

### 4.5 Events tab — `MOD/event-scheduler.tsx` (1149 lines)

| Flow | Evidence |
|---|---|
| Load | `assistance_events` + nested `organizations(name)` + `event_occurrences(...)`, **no `is_active` filter**, no limit (`:169-194`); errors ignored (`:191-193`) |
| Create (`handleCreateEvent`) | `:269-336`. Form: title, type, location name, address/city/state/zip, org select only when `'all'` (`:851-865`), `RecurrencePicker` (`:867-870`). **No date/time and no description field.** Geocode: Mapbox v6 `resolveGeoPointV6(…, NEXT_PUBLIC_MAPBOX_TOKEN)` (`:281`; `SRC/lib/mapbox-geocode-v6.ts:91-95`); lat/lng/accuracy passed to `supabase.rpc('admin_create_event')` (`:285-299`) which stores `location`. Direct `supabase.rpc` — not `privilegedRpc`, so no `x-request-id` |
| Occurrence add | separate modal, `datetime-local` inputs (`:926`, `:935`) → `new Date(value).toISOString()` = browser time zone (`:384-385`) → direct INSERT (`:380-389`) |
| Cancel | `confirm()` → direct UPDATE status cancelled (`:350-363`) |
| Edit | `(supabase.rpc as any)('admin_update_event', …)` re-geocodes via Mapbox on address change (`:411-478`, `:424`, `:439-454`) |
| Retire | `admin_update_event({p_is_active:false})` (`:480-508`) |
| Kiosk / attendance | `OrganizerCheckinDisplay` (`:1067`); `event_attendance` RPC (`:365-373`) |
| Event type maps | duplicated: `EVENT_TYPE_COLORS` at `MOD/event-scheduler.tsx:69`, `components/feed/event-feed-card.tsx:27`, `components/panels/events-panel.tsx:34`; `EVENT_TYPE_LABELS` at `event-feed-card.tsx:35`, `events-panel.tsx:42` |

`MOD/recurrence-picker.tsx` (122 lines) builds an RRULE string; its only consumer is `event-scheduler.tsx:20,869`. Nothing reads `rrule` to produce occurrences (§2.1 live scan).

### 4.6 Other surfaces

| Surface | Evidence |
|---|---|
| Settings admin entry | `SRC/components/panels/settings-panel.tsx:1261-1265` shows it for any tier or `is_org_admin_any`; `AdminSection` links to `/moderation` ("Open Organizer Tools" for no-tier) (`:792-834`) |
| `organizer-checkin-display.tsx` time | `toLocaleString('en-US', {weekday, month, day, hour, minute})` / `toLocaleTimeString` with no `timeZone` → viewer's zone, no zone label (`MOD/organizer-checkin-display.tsx:124-127`) |
| Public org page | `SRC/app/(social)/s/organization/[id]/page.tsx:173-180` (`await params`, `notFound()` on missing/inactive/business) — the existing `params: Promise<…>` pattern (`:27`) under Next `16.2.6` (`apps/web/package.json:48`) |

---

## 5. Feed path for events

### 5.1 `ranked_feed_v2` (`W16B:45-243`; live body identical; SECDEF STABLE sql; EXECUTE anon, authenticated, service_role)

| Part | Rule | Lines |
|---|---|---|
| Config | `half_life_hours, distance_decay_km, comment_weight` from `ranking_config LIMIT 1` (shared by posts and events) | `:58-62` |
| Posts branch | byte-identical to `ranked_feed` v1 | `:73-141` |
| Event eligibility | `eo.status='upcoming' AND eo.ends_at >= now() AND eo.starts_at <= now() + 30 days` | `:161-163` |
| Visibility OR | (a) `is_current_user_admin()` · (b) `is_org_admin(ae.org_id)` · (c) `ae.is_active AND org.is_active` · (d) `auth.uid() IS NOT NULL AND w1_6a_occ_authed_reachable(eo.id)` | `:164-171` |
| One row per event | `DISTINCT ON (event_id) ORDER BY starts_at, occ_id` → earliest eligible (in-progress wins) | `:173-182` |
| Score | `exp(-ln2 · |now − starts_at|_h / half_life_hours) · distance bucket factor`; engagement = 1; never pinned | `:183-202` |
| Row id | occurrence id, `kind='event'`; keyset `(score, id) DESC` | `:203-235` |

Who sees what today:

| Viewer | Event shown when |
|---|---|
| anon, guest, plain member | (c) event active AND org active — plus, for any authenticated non-guest, (d) an **in-progress** occurrence of a **retired** event on an active org |
| org admin | (b) any own-org event regardless of event/org active (`is_org_admin` has no active check) |
| platform admin | (a) every event, any state |

Retired-but-visible upcoming rows can exist: retire cancels only `starts_at > now()` (`W16A` admin_update_event), and `occurrences_org_admin_insert` / `occurrences_admin_insert` accept a new upcoming occurrence on a retired event.

Score arithmetic at the live `half_life_hours = 24`: an occurrence 7 days out scores `2^-7 = 0.0078`; at 168 h it would score `0.5`.

`ranking_config` live row: `half_life_hours 24, distance_decay_km 20, comment_weight 2, updated_at 2026-09-19 21:46:04`.

### 5.2 Client

| Step | Evidence |
|---|---|
| Fetch | `supabase.rpc('ranked_feed_v2', {p_lat,p_lng,p_limit,p_cursor_*})` inside `withMetric('feed.load')` (`SRC/components/panels/feed-panel.tsx:1819-1832`); `logger.info('feed.rank')` console only (`:1837`) |
| Split | `partitionRankedRows` (`SRC/components/feed/post-model.ts:375-386`) |
| Hydrate events | `event_occurrences` SELECT `id, starts_at, ends_at, status, event:assistance_events(id,title,event_type,location_name,city,state,requires_registration, organization:organizations(name))` `.in('id', eventIds)` under caller RLS (`feed-panel.tsx:1913-1924`); rows RLS hides are dropped (`:1939`); own check-ins + `my_anonymous_claims` for non-guests (`:1957-1970`). No description, no org id, no time zone read |
| Filter rule | events only when `rankMode==='ranked' && activeFilter==='all'` (`post-model.ts:394-399`); merge `mergeRankedFeedItems` (`:413-440`); wired `feed-panel.tsx:2491-2492` |
| `EventFeedItem` | `post-model.ts:346-364` (occurrenceId, eventId, title, eventType, orgName, startsAt, endsAt, locationName, city, state, status, requiresRegistration, score, distanceBucket) |
| Card | `SRC/components/feed/event-feed-card.tsx`: `formatDate`/`formatTime` `toLocale*('en-US')` no `timeZone` (`:43-48`, rendered `:128`); `eventTimingLabel` (`post-model.ts:447-460`); opens `CheckinSheet` (`:170`) |
| Events panel | `SRC/components/panels/events-panel.tsx:88-122`: `event_occurrences` `status='upcoming'`, `ends_at >= now`, `starts_at <= now+30d`, order starts_at, limit 50, RLS-scoped (no explicit is_active filter); times `toLocale*('en-US')` (`:52`, `:56`) |
| Check-in sheet | `SRC/components/panels/checkin-sheet.tsx:43-47` (en-US, no zone), `rpc('check_in')` `:69` |
| Realtime | `supabase_realtime` publication contains **only `posts`** (live `pg_publication_tables`); feed channel `posts-realtime` on table posts (`SRC/hooks/use-realtime-feed.ts:114-121`). Events reach the feed only on the next ranked fetch |

---

## 6. Logging and audit path

| Piece | Behaviour | Evidence |
|---|---|---|
| `logger.debug/info` | console only (no sink) | `SRC/lib/logger.ts:149-153` |
| `logger.warn` | console + `sinkToSupabase('warn')` | `:155-158` |
| `logger.error` | console + `sinkToSupabase('error')` with `error_code/name/message` | `:168-185` |
| `logEvent(name, attrs)` | persisted info row | `:283-290` |
| `withMetric(op, attrs, fn, rid?)` | persists exactly one `<op>.complete` (info) or `<op>.error` row | `:303-329` |
| Sink | browser → `POST /api/client-log` (keepalive) (`:51-70`); server → service-role insert after `sanitizeClientEvent` (`:96-110`) | |
| Registry | unknown event → no row; only listed label keys kept; error fields only on error level (`SRC/lib/event-registry.ts:443-468`) | |
| Registry entries in scope | `admin.event.created` [event_id, event_type, geocode_accuracy, org_id, rrule] `:64`; `admin.event.retired` `:65`; `admin.event.scheduler.kiosk_opened` `:66`; `admin.event.updated` `:67`; `admin.occurrence.cancel_failed` [] `:77`; `admin.occurrence.cancelled` `:78`; `admin.occurrence.created` `:79`; `admin.org.duplicate_warning` `:80`; `admin.org.panel.close` `:81`; `admin.org.save.complete/.error` `:82-83`; `admin.org.set_active.complete/.error` `:84-85`; `admin.shell.org_switch` `:116`; `admin.shell.tab_switch` `:117`; `organization.*.fetch.*` `:324-331` | |
| Emitters in scope | scheduler `admin.event.created/.updated/.retired/.scheduler.kiosk_opened`, `admin.occurrence.created/.cancelled` all `logger.info` (console only); `admin.occurrence.cancel_failed` is `logger.error` (persists, error fields only) (`MOD/event-scheduler.tsx:263,307,357,361,396,461,501`) | |
| `privilegedRpc(supabase, op, rpcName, args, attrs)` | mints one UUID, sends `x-request-id` via `.setHeader`, wraps in `withMetric(op, …, rid)` → `op.complete/.error` + the RPC's audit row share `request_id` | `SRC/lib/privileged-action.ts:41-86` |
| `AUDITED_PRIVILEGED` | 14 names incl. `admin_save_organization`, `admin_set_org_active`; event RPCs absent | `SRC/lib/privileged-action-guard.ts:10-25` |
| Bypass guard | any audited name outside `privilegedRpc(...)`'s 3rd arg is an offender; repo-wide scan expects zero | `privileged-action-guard.ts:30-50`; `SRC/lib/privileged-action.test.ts:139-149` |
| `record_admin_action` | EXECUTE postgres + service_role only → callable only from inside SECDEF RPCs; `actor_tier := tier_of(actor)` (NULL for a non-tier org admin; column nullable) | live ACL; `P31:177` |
| request_id | proxy mints/reuses `x-request-id` (`SRC/proxy.ts:31-52`; `SRC/lib/request-id.ts:9` `^[A-Za-z0-9-]{1,64}$`); SQL `request_id()` reads `request.headers->>'x-request-id'` and accepts `^[A-Za-z0-9_-]{1,64}$` (`P31:134`, live def). Event RPCs today use plain `supabase.rpc` → no header → NULL | |

---

## 7. What runs after each side effect

| Side effect | Synchronous follow-ons | Not triggered |
|---|---|---|
| `admin_create_event` | INSERT only; client `fetchEvents()` reload (`MOD/event-scheduler.tsx:332`) | no occurrence, no audit, no app_logs row, no notification, no realtime |
| Occurrence INSERT (direct) | none (no INSERT trigger on event_occurrences); client reload (`:405`) | not published to realtime; feed shows it on the next `ranked_feed_v2` fetch; no audit; log console-only |
| Occurrence cancel (direct UPDATE) | `trg_event_occurrences_guard_checkin_bounds`, `updated_at` | no audit |
| `admin_update_event` retire | cancels `starts_at > now()` occurrences | no audit |
| `admin_save_organization` | one `admin_actions` row (`SAVE:463-471`); `admin.org.save.complete|error` app_logs row (privilegedRpc); client deletes `removed_photo_paths` (`org-form-panel.tsx:626-628`); shell bumps `orgListKey` → list refetch (`admin-shell.tsx:175-182`) | no `revalidatePath/revalidateTag/unstable_cache` anywhere (`git grep` → 0); root layout renders per request via `await connection()` (`SRC/app/layout.tsx:59-63`, call `:83`) so `/s/organization/[id]` reads live |
| `admin_set_org_active(false)` | cascade cancels not-ended occurrences; one `org.deactivate` audit row | no per-occurrence audit |
| organization_members write (client) | none | no audit, no app_logs |
| `check_in` / `organizer_confirm` | `force_checked_in_by`, `engagement_on_event_checkin` | — |

---

## 8. Production traffic (2026-10-06 17:36 UTC)

Identity control: `current_user = supabase_read_only_user`, `rolbypassrls = true`.

| Entity | Count | Non-zero sibling control |
|---|---|---|
| organizations | 2: `community` active approved located (FEED `705c100e-77f3-4807-9788-ff1ab4b26bb1`, Rutland VT, created 2026-10-05); `business` active approved, no pin, `submitted_by NULL` (Leviosa VT `8f19246e-…`) | resources 19,146 |
| organization_members | **0** (org admins 0) | profiles 23 |
| assistance_events | **0** | posts 2 |
| event_occurrences | **0** | posts 2 |
| event_checkins / event_anonymous_claims | **0 / 0** | app_logs 1,099 |
| admin_actions | 1: `org.update` ok `platform_admin` 2026-10-06 05:10:14 | — |
| app_logs `admin.event*` / `admin.occurrence*` / `admin.shell*` | **0** (window 2026-09-06 → 2026-10-06) | `admin.org.save.complete` 1, `admin.org.panel.close` 1, `organization.roster.fetch.complete` 10, `organization.list.fetch.complete` 7, `feed.load.complete` 68, `feed.rank.fetch_failed` 1 (2026-09-21) |
| ranking_config | 1 row: 24 / 20 / 2 | — |
| Migration ledger top | `20261019500000 sync_secret_vault` (prod); git at `d561777` tops at `20261019000000`; `20261019500000_sync_secret_vault.sql` is an untracked file in this worktree | — |

The 0 `admin.shell.*` rows next to a recorded `admin.org.save.complete` confirm `logger.info` events do not persist.

---

## 9. Tests that pin current behaviour and will move

| Test | Asserting line(s) | Pins |
|---|---|---|
| `SMOKE/28-w1-6a-events-checkin.smoke.ts` | query `:64-69`, assert `:188` (`secdef_pinned` = **7**, list includes `admin_create_event`) | dropping `admin_create_event` → 6 |
| same | `:78-79` `has_function_privilege(… admin_create_event(16-arg) …)`; asserts `:205-206` | errors when the function is dropped |
| same | `:143`, `:161` `admin_update_event(19-arg)` regprocedure strings; asserts `:260`, `:275` | break on any signature change |
| same | `:111-115` (orgmem platform-only / no org-admin write), `:117-118` + `:240-241` (`is_org_admin_any` grants) | members stay platform-write |
| `SMOKE/29-ranked-feed-v2-events.smoke.ts` | `:146-152` direct INSERT `organizations(id,name,is_active)`, `assistance_events(...)`, `event_occurrences(...)`; asserts `:168-174`; v1 md5 `:103-111` | new NOT NULL columns without default break the INSERTs |
| `SMOKE/30-p3-0-moderation-guards.smoke.ts` | probes `:104`, `:106`, `:112` (org admin direct UPDATE of organizations); expects `ERR 42501 guard:organizations_admin_fields` at `:169`, `:175`, `:197` | with `orgs_update_org_admin` dropped these UPDATEs match no policy → `OK rows=0` |
| `supabase/tests/org_admin_save.smoke.sql` | S1 `:88-114` (`42501 org_save_denied%` for non-admin); S8 `:411-432` truth table incl. `:430` "member + own NON-business row => false"; S10 setup `:513-515` direct INSERT ae/occ | org admins currently denied save and photos |
| `supabase/tests/p4a_local_business.smoke.sql` | `:83-89` `PERFORM admin_create_event(v_biz, …)` inside `EXCEPTION WHEN others → 'BLOCKED'` | if the function is dropped the call raises undefined_function, is caught, and the assert passes for the wrong reason — must be re-pointed at the new RPC |
| `MOD/org-admin-gates.test.ts` | `:17-23` `canCreateOrganizations` PA-only; `:32-38` admin-shell has exactly **one** `<OrgFormPanel` and `{canManageOrgs && (<OrgFormPanel` | an org page must render its panel from a different file |
| `MOD/admin-shell-tabs.test.ts` | `:13-37` (org admin no tier → `['events']`; PA → all 10) | |
| `SRC/components/feed/event-feed.test.ts` | fixture `:41-47` (`EventFeedItem` literal); `feedIncludesEvents` `:64-74`; merge `:76-123`; `eventTimingLabel` `:125-141` | adding a required field to `EventFeedItem` breaks the literal |
| `SRC/lib/privileged-action.test.ts` | `:118-120`, `:139-149` | new audited RPCs must go through `privilegedRpc` |
| `SRC/lib/__tests__/event-registry.test.ts` | `:32-34` every emitted name registered | renamed events must be registered in the same PR |
| `supabase/functions/post-image-upload/target.test.ts` | `:89-105` | unchanged (edge fn only interprets the RPC result) |

CI (`.github/workflows/ci.yml`): type-check `:77`, lint `:110`, build `:143`, `npm run test` (`node --test` + `vitest run`) `:188`, `scripts/check-security-definer.mjs` `:217`. No SQL smoke and no `*.smoke.ts` run in CI. Local ephemeral PG17 harness: `<scratchpad>/plan-r2/harness/README.md` (`run-tests.sh` runs every `supabase/tests/*.smoke.sql` on a fresh clone).

---

## 10. Target state (approved ROUND 2 design, checkpoint 2026-10-06) — shipped

Shipped as migration `20261020000000_org_scoped_admin_events.sql` with the org-scoped admin page (release 2026-10-06). Sections 1-9 describe the system before that migration. Source: `~/.claude/session-env/synrg-checkpoint-2026-10-06-0100-org-scoped-admin-events.md` §ROUND 2 RESULTS and §Investigation results.

### 10.1 Routes and UI

| Change | Invariants (outcomes) |
|---|---|
| `/moderation/org` and `/moderation/org/[id]` server components; `await params`; non-UUID → `notFound()`; gate `can_admin_org(id)` (SECDEF); separate `OrgAdminShell` file | A caller reaches `/moderation/org/[id]` exactly when `can_admin_org(id)` is true; every other signed-in caller gets notFound/redirect and no org data; an unauthenticated request is redirected to `/login` by `proxy.ts:206-210`. `can_admin_org` admits the same set as the widened save gate — platform admin, or `role='admin'` member of that org while it is active and non-business — which is also exactly the set `get_admin_org_list()` (`P4A:234`) returns for the caller |
| Org row name in the platform Organizations tab links to `/moderation/org/<id>`; Settings admin entry reaches the org admin's org(s) | Every non-business org row is a working link for a platform admin; an org admin with no tier sees only orgs they administer |
| Tabs: Overview / Events / Profile / Members, all fed by the route's org id | Every query on the page is filtered to that org id; no tab reads another org's rows (both directions: own rows present, foreign rows absent). Overview is a new org-scoped component (current `OverviewTab` is platform-wide, §4.2) |
| Profile = `OrgFormPanel` `mode='edit'`, no `onEditExisting`, no `fetchOrgNameIndex`; `orgs-section` never rendered | An org admin can edit name/description/contact/hours/pin/photos/linked resources of their active non-business org and cannot change `is_active` or membership; `org-admin-gates.test.ts:37` still finds exactly one `<OrgFormPanel` in `admin-shell.tsx` |
| Members tab read-only for org admins (D3) | An org admin sees their org's roster and has no add/role/remove control; every roster write still requires a platform admin (`W16A:1234-1245` unchanged) |
| Event form: one step with date/time and time zone, org pin by default or Census address override; `recurrence-picker.tsx` deleted; Mapbox geocoding removed from the scheduler | Creating an event with one date produces exactly one event and one occurrence in one call; no Mapbox geocode result is written to `assistance_events.location` |
| `lib/event-time.ts formatEventWhen`; `lib/i18n-event-forms.ts`; EventFeedCard shows the event's zone | Every rendered event time states the event's own zone; the same instant renders identically for viewers in different zones |

### 10.2 Database

| Change | Invariants |
|---|---|
| `create_org_event(...)`: atomic event + first occurrence; `idempotency_key` UNIQUE `(org_id, key)`; `time_zone` NOT NULL with Area/City CHECK (membership in `pg_timezone_names` + `/`; live count 1194 includes `EST`, `UTC`); DST gap or ambiguous local time → 22023; `p_location_source org|address` → accuracy `'point'`; audit `event.create`. Write rule shared by all four event writers (`org_event_write_gate`): platform admin on any non-business org, active or inactive; org admin only on their own active non-business org; a guest (anonymous sign-in) session is refused even when it holds an `organization_members` admin row | Exactly one `admin_actions` row per write; a replay with the same key returns the existing id and writes nothing (one event, one occurrence, one audit row in total — also under two concurrent sessions, `supabase/tests/org_scoped_admin_events.race.sh`). A call either writes event + occurrence + audit row or nothing. Org admin of another org, org admin of an inactive org, business org (anyone), guest (even with an admin row), anon → 42501, nothing written |
| `add_event_dates(...)`: uses the event's time zone; `ON CONFLICT (event_id, starts_at) DO UPDATE … WHERE status = 'cancelled'` (a cancelled date is scheduled again with the supplied end time; a scheduled/completed one is ignored; in-call repeats count once); refuses retired events (`P0001 event_retired`) and re-opening a cancelled date that has check-ins (`P0001 … (<local start>)`); audit `event.add_dates` with `added`, `restored`, `restored_ids` | A scheduled date is never duplicated; re-adding a cancelled date restores the same occurrence; the return value = added + restored; a retired event gains no occurrence by any path; one audit row per call |
| `cancel_event_occurrence(...)`; audit `occurrence.cancel` | Cancelling is the only client path to `status='cancelled'`; ended occurrences stay refused by the existing guard trigger |
| `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON event_occurrences FROM anon, authenticated`; DROP the six `occurrences_{admin,org_admin}_{insert,update,delete}` policies | No client role writes `event_occurrences` directly; SECDEF RPCs and `organizations_cascade_deactivate` keep working (owner-run) |
| `CHECK (ends_at > starts_at)`; `UNIQUE (event_id, starts_at)` | Every occurrence ends after it starts; no event has two occurrences at the same instant (0 live rows, so no backfill conflict) |
| DROP `admin_create_event`; rewrite `admin_update_event` (no rrule params; Census/org location; no Mapbox; same write rule; one audit row per call: `event.update` / `event.retire`); DROP columns `assistance_events.rrule`, `event_occurrences.rrule_dtstart` (0 rows); time zone immutable after create | No callable function references `rrule`; changing an event's zone is refused |
| `ranked_feed_v2` `CREATE OR REPLACE`: events visible iff `ae.is_active AND org.is_active`; new `ranking_config.event_half_life_hours numeric NOT NULL DEFAULT 168` used for events; posts branch and v1 byte-identical | An event appears in the feed for every viewer type (anon, guest, member, org admin, platform admin) exactly when it is active, its org is active, and it has an upcoming occurrence ending ≥ now and starting ≤ now+30 days; a retired event or an event of an inactive org appears for no viewer. Both the admin/org-admin clause (`W16B:165-166`) and the in-progress-retired clause (`W16B:168-169`) leave the feed predicate. Post rows of v2 equal v1 rows; v1 md5 unchanged (`SMOKE/29…:103-111`). An event 7 days out scores 0.5 × distance factor |
| `admin_save_organization` widened: guest session → 42501 first; platform admin unchanged (any org, active or inactive, incl. `org_type` changes); else `is_org_admin(p_org_id)`, then after the `FOR UPDATE` lock require FOUND AND `is_active` AND `org_type <> 'business'` AND the payload's `org_type` equal to the stored one, else the same `42501 org_save_denied` (type change: `org_save_denied: only a platform admin may change the organization type`); create stays platform-only; `details.actor_role` added | An org admin saves profile/hours/pin/photos/links of their own active non-business org and nothing else; create, another org, inactive org, business org, any `org_type` change, guest session (even with an admin row) → 42501 with nothing written; every save writes exactly one audit row (`actor_tier` NULL for an org admin) |
| `can_manage_org_photos` + org admin of an active non-business org | An org admin uploads/lists/deletes photos only under their own org's folder; S8's existing truth table holds for every other caller |
| DROP POLICY `orgs_update_org_admin` | An org admin has no direct UPDATE path to `organizations` (every permissive UPDATE/ALL policy requires `is_current_user_admin()`); `admin_save_organization` is the single org-admin writer and refuses any `org_type` change, so `org_type` (including `'business'`), `submitted_by`, `status`, `moderated_*`, `is_active` cannot be set by an org admin. The other writers of `organizations` are platform- or tier-gated (`admin_set_org_active`, `approve_business` / `reject_business` on rows already `org_type='business'`); `orgs_business_insert` only creates a NEW business row through the member submit plane |
| `can_admin_org(p_org_id uuid)` (route gate; EXECUTE anon + authenticated) | Same rule as the writers: true for a platform admin on any existing non-business org (active or inactive); true for an org admin only on their own active non-business org; false for business, missing, NULL, anon, guest (even with an admin row), plain member, admin of another org. For an org admin it equals `get_admin_org_list()`; for a platform admin it is every non-business org (`get_admin_org_list` still returns active ones) |
| `AUDITED_PRIVILEGED += create_org_event, add_event_dates, cancel_event_occurrence` | Each call goes through `privilegedRpc`, carries one `x-request-id`, and yields one `admin_actions` row + one `app_logs` `.complete|.error` row sharing `request_id` |

Retired event, documented outcome: hidden from the feed for everyone; an in-progress occurrence of it stays in the Events panel for members via `occurrences_select_reachable_authed` until it ends.

Inactive organization, documented outcome (harness probe 2026-10-06): a platform admin may create, edit, add and cancel dates for an inactive org's events, and sees those dates in the admin scheduler (RLS `occurrences_admin_select`). The feed (`ranked_feed_v2`) hides them from every viewer, platform admins included, until the org is reactivated; then they appear for everyone. The org's own admins see none of its dates while it is inactive (`occurrences_org_admin_select` joins `assistance_events`, whose org-admin read path `events_select_reachable_authed` requires the org active) and every write by them is refused (42501), matching F7. Members and anon see none.

### 10.3 Logging names

| Add | Remove |
|---|---|
| `admin.event.create.complete/.error`, `admin.event.add_dates.complete/.error`, `admin.occurrence.cancel.complete/.error` | `admin.event.created`, `admin.occurrence.created`, `admin.occurrence.cancelled`, `admin.occurrence.cancel_failed` |

Unchanged by the approved list and still console-only: `admin.event.updated`, `admin.event.retired` (`logger.info`). `admin_update_event` writes one audit row per call (`event.update` / `event.retire`) from `20261020000000` on.

### 10.4 Tests that must change with the target

| Test | Change |
|---|---|
| `SMOKE/28…` `:64-69/:188`, `:78-79/:205-206`, `:143`, `:161`, `:260`, `:275` | new function list/count and signatures |
| `SMOKE/29…` `:147`, `:151` | add `time_zone` to the direct INSERTs |
| `SMOKE/30…` `:169`, `:175`, `:197` | expect `OK rows=0` |
| `org_admin_save.smoke.sql` `:513-514` | add `time_zone`; add S11 org-admin truth table and S8 org-admin cases |
| `p4a_local_business.smoke.sql` `:86` | call the new RPC so the block is a real gate, not undefined_function |
| `event-feed.test.ts` `:41-47` | add `timeZone` to the fixture |

The `orgs_update_org_admin` path in §2.3 is dropped by `20261020000000`; organization admins can be added once it is applied.
