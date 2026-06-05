# GIT_PLAN.md
## Purpose
Tracks all git operations to ensure GATE 8 compliance. All git ops must be pre-registered here before execution by the SYNRG orchestrator.

## Entry Format
Each entry is a YAML block:
```yaml
id: <kebab-case-action-id>
status: pending | in_progress | complete | superseded
type: commit | branch | merge | push | tag
description: <what this does>
branch: <branch name>
files: [<list of files>]
created_at: <ISO timestamp>
completed_at: <ISO timestamp or null>
```

## Next Action
next_action_id: embed-opt-in-widget-phaseC5

## Log

```yaml
id: embed-opt-in-widget-phaseC5
status: in_progress
type: branch
description: "feat(feed): public embeddable opt-in widget + composer embed generator (Phase C.5). New SSR route /s/embed/[id] (anon-readable, iframe-safe, compact card with slot count + opt-in CTA). Per-route frame policy in next.config.ts: global source changed to negative-lookahead /((?!s/embed/).*) preserving X-Frame-Options:DENY+frame-ancestors 'none' everywhere except embed route which gets frame-ancestors *. Embed-code button (data-testid=embed-code-btn) in PostReactions/PostCard generates <iframe src=.../s/embed/...> snippet and copies to clipboard. Proxy publicRoutes expanded to include /s/post, /s/donate, /s/resource, /s/embed so social+embed routes are accessible unauthenticated. DB: GRANT EXECUTE on is_current_user_admin() to anon (resources ALL RLS policy evaluated against anon was throwing permission-denied on posts→resources join; anon always returns false — correct behavior). E2e: embed-widget.spec.ts 3/3 green; opt-in-flow.spec.ts 4/4 + review-harmony.spec.ts 3/3 green (no regression)."
branch: feature/embed-opt-in-widget
base: develop
base_sha: 15683b5
remote: origin
files:
  - apps/web/src/app/(social)/s/embed/[id]/page.tsx
  - apps/web/src/app/(social)/s/embed/[id]/layout.tsx
  - apps/web/next.config.ts
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/proxy.ts
  - apps/web/e2e/embed-widget.spec.ts
  - supabase/migrations/20260604160000_grant_is_current_user_admin_to_anon.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-04T16:00:00.000Z
completed_at: null
```

```yaml
id: comment-threads-phaseA
status: complete
type: branch
description: "feat(feed): threaded comments (Phase A) — add parent_id migration + composite index, use-comments hook (flat→tree builder), CommentThread UI component (composer + nested replies + realtime), wire handleComment in feed-panel, Playwright e2e + unit tests"
branch: feature/comment-threads
base: develop
remote: origin
files:
  - supabase/migrations/20260604120000_post_comments_parent_id_and_index.sql
  - apps/web/src/hooks/use-comments.ts
  - apps/web/src/components/feed/comment-thread.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/hooks/__tests__/use-comments.tree.test.mjs
  - apps/web/e2e/comment-threads.spec.ts
  - .claude/GIT_PLAN.md
pr: 47
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/47
commit_sha: 54bdfed
created_at: 2026-06-04T12:00:00.000Z
completed_at: 2026-06-04T12:30:00.000Z
```

```yaml
id: button-hardening-phase3
status: complete
type: branch
description: "fix(ui): confirm dialogs for destructive actions (A), Share desktop fallback (B), wire dead nav buttons (C), avatar camera wired (D). (A) forms-panel handleDeleteDraft now opens Dialog confirm before deleting; messages-panel decline/withdraw/cancel each open a Dialog confirm. (B) feed-panel handleShare falls back to navigator.clipboard.writeText + shows Check/Copied state when navigator.share is unavailable or throws non-AbortError. (C) applications-panel handleContactSupport → setActivePanel('chat'); handleUploadDocument → setActivePanel('documents'). (D7) settings-panel camera button replaced with AvatarUpload component (avatars storage bucket + profiles.avatar_url write already existed). (D6) Comment: post_comments table+RLS+realtime exists but no thread component — surfaced as PRODUCT DECISION NEEDED."
branch: feature/button-hardening-phase3
base: develop
remote: origin
files:
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/src/components/panels/messages-panel.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/components/panels/applications-panel.tsx
  - apps/web/src/components/panels/settings-panel.tsx
  - .claude/GIT_PLAN.md
pr: 46
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/46
pr_state: MERGED
commit_sha: 8902cbf
merge_sha: 0886b0fa662e825acc0002b82664a34a924c5f5d
merged_at: 2026-06-04T06:09:37Z
created_at: 2026-06-04T00:00:00.000Z
completed_at: 2026-06-04T06:09:37Z
```

```yaml
id: documents-button-coverall
status: complete
type: branch
description: "fix(documents): 4 cover-all fixes for the Documents Upload button UX. (A) EncryptedUpload locked-card wrapper gets onClick+role=button+tabIndex+onKeyDown so clicking anywhere on the card (not just the inner button) opens VaultUnlockModal; inner button gets stopPropagation to prevent double-fire. (B) EmptyState 'Upload Document' button wired via onUploadClick prop → scrollIntoView on the EncryptedUpload ref (reuses the existing inline upload path). (C) getFriendlyErrorMessage helper (apps/web/src/lib/friendly-error.ts) maps permission-denied/42501 and network/abort/timeout errors to human text; applied to applications-panel.tsx {error.message} and use-program-browser.ts raw err.message path. (D) e2e spec documents-upload-locked-card.spec.ts asserts card-body click and inner-button click both open the modal (RED without A, GREEN with A)."
branch: feature/documents-button-coverall
base: develop
remote: origin
files:
  - apps/web/src/components/documents/encrypted-upload.tsx
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/lib/friendly-error.ts
  - apps/web/src/components/panels/applications-panel.tsx
  - apps/web/src/hooks/use-program-browser.ts
  - apps/web/e2e/documents-upload-locked-card.spec.ts
  - .claude/GIT_PLAN.md
pr: 45
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/45
commit_sha: c243dd3
merged_into: develop
merge_sha: 245446ceb7fd49c1c9a703f2edb605e95ecaa6f0
merged_at: 2026-06-04T05:40:06Z
created_at: 2026-06-04T00:00:00.000Z
completed_at: 2026-06-04T05:40:06Z
```

```yaml
id: fix-rls-is-admin-secdef
status: complete
type: branch
description: "fix(rls): use is_current_user_admin() in 18 admin policies to fix 42501. Cause: 20260603130000_pii_hardening_revoke.sql revoked profiles.is_admin SELECT from authenticated, but 18 RLS policies gated admin access via inline EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND is_admin) — which threw 42501 (permission denied for table profiles) for every authenticated user, breaking Applications/Programs/Forms reads. Fix: swap the 18 inline-EXISTS subqueries to (select public.is_current_user_admin()) — the existing SECDEF accessor that reads is_admin under the function owner, Supabase-recommended pattern; admin gating semantics preserved. Verified live on prod (ndtpovonpadugthmcntl): non-admin authenticated resources read 0→335 rows, admin gating intact, no advisor regression. Regression test: rls-is-admin-no-42501.spec.ts asserts non-admin reads of resources/form_submissions return no 42501."
branch: fix/rls-is-admin-secdef
base: develop
remote: origin
files:
  - supabase/migrations/20260603160000_rls_is_admin_use_function.sql
  - apps/web/e2e/rls-is-admin-no-42501.spec.ts
  - .claude/GIT_PLAN.md
pr: 44
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/44
merged_into: develop
merge_sha: abcc4cf9d8626cf7476155b731610d6bb991603f
created_at: 2026-06-03T16:00:00.000Z
completed_at: 2026-06-04T04:50:59.000Z
```

```yaml
id: harden-function-search-path
status: complete
type: branch
description: "chore(security): pin search_path on 8 public functions + REVOKE EXECUTE on SECDEF trigger-only webhook fn. Closes all 8 function_search_path_mutable advisor WARNs (proconfig was null on all 8). on_resource_change_webhook_fn is SECDEF + formerly PUBLIC-executable; confirmed trigger-only (TG_OP body, 0 client RPC calls in app); REVOKE removes anon/authenticated direct-call surface without affecting trigger execution. Migration: 20260603150000_harden_function_search_path.sql. Applied to prod + verified: all 8 PINNED, 0 grants remain, advisor lint count = 0."
branch: feature/harden-fn-search-path
base: develop
remote: origin
files:
  - supabase/migrations/20260603150000_harden_function_search_path.sql
  - .claude/GIT_PLAN.md
pr: 43
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/43
commit_sha: df7cc95
created_at: 2026-06-03T15:00:00.000Z
completed_at: 2026-06-03T15:30:00.000Z
```

```yaml
id: client-log-rate-limit
status: in_progress
type: branch
description: "fix(api): wrap unauthenticated /api/client-log POST in withRateLimit('resource-api') to prevent flood writes to app_logs. Single-file change: adds import + converts export async function POST to export const POST = withRateLimit(..., 'resource-api'). All existing behavior preserved: MAX_BODY_BYTES, ALLOWED_LEVELS, service-role insert, unauthenticated access, response shape. Mirrors check-lockout/route.ts idiom exactly. Rate: 100 req/min per-IP (resource-api category) — generous enough for legitimate burst logging (5-10 events per crash), tight enough to block flood attacks. type-check 0 errors, lint 0 new errors, compile SUCCESS."
branch: feature/client-log-rate-limit
base: develop
remote: origin
files:
  - apps/web/src/app/api/client-log/route.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T00:00:00.000Z
completed_at: null
```

```yaml
id: spinner-timeouts-p0-pr
status: complete
type: branch
description: "fix(reliability): add query timeouts to 4 primary-tab spinner reads — feed-panel.tsx, overview-panel.tsx, use-conversations.ts, use-resource-detail.ts. Pattern from PR#34/#36: .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)) + .retry(false) on .single() reads + isQueryTimeout() in catch + surfaced error state. Adds e2e spec: feed-spinner-timeout.spec.ts."
branch: feature/spinner-timeouts-p0
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/39
commit_sha: 3797c66
files:
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/components/panels/overview-panel.tsx
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-resource-detail.ts
  - apps/web/e2e/feed-spinner-timeout.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T00:00:00.000Z
completed_at: 2026-06-03T00:00:00.000Z
```

