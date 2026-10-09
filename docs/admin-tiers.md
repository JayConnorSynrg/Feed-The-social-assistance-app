# Admin tiers (P3.1)

FEED has three admin tiers plus an orthogonal org-admin axis. Privilege is **nomination only**: a
strictly higher tier grants and revokes. There is no self-request, no threshold, and no code to
redeem. This document replaces `administrator-code.md` (the facilitator self-elevation code is
retired — see the end).

Backend: `supabase/migrations/20261010000000_p3_1_admin_tiers.sql`.

## The tiers

| Tier | Value (`profiles.admin_tier`) | Public marker | Can do |
|---|---|---|---|
| Community Moderator | `community_moderator` | "Moderator" | Post moderation (remove / hold / authorize), report handling, comment hide / unhide, safety-alert verify + remove. Sees hidden and deleted posts and hidden comments. Never edits anyone's text. |
| Resource Admin | `resource_admin` | "Resource Admin" | Everything a CM can, **plus** the resource review queue: list pending, approve, reject, update, set location, list resources. |
| Platform Admin | `platform_admin` | "Admin" | Everything. Redacts private details from post / comment edit history (reason required). Discovery, form templates, SNAP, dashboards, user notes, events cross-org, AI summary, users (ban/delete), federation, organizations, and granting/revoking tiers. |

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

**Feed surfaces (PR-5b)** — every link renders through `ClientAdminEditLink`
(`apps/web/src/components/admin/client-admin-edit-link.tsx`): nothing on the server or in the first
hydrating render, then `AdminEditLink`, so no admin link is ever part of server HTML.

| Surface | Item / id | `source` |
|---|---|---|
| Feed post card (`feed-panel.tsx` `PostCard`, beside Report; petitions are posts) | post `posts.id` | `feed_post` |
| `/s/post/<id>` (server page; `components/feed/post-admin-edit-link.tsx` is its client island) | post | `post_page` |
| Map safety-alert popup (inside the popup dialog: Tab reaches it, Escape still closes) | `safety_alerts.id` | `map_popup` |
| Feed Active Alerts strip (`components/feed/safety-strip.tsx`, beside each alert button, never inside it) | `safety_alerts.id` | `feed_alert` |
| Event card in the feed / in the Events tab (`components/feed/event-card.tsx`) | event `assistance_events.id` + `org_id` | `feed_event` / `events_panel` |

