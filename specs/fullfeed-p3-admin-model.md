# FULL-FEED P3 — Admin Model & Moderation Guards

Status: **P3.0 SHIPPED** (guards; PR #215, squash `1028506`, migration `20261009000000` applied
in prod) · **P3.1 SHIPPED** (three admin tiers, nomination only — §6; PR #217, squash `92c3003`,
migration `20261010000000` applied in prod). The P3.1 ladder scoped in §2 is live.
Backend for P3.0: `supabase/migrations/20261009000000_p3_0_moderation_guards.sql`.
Prod: `ndtpovonpadugthmcntl`. Code baseline: `origin/develop` @ `05f0293`.

This document is the authoritative model for FEED's admin/moderation authority. It is seeded
from the empirical system model in the P3 planning session and will be extended in P3.1 when
the tiered ladder is built.

---

## 1. Roles (today)

Privilege is **binary** and lives in a single flag, mirrored for moderation:

| Representation | Meaning | Written by | Read by |
|---|---|---|---|
| `profiles.is_admin` (bool) | Platform admin | Never by clients (no column grant); `claim-facilitator-admin` edge fn (service_role, HMAC code, rate-limited) or direct SQL | `is_current_user_admin()` (SECDEF, pinned, anon has no EXECUTE); 48 RLS policies; ~25 SECDEF RPCs; the `(admin)` route-group gate |
| `profiles.is_staff` (bool) | Moderation flag; kept `= is_admin` by `sync_is_staff_trigger` | Never by clients; the sync trigger | Every content-moderation RPC reads `is_staff` inline (`SELECT is_staff FROM profiles WHERE id=auth.uid()`); 2 RLS policies; column-granted `r` to authenticated/anon |
| `profiles.user_role` (text: seeking/providing/facilitator/both) | A **label, not authority**. Client-writable | Client PATCH; onboarding | UI-visibility gates + notification filters only |
| `organization_members.role` (text: admin/member) | Org-scoped admin, orthogonal to platform tiers | Platform admins only (`org_members_*_platform_admin`); org admins cannot write membership | `is_org_admin(org)`, `is_org_admin_any()`, `is_org_member(org)` (all SECDEF, pinned) |

There is **no** `user_roles` table, role enum, or JWT custom claim. `is_current_user_admin()`
reads the `profiles` table, not `auth.jwt()`.

The `(admin)` route group (`apps/web/src/app/(admin)/layout.tsx`) admits platform admins OR any
org admin; the federation sub-tree is platform-admin only. The admin shell shows org admins only
the Events tab. A "Settings — coming soon" placeholder tab is the natural future home for tier
config; there is no UI to grant/revoke `is_admin` today.

---

## 2. Capabilities → proposed tiers (P3.1, not yet built)

The P3.1 ladder is **Community Moderator (CM) → Resource Admin (RA) → Platform Admin (PA)**,
with **org admin (ORG)** as an orthogonal, org-scoped axis. If `is_staff` becomes "tier ≥ CM",
every content-moderation RPC extends automatically because they all read `is_staff` — so P3.0's
guards read `is_staff` inline rather than through a new abstraction, to inherit that change for
free.

Clean fits (from the capability inventory): **CM** = post/report moderation + safety-alert
verify/remove (`admin_remove_post`, `admin_hold_post`, `admin_authorize_post`,
`admin_resolve_report`, see-hidden, read-reports, `admin_verify_safety_alert`,
`admin_remove_safety_alert`). **RA** = resource approve/reject/edit, pending queue, geocode,
external-sync triggers, form templates. **PA** = orgs CRUD + membership, user list/ban/delete,
admin notes, federation, all form submissions, all audit logs, petition-signature export,
dashboards, config writes, the admin-grant path.

Deliberately unresolved (need a ruling before P3.1 builds them): safety-alert verify mints a
verified trust fact (CM action → trust weight); editing verified reviews; opt-in override;
paid external APIs (`resource-discover`, community summary); form templates (forms ≠ resources);
cross-org event override and attendance PII; admin user notes; dashboards.

Thresholds should follow the existing singleton-config pattern (`badge_config`,
`ranking_config`): a new PA-only, SECDEF-written, audited config row — never client-writable.

---

## 3. Risks (from the P3 audit)