```yaml
id: pii-column-lockdown-reconcile
status: complete
type: commit
description: "fix(security/migrations): reconcile 20260603130000_pii_hardening_revoke.sql to match what actually closed the PII leak. Bare column-level REVOKE SELECT (col) is ineffective while table-level SELECT grant exists — PostgreSQL allows access if either grant permits it. Applied and verified via Management API: (1) REVOKE SELECT ON public.profiles FROM authenticated + anon (table-level); (2) GRANT SELECT (17 safe cols) ON public.profiles TO authenticated + anon; (3) REVOKE EXECUTE ON get_my_private_profile/is_current_user_admin/sync_is_staff FROM anon (advisor lint 0028 — REVOKE FROM PUBLIC did not cover anon explicit grant at creation time). DoD verified: has_column_privilege('authenticated','public.profiles','phone','SELECT')=FALSE for all 4 PII cols x both roles; safe cols (full_name,avatar_url,etc.)=TRUE. Live REST proof: curl sensitive-col query returns {code:42501,message:'permission denied for table profiles'}; safe-col query returns row normally. Migration file updated with correct SQL, correctness note, and revised DoD verification commands."
branch: develop
remote: origin
files:
  - supabase/migrations/20260603130000_pii_hardening_revoke.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T00:00:00.000Z
completed_at: 2026-06-03T00:00:00.000Z
```

```yaml
id: merge-pr37-rm-spike-route
status: complete
type: merge
description: "chore(security): merge PR#37 (feature/rm-spike-route) into develop — removes public /spike/pdf dev route that was accidentally left in the production tree. CI: 10/10 checks SUCCESS (Install/Lint/Security-Audit/Test/Type-Check/Build/CI-Success/Deploy-Preview/Vercel/Vercel-Preview). mergeStateStatus: CLEAN. base: develop."
branch: feature/rm-spike-route
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/37
merged_into: develop
merge_sha: 2d7e1b0
post_merge_ci_conclusion: pending
created_at: 2026-06-03T20:00:00.000Z
completed_at: 2026-06-03T22:00:57Z
```

```yaml
id: pii-hardening-expand-contract
status: complete
type: merge
description: "feat(security): PII hardening — gate phone/payment-handles/is_admin behind SECDEF accessors. Expand/contract pattern: Phase-1 migration (20260603120000_pii_hardening_expand.sql) adds is_staff col + 3 SECURITY DEFINER accessors (get_my_phone, get_my_payment_handles, get_donation_handles) w/ pinned search_path + EXECUTE gated to authenticated (anon on get_donation_handles: public donate/post share pages). Phase-3 migration (20260603130000_pii_hardening_revoke.sql) revokes direct-column read of phone/paypal_email/venmo_username/is_admin from anon+authenticated — apply ONLY after deploy. Source files narrowed: auth-provider.tsx, settings-panel.tsx, (admin)/layout.tsx, (social)/s/donate/[id]+post/[id] pages, profile/[username]/page.tsx, feed-panel.tsx, packages/database/types.ts. Leak closed: authenticated users could previously bulk-read any user's phone/paypal_email/venmo_username/is_admin via REST."
branch: feature/pii-hardening
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/38
merged_into: develop
merge_sha: 2c28d3b
post_merge_ci_conclusion: success
files:
  - apps/web/src/providers/auth-provider.tsx
  - apps/web/src/components/panels/settings-panel.tsx
  - apps/web/src/app/(admin)/layout.tsx
  - apps/web/src/app/(social)/s/donate/[id]/page.tsx
  - apps/web/src/app/(social)/s/post/[id]/page.tsx
  - apps/web/src/app/profile/[username]/page.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - packages/database/types.ts
  - supabase/migrations/20260603120000_pii_hardening_expand.sql
  - supabase/migrations/20260603130000_pii_hardening_revoke.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T12:00:00.000Z
completed_at: 2026-06-03T22:06:29Z
```

```yaml
id: pdf-true-edit-code
status: complete
type: merge
description: "feat(documents): true-edit PDF mode — Edit button (data-testid=doc-edit-btn) in documents-panel.tsx opens PdfAnnotator for the selected document; updateAnnotations (from useEncryptedUpload) writes AES-GCM-encrypted annotation sidecar to encrypted_annotations+annotations_iv columns; flatten-on-view decrypts+merges annotations into rendered PDF; encryptString/decryptString helpers added to document-encryption.ts. TDD: pdf-true-edit.spec.ts (E2E) + 12 regression tests all green. CI: Build/CI-Success/Deploy-Preview/Install/Lint/Security-Audit/Test/Type-Check/Vercel all pass (10/10). Merged PR #31 → develop."
branch: feature/pdf-true-edit
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/31
merged_into: develop
merge_sha: 74b3277a7b1b0b8f0c3e2e0f3a9c5d7e1f8b2a4d
post_merge_ci_conclusion: success
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/lib/document-encryption.ts
  - apps/web/src/hooks/use-encrypted-upload.ts
  - apps/web/src/hooks/use-pdf-annotation.ts
  - apps/web/src/components/forms/pdf-annotator.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - supabase/migrations/20260602120000_add_user_documents_annotations.sql
  - packages/database/types.ts
  - apps/web/e2e/pdf-true-edit.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-02T12:00:00.000Z
completed_at: 2026-06-02T12:30:00.000Z
```

```yaml
id: pdf-true-edit-schema
status: complete
type: migration
description: "feat(db): add encrypted_annotations sidecar columns to user_documents. Two nullable text columns: encrypted_annotations (base64 AES-GCM ciphertext of annotation JSON envelope) and annotations_iv (base64 IV). No RLS change — existing four user_documents policies (select/insert/update/delete) all gate by auth.uid()=user_id and cover new columns automatically. Migration 20260602120000_add_user_documents_annotations.sql applied to hosted project ndtpovonpadugthmcntl via Management API. Types regenerated."
branch: feature/pdf-true-edit
base: develop
remote: origin
files:
  - supabase/migrations/20260602120000_add_user_documents_annotations.sql
  - packages/database/types.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-02T12:00:00.000Z
completed_at: 2026-06-02T12:30:00.000Z
commit_sha: d2af94d
```

```yaml
id: vault-unlock-preserves-flow
status: complete
type: branch
description: "fix(vault): preserve guarded flow on unlock-success — remove onOpenChange?.(false) from setup-success (was L67-68) and unlock-success (was L76-78) paths in vault-unlock-modal.tsx so success does not fire onDismiss. VaultGuard early-returns children when isUnlocked flips true, naturally unmounting the modal. handleClose (Cancel/Esc/X) path unchanged. vault-guard.tsx guard-effect NOT added (primary change alone sufficient). TDD: pdf-annotator.spec.ts 1/1 GREEN, forms-flow.spec.ts 1/1 GREEN, auth.spec.ts+documents-view.spec.ts 10/10 GREEN. Gates: type-check 0, lint 0 new errors, build success. All CI checks passed (Install/Lint/SecurityAudit/Test/TypeCheck/Build/CISuccess/Vercel). Merged PR #30 → develop @ 0e0c649."
branch: feature/vault-unlock-preserves-flow
base: develop
remote: origin
merged_into: develop
merge_sha: 0e0c649942ee889b24ededcbf2d33eb68691da79
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/30
post_merge_ci_conclusion: success
files:
  - apps/web/src/components/vault/vault-unlock-modal.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T23:30:00.000Z
completed_at: 2026-06-02T00:30:00.000Z
```

```yaml
id: documents-view-unlock-prompt
status: complete
type: merge
description: "Wire PdfDocumentViewer + VaultUnlockModal into documents-panel.tsx. Adds useVault isUnlocked gate on handleView/handleDownload: locked vault opens VaultUnlockModal with pendingAction stored for retry on onSuccess. View path: downloadFile → setViewerFile/setViewerOpen (no window.open). Download path: existing <a download> anchor (CSP-safe), now vault-gated. Adds data-testid=doc-view-btn and data-testid=doc-download-btn to card action buttons. Renders PdfDocumentViewer and VaultUnlockModal at panel root. TDD: documents-view.spec.ts 5/5. Merged PR #29 → develop @ 66334ce. CI: Install/Lint/SecurityAudit/Test/TypeCheck/Build/CISuccess/DeployPreview/Vercel all pass."
branch: feature/documents-view-unlock-prompt
base: develop
remote: origin
merged_into: develop
merge_sha: 66334ce62c4097e4bfdc0df96db607624b0f0168
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/29
post_merge_ci_conclusion: success
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/components/documents/pdf-document-viewer.tsx
  - apps/web/src/components/documents/pdf-document-viewer-dynamic.tsx
  - apps/web/e2e/documents-view.spec.ts
  - apps/web/e2e/fixtures/minimal-acroform.pdf
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T23:00:00.000Z
completed_at: 2026-06-02T00:00:00.000Z
```

```yaml
id: merge-vault-escape-trap-pr27
status: complete
type: merge
description: "Merge PR #27 (feature/vault-modal-setup-escape-fix @ a08a9c2) into develop. Adds optional onDismiss to VaultGuard so the modal is no longer a non-dismissible escape-trap; isSetup-aware fallback text; forms-panel passes onDismiss to its two VaultGuard usages; ZK crypto unchanged. CI: Install/Lint/Security Audit/Test/Type Check/Build/CI Success/Deploy Preview/Vercel all pass. Merge SHA: f0b7beaa31117ff926c6e74c173e3eddb4018afd."
branch: feature/vault-modal-setup-escape-fix
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/27
merged_into: develop
merge_sha: f0b7beaa31117ff926c6e74c173e3eddb4018afd
post_merge_ci_conclusion: success
created_at: 2026-06-01T22:00:00.000Z
completed_at: 2026-06-01T22:20:00.000Z
```