Event cards carry `orgId` from the one hydration select (`EVENT_OCCURRENCE_SELECT` reads the event's
own `org_id`). Cost: post and alert links share the one tier lookup; an event link of a viewer who is
not a platform admin adds one `get_admin_org_list` per identity (an organization admin may hold no
tier, so a signed-in member's feed with event cards asks once).

**What the admin screen opens** — the tab that owns the kind claims `?focus=` on mount
(`app/(admin)/moderation/use-admin-focus.ts`) and writes exactly one `admin.deeplink.resolve` row, then
drops the param with `history.replaceState`:

- **Post** → Moderation tab, **Linked post** panel above the reports queue (`focused-post.tsx`): the post
  is read by id first (staff read any post, hidden or held; author embed `profiles!posts_user_id_fkey`),
  then Remove / Hold / Authorize — Remove unless already removed, Hold while visible, Authorize while
  hidden. It works for posts nobody reported. The RPCs accept any id and do not check it exists, so
  the buttons render only for a post that was read and act on the id that was read. Remove / Hold /
  Authorize have ONE client path, `moderatePost` (`post-moderation-actions.ts`), used by the reports
  queue and this panel. `found` / `not_found` (no row, or the read failed).
- **Safety alert** → Moderation tab opens on **Safety Alerts**; the alert is read by id while live
  (`whereSafetyAlertLive`) and pinned first, once, marked "Opened from link", with Approve / Remove —
  even when it is not among the newest 50. A removed or expired alert is unreadable (RLS
  `safety_alerts_select` is `status = 'live'`) → `not_found` with "no longer live".
- **Event** → the scheduler (main shell Events tab, or the organization page's Events tab) reads the
  event by id with the list's embeds and opens its **edit dialog** when it manages it: an event of
  this organization (organization page) or of one of `get_admin_org_list` (main shell: active,
  non-business). Otherwise `not_found` with a translated line ("organization is inactive" when it is).
  Closing the dialog returns focus to "New event".

The shell writes the row when no tab will take the link (`admin-focus-session.ts`
`adminFocusGateOutcome`, run once the tier and organization roles have loaded): `forbidden` when the
viewer's tier does not show the owning tab (e.g. an organization admin on a post link), `invalid` for a
malformed focus, a kind the screen never opens, or a `?tab=` that is not the kind's tab. A tab left
before it resolved writes `abandoned`. A tab claims a focus only when `?tab=` names it — the gate's own rule — so when the
shell falls back to another tab for a missing or different `?tab=`, only the gate writes (invalid): exactly one writer
exists for any URL. For `forbidden` /
`invalid` the shell also shows one plain line in the viewer's language (`admin-focus-gate-status.tsx`,
`lib/i18n-admin-focus.ts`, 14 locales) in a `role="status"` region rendered from the first paint.

**Stated exception — refused before any client code runs: no row.** A link the server turns away
before the admin page's JavaScript loads writes no `admin.deeplink.resolve` row: a signed-out visitor
(`proxy.ts` → `/login`), a signed-in user with no tier and no organization role (`(admin)/layout.tsx`
→ `/`), and an organization page the viewer may not administer (`notFound()` in
`moderation/org/[id]/page.tsx`, counted by `admin.org_page.load` with `outcome = not_found`). The link
is shown only to viewers the screen accepts, so these arise only from a forwarded or stale link.

**Screen details.** The Linked post panel has ONE `role="status"` line (loading → status → each
action's result) and moves focus to its heading after an action and on load; buttons are
`aria-disabled` while an action runs; Remove is red-700 (6.4:1, also in the reports queue and the
Safety Alerts review); closing it returns focus to the selected sub-tab. Reports / Safety Alerts is a
real tablist. When the reports queue changes a post, the Linked post panel re-reads it (and an action
in the panel reloads the queue), so neither acts on a stale state. The scheduler renders the event
edit dialog outside its loading / error / ready branches, so a `found` event link opens the dialog
even when the event list failed to load; its not-found line is one `role="status"` region. On the
feed, each Active Alerts item is a real `<button>` and its Edit in admin name adds the age and the
start of the description (several alerts share a type); a hidden post card dims its content but not
the action row; an image-only post's link is named "post by <author>, <date>" on the feed ("post by <author>" on `/s/post`, which shows one post and keeps its develop author read untouched). The Linked post panel reads the author's `first_name` only — no `username` / `avatar_url` / `bio`, which the pending Settings C2 change revokes.

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

## Post editing and comment moderation (20261026000000)

Authors edit and delete their own posts and comments; no tier rewrites someone else's text
(contract: `specs/post-editing-contract.md`). Staff actions, each writing exactly one audit row:

| Action (`admin_actions.action`) | RPC | Tier |
|---|---|---|
| `comment.hide` / `comment.unhide` | `admin_set_comment_hidden(p_comment_id, p_hidden, p_reason)` | CM+ |
| `post.hold` / `post.remove` / `post.authorize` / `report.resolve` | the post moderation RPCs, now with an optional `p_expected_version`; `details.version` records the version acted on | CM+ |
| `post_revision.redact` / `comment_revision.redact` | `redact_post_revision` / `redact_comment_revision` (reason required) | PA |

Moderation clients send the `posts.version` the moderator is looking at: a stale one returns 409
(`PT409 edit_conflict`). Without a version, an author's edit to a held / community-hidden post that no
moderator has seen cannot be published (authorize → 409 with `needs_review: true`).
