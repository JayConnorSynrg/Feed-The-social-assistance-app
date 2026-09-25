# FULL-FEED P3 — Admin Model & Moderation Guards

Status: **P3.0 shipped** (guards). P3.1+ (tiered roles) is scoped here but not yet built.
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
`status`, `moderated_by`, `moderated_at`, `is_verified`, `last_verified_at` are set only by an
admin, `service_role`, or an authority-checking SECDEF function (`approve_resource`,
`reject_resource`, `admin_update_resource`, geocode). A client INSERT lands `pending` with every
moderation field empty. **One carve-out** (today's shipped feature): a volunteer listing
(`is_volunteer_resource = true`) may be inserted `approved` by its own submitter, still with
every moderation field empty — this cannot mint a verified `resource_approved` because that
requires a non-null `moderated_by`. A client UPDATE may change no moderation field and no status,
**except** the volunteer self-withdraw (`approved → archived`) on the owner's own row.

### I1b — volunteer withdraw (live-bug fix)
The pre-P3.0 only client UPDATE policy matched `status='pending'`, so archiving an *approved*
volunteer listing matched zero rows and PostgREST reported success while doing nothing. P3.0 adds
the RLS policy **"Volunteers can withdraw their own listing"** (`USING` own approved volunteer
row, `WITH CHECK` own archived volunteer row) and the I1 guard permits that one transition. The
hook (`use-volunteer-resource.ts` `withdrawResource`) now `.select('id')`s the affected rows and
surfaces a zero-row result as a user-facing error instead of a false success. After withdrawal
the listing is `archived`, so it drops off the map and lists; only the submitter (or an admin) can
withdraw it; no moderation field is written.

### I6 — comment visibility · `guard_post_comments_is_hidden`
`post_comments.is_hidden` is set/cleared only by staff (`profiles.is_staff`) or a server path.
Users keep inserting and replying to comments exactly as before (their payloads never carry
`is_hidden`). *Note:* there is no staff comment-moderation RPC yet — after P3.0, only
`service_role`/`postgres` or a future staff RPC can hide a comment; building that RPC is a P3.1
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

Proven against prod inside `BEGIN … RAISE → ROLLBACK` transactions (nothing persisted):
- **14 forbidden writes** each rejected with `42501` and the correct `guard:` prefix.
- **11 legitimate writes** each succeeded: suggest-pending, volunteer-approved, volunteer
  withdraw, `approve_resource` + its `resource_approved` ledger credit, reject, admin direct
  edit, a `service_role` upsert (`ON CONFLICT (external_id,source)`), comment insert + reply,
  org-admin descriptive edits, and a platform-admin `is_active` toggle.
- **9 mutation checks** all KILLED: dropping each trigger, removing the volunteer carve-out,
  removing the admin bypass, and flipping the resources guard to `SECURITY DEFINER` each flipped
  its probe — proving every element is load-bearing.
- Smoke suite `30-p3-0-moderation-guards.smoke.ts` (ledger-gated on `20261009000000`) asserts the
  structural facts post-apply.

App gates: `tsc` 0 errors; `eslint` 0 errors; `test:unit` 66/66 (incl.
`use-volunteer-resource.withdraw.test.mjs` 5/5); `next build` ✓.