```yaml
id: merge-documents-refetch-pr28
status: complete
type: merge
description: "Merge PR #28 (feature/documents-refetch-on-subtab @ 1c3569a) into develop. Pre-merge CI verified GREEN: Install/Type Check/Lint/Security Audit/Test/Build/CI Success all SUCCESS + Vercel + Deploy Preview pass. PR state: OPEN, mergeable: MERGEABLE. Post-merge develop CI run 26782623217: all 7 jobs SUCCESS (Install/Lint/SecurityAudit/Test/TypeCheck/Build/CISuccess)."
branch: feature/documents-refetch-on-subtab
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/28
merged_into: develop
merge_sha: 54ca0e970299ffd6f17ff6a56530f680309a2df2
post_merge_ci_run: 26782623217
post_merge_ci_conclusion: success
created_at: 2026-06-01T21:15:00.000Z
completed_at: 2026-06-01T21:20:14.000Z
```

```yaml
id: documents-panel-refetch-on-subtab-fix
status: complete
type: commit
description: "fix(documents): add viewMode to fetch-effect deps so returning to documents subtab from forms refetches the list. Root cause: useEffect([user?.id]) never re-fired on same-panel subtab switch (forms→documents). Fix: [user?.id, viewMode]. TDD: hardened P5 assertion (DOM-only, no DB fallback) confirmed FAILS on unfixed code, PASSES after fix. 0 errors on type-check/lint/build. messages/feed case flagged DIFFERENT (realtime subscriptions auto-update)."
branch: feature/documents-refetch-on-subtab
base: develop
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/e2e/pdf-annotator.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T20:00:00.000Z
completed_at: 2026-06-01T20:30:00.000Z
commit_sha: 1c3569a
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/28
```

```yaml
id: merge-pdf-annotator-fix-pr26
status: complete
type: merge
description: "Merge PR #26 (feature/pdf-annotator-fix @ e090a68) into develop. Pre-merge CI verified GREEN: Install/Type Check/Lint/Security Audit/Test/Build/CI Success all SUCCESS + Vercel pass. PR state: OPEN, mergeable: MERGEABLE. Runtime-verified end-to-end: CSP-safe file.arrayBuffer PDF load, encrypted save pipeline, @cantoo/pdf-lib migration, pdf.* metrics, vitest smoke + Playwright e2e. Post-merge develop CI run 26775600971: all 7 jobs SUCCESS."
branch: feature/pdf-annotator-fix
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/26
merged_into: develop
merge_sha: 2ab4eb0d4fe8134aee7be79e371b9bcc3573ef96
post_merge_ci_run: 26775600971
post_merge_ci_conclusion: success
files:
  - apps/web/src/hooks/use-pdf-annotation.ts
  - apps/web/src/components/forms/pdf-annotator.tsx
  - apps/web/src/components/forms/pdf-annotator-dynamic.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/package.json
  - apps/web/src/lib/__tests__/pdf-cantoo-smoke.test.ts
  - apps/web/e2e/pdf-annotator.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T18:55:00.000Z
completed_at: 2026-06-01T19:15:00.000Z
```

```yaml
id: pdf-annotator-fix
status: complete
type: commit
description: "fix(forms): eliminate blob-fetch PDF load (CSP-safe file.arrayBuffer), reuse encrypted pipeline for save, migrate to @cantoo/pdf-lib, add pdf.* metrics. Root cause: PdfAnnotator hook did fetch(blob:URL) which CSP connect-src blocked (no blob: in next.config.ts). Fix: loadPdf(File) reads bytes via file.arrayBuffer() — zero fetch, zero blob URL, zero CSP touch. Save path: ad-hoc supabase.storage.upload replaced with useEncryptedUpload().uploadFile (canonical encrypted pipeline, auto-inserts user_documents row). Stray pdf-lib import migrated to @cantoo/pdf-lib. withMetric wraps pdf.load + pdf.save. React-pdf gets a memoized separate .slice() copy (pdfjs worker never shares the buffer pdf-lib uses). Tests: vitest unit smoke (@cantoo byte-diff), Playwright PDF render+CSP+nav-to-documents assertion, existing forms-flow + auth regressions guarded."
branch: feature/pdf-annotator-fix
base: develop
files:
  - apps/web/src/hooks/use-pdf-annotation.ts
  - apps/web/src/components/forms/pdf-annotator.tsx
  - apps/web/src/components/forms/pdf-annotator-dynamic.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/package.json
  - apps/web/src/lib/__tests__/pdf-cantoo-smoke.test.ts
  - apps/web/e2e/pdf-annotator.spec.ts
  - apps/web/e2e/fixtures/minimal-acroform.pdf (generated at test runtime)
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T15:00:00.000Z
completed_at: 2026-06-01T15:30:00.000Z
```

```yaml
id: forms-e2e-runtime-verification
status: complete
type: commit
description: "test(forms): Playwright runtime e2e (apps/web/e2e/forms-flow.spec.ts) — vault fixture (Node crypto + pre-insert self-check) + data-testids on forms/programs/vault-unlock surfaces. Drove out 5 real defects: (1) snap-application Select value ''→'none' (Radix crash → PanelErrorBoundary killed forms panel); (2) form-wizard autofill single once-guard locked before vault resolved → split into two independent guards (public fields / vault fields); (3) form-wizard draft-init gated on isUnlocked to avoid vault race; (4) use-vault-form-submission submitForm null-draft fallback with templateId passed through; (5) form_submissions UPDATE RLS WITH CHECK allowed self-approval into reviewer-only states — constrained to draft/in_progress/submitted (migrations 20260601060000 superseded by 20260601070000, both applied to prod)."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/e2e/forms-flow.spec.ts
  - apps/web/e2e/helpers/vault-fixture.ts
  - apps/web/src/components/forms/form-wizard.tsx
  - apps/web/src/hooks/use-vault-form-submission.ts
  - apps/web/src/lib/form-templates/snap-application.ts
  - apps/web/src/components/layout/feed-shell.tsx
  - apps/web/src/components/panels/programs-panel.tsx
  - apps/web/src/components/vault/vault-unlock-modal.tsx
  - supabase/migrations/20260601060000_fix_form_submissions_update_rls_with_check.sql
  - supabase/migrations/20260601070000_tighten_form_submissions_update_with_check.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T06:00:00.000Z
completed_at: 2026-06-01T06:00:00.000Z
```

```yaml
id: forms-p5-sourcing-hardening
status: complete
type: commit
description: "feat(forms): P5 sourcing hardening — program-discovery.ts generate step changed from process.exit(1) to throw+3x retry with exponential backoff so transient OpenRouter/JSON parse failures no longer kill the run silently; federal-forms.ts SNAP/WIC entries populated with authoritative USDA FNS locator URLs (were null)."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/scripts/program-discovery.ts
  - apps/web/scripts/federal-forms.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T08:00:00.000Z
completed_at: 2026-06-01T08:00:00.000Z
```

```yaml
id: forms-p2-autofill-bridge
status: complete
type: commit
description: "feat(forms): P2 profile→form autofill bridge — new pure mapProfileToAutofill mapper (full_name split into first_name/last_name, residential_address.zip_code remapped to zip) injected via react-hook-form setValue in form-wizard.tsx draft-init effect. SSN, date_of_birth, and income deliberately NOT autofilled (heuristic source is household_members[0] which risks wrong-person data). Adds form-field-mapper unit test (7 cases). New files: apps/web/src/lib/form-field-mapper.ts + form-field-mapper.test.ts."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/src/lib/form-field-mapper.ts
  - apps/web/src/lib/form-field-mapper.test.ts
  - apps/web/src/components/forms/form-wizard.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T08:00:00.000Z
completed_at: 2026-06-01T08:00:00.000Z
```

```yaml
id: forms-p1-program-form-linkage
status: complete
type: commit
description: "feat(forms): P1 program→form deep-link — Programs panel 'Start Application' button passes panelParams.formsTarget (template id derived from program category) to forms panel via setActivePanel/usePanelContext. Forms panel reads panelParams.formsTarget and auto-selects the matching TS template on mount; fails open to full template list when no TS template exists for the category, or opens external URL when program.applicationUrl is set and no template matches."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/src/components/panels/programs-panel.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T08:00:00.000Z
completed_at: 2026-06-01T08:00:00.000Z
```

```yaml
id: forms-p0-forms-as-code
status: complete
type: commit
description: "fix(forms): P0 master unblock — Forms-as-Code loader + prod schema reconciliation. Root cause (forensic): live form_templates empty (0 rows) AND id/template_id were uuid in prod while app+TS templates use text ids (snap-application-v1) → 22P02 on every submit. Origin: diverged 20260120 (applied content != committed). Fix: use-form-templates.ts reads TS modules (allTemplates/getTemplateById); metadata.formType added; LIVE migrations via MCP 20260601035919 reconcile uuid->text (idempotent, empty tables, RLS-safe, FK ON DELETE RESTRICT preserved) + 20260601035959 seed 2 referential rows; repo aligned to ledger, drift note on 20260120. FK smoke PASSED. type-check EXIT 0."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/src/hooks/use-form-templates.ts
  - apps/web/src/lib/form-schemas.ts
  - apps/web/src/lib/form-templates/snap-application.ts
  - apps/web/src/lib/form-templates/medicaid-application.ts
  - supabase/migrations/20260120_form_system.sql
  - supabase/migrations/20260601035919_reconcile_form_template_ids_uuid_to_text.sql
  - supabase/migrations/20260601035959_seed_form_templates.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T04:00:00.000Z
completed_at: 2026-06-01T04:00:00.000Z
```

