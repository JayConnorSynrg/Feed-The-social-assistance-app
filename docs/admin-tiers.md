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

## Getting back to the feed / viewing as members

- **Back to feed**: every admin page (`/moderation`, the organization admin pages, `/federation/*`, and the
  admin error and not-found screens) has one **Back to feed** link at the top left. It opens the
  community feed in the same tab. It follows the profile language.
- **View …**: admin rows link to what members see — **View post** (Moderation reports and Removed & Held
  posts) and **View public page** (Manage resources, Businesses, Organizations More menu, the
  organization admin page's Profile tab). The link appears only while a member can see the item there.
  Otherwise the row says why: *Hidden from members*, *Inactive — hidden from members*, *Not approved —
  hidden from members* (also on every "Awaiting review" business and resource), or *No longer exists*.
  Links open in one preview tab named `feed-preview`; each click reuses it. What an admin sees there
  is what a member sees: the public business pages and showcase hide inactive businesses, and an
  organization page lists only approved linked resources.
- **View in feed** (Events tab, both the main admin and an organization's admin page): each event row
  links to that event in the members' Events list, opened in the `feed-preview` tab, where its card is
  scrolled into view, focused and highlighted. The link appears exactly when members see the event
  there now (the server rule `event_feed_next`: active event, active organization, a date that has not
  ended, from 00:00 venue time "N days before" its date). Otherwise the row says *Appears in feed
  <date>* (the venue's date) or why not: *Retired*, *Organization inactive*, or *No upcoming dates*.
  After **New event** the "created" notice offers the same link or date for the new event.
  Known gap: the link follows the window rule only; the members' list shows the first 50 events, so an
  event ranked 51st or later gets the link but is reported as not in the list. If the
  event is not among the first 50 listed when the link is followed, the members' list says so and
  nothing moves.
- **View on map** (Manage resources, Businesses, the Organizations More menu, the organization admin
  page's Profile tab, and Safety Alerts Review): opens the members' map in the `feed-preview` tab,
  centred on the item's pin with its popup open (a resource's details open too). The link appears
  exactly when a member's map shows the pin now: an approved resource with a location, an active
  organization with a location, an approved active business with a location, a live safety alert that
  has not expired. Otherwise the row says why: *No location — not on the map*, *Inactive*, *Not
  approved*, or *Expired — not on the map* (an inactive organization or business shows *Inactive* once,
  not twice). A resource whose business is on the map opens on the business's pin, because the map
  shows one pin for the two. If the place has left the map by the time the link is followed (its
  status, location or expiry no longer qualify), the map says "That place isn't on the map right now."
  and does not move. If it still qualifies but its pin does not load within 8 seconds, the map has
  already flown to where it is and shows the same line. The flight is instant under Reduce motion
  (FEED's setting or the device's).
- **Tabs in the URL**: the open tab is in the address (`/moderation?tab=people`,
  `/moderation/org/<id>?tab=members`), so a reload or a shared link returns to it. A tab your tier does
  not include opens your first tab instead. Switching tabs replaces the address without adding Back
  entries.

## Admin edit links ("Edit in admin")

An admin looking at an item in the member app gets an **Edit in admin** link that opens the admin
screen with that item open, in one reused tab named `feed-admin`. Members, logged-out visitors and
guests never see it, nor does anyone while the admin lookup is loading or after it failed. The shared
pieces (PR-5 foundation) are wired into member surfaces by PR-5a (map popups, `/s` pages) and PR-5b
(feed posts, events).

**Who sees the link** — `canEditInAdmin` (`apps/web/src/lib/admin-editability.ts`), the same rule the
admin screen and its RPCs enforce:

| Item | Link shown to | Server gate |
|---|---|---|
| post | community moderator and up | `admin_remove_post` / `admin_hold_post` / `admin_authorize_post` (`current_user_tier_at_least('community_moderator')`) |
| safety alert | community moderator and up | `admin_verify_safety_alert` / `admin_remove_safety_alert` (same) |
| resource | resource admin and up | `admin_update_resource` (`current_user_tier_at_least('resource_admin')`) |
| business | platform admin (`canEditBusinesses` in `lib/admin-tier.ts` — the one line PR-6 widens) | `orgs_admin_update` / `orgs_admin_select` (`is_current_user_admin()`) |
| organization | platform admin, or an admin of that organization | `can_admin_org` |
| event | platform admin, or an admin of the event's organization | `org_event_write_gate(assistance_events.org_id)` |

"An admin of that organization" = the organization is in the viewer's `get_admin_org_list` (active,
non-business, `organization_members.role = 'admin'`), which is exactly the organization-admin branch of
`can_admin_org`. Resource rows that are form templates (`discovery_metadata.content_type = 'form'`) are
platform-admin-only in `admin_update_resource`; none exist among `resources` today.

**URL contract** — `adminEditUrl` (`apps/web/src/lib/admin-url.ts`); the admin screens read it back
with `readAdminFocus` / `stripAdminFocusHref` (`app/(admin)/moderation/admin-focus-url.ts`) or the
existing `readOrgPanelTarget` (`?org=`):

| Item | Platform admin | Anyone else allowed |
|---|---|---|
| resource | `/moderation?tab=manage&focus=resource:<uuid>` | same |
| business | `/moderation?tab=businesses&focus=business:<uuid>` | — |
| safety alert | `/moderation?tab=moderation&focus=safety_alert:<uuid>` | same |
| post | `/moderation?tab=moderation&focus=post:<uuid>` | same |
| organization | `/moderation?tab=organizations&org=<uuid>` | `/moderation/org/<uuid>?tab=profile` |
| event | `/moderation?tab=events&focus=event:<uuid>` | `/moderation/org/<orgUuid>?tab=events&focus=event:<uuid>` |

**Cost**: the viewer's tier is looked up once per signed-in identity per page load, shared by every
`useAdminTier()` and every link (`resolveAdminTier`); the organization list only for organization or
event links of a viewer who is not a platform admin, also once. Logged-out visitors and guests cost no
call (`useIsOrgAdmin` included). Each click writes one `admin.nav.edit_in_admin` row; each followed link
writes one `admin.deeplink.resolve` row from the admin screen (see `docs/observability.md`).

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
