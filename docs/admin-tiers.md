# Admin tiers (P3.1)

FEED has three admin tiers plus an orthogonal org-admin axis. Privilege is **nomination only**: a
strictly higher tier grants and revokes. There is no self-request, no threshold, and no code to
redeem. This document replaces `administrator-code.md` (the facilitator self-elevation code is
retired — see the end).

Backend: `supabase/migrations/20261010000000_p3_1_admin_tiers.sql`.

## The tiers

| Tier | Value (`profiles.admin_tier`) | Public marker | Can do |
|---|---|---|---|
| Community Moderator | `community_moderator` | "Moderator" | Post moderation (remove / hold / authorize), report handling, safety-alert verify + remove. Sees hidden posts. |
| Resource Admin | `resource_admin` | "Resource Admin" | Everything a CM can, **plus** the resource review queue: list pending, approve, reject, update, set location, list resources. |
| Platform Admin | `platform_admin` | "Admin" | Everything. Discovery, form templates, SNAP, dashboards, user notes, events cross-org, AI summary, users (ban/delete), federation, organizations, and granting/revoking tiers. |

Org admins (`organization_members.role='admin'`) are a **separate** axis: they get the Events tab
for their own active org only, regardless of tier.

`admin_tier` is the single source of truth. Two legacy booleans are **derived** from it by the
`sync_tier_flags` BEFORE trigger and are never written directly:
- `is_admin = (admin_tier = 'platform_admin')` — the `is_current_user_admin()` gate (PA).
- `is_staff = (admin_tier IS NOT NULL)` — the moderation gate (any tier ≥ CM).

This is why all ~48 `is_current_user_admin()` policies/RPCs become PA and all `is_staff` moderation
RPCs become CM+ with no predicate edits.

The public tier marker (T4) renders wherever a post author or a profile is shown: feed cards, the
appreciation sheet, the profile page and its post list (`post-card`), comment authors in the
comment thread, the shared post page, and the admin user lists. Messages and the opt-in seeker list
are person-to-person surfaces outside that ruling and are left unmarked (possible follow-up).

## Nomination: who may grant/revoke whom

Grants and revokes go through `admin_set_tier(p_target, p_tier, p_reason, p_request_id)` (returns
`{ok, code}`; never a self-target):
- **Resource Admin** may grant/revoke **Community Moderator**.
- **Platform Admin** may grant/revoke **CM and RA**, and move a user between them.
- Anything that touches **Platform Admin** (grant, revoke, or demote a PA) is **founder-only**.
- A Community Moderator (or a plain user) may grant nothing.

The **founder** is a singleton (`platform_founder`, seeded to the founder's profile id). The founder
is the only actor who can create or remove a Platform Admin. The founder can never be demoted,
banned or deleted through the app (they are PA — top tier — and self-targeting is refused).

`service_set_tier(p_target, p_tier, p_reason)` is a service-role-only break-glass path (audited,
actor NULL, reason required) for operators and CM/RA e2e fixtures. It is **not** a nomination path
and founder-only stays absolute: it refuses any change that touches Platform Admin (grant, or a
target that is already PA), any change to the founder, and anonymous/nonexistent targets — each
returns `{ok:false, code}` and writes an audit row. Because Platform Admin cannot be minted this
way, e2e specs that drive PA-only surfaces use a **pre-provisioned** PA account passed via
`E2E_PA_EMAIL` / `E2E_PA_PASSWORD` / `E2E_PA_USER_ID` and skip with a clear message when it is absent.

A caller with **no tier** (a guest, an anonymous session, or a plain user) that invokes
`admin_set_tier` gets a `p3_denied:*` RAISE (observable in `postgres_logs`) and **no** durable audit
row — only tier-holders' denials are recorded. Every stored `request_id` is validated to a
uuid/simple-token shape and capped at 64 chars (else NULL); `reason` is capped at 500 chars.

The two existing platform admins were migrated to `platform_admin` with zero behavior change.

## Ban / delete (T3)

Ban, delete and role changes cannot target a user of **equal or higher** tier, nor the actor
themselves. Content moderation and the resource queue do **not** carry this guard — a moderator may
moderate any post, including a Platform Admin's. Ban/delete stay Platform-Admin only and enforce T3 in `lib/admin-tier.ts` (`decideUserAction`)
plus a durable audit row. A caller below Platform Admin is refused 403 before any target lookup or
audit write (nothing written, nothing revealed); a PA acting on a nonexistent target gets 404.

Form-template rows (`discovery_metadata.content_type='form'`) are Platform-Admin-only on every
state-change path — approve_resource, reject_resource, admin_update_resource all refuse them for a
non-PA, and approve_form_template (PA-only) is the audited approval path.

## Audit (`public.admin_actions`)

Every privileged action — grant, revoke, ban, delete, each moderation RPC, each RA resource-queue
write — writes **exactly one** append-only row: `actor_id`, `actor_tier`, `action`, `target_type`,
`target_id`, `target_tier`, `outcome` (`ok`/`denied`/`error`), `reason`, `details`, `request_id`,
`created_at`.

- Clients cannot insert, update or delete rows; even `service_role` is append-only (SELECT + the
  SECDEF writer only). Only **Platform Admins** may read the table.
- New RPCs (`admin_set_tier`) write a durable `denied` row and return `{ok:false, code}` without
  raising, so denials are observable. Re-gated existing RPCs raise `p3_denied:<reason>` (42501),
  observable in `postgres_logs` and, via the client, in `app_logs`.
- The client mints one request id per privileged call, sends it as `x-request-id`, and passes it to
  `withMetric`, so the durable audit row and the latency/error telemetry share the id.

## The People tab

Reachable via Settings → Administration → Open Moderation Dashboard → **People** (RA+), or the shell
Admin nav. It lists people with their current tier and offers only the grants/revokes the viewer may
make (computed by `grantableTiers`), each requiring a reason. The Platform Admin option appears only
to the founder. It never exposes email or ban data (those stay in the PA-only `admin_list_users`).

## Facilitator code — retired

The `claim-facilitator-admin` edge function, its onboarding "Administrator" option and code input,
the `.gitignore` reference, and the `admin_code_redemptions` table (0 rows) are all removed. The
deployed function and its secrets are removed post-merge by the operator:

```
supabase functions delete claim-facilitator-admin --project-ref ndtpovonpadugthmcntl
supabase secrets unset FACILITATOR_ADMIN_CODE_HASH FACILITATOR_ADMIN_CODE_PEPPER --project-ref ndtpovonpadugthmcntl
```

The `profiles.user_role='facilitator'` label value is kept (still referenced by a few UI heuristics)
but is no longer selectable in onboarding.

## Follow-up

Comment moderation is **not** built in P3.1 (there are no comments in prod and it is new scope). When
built, `admin_remove_comment` / `admin_restore_comment` should be CM+ and audited like the post
moderation RPCs.