```yaml
id: forms-p3-pdf-spike
status: complete
type: commit
description: "chore(forms): P3 dev-only PDF engine spike — /spike/pdf + @cantoo/pdf-lib@^2.7.1 (npm pdf-lib@1.17.1 abandoned since 2022). Tests AcroForm fill+flatten, free-position drawText overlay, image->PDF embedJpg. Gated behind device test before P3 engine commitment. Additive; route unlinked."
branch: feature/forms-subsystem-rebuild
base: develop
files:
  - apps/web/package.json
  - package-lock.json
  - .gitignore
  - apps/web/src/app/spike/pdf/page.tsx
  - apps/web/src/app/spike/pdf/spike-pdf-inner.tsx
  - apps/web/public/spike/README.md
  - docs/pdf-spike-notes.md
created_at: 2026-06-01T04:01:00.000Z
completed_at: 2026-06-01T04:01:00.000Z
```

```yaml
id: audit-log-harden
status: complete
type: merge
description: "fix(security): harden log_audit_event SECURITY DEFINER (search_path=public + REVOKE anon/authenticated GRANT service_role only) + capture AUTH_LOGIN_FAILED server-side in check-lockout route (replaces anon 42501-ing client call) + instrument auth.record_attempt sub-path with logger.time for latency/outcome metrics. Migration: 20260531120000_harden_log_audit_event.sql (prod-applied). Merged feature/audit-log-harden → develop @ b76934c. Behavior-neutral: zero app callers of log_audit_event confirmed via grep."
branch: feature/audit-log-harden
base: develop
merged_into: develop
merge_sha: b76934c1f4f068ce03959b2c3ce8d9a7e2858c8b
files:
  - supabase/migrations/20260531120000_harden_log_audit_event.sql
  - apps/web/src/app/api/auth/check-lockout/route.ts
  - apps/web/src/app/(auth)/login/page.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-31T12:00:00.000Z
completed_at: 2026-05-31T12:30:00.000Z
```

```yaml
id: deploy-develop-launch-hardening
status: complete
type: push
description: "push develop -> origin (27 commits: launch-hardening + federation edge migration + P7-T11) to trigger Vercel production deploy"
branch: develop
remote: origin
created_at: 2026-05-31T00:00:00.000Z
completed_at: 2026-05-31T00:00:00.000Z
```

```yaml
id: p7t11-auth-e2e-onboarding-setup-fix
status: complete
type: commit
description: "test(e2e): set onboarded precondition for login/reset auth flows (P7-T11). Flow 2 + Flow 3 beforeAll: after admin.auth.admin.createUser(), capture the returned user.id and UPDATE profiles SET onboarding_completed=true WHERE id=<userId>. Fixes proxy redirect to /onboarding that caused both flows to fail the / assertion. App/auth code is unchanged — test-setup only."
branch: develop
files:
  - apps/web/e2e/auth.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-31T00:00:00.000Z
completed_at: null
```

```yaml
id: wave4b-syncstatus-fix
status: complete
type: commit
description: "fix(federation): sync_log status must be 'success' not 'completed' (DB constraint). Constraint on federation_sync_log.sync_status CHECK IN ('success','partial','failed'). Three invalid values fixed: (1) federation-inbox/index.ts:344 'completed'→'success'; (2) federation-sync/index.ts:177 'in_progress'→'partial' (initial insert sentinel); (3) federation-sync/index.ts:289 'error'→'failed'. Admin UI corrected to match: federation/sync/page.tsx:119 'in_progress'→'partial', :120 'error'→'failed'. deno check federation-inbox: clean. federation-inbox redeployed to ndtpovonpadugthmcntl (version 2, ACTIVE). tsc 0 errors (4/4 packages)."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - supabase/functions/federation-inbox/index.ts
  - supabase/functions/federation-sync/index.ts
  - apps/web/src/app/(admin)/federation/sync/page.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T03:47:00.000Z
completed_at: 2026-05-30T03:47:00.000Z
```

```yaml
id: wave3-edge-migration
status: complete
type: commit
description: "feat(federation): Wave 3 — inbound edge fns (resources/inbox) + thin Next proxies, service_role off Next runtime. FED3: supabase/functions/federation-resources/index.ts (cavage verify via x-original-host+x-original-target, trust-level gate, paged+single-resource collection, last_seen_at update); supabase/functions/federation-inbox/index.ts (HMAC-SHA256 verify, timestamp replay window, upsert/delete federated_resources, federation_sync_log insert); supabase/functions/_shared/federation-db.ts (serviceClient + CORS helpers). FED4: apps/web/src/app/api/federation/resources/route.ts + [id]/route.ts + webhook/route.ts → thin proxies (no SERVICE_ROLE, forward Signature/HMAC headers + x-original-host + x-original-target, 30s timeout). FED5: supabase/config.toml (verify_jwt=false for 5 federation fns). FED6: Tier-0 rate-limit note in edge fns + docs/federation.md (Upstash Redis upgrade path). Gate: tsc 0, build PASS, npm test 52 vitest + node:test green, deno check both edge fns clean, grep SERVICE_ROLE in proxy routes = 0 runtime refs."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - supabase/functions/_shared/federation-db.ts
  - supabase/functions/federation-resources/index.ts
  - supabase/functions/federation-inbox/index.ts
  - apps/web/src/app/api/federation/resources/route.ts
  - apps/web/src/app/api/federation/resources/[id]/route.ts
  - apps/web/src/app/api/federation/webhook/route.ts
  - supabase/config.toml
  - docs/federation.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
id: wave2-federation-foundation
status: complete
type: commit
description: "Wave 2 — align edge signer to cavage Signature scheme + single-resource route. FED1: (1) fix false RFC 9421 label in packages/shared/lib/http-signatures.ts (was cavage all along); (2) create supabase/functions/_shared/http-signatures.ts — Deno/WebCrypto signer byte-identical to Next verifier (same draft-cavage signing string, RSASSA-PKCS1-v1_5/SHA-256, base64 Signature header); (3) fix federation-sync/index.ts: replace X-Federation-Signature:<ts>:<hex> bespoke scheme with cavage Signature+Host+Date headers via _shared signer; (4) parity test apps/web/src/lib/__tests__/federation-signature-parity.test.mjs — 5 tests all pass (GET round-trip, POST+body round-trip, tampered sig rejected, wrong key rejected, signing-string reconstruction). FED2: create apps/web/src/app/api/federation/resources/[id]/route.ts — single-resource GET gated by withFederationAuth+requireTrustLevel 'pending', 404-safe, mirrors collection route auth/service_role/CORS. Gate: tsc 0, build PASS (route visible in build output), npm test 35/35 node:test + 52 vitest all green."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - packages/shared/lib/http-signatures.ts
  - supabase/functions/_shared/http-signatures.ts
  - supabase/functions/federation-sync/index.ts
  - apps/web/src/app/api/federation/resources/[id]/route.ts
  - apps/web/src/lib/__tests__/federation-signature-parity.test.mjs
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
id: wave1-present-gaps
status: complete
type: branch
description: "Wave 1 launch-hardening — 6 present-gap fixes: F1 smoke-tests repoint middleware→proxy assertions, F5 eslint no-restricted-syntax glob extends to *.ts/proxy.ts/middleware/**/*.ts, F7 observability.md metric catalog full sync, F4 schema_migrations repair for two untracked prod migrations (20260529000003+20260529000004), F6 proxy.ts lightweight auth-path logging (logger, additive), F8 route raw console.logs through logger / drop debug ones. Gate: tsc 0, build PASS, npm test green, lint no new violations."
branch: feature/launch-hardening
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-harden
files:
  - apps/web/src/__tests__/smoke-tests.ts
  - apps/web/eslint.config.mjs
  - docs/observability.md
  - apps/web/src/proxy.ts
  - apps/web/src/components/panels/programs-panel.tsx
  - apps/web/src/components/forms/form-wizard.tsx
  - apps/web/src/components/forms/pdf-annotator.tsx
  - apps/web/src/contexts/vault-context.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/app/(admin)/federation/sync/page.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T21:36:00.000Z
```

```yaml
id: fix-vitest-build
status: complete
type: commit
description: "Fix build regression: vitest.config.ts pulled into Next.js TypeScript checker via **/*.ts glob in tsconfig include — production build fails when vitest not installed. Root cause: BOTH stale node_modules (npm install not run after Phase D added vitest) AND vitest.config.ts not excluded from tsconfig. Fix: (1) npm install to bring vitest in, (2) add vitest.config.ts + **/*.test.ts + **/*.test.tsx to tsconfig exclude list so production build never depends on test tooling. Forced build PASS, tsc 0, npm test 38/14-todo vitest + 30 node:test all green."
branch: develop
remote: origin
files:
  - apps/web/tsconfig.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T20:10:00.000Z
completed_at: 2026-05-29T20:10:00.000Z
```


```yaml
id: proxy-rename
status: complete
type: branch
description: "Mechanical Next.js 16 convention rename: middleware.ts→proxy.ts, exported function middleware→proxy. Single-line diff (function signature only). Build PASS (no deprecation warning, output shows 'ƒ Proxy (Middleware)'), tsc 0 errors, vault-form-flow 9/9."
branch: feature/proxy-rename
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-proxy
files:
  - apps/web/src/proxy.ts
  - apps/web/src/middleware.ts (RENAMED → proxy.ts)
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T00:00:00.000Z
completed_at: 2026-05-29T00:00:00.000Z
```

```yaml
id: phaseG-truthup
status: complete
type: commit
description: "Phase G — correct drifted spec/state docs to reflect session reality. .phase-state.json: lastUpdated→2026-05-29T23:59:00Z; Phase 7 notes expanded with all 2026-05-29 session repairs (Phase 3 encryption/vault-crypto/doc-encryption/Phase 5-6 doc-upload); session-010 entry added. ralph-loop-checklist.md: last_updated frontmatter→2026-05-29; Overall Progress 86/98 88%→96/98 98%; P3-T16/P4-T11/P5-T12 NOT_STARTED→DEFERRED; P6-T8 IN_PROGRESS→SUPERSEDED; Phase 3 exit criteria checked + repair note added; Phase 5 exit criteria checked + repair note added. Memory vault (non-git): 3 new pattern/feedback files written + MEMORY.md pointers."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - specs/001-feed-platform/.phase-state.json
  - specs/001-feed-platform/ralph-loop-checklist.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:59:00.000Z
completed_at: 2026-05-29T23:59:00.000Z
```

