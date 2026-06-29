# MISSION 14 — Saved Resources   | owner: feed-resources-expert | tier: P2
> One-line: a signed-in user bookmarks a resource (with optional private encrypted notes), sees it persist across sessions in their saved list, and removes it.

## 1. Backend surface
- RPCs: none — saved resources are direct client table mutations (insert/select/delete), row-scoped by RLS.
- Edge functions: none.
- Tables:
  - `saved_resources` — bookmark rows: public listing copies (`resource_name`, `resource_address`, `resource_phone`, `resource_website`, `resource_category` left cleartext for search) + user-authored private `notes` stored as `encrypted_notes`/`notes_iv` (zero-knowledge-at-rest) — RLS yes (FOR ALL, row-scoped by `user_id`); realtime off — anchor: encryption migration `supabase/migrations/20260611000000_encrypt_saved_resources.sql`, base table `supabase/migrations/20260527000002_saved_resources.sql`.
  - `saved_resource_tasks` — `encrypted_title`/`title_iv` — RLS row-scoped.
  - `saved_resource_events` — `encrypted_title`/`title_iv` — RLS row-scoped.
  - `saved_resource_documents` — `encrypted_file_name`/`file_name_iv` — RLS row-scoped — `supabase/migrations/20260527000004_add_resource_detail_tables.sql`.

## 2. User-facing surfaces + interaction points
- Saved-resources drawer/panel (consumer of `use-saved-resources.ts`) — interaction points: save/bookmark button, notes textarea (vault-gated), remove button, list render.
- `VaultGuard` / `VaultProvider` — gates the encrypted `notes` decryption surface (cleartext notes appear only after unlock).

## 3. Backend→Surface binding map
- Save button → `saveResource(input)` → `supabase.from('saved_resources').insert({ user_id:user.id, resource_id, resource_name, notes, ... }).select().single()` (`apps/web/src/hooks/use-saved-resources.ts:116-129`); optimistic prepend at :135.
- Saved list load → `fetchResources` → `supabase.from('saved_resources').select('*').eq('user_id',user.id).order('created_at',desc).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))` (`use-saved-resources.ts:79-84`).
- Remove → `removeResource(id)` → `supabase.from('saved_resources').delete().eq('id',id).eq('user_id',user.id)` (`use-saved-resources.ts:156-160`); optimistic filter at :166.
- Already-saved check → `isResourceSaved(resourceId)` / `isResourceSavedByName(name)` (`use-saved-resources.ts:177-191`).
- Encrypted notes write/read → AES-GCM via vault (`encrypted_notes`/`notes_iv`); RLS auto-covers new cols (FOR ALL is row-scoped, not column-scoped — see migration header).

## 4. Dependencies
- upstream: authenticated user (`useAuth`); vault unlocked for notes encryption/decryption; `QUERY_TIMEOUT_MS`/`isQueryTimeout` from `@/lib/vault`.
- downstream: Mission 9 Documents/Vault (shares the AES-GCM vault key for notes); resource detail surfaces that show "saved" state.

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "eq\('user_id', user.id\)" apps/web/src/hooks/use-saved-resources.ts` → expected: present on select (:81), delete (:160) — proves caller-side row scoping aligns with RLS.
- [ ] `grep -n "AbortSignal.timeout" apps/web/src/hooks/use-saved-resources.ts` → expected: fetch wrapped with QUERY_TIMEOUT_MS (:84) — no-timeout hangs guarded.
- [ ] `grep -nE "encrypted_notes|notes_iv|encryption_migrated" supabase/migrations/20260611000000_encrypt_saved_resources.sql` → expected: additive nullable column pairs added; plaintext `notes` NULLed on encrypted write (header note).
- [ ] `grep -nE "resource_name|resource_address|resource_phone" supabase/migrations/20260611000000_encrypt_saved_resources.sql` → expected: listed as "Left cleartext" (search retained, no privacy gain from encrypting public listing copies).
- [ ] `read apps/web/e2e/saved-resources-encryption.spec.ts:1-20` → expected: spec asserts (a) ciphertext-at-rest, (b) decrypted-in-UI, (c) locked-hides-plaintext.

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL (read-only, MCP): `select count(*) total, count(encrypted_notes) with_cipher, count(notes) filter (where notes is not null) plaintext_remaining from public.saved_resources;` → expected: rows written via the current UI have `encrypted_notes` populated and `notes` NULL (zero-knowledge at rest). Pre-encryption legacy rows may still carry plaintext (migration is additive, drop deferred).
- [ ] Prod SQL: confirm RLS row scoping — `select polname, cmd, qual from pg_policies where tablename='saved_resources';` → expected: FOR ALL policy with `user_id = auth.uid()` qual.
- [ ] Playwright E2E: `npx playwright test apps/web/e2e/saved-resources-encryption.spec.ts --reporter=line` → expected: all 3 scenarios green. PROD-WRITE: creates a saved_resources row + reads via Management API; CLEANUP: spec deletes the test row (verify teardown removes by `user_id=<test uid>`).

## 6. PASS criteria + residuals
- PASS when: save inserts a row scoped to `user_id`; the row persists and reloads after refresh; remove deletes only the caller's row; private `notes` are stored as `encrypted_notes` (plaintext `notes` NULL) and only render after vault unlock; `saved-resources-encryption.spec.ts` passes.
- Known residuals: plaintext `notes` column still exists (drop deferred to a Phase-3 PR) — legacy rows may retain plaintext until backfilled. `saved_resource_tasks.title` keeps a NOT-NULL plaintext placeholder by design.
