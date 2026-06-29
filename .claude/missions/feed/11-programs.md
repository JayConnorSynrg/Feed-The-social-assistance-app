# MISSION 11 — Programs   | owner: feed-programs-expert | tier: P1
> One-line: a user browses approved benefits programs filtered by category/state/search, sees which have an application form, and runs an eligibility wizard that calls benefits-screening.

## 1. Backend surface
- RPCs: none dedicated (browser queries `resources` directly under RLS)
- Edge functions: `benefits-screening` (shared with Forms — Mission 10) — eligibility evaluation via PolicyEngine — `supabase/functions/benefits-screening/index.ts`
- Tables:
  - `resources` — programs are rows filtered by `status='approved'`, `is_volunteer_resource=false`, `source='admin_added'`, `category IN (FORM_CATEGORIES)` — RLS, realtime per resources config — query at `apps/web/src/hooks/use-program-browser.ts:76-83`
  - `form_templates` — linked indirectly via `category-form-map.ts` to indicate which categories have an application form

## 2. User-facing surfaces + interaction points
- `ProgramsPanel` (`apps/web/src/components/panels/programs-panel.tsx:502`) — interaction points: category filter (`handleCategoryFilter` `:560-561`), state filter, search box, save resource, open application form (`hasApplicationForm` `:178`), open eligibility wizard
- Hook `use-program-browser.ts` (`apps/web/src/hooks/use-program-browser.ts:48,76-88`) — filter/search/paginate; `FORM_CATEGORIES` derived from `CATEGORY_FORM_MAP` (`:14`)
- `resource-wizard.tsx` (`apps/web/src/components/panels/resource-wizard.tsx`) + `lib/ai/resource-wizard-config.ts` — guided eligibility flow
- Lib `category-form-map.ts` (`apps/web/src/lib/category-form-map.ts:1,12,16,26`) — `CATEGORY_FORM_MAP`, `getFormTypesForCategory`, `hasApplicationForm`, `CATEGORY_DISPLAY`

## 3. Backend→Surface binding map
- Programs list → `useProgramBrowser` → `supabase.from('resources').select('*').eq('status','approved').eq('is_volunteer_resource',false).eq('source','admin_added').in('category', FORM_CATEGORIES).eq('state', normalizeState(...)).order('category')` (`apps/web/src/hooks/use-program-browser.ts:76-83`)
- Category filter → `setFilters({ category })` → re-query with `.in('category', [category])` (`apps/web/src/components/panels/programs-panel.tsx:561`; `use-program-browser.ts:81`)
- Search → `query.ilike('name', '%term%')` (`apps/web/src/hooks/use-program-browser.ts:88`)
- "Has application form" badge → `hasApplicationForm(category)` → `CATEGORY_FORM_MAP` lookup (`apps/web/src/components/panels/programs-panel.tsx:178`)
- Eligibility wizard step → `functions.invoke('benefits-screening', { body })` (shared edge fn, Mission 10)
- Save program → `useSavedResources` insert (Mission 14 territory)

## 4. Dependencies
- upstream (this feature needs): External Sync 211/HUD/IMLS + admin discovery populate `resources` with `status='approved'`, `source='admin_added'`; `us-states.ts` `normalizeState` for state-name vs abbrev matching (known prior bug: `'VT'` vs `'Vermont'` → empty results); `benefits-screening` edge fn for the wizard
- downstream (depend on this): Forms & Applications (Mission 10) — "open application form" deep-links from a program category via `getFormTypesForCategory`

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "\.eq\('status', 'approved'\)|is_volunteer_resource|source', 'admin_added'" apps/web/src/hooks/use-program-browser.ts` → expected: all three filters present (`:78-80`) — proves only approved admin programs surface (no pending/volunteer leakage)
- [ ] `grep -n "normalizeState" apps/web/src/hooks/use-program-browser.ts` → expected: state filter normalizes before `.eq('state', ...)` (`:82`) — guards the VT/Vermont empty-result regression
- [ ] `grep -n "ilike" apps/web/src/hooks/use-program-browser.ts` → expected: name search uses `ilike` (`:88`)
- [ ] `grep -nE "CATEGORY_FORM_MAP|hasApplicationForm|getFormTypesForCategory" apps/web/src/lib/category-form-map.ts` → expected: exports present (`:1,12,16`) — form linkage wiring intact
- [ ] `grep -n "useProgramBrowser\|hasApplicationForm" apps/web/src/components/panels/programs-panel.tsx` → expected: panel consumes the hook (`:26`) and form-availability check (`:178`)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL (read-only): confirm program rows exist matching the exact filter
      `SELECT count(*) FROM resources WHERE status='approved' AND is_volunteer_resource=false AND source='admin_added';` → expected: > 0 (otherwise ProgramsPanel renders empty)
- [ ] Prod SQL (read-only): confirm state normalization is needed/consistent
      `SELECT DISTINCT state FROM resources WHERE status='approved' AND source='admin_added' LIMIT 20;` → expected: confirm whether values are abbrev or full name; must match `normalizeState` output
- [ ] Edge-fn invoke (no DB write): `benefits-screening` with a known-eligible household → expected: eligible program returned (shared with Mission 10)
- [ ] Playwright E2E: `apps/web/e2e/programs-posts-bridge.spec.ts` → expected: programs render, category filter narrows list, form deep-link navigates correctly (read-only; no prod write)

## 6. PASS criteria + residuals
- PASS when: ProgramsPanel renders ≥1 program for the user's state; category filter narrows results; search by name returns matches; state filter respects normalization (no false-empty); "has application form" badge maps to the correct form types; eligibility wizard invokes `benefits-screening` and reflects the result; `programs-posts-bridge.spec.ts` green.
- Known residuals: program discovery scripts referenced in the inventory (`scripts/program-discovery.ts`) are NOT present under `scripts/` in this tree — discovery currently flows through admin-added resources only; treat the AI discovery pipeline as out-of-scope until the script is added.