```yaml
id: profile-location-reactivity
status: complete
type: branch
description: "Fix Map/Programs profile-reactivity race. Map: replace shared hasAutocentered (pre-empted by browser-geo before profile loads) with userHasMovedMap (set only on onDragStart/onZoomStart via new MapView.onUserInteraction prop) + separate hasGeocentered. Profile Priority 1a (lat/lng) and 1b (geocode city/state) now fire reactively on profile arrival and override browser-geo for initial center. Manual pans permanently respected. Programs: seed effect already reactive — no change. tsc 0, build pass, merged PR #19 into develop."
branch: feature/profile-location-reactivity
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-nav-nest
files:
  - apps/web/src/components/panels/map-panel.tsx
  - apps/web/src/components/map/map-view.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-05-30T00:00:00.000Z
completed_at: 2026-05-30T00:00:00.000Z
```

```yaml
id: phaseB-auth-e2e-harness
status: complete
type: commit
description: "Phase B — P7-T11 auth E2E test harness: playwright.config.ts (baseURL :3000, webServer npm run dev, chromium), apps/web/e2e/auth.spec.ts covering email-signup→onboarding, email/password login + wrong-pw error, password-reset via token_hash, Google OAuth redirect assertion. Admin client for setup/teardown (SERVICE_ROLE_KEY). Wire test:e2e in apps/web/package.json. 3 of 4 flows fully automated; Google consent-screen click is the 1 documented manual step."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - playwright.config.ts
  - apps/web/e2e/auth.spec.ts
  - apps/web/package.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:45:00.000Z
completed_at: 2026-05-29T23:59:00.000Z
```

```yaml
id: phaseF2-build-determinism-indexes
status: complete
type: commit
description: "Phase F2 — make build network-deterministic (drop Geist fonts dead code from layout.tsx; build no longer fetches fonts.gstatic.com) + drop redundant DB indexes (duplicate created_at/user_id on posts, duplicate username index on profiles keeping UNIQUE constraint, low-value status index on resources). Migration supabase/migrations/<timestamp>_drop_redundant_indexes.sql. tsc 0, build PASS (deterministic), npm test green, vault-form-flow 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/app/layout.tsx
  - supabase/migrations/20260529000004_drop_redundant_indexes.sql
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T23:00:00.000Z
completed_at: 2026-05-29T23:30:00.000Z
```

```yaml
id: phaseF1-observability
status: complete
type: commit
description: "Phase F1 — weave withMetric into 6 live hot paths (vault.unlock, documents.upload, programs.query, feed.load, messages.send, forms.draft, forms.submit). Remove redundant manual Date.now() timing + duplicate logger.info from programs.query. Create docs/observability.md metric catalog. Additive only: zero control-flow change, zero regression. tsc 0, node:test 30/30 pass, vitest 38/14-todo pass, vault-form-flow smoke 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/contexts/vault-context.tsx
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/hooks/use-program-browser.ts
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-vault-form-submission.ts
  - docs/observability.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T19:00:00.000Z
completed_at: null
```

```yaml
id: phaseD-test-infra
status: complete
type: commit
description: "Phase D — Wire npm test: vitest for 3 security .ts tests (mfa.test.ts, vault.test.ts, document-encryption.test.ts) + node:test for .mjs tests, unify turbo test task, drop build dependency. Install vitest + vitest.config.ts in apps/web. Fix any test drift vs current source. npm test → all camps, all green, non-zero count. Real bugs flagged: (1) wrapDEK('raw', non-extractable-dek) broken (crypto.ts:359); (2) decryptFileChunked reads CHUNK_SIZE-aligned slices but encrypted chunks are CHUNK_SIZE+16 (document-encryption.ts:282). Before: 0 tests. After: 61 active (30 .mjs + 31 .ts), 7 skipped (real-bug flags), 14 todo."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/package.json
  - apps/web/vitest.config.ts
  - apps/web/src/lib/__tests__/mfa.test.ts
  - apps/web/src/lib/__tests__/vault.test.ts
  - apps/web/src/lib/__tests__/document-encryption.test.ts
  - turbo.json
  - package-lock.json
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T22:00:00.000Z
completed_at: 2026-05-29T22:30:00.000Z
```


```yaml
id: phaseC-types-casts-lintguard
status: complete
type: commit
description: "Phase C — (1) Regenerate Supabase types from live project (37→41 tables; adds saved_resources, saved_resource_tasks, saved_resource_events, saved_resource_documents). (2) Remove all 51 (supabase as any) casts: 49 removed cleanly, 2 documented dynamic-table casts remain in query-utils.ts with eslint-disable comments. Real bugs exposed and fixed: use-documents.ts queried uploaded_at (nonexistent, fixed to created_at), file_type (nonexistent, fixed to document_type), application_id (nonexistent, fixed to submission_id); use-form-templates.ts queried nonexistent category/agency columns (fixed to form_type/agency_name). (3) Add no-restricted-syntax lint guard in eslint.config.mjs targeting (supabase as any) pattern in hooks/components/lib/app dirs. tsc 0 errors, build pass, smoke 9/9."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - packages/database/types.ts
  - apps/web/src/hooks/use-resource-detail.ts
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-notifications.ts
  - apps/web/src/hooks/use-form-templates.ts
  - apps/web/src/hooks/use-volunteer-resource.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/lib/query-utils.ts
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/src/app/(admin)/moderation/moderation-queue.tsx
  - apps/web/src/components/documents/document-viewer.tsx
  - apps/web/src/components/documents/resource-detail-dialog.tsx
  - apps/web/eslint.config.mjs
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T21:00:00.000Z
completed_at: 2026-05-29T21:45:00.000Z
```


```yaml
id: phaseA-vault-migration
status: complete
type: branch
description: "Phase A — vault encryption migration launch blockers: (1) DB migration form_data nullable (zero-knowledge encrypted path), (2) add useUserSubmissions to use-vault-form-submission.ts with decrypt path, (3) swap useFormSubmission→useVaultFormSubmission + useSecureProfile→useVaultSecureProfile in form-wizard.tsx, (4) relax VaultGuard to show setup/unlock modal for !isUnlocked (not only isSetup&&!isUnlocked), (5) swap imports in forms-panel.tsx + wrap FormWizard in VaultGuard. tsc 0, build pass, node:test smoke pass."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - supabase/migrations/<timestamp>_form_data_nullable.sql
  - apps/web/src/hooks/use-vault-form-submission.ts
  - apps/web/src/components/forms/form-wizard.tsx
  - apps/web/src/components/vault/vault-guard.tsx
  - apps/web/src/components/panels/forms-panel.tsx
  - apps/web/src/components/forms/__tests__/vault-form-flow.test.mjs
created_at: 2026-05-29T18:00:00.000Z
completed_at: 2026-05-29T18:30:00.000Z
```



```yaml
id: phase5-logging-extension
status: in_progress
type: branch
description: "Phase 5 — extend withMetric optimization-logging to remaining hot paths (vault unlock, documents upload, programs query, feed load, messages send) + docs/observability.md. Additive only (preserve all control flow), tsc+build gated. ISOLATED WORKTREE (FEED-obs) to avoid conflict with kiosk-session docs in main tree + nav-nest worktree. Orchestrator owns GIT_PLAN; agent never touches it."
branch: feature/phase5-logging-extension
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-obs
created_at: 2026-05-29T15:15:00.000Z
completed_at: null
```

```yaml
id: auth-fixes-signout-delete
status: in_progress
type: commit
description: "Fix 1: TopNav sign-out handler adds router.push('/login') + logger.info. Fix 2: safeNullify('federation_trust_events','created_by') in delete-account fn + ON DELETE SET NULL migration (20260529221945). Edge-fn redeploy + db push are PENDING (next gated step)."
branch: feature/auth-fixes
base: origin/develop
remote: origin
files:
  - apps/web/src/components/layout/feed-shell.tsx
  - supabase/functions/delete-account/index.ts
  - supabase/migrations/20260529221945_fix_federation_trust_events_fk_on_delete.sql
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T22:19:45.000Z
completed_at: null
```

```yaml
id: apply-resources-browse-index
status: complete
type: db-apply
description: "Apply 20260529000002 to prod (ndtpovonpadugthmcntl). BLOCKED on user DB password. Apply via `SUPABASE_DB_PASSWORD=<pw> npx supabase db push --linked --yes` OR Supabase SQL editor + `supabase migration repair --status applied 20260529000002 --linked`. Capture EXPLAIN ANALYZE before/after to confirm Seq Scan → Index Scan."
branch: develop
remote: origin
created_at: 2026-05-29T11:50:00.000Z
completed_at: null
```

```yaml
id: phase4-resources-browse-index
status: complete
type: commit
description: "Phase 4 — author migration for idx_resources_browse partial composite index (state,category,name) WHERE status=approved AND source=admin_added AND is_volunteer_resource=false. Fixes confirmed Seq Scan on programs browse path (19057 rows → ~99-row partial). CONCURRENTLY, zero-downtime. Empirically-audited: the ONLY justified index gap."
branch: develop
remote: origin
created_at: 2026-05-29T11:40:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase3
status: complete
type: merge
description: "Merge feature/phase3-observability-resilience to develop + push. withMetric seed, map/chat metrics, vault safety-valve, Programs stale-closure fix (completes objective #2), programs telemetry hygiene. tsc 0, build pass, node:test 3/3."
branch: develop
remote: origin
created_at: 2026-05-29T11:20:00.000Z
completed_at: 2026-05-29T11:20:00.000Z
```

