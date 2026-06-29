# MISSION 9 — Documents & Vault   | owner: feed-documents-expert + feed-vault-expert | tier: P0
> One-line: a user unlocks their zero-knowledge vault, uploads a file that is AES-GCM-256 encrypted in-browser before it ever reaches Storage, and views/downloads it back decrypted — server never sees plaintext or the real filename.

## 1. Backend surface
- RPCs: `geocode_profile_location()` — geocodes profile address to lat/lng (peripheral to vault; secure-profile adjacent) — SECDEF — `supabase/migrations/`
- Edge functions: none (entire encryption chain is client-side Web Crypto; Storage + DB writes go direct via supabase-js)
- Tables:
  - `user_secure_profiles` — stores `encryption_salt`, `wrapped_dek`, `dek_iv`, `encryption_version`, `vault_created_at`; server holds the WRAPPED DEK but cannot unwrap it (zero-knowledge) — RLS `user_secure_profiles_self_access` — `supabase/migrations/20260214200000_add_vault_key_storage.sql:23,33,79`
  - `user_documents` — one row per encrypted file: `file_path`, `encryption_iv`, `encrypted_original_name`, `encrypted_name_iv`, `is_encrypted`, `encrypted_annotations`, `annotations_iv` — RLS own-row policies — `supabase/migrations/20260214220000_add_document_encryption_fields.sql:36-45`
  - `user_document_annotations` — encrypted sidecar annotations (true-edit PDF) — `supabase/migrations/20260602120000_add_user_documents_annotations.sql`
- Storage bucket: `user-documents` (private, `public=false`) — `supabase/migrations/20260214220000_add_document_encryption_fields.sql:73`
  - Storage RLS on `storage.objects` scoped by `bucket_id='user-documents' AND (storage.foldername(name))[1] = auth.uid()::text` for upload/select/delete — same migration `:85-108`

## 2. User-facing surfaces + interaction points
- `DocumentsPanel` (`apps/web/src/components/panels/documents-panel.tsx:546`) — interaction points: upload (drag/file picker), view/preview, download, download-for-edit (PDF annotator), rename, delete; wraps edit flow in `<VaultGuard>` (`:1003`)
- `VaultGuard` (`apps/web/src/components/vault/vault-guard.tsx:36`) — renders children only when `isUnlocked`; otherwise mounts `VaultUnlockModal` (`:99`)
- `VaultUnlockModal` (`apps/web/src/components/vault/vault-unlock-modal.tsx`) — master-password input; title/copy driven by `isSetup`
- `VaultProvider` context (`apps/web/src/contexts/vault-context.tsx:70`) — exposes `unlock()`, `lock()`, `isUnlocked`, `isSetup`; registers pre-lock flush callbacks so locking mid-flow never loses unsaved work

## 3. Backend→Surface binding map
- Upload file → `useEncryptedUpload.uploadFile` → `encryptFile()` (Web Crypto AES-GCM) → `supabase.storage.from('user-documents').upload(storagePath, encryptedBlob)` then `supabase.from('user_documents').insert({ file_path, encryption_iv, encrypted_original_name, encrypted_name_iv, ... })` (`apps/web/src/hooks/use-encrypted-upload.ts:139-141,194-212`); storage path = `${user.id}/${uniqueId}.encrypted` (`:120`)
- View/download → `useEncryptedUpload.downloadFile` reads row, `createSignedUrl` (1h), then `decryptFile()` using `encryption_iv` + `encrypted_name_iv` (`apps/web/src/hooks/use-encrypted-upload.ts:316,357-359`); plain list/preview uses `useDocuments` → `supabase.storage.from('documents').createSignedUrl(filePath, 3600)` (`apps/web/src/hooks/use-documents.ts:206-207`)
- Annotation save → `supabase.from('user_documents').update({ encrypted_annotations, annotations_iv })` (`apps/web/src/hooks/use-encrypted-upload.ts:404-407`)
- Delete → `supabase.storage.from('documents').remove(...)` + `supabase.from('user_documents').delete().eq('id', id)` (`apps/web/src/hooks/use-documents.ts:182-193`)
- Vault unlock → `VaultProvider.unlock(masterPassword)` → `unlockVault()` → PBKDF2(600k) derive KEK → AES-GCM verification-ciphertext check → `unwrapDEK()` → DEK held in IndexedDB/memory (`apps/web/src/lib/vault.ts:159,250`)
- Vault setup → `setupVault()` generates DEK, wraps with KEK, writes `wrapped_dek`+`dek_iv`+`encryption_salt` to `user_secure_profiles` (`apps/web/src/lib/vault.ts:87,103`)
- Field encrypt/decrypt (for forms/profile) → `encryptField()`/`decryptField()` call `getDEK()` (requires unlocked vault) (`apps/web/src/lib/vault.ts:392-393,417-418`)