| # | Sev | Risk | Status |
|---|---|---|---|
| R1 | HIGH | `resources` client INSERT could set `status='approved'` + `moderated_by=<any profile id>`; nightly `reconcile_engagement` then minted a **verified** `resource_approved` (weight 3, public) | **Closed in P3.0** (I1 guard) |
| R2 | MED | `audit_log` is client-insertable (own `user_id`, any category incl. `admin`); admin actions mostly unaudited; the facilitator-claim audit write violates the CHECKs and always fails | Open — P3.1 (append-only admin action log) |
| R3 | MED | `orgs_update_org_admin` is not active-aware and grants full-column UPDATE; an org admin could change `created_by` and (via an unfiltered PATCH) reactivate their own deactivated org | **Closed in P3.0** (I3 guard) |
| R4 | MED | ban/delete API routes have no target-tier guard and write no audit entry | Open — P3.1 |
| R5 | LOW | `profiles.is_staff` is anon-readable → the admin roster is enumerable | Open |
| R6 | LOW | `post_comments` own-row UPDATE could flip `is_hidden` (an unfiltered PATCH un-hides a moderated comment) | **Closed in P3.0** (I6 guard) |
| R7 | LOW | `event_checkin` ledger row is `verified=false` though organizer-confirmed; P3 eligibility must read `event_checkins.confirmed_by`, not the ledger flag | Note for P3.1 |
| R8 | INFO | `user_role='facilitator'` is a self-writable label shown as "Administrator" | Open |

---

## 4. P3.0 guards (shipped)