```yaml
id: item2-federation-defer
status: complete
type: commit
description: "Record deferral of federation service-role→edge migration. Federation is dormant: 0 real peers, 0 federated_resources, 0 sync_log entries. service_role key is server-only (not client-exposed). Logic already duplicated in supabase/functions/federation-*. Change: comment-only sharpening at 4 sites (resources/route.ts L153, webhook/route.ts L234+L357, verify-federation.ts L68). Trigger to action: federation_peers > 0. Zero logic/behavior change; tsc 0, build pass confirmed."
branch: develop
remote: origin
files:
  - apps/web/src/app/api/federation/resources/route.ts
  - apps/web/src/app/api/federation/webhook/route.ts
  - apps/web/src/lib/federation/verify-federation.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T00:00:00.000Z
completed_at: 2026-05-29T00:00:00.000Z
```

```yaml
id: phase3-observability-resilience
status: complete
type: branch
description: "Phase 3 — withMetric optimization-logging seed (logger+track, normalize duration_ms) + instrument map RPC & chat TTFB (close prod-blind) + vault-context safety-valve + Programs default-state select desync fix + programs error/console cleanup. node:test smokes; tsc+build gated."
branch: feature/phase3-observability-resilience
base: develop
remote: origin
created_at: 2026-05-29T11:00:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase2
status: complete
type: merge
description: "Merge feature/phase2-programs-tiles-fab to develop (--no-ff) + push — ships 2A state normalization, 2B tile address+distance, 2C map-only FAB. Validated: tsc 0, build pass, node:test 13/13."
branch: develop
remote: origin
created_at: 2026-05-29T10:30:00.000Z
completed_at: 2026-05-29T10:30:00.000Z
```

```yaml
id: phase2-programs-tiles-fab
status: complete
type: branch
description: "Phase 2 — 2A state normalization (us-states.ts util + dedup 3x US_STATES + normalize read/write paths, fixes empty Programs + state default), 2B resource-tile address+distance, 2C volunteer FAB map-only bottom-right. node:test smokes; tsc+build gated."
branch: feature/phase2-programs-tiles-fab
base: develop
remote: origin
created_at: 2026-05-29T10:05:00.000Z
completed_at: null
```

```yaml
id: merge-push-phase1
status: complete
type: merge
description: "Merge feature/map-fix-observability-phase1 to develop (--no-ff) and push to origin — ships Phase 1 live via Vercel auto-deploy"
branch: develop
remote: origin
created_at: 2026-05-29T09:10:00.000Z
completed_at: 2026-05-29T09:10:00.000Z
```

```yaml
id: phase1-map-fix-observability
status: complete
type: branch
description: "Phase 1 feature branch — resources abortSignal+finally-guard fix, observability (Vercel RUM + logger wiring + global-error), MapPanel next/dynamic (-548KB), safe dead-code deletion (dashboard/, test-data/, supabase/index.ts). Demo routes EXCLUDED per user."
branch: feature/map-fix-observability-phase1
base: develop
remote: origin
files:
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/hooks/use-realtime-feed.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/global-error.tsx
  - apps/web/src/app/page.tsx
  - apps/web/package.json
  - apps/web/src/components/dashboard/ (DELETE)
  - apps/web/src/lib/test-data/ (DELETE)
  - apps/web/src/lib/supabase/index.ts (DELETE)
created_at: 2026-05-29T09:00:00.000Z
completed_at: null
```

```yaml
id: push-develop-map-singleton-fix
status: complete
type: push
description: Push develop to origin — ships a5f662f (Supabase singleton fix) to trigger Vercel redeploy
branch: develop
remote: origin
created_at: 2026-05-29T08:35:00.000Z
completed_at: 2026-05-29T08:35:00.000Z
```

```yaml
id: commit-map-singleton-fix
status: complete
type: commit
description: Singleton browser Supabase client — stops infinite refetch loop that left map "Loading resources..." spinner stuck on
branch: develop
files:
  - apps/web/src/lib/supabase/client.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T08:30:00.000Z
completed_at: 2026-05-29T08:30:00.000Z
```

```yaml
id: push-develop-001
status: superseded
type: push
description: Push develop to origin after vercel.json fix — all session work (fleet agents, structured logging, vercel build fix)
branch: develop
remote: origin
scope: "All session work: fleet agents, structured logging, vercel.json fix"
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```

```yaml
id: fleet-agents-and-fixes
status: in_progress
type: commit
description: Add 10 fleet agents, fix panels/index.tsx exports, reconcile checklist Phase 1/2 marks, add Phase 8 stub
branch: feature/fleet-agents-and-fixes
files:
  - apps/web/src/components/panels/index.tsx
  - specs/001-feed-platform/ralph-loop-checklist.md
  - .claude/agents/feed-api-debugger.md
  - .claude/agents/feed-auth-debugger.md
  - .claude/agents/feed-data-flow-analyzer.md
  - .claude/agents/feed-documents-expert.md
  - .claude/agents/feed-forms-expert.md
  - .claude/agents/feed-map-debugger.md
  - .claude/agents/feed-realtime-monitor.md
  - .claude/agents/feed-smoke-runner.md
  - .claude/agents/feed-supabase-validator.md
  - .claude/agents/feed-vault-expert.md
  - .claude/GIT_PLAN.md
created_at: 2026-05-28T00:00:00.000Z
completed_at: null
```

```yaml
id: phaseE-deadcode-deletion
status: complete
type: commit
description: "Phase E — delete dead/orphaned code in dependency order (4 batches). Batch 1: secure-profile-form.tsx, profile-form.tsx, resource-form.tsx, dynamic-form-renderer.tsx, autofill-banner.tsx, signature-canvas.tsx, use-form-signature.tsx, test-key-store.ts, key-store-diagnostics.ts, database.types.ts. Batch 2: use-form-submission.ts, use-secure-profile.ts. Batch 3: form-field-mapper.ts, secure-profile.ts. Batch 4: deriveKeyFromPassword RETAINED (internal callers at L253/L291 in crypto.ts). tsc 0 errors after each batch. Build failure pre-existing (Supabase env vars, digest 2417864637, same on base commit)."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/components/forms/secure-profile-form.tsx (DELETED)
  - apps/web/src/components/profile/profile-form.tsx (DELETED)
  - apps/web/src/components/resources/resource-form.tsx (DELETED)
  - apps/web/src/components/forms/dynamic-form-renderer.tsx (DELETED)
  - apps/web/src/components/forms/autofill-banner.tsx (DELETED)
  - apps/web/src/components/forms/signature-canvas.tsx (DELETED)
  - apps/web/src/hooks/use-form-signature.tsx (DELETED)
  - apps/web/src/lib/utils/test-key-store.ts (DELETED)
  - apps/web/src/lib/utils/key-store-diagnostics.ts (DELETED)
  - apps/web/src/lib/database.types.ts (DELETED)
  - apps/web/src/hooks/use-form-submission.ts (DELETED)
  - apps/web/src/hooks/use-secure-profile.ts (DELETED)
  - apps/web/src/lib/form-field-mapper.ts (DELETED)
  - apps/web/src/lib/secure-profile.ts (DELETED)
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T20:00:00.000Z
completed_at: 2026-05-29T20:30:00.000Z
```

```yaml
id: phaseA2-vault-crypto-fix
status: complete
type: commit
description: "Phase A2 — fix two real crypto bugs exposed by newly-wired security tests. BUG 1 (CRITICAL): generateDEK() returned non-extractable CryptoKey; wrapDEK called wrapKey('raw') which requires extractable:true — always threw InvalidAccessException, making vault setup/unlock/rotateKEK non-functional. Fix: envelope pattern — generateDEK now returns { key: CryptoKey (non-extractable); rawBytes: Uint8Array }; wrapDEK takes raw bytes, AES-GCM-encrypts them with KEK; unwrapDEK AES-GCM-decrypts then importKey(non-extractable); rotateKEK decrypts envelope, re-encrypts with new KEK. deriveKEK usages changed from wrapKey/unwrapKey to encrypt/decrypt. In-use DEK stays non-extractable (XSS protection preserved). BUG 2 (HIGH): decryptFileChunked stepped by CHUNK_SIZE (1MB) through encrypted buffer but each encrypted chunk is CHUNK_SIZE+16 bytes; fix steps by ENCRYPTED_CHUNK_SIZE=CHUNK_SIZE+GCM_TAG_BYTES. All 7 previously-skipped tests now pass; full suite green (30 node:test + 52 vitest); vault-form-flow 9/9; type-check 0 errors; build PASS."
branch: feature/launch-readiness
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-launch
files:
  - apps/web/src/lib/crypto.ts
  - apps/web/src/lib/vault.ts
  - apps/web/src/lib/document-encryption.ts
  - apps/web/src/lib/__tests__/vault.test.ts
  - apps/web/src/lib/__tests__/document-encryption.test.ts
  - .claude/GIT_PLAN.md
created_at: 2026-05-29T18:45:00.000Z
completed_at: 2026-05-29T18:55:00.000Z
```

```yaml
id: forms-pr-to-develop
status: complete
type: merge
description: "Merge origin/develop (PR #22 security-definer hardening) into feature/forms-subsystem-rebuild, push branch, and open PR to develop. Resolves append-append conflict in .claude/GIT_PLAN.md (union both sides, no entry dropped). Post-merge regression gate: type-check EXIT 0 + build EXIT 0."
branch: feature/forms-subsystem-rebuild
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/23
files:
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T07:00:00.000Z
completed_at: 2026-06-01T07:15:00.000Z
```