## 4. Dependencies
- upstream (this feature needs): Auth & Session (Mission 1) for `auth.uid()` in Storage + table RLS; `user_secure_profiles` vault row created via `setupVault`; Web Crypto SubtleCrypto (browser); CSP `connect-src` must allow `blob:` (PDF annotator fetch)
- downstream (depend on this): Forms & Applications (Mission 10) — encrypted form submission requires the vault to be UNLOCKED (DEK in memory) before `encryptField` can run; Profiles secure fields

## 5. Empirical verification
### 5a. STATIC (cheap, no server) — grep/read with file:line evidence
- [ ] `grep -nE "crypto.subtle.encrypt|AES-GCM" apps/web/src/lib/document-encryption.ts` → expected: AES-GCM encrypt calls present (`:85,124,166`) — confirms client-side encryption before upload
- [ ] `grep -n "encryption_iv\|encrypted_original_name\|encrypted_name_iv" apps/web/src/hooks/use-encrypted-upload.ts` → expected: all three metadata columns written in the `.insert` payload (`:206-208`) — filename never stored in plaintext
- [ ] `grep -n "600000\|PBKDF2\|iterations" apps/web/src/lib/crypto.ts apps/web/src/lib/vault.ts` → expected: 600k PBKDF2 iterations for KEK derivation
- [ ] `grep -nE "bucket_id = 'user-documents'|storage.foldername\(name\)\)\[1\] = auth.uid" supabase/migrations/20260214220000_add_document_encryption_fields.sql` → expected: per-user folder scoping on all three storage policies (`:89-90,98-99,107-108`)
- [ ] `grep -n "public=false\|, false)" supabase/migrations/20260214220000_add_document_encryption_fields.sql` → expected: bucket created with `public=false` (`:73`) — no anonymous object reads
- [ ] `grep -nE "finally" apps/web/src/hooks/use-encrypted-upload.ts` → expected: `finally` blocks reset `isUploading`/`isDownloading` (`:264,377,603`) — no stuck spinner on error
- [ ] `grep -n "useVault\|isUnlocked" apps/web/src/components/vault/vault-guard.tsx` → expected: guard returns children only when `isUnlocked` (`:61-62`)

### 5b. RUNTIME (live probes) — prod SQL / edge-fn invoke / Playwright E2E
- [ ] Prod SQL (read-only, no write): verify Storage object naming + bucket privacy
      `SELECT public FROM storage.buckets WHERE id='user-documents';` → expected: `public = false`
- [ ] Prod SQL (read-only): confirm `user_documents` never stores a plaintext name column populated for encrypted rows
      `SELECT count(*) FROM user_documents WHERE is_encrypted=true AND encrypted_original_name IS NULL;` → expected: `0`
- [ ] Prod SQL (read-only): confirm column REVOKE leaves no plaintext leak — `user_secure_profiles` only holds WRAPPED dek
      `SELECT wrapped_dek IS NOT NULL AS wrapped_present FROM user_secure_profiles LIMIT 1;` → expected: wrapped present, no `dek` plaintext column exists
- [ ] Playwright E2E: `apps/web/e2e/document-filename-encryption.spec.ts` → expected: uploaded filename is ciphertext at rest, decrypts to original in UI
- [ ] Playwright E2E: `apps/web/e2e/documents-view.spec.ts` + `documents-upload-locked-card.spec.ts` → expected: locked card shown until vault unlock; view renders decrypted (prod-write: uploads a test doc to the test user's `user-documents/` folder — CLEANUP: delete the `user_documents` row + Storage object for the test user after run)
- [ ] Playwright E2E: `apps/web/e2e/vault-unlock-timeout.spec.ts` + `vault-idle-autolock.spec.ts` → expected: unlock bounded by `QUERY_TIMEOUT_MS=12_000` (`apps/web/src/lib/vault.ts:37`); idle auto-lock flushes pending work
- [ ] Playwright E2E: `apps/web/e2e/document-preview-timeout.spec.ts` → expected: signed-URL preview times out gracefully, no hang

## 6. PASS criteria + residuals
- PASS when: vault unlock succeeds with correct master password and fails (no DEK) on wrong password (AES-GCM auth-tag); upload produces a `.encrypted` Storage object under `${uid}/` and a `user_documents` row with all three IV/name-cipher columns set; view/download round-trips to original plaintext + filename; Storage RLS blocks cross-user object access; bucket is private; all 5b E2E specs green; no stuck upload/download spinner on induced error.
- Known residuals: master password is zero-knowledge (PBKDF2 600k) — forgotten password is unrecoverable by design (reset = verify-then-DELETE row); `documents` vs `user-documents` bucket naming split between `use-documents.ts` (plain) and `use-encrypted-upload.ts` (encrypted) — verify both buckets exist and are private.
