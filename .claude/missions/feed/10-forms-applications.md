# MISSION 10 — Forms & Applications   | owner: feed-forms-expert | tier: P0
> One-line: a user fills a benefits application in the wizard, the vault encrypts the submission client-side before insert, the row is readable only by them, and the benefits-screening edge function returns eligible programs from their household data.

## 1. Backend surface
- RPCs: none dedicated (forms write directly via PostgREST inserts under RLS)
- Edge functions: `benefits-screening` — maps household data → PolicyEngine `/us/calculate` payload, returns per-program eligibility (SNAP/Medicaid/TANF/WIC/SSI/EITC) — browser-invoked, `verify_jwt = false` (`supabase/config.toml`, in-code auth) — `supabase/functions/benefits-screening/index.ts:2-3,9,323` (PolicyEngine integration `:134-173`, eligibility extraction `:248-298`)
- Tables:
  - `form_templates` — template schema, `is_active`/`form_type`, `discovery_metadata`, `moderated_by/at`, RLS — read filter on active templates
  - `form_submissions` — submitted data; encrypted path writes `encrypted_data`; RLS own-row — written by both plain and vault hooks
  - `form_signatures` — captured e-signature linked to submission

## 2. User-facing surfaces + interaction points
- `ApplicationsPanel` / `FormsPanel` (`apps/web/src/components/panels/forms-panel.tsx:601`) — interaction points: list applications, open wizard, fill fields, autofill from vault profile, submit (plain or encrypted), e-sign, PDF annotate; reached via `PANEL_ALIASES` `forms→documents#applications` + `applications→documents#applications`
- `form-wizard.tsx` (`apps/web/src/components/forms/form-wizard.tsx`) — multi-step progression, conditional field visibility
- `wizard-panel.tsx` (`apps/web/src/components/panels/wizard-panel.tsx`) — wizard shell
- Hook `use-applications.ts` (`apps/web/src/hooks/use-applications.ts:163-189`) — lists `form_submissions` joined to `form_templates(name, form_type, schema)` for deep-link back-nav

## 3. Backend→Surface binding map
- Application list load → `useApplications` → `supabase.from('form_submissions').select('..., form_templates(name, form_type, schema)')` (`apps/web/src/hooks/use-applications.ts:163-173,219-230`)
- Form template load → `useUserSubmissions` (forms-panel import `apps/web/src/components/panels/forms-panel.tsx:31`) → `form_templates` read filtered by active
- Encrypted submit → vault unlock gate (`isUnlocked` check) → `useVaultFormSubmission` → `encryptField` → `supabase.from('form_submissions').insert(submission)` (`apps/web/src/hooks/use-vault-form-submission.ts:108,129,276-277,624-628`)
- Encrypted attachment path → encrypt → `supabase.storage.from('user-documents').upload(...)` → `supabase.from('user_documents').insert({...})` with cleanup-on-error `.remove()` (`apps/web/src/hooks/use-vault-form-submission.ts:481-511`)
- Benefits screening → `functions.invoke('benefits-screening', { body: { household } })` → PolicyEngine round-trip → eligible-program list

## 4. Dependencies
- upstream (this feature needs): Documents & Vault (Mission 9) — encrypted submission requires the vault UNLOCKED so `encryptField`/`getDEK` have the DEK in memory; Auth & Session (Mission 1) for own-row RLS on `form_submissions`; PolicyEngine API credentials as edge-fn secrets (`getPolicyEngineToken` `supabase/functions/benefits-screening/index.ts:139,146`)
- downstream (depend on this): Programs (Mission 11) — eligibility wizard reuses `benefits-screening`; Applications status surfacing in DocumentsPanel

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -n "isUnlocked" apps/web/src/hooks/use-vault-form-submission.ts` → expected: every encrypted insert path is gated on `isUnlocked` (`:108,330,533`) — proves vault dependency wiring
- [ ] `grep -nE "finally" apps/web/src/hooks/use-vault-form-submission.ts` → expected: `finally` resets `isSubmitting` (`:202`) — no stuck submit spinner
- [ ] `grep -n "encrypted_data\|encryptField\|from('form_submissions').insert" apps/web/src/hooks/use-vault-form-submission.ts` → expected: encrypted payload inserted, not plaintext (`:276-277,624-628`)
- [ ] `grep -n "POLICYENGINE_API_URL\|getPolicyEngineToken\|is_snap_eligible\|is_medicaid_eligible" supabase/functions/benefits-screening/index.ts` → expected: real PolicyEngine endpoint + per-program eligibility extraction (`:9,139,248,257`)
- [ ] `grep -n "verify_jwt" supabase/config.toml` → expected: `benefits-screening` block has `verify_jwt = false` (in-code auth, gateway bypass)
- [ ] `grep -n "form_templates (" apps/web/src/hooks/use-applications.ts` → expected: single joined select (no N+1) for template name + form_type (`:173,230`)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Edge-fn invoke (no prod write): `supabase.functions.invoke('benefits-screening', { body: { household: { state:'VT', size:4, income:28000 } } })` → expected: 200 with `eligible:true` for SNAP at that income/size (validates PolicyEngine mapping). Note: external PolicyEngine call — read-only, no DB write.
- [ ] Prod SQL (read-only): confirm RLS isolates submissions
      `SELECT count(*) FROM form_submissions;` run as a non-owner test JWT → expected: returns only the caller's rows (0 for a fresh test user)
- [ ] Prod SQL (read-only): confirm encrypted rows carry ciphertext
      `SELECT count(*) FROM form_submissions WHERE encrypted_data IS NOT NULL;` → expected: ≥0; for any encrypted submission, `data` plaintext column must not duplicate sensitive fields
- [ ] Playwright E2E: `apps/web/e2e/forms-flow.spec.ts` → expected: wizard advances through steps, conditional fields show/hide, submit succeeds (prod-write: inserts a `form_submissions` row for test user — CLEANUP: delete by `id` after run)
- [ ] Playwright E2E: `apps/web/e2e/docs-forms-lifecycle.spec.ts` + `government-forms.spec.ts` → expected: full lifecycle incl. vault-gated encrypted submission + government-forms bucket access (`supabase/migrations/20260610210000_government_forms_bucket.sql`)

## 6. PASS criteria + residuals
- PASS when: active form templates load; wizard progresses with correct conditional-field gating; encrypted submit is blocked while vault is locked and succeeds once unlocked, writing `encrypted_data`; submission RLS returns only own rows; `benefits-screening` returns correct eligibility for a known household; submit spinner always resets via `finally`; `forms-flow.spec.ts` green.
- Known residuals: dead phone-autofill (carried in MEMORY) — autofill banner may reference a field map that is partially stale; verify `AUTOFILL_KEY_MAP` against live template field names before claiming autofill PASS.