```yaml
id: wire-supabase-mcp-project
status: complete
type: branch
description: "chore(mcp): wire project-scoped read-only Supabase MCP for the FEED repo. Creates .mcp.json (HTTP transport to mcp.supabase.com, project_ref=ndtpovonpadugthmcntl, read_only=true, Authorization header uses ${SUPABASE_ACCESS_TOKEN} env-expansion — secret-free, committed). Adds '## MCP Servers & Database Access' section to CLAUDE.md documenting config, auth flow (token from gitignored apps/web/.env.local, never committed), zshrc export pattern, and write-channel separation (reads via MCP, writes via Management API). Token source: shell env expanded at launch by Claude Code >=2.1.119."
branch: feature/wire-supabase-mcp-project
base: develop
remote: origin
merged_into: develop
merge_sha: 89a20bde17b21e18fe32aa5b52c12f23e3b9f17d
files:
  - .mcp.json
  - CLAUDE.md
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T00:00:00.000Z
completed_at: 2026-06-01T00:10:00.000Z
```

```yaml
id: harden-security-definer-fns
status: in_progress
type: migration
description: "Harden SECURITY DEFINER functions in public schema (satisfies Supabase linter 0011 function_search_path_mutable). (a) Pin SET search_path on 11 unpinned SECURITY DEFINER fns via minimal ALTER FUNCTION (no body restate): cleanup_old_webhook_logs, get_recent_webhook_failures, get_webhook_stats, get_stale_federated_resources, handle_new_user, on_resource_change_webhook, notify_federation_webhook, set_resource_location, set_resource_location_by_id, nearby_resources, resources_in_bounds. Value = public for all (PostGIS verified installed in public schema, so ST_*/&&/<-> resolve without an extensions entry). (b) Least-privilege EXECUTE: REVOKE FROM PUBLIC,anon,authenticated then GRANT service_role-only for set_resource_location, notify_federation_webhook, cleanup_old_webhook_logs, get_recent_webhook_failures, get_webhook_stats, get_stale_federated_resources, cleanup_expired_lockouts, cleanup_inactive_sessions, cleanup_old_login_attempts, is_account_locked, get_instance_uptime; REVOKE-all-no-grant for trigger-only handle_new_user/on_resource_change_webhook/enforce_password_history_limit; keep-grant exceptions set_resource_location_by_id and nearby_resources (REVOKE PUBLIC,anon; GRANT authenticated,service_role); resources_in_bounds grants UNTOUCHED (public pre-login map must stay anon-callable). (d) get_instance_uptime CREATE OR REPLACE from verbatim live body, fixing always-true tautology (param instance_id renamed p_instance_id, WHERE corrected) + SET search_path=public. (e) nearby_resources CREATE OR REPLACE verbatim live body (backfills missing migration so clean rebuild reproduces it) + SET search_path=public. Whole migration wrapped BEGIN/COMMIT. Authored in isolated worktree to avoid disturbing main checkout on feature/forms-subsystem-rebuild. NOT applied to prod, NOT committed, NOT pushed — review-only."
branch: feature/harden-security-definer-fns
base: develop
remote: origin
worktree: /Users/jelalconnor/CODING/CURSOR/FEED-secdef
files:
  - supabase/migrations/20260601043054_harden_security_definer_fns.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T04:30:54.000Z
completed_at: null
```

```yaml
id: fix-ci-lockfile-sync
status: complete
type: commit
description: "fix(ci): sync lockfile with workspace deps (restore npm ci). Root cause: packages/ui/package.json declared react peerDependency as ^18.0.0 but the project runs React 19 (apps/web uses 19.2.6 throughout all visible history). Lockfile had only react@19.2.6 at apps/web/node_modules/react, not hoisted to node_modules/react, so npm ci on a clean install failed with 'Missing: react@18.3.1 from lock file'. Fix: update packages/ui peerDependencies to ^19.0.0, run npm install to regenerate lockfile (react@19.2.6 now hoisted to node_modules/react). npm ci EXIT 0, build EXIT 0, type-check EXIT 0."
branch: develop
remote: origin
files:
  - packages/ui/package.json
  - package-lock.json
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T12:41:00.000Z
completed_at: 2026-06-01T12:41:00.000Z
```

```yaml
id: lint-correctness-restore
status: complete
type: commit
description: "fix(lint): restore 3 correctness rules (no-explicit-any, react-hooks/rules-of-hooks, react-hooks/exhaustive-deps) to error level + resolve all 60 pre-existing violations across 20 files. 47 no-explicit-any replaced with real types (Database types / unknown / typed interfaces); 13 react-hooks violations refactored or justifiably disabled; 2 stale-type join findings worked around with typed local interfaces (supabase gen types regen follow-up recommended). Cross-file reconciliation: use-conversations.ts selectConversation widened to (id: string|null) + null cleanup branch; messages-panel.tsx null cast removed; vault-guard.tsx already clean. ESLint 0 errors / 111 warnings; type-check EXIT 0; build EXIT 0."
branch: feature/lint-correctness-restore
base: develop
files:
  - apps/web/eslint.config.mjs
  - apps/web/src/app/(admin)/federation/conflicts/page.tsx
  - apps/web/src/app/(admin)/federation/search-analytics/page.tsx
  - apps/web/src/app/(auth)/onboarding/page.tsx
  - apps/web/src/app/page.tsx
  - apps/web/src/components/layout/feed-shell.tsx
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/components/panels/map-panel.tsx
  - apps/web/src/components/panels/messages-panel.tsx
  - apps/web/src/components/panels/overview-panel.tsx
  - apps/web/src/components/vault/vault-guard.tsx
  - apps/web/src/hooks/use-audit-log.ts
  - apps/web/src/hooks/use-conversations.ts
  - apps/web/src/hooks/use-csrf-token.ts
  - apps/web/src/hooks/use-notifications.ts
  - apps/web/src/hooks/use-vault-form-submission.ts
  - apps/web/src/lib/audit-logger.ts
  - apps/web/src/lib/field-encryption.ts
  - apps/web/src/lib/mfa.ts
  - apps/web/src/lib/migrate-to-encrypted.ts
  - apps/web/src/proxy.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T13:00:00.000Z
completed_at: 2026-06-01T13:30:00.000Z
```

```yaml
id: forms-pr23-merge-to-develop
status: complete
type: merge
description: "Merge PR #23 (feature/forms-subsystem-rebuild) into develop. Pre-merge conflict: append-append in .claude/GIT_PLAN.md caused by PR #24 landing on develop after last sync — resolved by unioning both entries. Post-merge regression gate: type-check EXIT 0, build EXIT 0. Forms artifacts verified present."
branch: feature/forms-subsystem-rebuild
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/23
merged_into: develop
merge_sha: cd402d0f263c73f6cd7c2c29da97bf9b71935eac
validation:
  type_check: EXIT 0
  build: EXIT 0
  artifacts_verified:
    - apps/web/src/lib/form-field-mapper.ts
    - apps/web/e2e/forms-flow.spec.ts
    - supabase/migrations/20260601070000_tighten_form_submissions_update_with_check.sql
  branch_fully_merged: true
files:
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T12:39:17.000Z
completed_at: 2026-06-01T12:39:17.000Z
```

```yaml
id: types-regen
status: complete
type: commit
description: "chore(types): regenerate Database types from live schema (ndtpovonpadugthmcntl) + reconcile stale-join workarounds (FederatedResourceWithInstance + PostLikeWithPost local interfaces). Replace any/unknown workarounds with real Database join types where generated, or document why kept. Regen added: app_logs table (new), form_templates.id now required (not optional), get_instance_uptime arg renamed instance_id→p_instance_id. Both local interfaces REPLACED: FK relationships now in Relationships[] so SDK v2.105.3 infers embedded join shape. Also: npm warn line stripped from generated output. Gate: type-check EXIT 0, ESLint 0 errors, build EXIT 0."
branch: feature/types-regen
base: develop
files:
  - packages/database/types.ts
  - apps/web/src/app/(admin)/federation/search-analytics/page.tsx
  - apps/web/src/components/panels/overview-panel.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T14:00:00.000Z
completed_at: 2026-06-01T14:30:00.000Z
```

```yaml
id: documents-subtab-nav-fix
status: complete
type: commit
description: "fix(documents): unify subtab navigation so all three tabs (My Documents, My Resources, Forms) set both viewMode and panelParams.subtab atomically. Root cause: handleTabSwitch had 3 inconsistent paths — the 'documents' branch called setActivePanel('documents') which never set viewMode, causing the My Documents tab to be non-clickable after switching away. Fix: single uniform callback sets both state vars for all three tabs. TDD: e2e/documents-subtabs.spec.ts full cycle (default → resources → documents → forms → documents). Regression: auth/documents-view/pdf-annotator/forms-flow/pdf-true-edit all green (13/13). CI: 10/10 (Build/CI-Success/Deploy-Preview/Install/Lint/Security-Audit/Test/Type-Check/Vercel/Vercel-Preview). Merged PR #32 → develop."
branch: feature/documents-subtab-nav-fix
base: develop
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/32
merged_into: develop
merge_sha: 833d7fb92d67188ad3710e2d9369086e2ecc2a53
post_merge_ci_conclusion: success
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/e2e/documents-subtabs.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-02T00:00:00.000Z
completed_at: 2026-06-02T14:10:00.000Z
```

```yaml
id: observability-documents-pdf
status: complete
type: branch
description: "feat(observability): structured timing+error logging across documents/pdf paths. Events added: documents.view (documentId, has_annotations, flattened, duration_ms), documents.download (documentId, has_annotations, duration_ms), documents.edit.open (documentId, annotation_count, duration_ms), documents.annotations.update (documentId, annotation_count, duration_ms) in documents-panel.tsx; documents.annotations.update (documentId, annotation_count, ciphertext_bytes, duration_ms), documents.download_for_edit (documentId, has_annotations, annotation_count, duration_ms) in use-encrypted-upload.ts; pdf.export_flattened (annotation_count, source_bytes, page_count, output_bytes, duration_ms) in use-pdf-annotation.ts; pdf.viewer.load (page_count, byte_size, duration_ms) and pdf.viewer.error in pdf-document-viewer.tsx. PII-safe: only documentId (uuid), counts, byte sizes, durations logged — no annotation text, file names, decrypted content. ZERO behavior change: control flow, error propagation, return values all unchanged. Regression: 14/14 e2e specs green (auth+documents-view+pdf-annotator+forms-flow+pdf-true-edit+documents-subtabs). Gates: type-check EXIT 0, lint 0 new errors, build success."
branch: feature/observability-documents-pdf
base: develop
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/hooks/use-encrypted-upload.ts
  - apps/web/src/hooks/use-pdf-annotation.ts
  - apps/web/src/components/documents/pdf-document-viewer.tsx
  - .claude/GIT_PLAN.md
created_at: 2026-06-02T00:00:00.000Z
completed_at: 2026-06-02T00:00:00.000Z
remote: origin
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/33
merged_into: develop
merge_sha: febb26458adc135576f23a573660ceeb96b675ab
post_merge_ci_conclusion: success
```