**Design.** BEFORE INSERT/UPDATE triggers, all `SECURITY INVOKER` (load-bearing — a
`SECURITY DEFINER` trigger would always see `current_user = postgres` and never enforce),
`SET search_path = public, pg_temp`, EXECUTE revoked from PUBLIC/anon/authenticated (Postgres
does not check EXECUTE when a trigger fires). Each guard exits at the first `current_user` test
for non-client roles (`service_role`, `postgres`, `supabase_admin`), so every SECDEF RPC,
edge-function pipeline, migration and Management-API write passes untouched; authenticated
admins pass via `is_current_user_admin()`, comment staff via `profiles.is_staff`. This is the
only design that holds all three invariants at every writer with **zero client changes**
(a column GRANT can't tell admins from users or express "only while active"; an RLS `WITH
CHECK` can't compare NEW against OLD, i.e. "moderated_by unchanged" / "created_by unchanged").

Every rejection is `SQLSTATE 42501` with a stable, greppable message prefix per guard plus a
`HINT`. Operators count rejections per guard in `postgres_logs`, e.g.
`source='postgres_logs' AND position('guard:resources_moderation_fields' IN event_message) > 0`.

### I1 — resources moderation authority · `guard_resources_moderation_fields`
`status`, `moderated_by`, `moderated_at`, `is_verified`, `last_verified_at` and `rejection_reason`
are set only by an admin, `service_role`, or an authority-checking SECDEF function
(`approve_resource`, `reject_resource`, `admin_update_resource`, geocode). A client INSERT lands
**exactly** `pending` (a NULL status is a violation — checked with `IS NOT DISTINCT FROM` so a NULL
cannot slip past as "not pending") with every moderation field empty. **One carve-out** (today's
shipped feature): a volunteer listing (`is_volunteer_resource = true`) may be inserted `approved`
by its own submitter, still with every moderation field empty — this cannot mint a verified
`resource_approved` because that requires a non-null `moderated_by`. A client UPDATE may change no
moderation field and no status, **except** the volunteer self-withdraw (`pending` OR `approved →
archived`) on the owner's own row. It also may not change `is_volunteer_resource` on an existing
row — that is fixed at creation. (Flipping it would otherwise unlock the volunteer-only carve-outs:
a non-volunteer pending pin could be flipped to volunteer and then archived, or — once a moderator
approved it — relocated by its submitter through `set_resource_location_by_id`'s owner path.)

### I1b — volunteer withdraw (live-bug fix, wired to the FAB)
The pre-P3.0 only client UPDATE policy matched `status='pending'`, so archiving an *approved*
volunteer listing matched zero rows and PostgREST reported success while doing nothing — and the
listing had no removal affordance anywhere in the UI. P3.0 adds the RLS policy
**"Volunteers can withdraw their own listing"** (`USING (select auth.uid()) = submitted_by AND
is_volunteer_resource AND status IN ('pending','approved')`, `WITH CHECK ... status='archived'`)
and the I1 guard permits that one transition (pending or approved → archived). The hook
(`use-volunteer-resource.ts` `withdrawResource`) interprets the result through the pure helper
`withdraw-result.ts` `interpretWithdrawResult` — `.select('id')` makes PostgREST report affected
rows, and a zero-row result surfaces as a user-facing error instead of a false success. The
volunteer FAB (`components/volunteer/volunteer-resource-fab.tsx`) now lists the signed-in
volunteer's **withdrawable** (pending/approved) listings with a Remove button; a rejected listing
is omitted (it is a moderation outcome the user cannot archive). Removal takes one explicit
confirm, guarded by a single-flight `useRef` (flipped synchronously before the first await, PR #203
pattern) so a double-click cannot fire twice; on success the listing is gone from the map and lists
and the FAB returns to the register state, and on failure (including zero rows) the confirm dialog
shows this attempt's error only (cleared on open and cancel) in an `role="alert"`/`aria-live`
region. While the dial is closed the Remove buttons are out of the tab order (`tabIndex=-1`) and
hidden from assistive tech (`aria-hidden`). A user who still owns an active listing can reach
Remove even if their `user_role` has changed; with neither a provider role nor an active listing
the FAB stays hidden. Only the submitter (or an admin) can withdraw; no moderation field is
written; a rejected listing stays rejected.

### Moderated-pin integrity — `set_resource_location_by_id`
The owner path applies only while the row is still `pending` or is the owner's own volunteer
listing, and it resets `geocode_accuracy` to NULL so a moderator's rooftop tag never lingers on
coordinates the user chose. A moderated/approved non-volunteer pin can be relocated by moderators
only. The admin path and the server (`auth.uid() IS NULL`) path are unchanged; the volunteer
register and suggest-resource location flows still work.

### I6 — comment visibility · `guard_post_comments_is_hidden`
`post_comments.is_hidden` is set/cleared only by staff (`profiles.is_staff`) or a server path.
Users keep inserting and replying to comments exactly as before (their payloads never carry
`is_hidden`). A staff member can set/clear `is_hidden` on **their own** comment (RLS
`post_comments_update_own` admits the own-row write and the staff bypass permits the flag change).
*Note:* there is no staff comment-moderation RPC yet, so hiding/un-hiding **another** user's
comment still needs `service_role`/`postgres` or a future staff RPC; building that RPC is a P3.1
capability item.

### I3 — organization ownership · `guard_organizations_org_admin_update`
An org admin edits descriptive fields — including `org_type` — of their **own active** org only,
and can never change `is_active`, `created_by`, `id` or `created_at`. Platform admins keep full
control (bypass). The W1.6a deactivation-cascade trigger (`AFTER UPDATE OF is_active`) still fires
whenever a platform admin flips `is_active`.

### Side fix
`post_comments` carried two byte-identical `updated_at` BEFORE UPDATE triggers; P3.0 drops the
redundant `set_post_comments_updated_at` (keeping `update_comments_updated_at`).

### Defense-in-depth note
RLS independently blocks two of the guarded moves today (an org admin setting `is_active=false`
via a filtered PATCH; hiding one's own *visible* comment) — for those the guard is a second line
with a clearer message. The guard is the **sole** protection for the R1 resource forge, the R3
`created_by` change, and the R6 unfiltered comment un-hide (each proven by mutation tests that
dropped the guard and watched the forge succeed).

---

## 5. Verification (P3.0)

Proven against prod inside `BEGIN … RAISE → ROLLBACK` transactions (nothing persisted; 19,146
resources unchanged, migration not recorded):
- **Full dry-run matrix**: every forbidden write rejected with `42501` and the correct `guard:`
  prefix (incl. NULL status, client `rejection_reason` on insert/update, and an owner relocate of
  an approved non-volunteer pin → `not authorized`); every legitimate write succeeded — suggest
  pending, volunteer approved, owner withdraw of a **pending** and an **approved** volunteer
  listing, owner `set_resource_location_by_id` on a pending row and on a volunteer row (with
  `geocode_accuracy` reset to NULL), `approve_resource` + its `resource_approved` ledger credit,
  reject, admin direct edit, `admin_update_resource`, a `service_role` upsert
  (`ON CONFLICT (external_id,source)`), comment insert/delete, org-admin descriptive + `org_type`
  edits, and a platform-admin `is_active`+`created_by` toggle.
- **Behavioural smoke** `30-p3-0-moderation-guards.smoke.ts` (ledger-gated on `20261009000000`):
  each guarantee is an actual write executed as the relevant role in a rolled-back transaction, so
  it goes RED if the guard's behaviour is removed. A mutation runner mutated the migration and
  re-ran the smoke's SQL through the Mgmt API. Of nine mutations, **seven are KILLED** by a smoke
  check: drop the admin bypass (→ ADMIN_DIRECT_UPDATE), drop the org inactive-edit check
  (→ INACTIVE_ORG_EDIT), drop the org is_active-change check (→ ORG_DEACTIVATE_UNFILTERED, run while
  the org admin administers only the active org so it is the is_active-change check — not the
  inactive-edit check or RLS — that blocks it), drop the withdraw volunteer check (→ NONVOL_ARCHIVE),
  drop the `is_verified`/`moderated_at` UPDATE check (→ OWNER_SET_MODERATION), allow any owner status
  change (→ VOL_STATUS_NONARCHIVE), and drop the `is_volunteer_resource` UPDATE clause
  (→ VOLUNTEER_FLIP + NONVOL_ARCHIVE). The two survivors are **defense-in-depth or uncovered by a
  smoke probe, not gaps**: dropping the withdraw *owner* check is still covered by the RLS withdraw
  policy (`USING (select auth.uid()) = submitted_by`); dropping the comment *staff bypass* is not
  inert — its live effect is that a staff member can un-hide **their own** comment via an unfiltered
  update (RLS `post_comments_update_own` admits the own-row write and the bypass permits the
  `is_hidden` change; it does not let staff touch another user's comment) — but the smoke has no
  probe for that path, so this mutation survives the smoke. Both survivors are exercised by the full
  dry-run matrix (the staff-un-hide-own case is the `Y09` probe: staff un-hides own hidden comment,
  unfiltered → OK).
- **Unit**: `withdraw-result.ts` `interpretWithdrawResult` (the real logic the hook runs) is
  covered by `__tests__/withdraw-result.test.ts`; deleting the zero-row branch fails the test.

App gates: `tsc` 0 errors; `eslint` 0 errors; `test:unit` 61/61; targeted `vitest`
`withdraw-result.test.ts` 6/6; `next build` ✓.

---

## 6. P3.1 — three admin tiers, nomination only (built)

Backend: `supabase/migrations/20261010000000_p3_1_admin_tiers.sql` (applies as a separate
post-deploy step, before merge). Branch `feature/feed-fullfeed-p3-1-admin-tiers`. Docs:
`docs/admin-tiers.md` (replaces `docs/administrator-code.md`). Smoke:
`31-p3-1-admin-tiers.smoke.ts` (ledger-gated on `20261010000000`).

### Model
Community Moderator (CM) < Resource Admin (RA) < Platform Admin (PA), stored in
`profiles.admin_tier` (enum, NULL = no tier). Org admin (`organization_members.role='admin'`) stays
an orthogonal, org-scoped axis (Events tab, own active org). `admin_tier` is the single source of
truth; the `sync_tier_flags` BEFORE trigger derives `is_admin = COALESCE(tier=platform_admin,false)`
and `is_staff = COALESCE(tier IS NOT NULL,false)` and refuses any direct client write to
`admin_tier`/`is_admin`/`is_staff`. This turns all ~48 `is_current_user_admin()` policies/RPCs into
PA and all `is_staff` moderation readers into CM+ with zero predicate edits — exactly the "if
`is_staff` becomes tier ≥ CM" hook §2 anticipated.

### Capabilities by tier
- **CM:** post moderation (remove/hold/authorize), report handling, safety-alert verify+remove, sees hidden posts.
- **RA:** CM + resource review queue (list pending, approve, reject, update, set location, list resources).
- **PA:** everything else — discovery, form templates, SNAP, dashboards, notes, cross-org events, AI summary, users (ban/delete), federation, orgs, and tier grants/revokes.

### Invariants (verified by rolled-back prod probes + unit tests)
- **T1** every capability reaches exactly the ruled tiers; the two existing admins became PA with zero behavior change; org-admins keep Events only; a plain user gains nothing.
- **T2** a tier changes only via `admin_set_tier` (a strictly higher tier; the founder for anything touching PA) or the audited service-role `service_set_tier`. No self-target; no direct column write; `is_admin`/`is_staff` always derived; exactly one `admin_actions` row per tier-holder grant/revoke (allowed or denied). A no-tier/guest caller gets a `p3_denied:*` RAISE with **no** durable row.
- **T3** ban, delete and role changes cannot target an equal-or-higher tier or self (**D2**: this does NOT apply to content moderation or the resource queue). Form-type resource state changes (approve/reject/update) are PA-only on every path.
- **T4** every post-author / profile surface shows the public tier marker ("Moderator"/"Resource Admin"/"Admin"): feed card, appreciation sheet, profile page + its post list (`post-card`), comment authors, the shared post page, and the admin user lists. `profiles.admin_tier` is anon+authenticated SELECT, no client write. No other private field is exposed.
- **T5** every privileged action writes exactly one append-only `admin_actions` row (actor, actor tier, action, target, target tier, outcome, reason, request_id, timestamp); clients cannot write, only PA reads, even service_role is append-only. Every privileged client call routes through `lib/privileged-action.ts` (`privilegedRpc`/`privilegedFetch`) which mints one request id, sends it as `x-request-id`, and shares it with `withMetric` — so the durable audit row and the `app_logs` telemetry join on one id, and a denied/failed call is recorded as exactly one error-level (ok:false) telemetry row. A source-guard test flags any bypass (dot/bracket/alias/template/variable call, or a bare `fetch()` to `/api/admin`). `record_admin_action` caps `request_id` (uuid/token, ≤64) and `reason` (≤500).

### Founder
`platform_founder` singleton (founder profile id hard-coded — no PII in the repo, **D6**). Only the
founder grants/revokes PA; `service_set_tier` refuses any platform_admin touch, the founder, and
invalid targets. The founder cannot be demoted/banned/deleted through the app (top tier + self-target
refusal).

### Ban / delete
Platform-Admin only. A caller below PA is refused 403 **before** any target lookup or audit write
(writes nothing, reveals nothing). A PA acting on a nonexistent target gets 404. T3 self/equal-tier
refusals and the final outcome each write exactly one audit row (**D7**: delete writes one row after
success, or one error row on failure).

### Rulings resolved
D2 (T3 scope = ban/delete/role only) · D3 (`service_set_tier` break-glass + CM/RA e2e fixtures;
PA-surface e2e specs use a pre-provisioned PA via `E2E_PA_EMAIL`/`E2E_PA_PASSWORD`/`E2E_PA_USER_ID`
and skip when absent) · D4 (re-gated RPCs RAISE `p3_denied:*`; new RPCs return `{ok,code}` + durable
denial rows) · D5 (`user_role='facilitator'` label kept, unreachable from onboarding) · D6 · D7.

### Facilitator code retired
`claim-facilitator-admin` edge fn + onboarding "Administrator" option/code input + `.gitignore`
reference + `admin_code_redemptions` table (0 rows) removed. The deployed function and its secrets
(`FACILITATOR_ADMIN_CODE_HASH`, `FACILITATOR_ADMIN_CODE_PEPPER`) are removed post-merge by the
operator (commands in the PR body).

### Verification (P3.1)
Rolled-back prod dry-run (P3.1 on live prod, which already has P3.0): full tier matrix across
plain/CM/RA/PA/founder/org-admin, founder-only, audit exactly-once per request id, form-path gates
(RA reject/update/approve of a form row → 42501; PA → ok), `set_resource_location_by_id` owner path
(own pending/volunteer → ok + geocode reset; other's approved → 42501), and both current admins
keeping a capability sample. Mutation runners killed every guard (RA-on-ICUA, `>=`-vs-`>` tier,
founder check, self check, column-grant, trigger-derive, audit-skip, `admin_actions` INSERT grant,
form guards on reject/update, helper throw-on-error, bypass-guard quote coverage, ban gate-first +
404). App gates: `tsc` 0 · `eslint` 0 errors · `vitest` (non-smoke) all green · `next build` ✓.

### Follow-ups (deferred, not built in P3.1)
- **Comment moderation** (D1): `admin_remove_comment` / `admin_restore_comment`, CM+, audited — not built (new scope; 0 comments in prod).
- **Tier markers on person-to-person surfaces**: messages and the opt-in seeker list are left unmarked by ruling (outside the "posts and profiles" T4 scope).
- **Volunteer registration failing silently** (pre-existing): the volunteer register path can fail without surfacing an error to the user; withdraw was fixed in P3.0, register is still to do.
- **Guest 406 from `apps/web/src/lib/vault.ts:294`**: a guest hits a `.single()` lookup that returns 406/PGRST116 (no row); pre-existing benign noise, to be quieted with `.maybeSingle()` or a guest guard.