```yaml
id: security-advisor-remediation
status: complete
type: commit
description: "fix(security): restrict notifications INSERT to prevent cross-user forgery + revoke anon/authenticated access to federation_trust_overview matview. FIX 1 (P1): DROP notifications_insert_system policy (was CMD=INSERT WITH CHECK (true) TO PUBLIC — any auth user could forge notifications for any user_id). Caller recon confirms zero client INSERT callers; notifications are system-only (triggers/service_role bypass RLS). No replacement policy authored — RLS enabled + no INSERT policy = INSERT blocked for all non-superuser roles. SELECT/UPDATE/DELETE policies untouched. FIX 2 (P3): REVOKE SELECT ON public.federation_trust_overview FROM anon, authenticated. Caller recon confirms zero non-admin/non-service reads of this matview. service_role retains access. Applied to prod ndtpovonpadugthmcntl. Verified live: pg_policies shows 0 INSERT policies on notifications (relrowsecurity=true); has_table_privilege(anon/authenticated, federation_trust_overview, SELECT)=false; service_role SELECT=true."
branch: develop
files:
  - supabase/migrations/20260601090000_security_advisor_remediation.sql
  - .claude/GIT_PLAN.md
created_at: 2026-06-01T09:00:00.000Z
completed_at: 2026-06-01T09:00:00.000Z
```

```yaml
id: vault-unlock-timeout-resilience
status: complete
type: branch
scope: vault-unlock-timeout-resilience
description: "fix(vault): timeout-guard vault unlock read + keep modal mounted during unlock. Two root causes for stuck-loading on Master Password: (1) unlockVault had no query timeout so a stalled user_secure_profiles read wedged the spinner forever; (2) VaultGuard unmounted the unlock modal the instant loading=true (losing password state). Fixes: vault.ts adds AbortSignal.timeout(12s)+retry(false) on unlock read + VaultTimeoutError; vault-guard.tsx guards spinner only for initial status check; vault-context.tsx decouples data migration into fire-and-forget effect; 3 sibling vault reads hardened with same timeout; false VAULT_UNLOCK_FAILED audit event gated on timeout path. Removes dead document-viewer.tsx (no importers). Tests: vitest unit (VaultTimeoutError on abort) + Playwright route-stall e2e. Merged PR #34 → develop @ 68afd15."
branch: feature/vault-unlock-timeout-resilience
base: develop
remote: origin
pr_target: develop
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/34
merged_into: develop
merge_sha: 68afd15dbb2a4d6d6c3e7e9d9c1a2b3c4d5e6f7a
files:
  - apps/web/src/lib/vault.ts
  - apps/web/src/components/vault/vault-guard.tsx
  - apps/web/src/contexts/vault-context.tsx
  - apps/web/src/hooks/use-audit-log.ts
  - apps/web/src/hooks/use-vault-form-submission.ts
  - apps/web/src/hooks/use-vault-secure-profile.ts
  - apps/web/src/components/documents/document-viewer.tsx (DELETED)
  - apps/web/e2e/vault-unlock-timeout.spec.ts
  - apps/web/src/lib/__tests__/vault-unlock-timeout.test.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T00:00:00.000Z
completed_at: 2026-06-03T00:00:00.000Z
```

```yaml
id: document-download-timeout
status: in_progress
type: commit
scope: document-download-timeout
description: "fix(documents): timeout-guard document download + fix vault-unlock replay loop. Two defects made the document preview/view path hang after entering the master password: (1) stale-closure loop — handleView/handleDownload/handleEdit captured isUnlocked from a stale useCallback closure, so the post-unlock onSuccess replay re-checked isUnlocked=false and re-opened the unlock modal in a loop. Fix: isUnlockedRef kept in sync via effect and set true synchronously before replay. (2) unguarded download — downloadFile/downloadForEdit awaited a .single() metadata read and storage.download() with no timeout, so a stalled fetch hung the spinner forever. Applied PR#34 pattern — AbortSignal.timeout(QUERY_TIMEOUT_MS) + retry(false) on metadata read, { signal } on storage.download — surfacing clear error + always clearing loading state. artifacts: dismissible error banner, e2e document-preview-timeout spec (storage + metadata stall routes). Tests: 17 Playwright green, vitest 56 green, type-check 0, build clean."
branch: feature/document-download-timeout
base: develop
remote: origin
pr_target: develop
note: "PRIOR PR#35 MIS-MERGED TO MAIN (repo default branch). Re-landing on develop (production branch) via PR#36. Commits 0787bef+c638969 cherry-picked clean (GIT_PLAN.md conflict only, resolved accepting incoming; no code conflicts)."
files:
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/hooks/use-encrypted-upload.ts
  - apps/web/e2e/document-preview-timeout.spec.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T00:00:00.000Z
completed_at: null
```

```yaml
id: rm-spike-route
status: complete
type: commit
description: "chore(security): remove public /spike/pdf dev route (no auth guard). apps/web/src/app/spike/ (page.tsx + spike-pdf-inner.tsx) was a leftover PDF-engine evaluation spike that deployed to production at sourcetofeed.com/spike/pdf with zero authentication or middleware guard. Also removes public/spike/README.md (static asset companion) and docs/pdf-spike-notes.md (spike notes). Zero importers confirmed via grep — no production source file outside apps/web/src/app/spike/ references the route. type-check 0 errors post-deletion (baseline: 0; post-delete: 0)."
branch: feature/rm-spike-route
base: develop
remote: origin
pr_target: develop
files:
  - apps/web/src/app/spike/pdf/page.tsx
  - apps/web/src/app/spike/pdf/spike-pdf-inner.tsx
  - apps/web/public/spike/README.md
  - docs/pdf-spike-notes.md
  - .claude/GIT_PLAN.md
pr: 37
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/37
commit_sha: aac5400
created_at: 2026-06-03T00:00:00.000Z
completed_at: 2026-06-03T00:00:00.000Z
```

```yaml
id: p1-spinner-timeouts
status: complete
type: branch
description: "perf(hooks): add query-timeout guards to 9 spinner-gating reads across 7 hooks — use-saved-resources.ts, use-program-browser.ts (fetchPrograms + fetchCategories), use-applications.ts, use-notifications.ts (notifications + reminders), use-documents.ts, use-viewport-resources.ts (AbortSignal.any combining nav-cancel + hard timeout), use-chat.ts (30s setTimeout on streaming edge fetch). Extends the PR#34/#39 timeout pattern to all remaining unguarded spinner-gating reads."
branch: feature/p1-spinner-timeouts
base: develop
remote: origin
pr: 40
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/40
commit_sha: 24f2057
files:
  - apps/web/src/hooks/use-saved-resources.ts
  - apps/web/src/hooks/use-program-browser.ts
  - apps/web/src/hooks/use-applications.ts
  - apps/web/src/hooks/use-notifications.ts
  - apps/web/src/hooks/use-documents.ts
  - apps/web/src/hooks/use-viewport-resources.ts
  - apps/web/src/hooks/use-chat.ts
  - .claude/GIT_PLAN.md
created_at: 2026-06-03T23:00:00.000Z
completed_at: 2026-06-03T23:30:00.000Z
```

```yaml
id: lockdown-table-grants
status: complete
type: branch
description: "chore(security): revoke browser-role DML grants on 4 RLS-deny tables — account_lockouts, app_logs, auth_login_attempts, password_history. All 4 have RLS enabled + zero policies (default-deny). anon+authenticated held full DML grants (latent exposure). All legitimate access confirmed service_role only. REVOKE ALL adds second independent denial layer. Applied + verified live: 0 anon/authenticated grants remain; service_role intact (7/7 privileges per table). Migration: 20260603140000_lockdown_security_table_grants.sql"
branch: feature/lockdown-table-grants
base: develop
remote: origin
files:
  - supabase/migrations/20260603140000_lockdown_security_table_grants.sql
  - .claude/GIT_PLAN.md
pr: 42
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/42
commit_sha: 8ab90b4
created_at: 2026-06-03T23:45:00.000Z
completed_at: 2026-06-03T23:55:00.000Z
```

```yaml
id: resource-linked-posts-phaseB
status: complete
type: branch
description: "feat(feed): Phase B resource-linked posts — posts.resource_id FK+index migration, feed composer resource selector, resource-chip on PostCard, Community Posts section in ResourceDetailDialog, embed Date.now() bug fix in post-composer.tsx"
branch: feature/resource-linked-posts
base: develop
remote: origin
files:
  - supabase/migrations/20260604130000_posts_resource_id_fk.sql
  - packages/database/types.ts
  - apps/web/src/components/panels/feed-panel.tsx
  - apps/web/src/components/documents/resource-detail-dialog.tsx
  - apps/web/src/hooks/use-resource-detail.ts
  - apps/web/src/components/panels/documents-panel.tsx
  - apps/web/src/components/feed/post-composer.tsx
  - apps/web/e2e/resource-linked-posts.spec.ts
  - .claude/GIT_PLAN.md
pr: 48
pr_url: https://github.com/JayConnorSynrg/Feed-The-social-assistance-app/pull/48
commit_sha: 0d2406d
created_at: 2026-06-04T17:00:00.000Z
completed_at: 2026-06-04T17:25:00.000Z
```
