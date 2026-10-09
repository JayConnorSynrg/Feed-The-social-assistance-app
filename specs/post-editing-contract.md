# Post editing — RPC contract (PR-2, migrations `20261026000000_post_editing_foundation` + `20261026500000_post_editing_contract`)

Owner: Jelal Connor / SYNRG SCALING, LLC. Model and invariants: [post-editing-model.md](post-editing-model.md).
Behavioural proof: `supabase/tests/posts_editing.smoke.sql` (156 checks, passing in both release states) + `supabase/tests/posts_editing.race.sh` (10 races).

## Release: expand / contract

| Step | File | Client INSERT on `posts`, INSERT/UPDATE/DELETE on `polls` |
|---|---|---|
| 1. Expand (apply first) | `20261026000000_post_editing_foundation.sql` | **kept** — the deployed client keeps posting and creating polls directly |
| 2. Deploy the client that writes through `create_post` | — | — |
| 3. Contract (apply after the deploy) | `20261026500000_post_editing_contract.sql` | **revoked**; `create_post` is the only writer |

**The forged-insert hole (a client can set `is_pinned`, counts, `created_at`, `petition_id`, `version`,
`deleted_at`, …) and the poll vote-wipe hole stay open until step 3** and are closed by
`20261026500000`. The contract file refuses to run before the foundation (`55000`, "requires
20261026000000 … to be applied first"). Everything else — comment UPDATE/DELETE revoked, RLS, the RPCs,
history, moderation, likes / votes on hidden posts — is enforced from step 1.

Every write below is a `SECURITY DEFINER` function with `search_path = public, pg_temp`, executable by
`authenticated` + `service_role` only (no `anon`, no `PUBLIC`). Each refuses a guest
(`is_anonymous` JWT) **first**, even when the guest authored the row or holds an admin tier.

## Errors

PostgREST turns the SQLSTATE into the HTTP status; supabase-js returns `{ code, message, details, hint }`.
Branch on `code` + `message` (the message is a stable token, never prose).

| SQLSTATE | HTTP | `message` tokens | Meaning |
|---|---|---|---|
| `PT409` | 409 | `edit_conflict` | Stale `p_expected_version`. `details` is JSON (below). |
| `PT404` | 404 | `post_not_found`, `comment_not_found`, `comment_deleted`, `revision_not_found`, `poll_not_found`, `post_deleted` | Missing, or deleted by its author. |
| `42501` | 403 (401 anon) | `guest_refused`, `not_authenticated`, `not_author`, `post_removed`, `comment_hidden`, `comments_closed`, `revision_under_report`, `p3_denied:insufficient_tier`, `permission denied for table …`, `new row violates row-level security policy …` | Not allowed. |
| `22023` | 400 | `post_field_not_editable:<key>`, `post_field_invalid:<key>`, `post_field_required:<key>`, `post_field_locked:<key>` (+ `hint`), `capacity_below_committed` (+ `details` `{"committed": n}`), `post_fields_not_object`, `comment_invalid:content`, `comment_field_required:<key>`, `reason_required` | Bad input / locked field. |
| `0A000` | 400 | `post_type_not_creatable:<type>`, `post_type_not_editable:petition` | Type not handled by this path. |

**PT409 `details`** (a JSON object as text; jsonb key order):

```json
{"edited_at": "2026-10-09T21:53:18.95109+00:00", "current_version": 4}
```

Moderation conflicts add `"needs_review": true|false`. Parse with `JSON.parse(error.details)`;
`edited_at` is `null` when the post was never visibly edited.

**Member-event `details`** — every event problem at once (the `message` is the first of
`starts_at`, `time_zone`, `ends_at`):

```json
{"problems": {"ends_at": "before_start", "time_zone": "required"}}
```

Values: `required`, `invalid`, `before_start`. Production's one legacy event post (no zone, end before
start) returns exactly this on its first edit; it is untouched until then.

Moderation RPCs keep their legacy messages for the auth checks (`Anonymous users cannot perform
moderation actions`, `Account required for this action`, `Not authenticated` / `not authenticated`,
`report not found`, `action must be dismiss or uphold`).

## Author RPCs

### `create_post(p_post_type post_type, p_fields jsonb, p_resource_id uuid DEFAULT NULL, p_lang text DEFAULT NULL) → uuid`
The only client writer of `posts` (direct INSERT is revoked). Returns the new post id.
- `p_fields`: keys from the per-type table below; `content` is required. Unknown or protected keys → `22023 post_field_not_editable:<key>`.
- `p_resource_id`: only for `feed` and `source_offer`, and only an `approved` resource → else `22023 post_field_invalid:resource_id`.
- `poll`: `options` is required; the `polls` row is created in the same transaction (question = `content`). `ends_at` must be in the future or `null`.
- `event_post`: `starts_at` and `time_zone` are required (`post_field_required:starts_at` / `:time_zone`); `details` lists every problem (see Errors).
- `p_lang`: the client's effective app locale (`lib/i18n.ts` `Locale`: en, es, ht, vi, ar, zh, so, fr, pt, ru, ko, tl, am, hmn). Trimmed and lower-cased; anything else (incl. `'other'`) is stored as `NULL`, never an error. Stored in `posts.lang`; share previews (OG / oEmbed) use it. Never editable (`edit_post` → `post_field_not_editable:lang`).
- `petition`, `resource_post` → `0A000 post_type_not_creatable:<type>` (created by their own server paths).
- Stored text is **raw** (trimmed): send the user's text, not `sanitizeInput(...)`; React escapes on render.

### `edit_post(p_post_id uuid, p_expected_version integer, p_changes jsonb, p_reason text DEFAULT NULL) → jsonb`
Author only (`not_author` for everyone else, every admin tier included). `p_changes` holds only the
keys that change (same per-type table). `p_reason`: optional public edit note, ≤ 500 chars.

Returns:
```json
{"grace": false, "changed": ["content"], "post_id": "…", "version": 3, "edited_at": "…", "edit_count": 2, "revision_id": 17}
```
- `version` is the new token; send it with the next edit. `changed` is `[]` for a no-op (version unchanged, nothing written).
- `grace: true` = a quiet edit: within 5 min of creation, post visible, no likes / comments / votes / opt-ins / reports. No history row; `edited_at` / `edit_count` unchanged (no "Edited" label). `version` still increments.
- Order of checks: guest → `p_expected_version` present → found & not deleted (`PT404`) → author → not removed (`post_removed`) → not a petition → version (`PT409`) → fields.
- Held / community-hidden post: editable; it stays hidden and is re-queued for moderators (`needs_review_at`).

### `delete_own_post(p_post_id uuid) → jsonb`
`{"deleted": true, "post_id": "…"}`. Soft delete: the post leaves the feed for the author and the
public (staff keep it); opt-ins, comments, votes and history stay. A deleted post takes no edit,
comment, vote, opt-in or report; a second delete → `PT404 post_not_found`.

### `redact_post_revision(p_revision_id bigint, p_reason text DEFAULT NULL) → jsonb`
### `redact_comment_revision(p_revision_id bigint, p_reason text DEFAULT NULL) → jsonb`
`{"redacted": true, "revision_id": n, "redactor_role": "author"|"platform_admin", "already_redacted": false}`.
The author of the post / comment, or a platform admin (`p_reason` required → `reason_required`;
one `admin_actions` row). Blanks the text, keeps version / time / role. Repeat → `already_redacted: true`.
An author cannot redact a post revision that an **open** report points at (`revision_under_report`).

### `edit_comment(p_comment_id uuid, p_expected_version integer, p_content text) → jsonb`
```json
{"grace": false, "changed": true, "version": 3, "edited_at": "…", "comment_id": "…", "edit_count": 1, "revision_id": 9}
```
Author only; 1–2000 chars after trim; stale version → `PT409` (`details` `{"edited_at": …, "current_version": n}`).
Grace = within 5 min and no replies. Refused when the comment is deleted (`PT404 comment_deleted`),
hidden (`comment_hidden`) or the post is deleted / removed (`comments_closed`). Comments are inserted as
before (direct `post_comments` INSERT); **UPDATE and DELETE are revoked** (use this RPC and
`delete_own_comment`).

### `delete_own_comment(p_comment_id uuid) → jsonb`
`{"comment_id": "…", "deleted": true}`. Author only (`not_author`), guest refused first. **Soft
delete:** the row stays, `content` becomes `''` and `deleted_at` is set; every reply stays under it
(render the parent as "Comment deleted" when `deleted_at` is set and keep its replies). A second
delete → `PT404 comment_not_found`. The comment's edit history stays readable under the unchanged rules
(the author can still redact it with `redact_comment_revision`). New replies under a deleted comment are
allowed. Staff hide / unhide is unchanged. A hard delete that still happens (account deletion
cascade) keeps other people's replies: they lose their parent link (`parent_id` → `NULL`) instead of
being deleted.

### OPEN — `posts.comment_count` must count live, visible comments (for feed-db-migrations-expert)

**Observed** (DB harness, prod-catalog dump with 20261026000000 applied, and with 20261026000000 + 20261026500000;
probe `scratchpad/edit-build/db/probe/comment_count.sql`, identical output in both states).
`sync_post_comment_count` recounts `count(*)` of **every** `post_comments` row of the post, so a soft delete or a hide
never changes the number:

| step | `posts.comment_count` | rows | live (not deleted) | rows the thread renders | live and not hidden |
|---|---|---|---|---|---|
| 4 comments (one a reply) | 4 | 4 | 4 | 4 | 4 |
| a leaf soft-deleted (no replies) | **4** | 4 | 3 | 3 | 3 |
| a parent soft-deleted (it has a reply) | **4** | 4 | 2 | 3 (2 + its "Comment deleted" placeholder) | 2 |
| one comment hidden by a moderator | **4** | 4 | 2 | 2 | 1 |

The client's number (comment button + thread header) is **live and not hidden, replies included**
(`liveCommentCount`, `apps/web/src/hooks/use-comments.ts`). While a thread is open the client already pushes that
number to the card; a closed card shows `posts.comment_count`, which over-counts deleted and hidden comments.

**Required change** (new migration; 20261026000000 is committed):
- `sync_post_comment_count`: `count(*) FROM post_comments pc WHERE pc.post_id = target AND pc.deleted_at IS NULL AND NOT pc.is_hidden`
  (same for the `OLD.post_id` branch). The trigger already fires AFTER INSERT OR UPDATE OR DELETE, so soft delete
  (`deleted_at`) and hide / unhide (`is_hidden`) recount.
- One-time backfill of `posts.comment_count` with the same predicate.
- `edit_post` grace (`p.comment_count = 0`, foundation line 584) must keep meaning "nobody has engaged": replace with
  `NOT EXISTS (SELECT 1 FROM post_comments WHERE post_id = p.id)` (any row, deleted or hidden included), or deleting
  the only comment re-opens quiet edits.
- `ranked_feed_v2` (`cfg.comment_weight * v.comment_count`) then ranks on live, visible comments — intended.
- Smoke: the four rows above (count 4 → 3 → 2 → 1); grace stays closed after the only comment is deleted.
- No client change is needed when this lands (`comment_count` is already in the posts publication and patched).

## Moderator RPCs (community moderator and up)

| RPC | Change in PR-2 |
|---|---|
| `admin_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_reason text DEFAULT NULL) → {"comment_id","is_hidden"}` | New. One `admin_actions` row (`comment.hide` / `comment.unhide`). |
| `admin_hold_post(p_post_id uuid, p_expected_version integer DEFAULT NULL)` | + optional version; `PT404 post_deleted` on a deleted post. |
| `admin_remove_post(p_post_id uuid, p_reason text DEFAULT 'admin_removal', p_expected_version integer DEFAULT NULL)` | + optional version. |
| `admin_authorize_post(p_post_id uuid, p_expected_version integer DEFAULT NULL)` | + optional version; `PT404 post_deleted` on a deleted post. |
| `admin_resolve_report(p_report_id uuid, p_action text, p_expected_version integer DEFAULT NULL)` | + optional version; returns `{"report_id","action","unhidden","needs_review"}`. |

- **Send the version the moderator is looking at** (`posts.version`). A stale one → `PT409`.
- `NULL` = legacy caller (accepted during the client rollout). A legacy caller **cannot publish**
  (authorize, or the dismissal that lifts a community hide) a post whose author edited it since it
  was hidden: authorize → `PT409` with `"needs_review": true`; the dismissal still closes the report
  but leaves the post hidden (`needs_review: true` in the result). Only a versioned decision clears
  the review flag.
- A dismissal lifts **only** a `community_reports_threshold` hide, and only when no open report is
  left; holds, removals and deletions stay.
- Every post moderation audit row carries `details.version`.

## Per-type fields (`create_post` + `edit_post`)

| Type | Fields | Notes |
|---|---|---|
| `feed` | `content`, `image_url`, `image_alt`, `max_seekers` | composer + programs "Share to feed" (`p_resource_id`). |
| `seeker_request` | `content`, `categories`, `max_seekers` | |
| `source_offer` | `content`, `categories`, `max_seekers` | + `p_resource_id` on create. |
| `event_post` | `content` (title), `starts_at`, `ends_at`, `location`, `is_online`, `time_zone` | Every edit must leave a `time_zone` (legacy zone-less rows add one on their first edit). |
| `poll` | `content` (question), `options`, `ends_at` | Locks below. |
| `resource_post` | `content` | not creatable here. |
| `petition` | — | not creatable / editable here. |

Field rules:

| Key | Type | Rule |
|---|---|---|
| `content` | string | trimmed, 1–5000 chars; poll question 3–300. |
| `image_url` | string \| null | `https://ndtpovonpadugthmcntl.supabase.co/storage/v1/object/public/post-images/<author uid>/<uuid>.(jpg\|png\|webp)` (or local `http://127.0.0.1:54321`/`localhost:54321`), and the object must exist. `null` removes the photo and its alt text. |
| `image_alt` | string \| null | ≤ 1000 chars, `""` = null; needs an image. |
| `max_seekers` | integer \| null | 1–1000; `null` = unlimited. Edit: never below the opt-in rows already held (`capacity_below_committed`, `details` `{"committed": n}`); `slots_remaining` is recomputed. |
| `categories` | string[] | ≤ 10, each 1–40 chars (trimmed). |
| `starts_at`, `ends_at` | string | venue-local wall time `YYYY-MM-DDTHH:MM[:SS]`; `ends_at` may be null and must be after `starts_at`. |
| `time_zone` | string | IANA zone known to the server; `America/Asuncion` and `America/Coyhaique` refused (same list as `lib/event-time.ts` `SERVER_UNSUPPORTED_ZONES`); cannot be removed. |
| `location` | string \| null | ≤ 200 chars; cleared when `is_online` is true. |
| `is_online` | boolean | |
| `options` | string[] | 2–10, each 1–100 chars, unique ignoring case. |
| `ends_at` (poll) | string \| null | an instant **with an offset** (`toISOString()`), or `"now"` to close the poll now; `null` = no deadline. |

Poll locks after the first vote: question and options locked (`post_field_locked:content` /
`:options`); the deadline may only be extended, removed, or closed now (`"now"` or any past
instant → `ends_at = now()`); shortening to a future time or reopening a closed poll →
`post_field_locked:ends_at`. Votes are refused once the poll has ended or its post is deleted.

## Columns × roles (`posts`)

| Column | anon read | member read | Written by |
|---|---|---|---|
| `content`, `metadata`, `max_seekers` | ✓ (visible rows) | ✓ | `create_post`, `edit_post` (author) |
| `image_url`, `image_alt` | ✓ | ✓ | `create_post`, `edit_post` (author, `feed`) |
| `version`, `edited_at`, `edit_count` | ✓ | ✓ | `edit_post` only |
| `lang` | ✓ | ✓ | `create_post` only (never edited) |
| `deleted_at`, `needs_review_at` | — | ✓ | `delete_own_post`; `edit_post` / moderation RPCs |
| `slots_remaining` | ✓ | ✓ | opt-in RPCs; `edit_post` reconcile |
| `is_hidden`, `hidden_at`, `hidden_reason` | ✓ | ✓ | moderation RPCs, report threshold, `delete_own_post` |
| `user_id`, `post_type`, `resource_id`, `petition_id`, `created_at`, `is_pinned` | ✓ | ✓ | set once by `create_post` / server paths; never edited |
| `like_count`, `comment_count`, `updated_at` | ✓ | ✓ | triggers |
| `location` | — | — | (unchanged) |

Row visibility (`posts_select_public`): visible posts to everyone; a hidden (held / removed /
community-hidden) post to its author and staff; a **deleted** post to staff only.
`post_comments` + both history tables follow the parent: readable exactly when the parent is
readable; a hidden comment by its author + staff only.

`post_comments` gains `version`, `edited_at`, `edit_count`, `deleted_at`; `content_reports` gains `reported_version`.

## Engagement on hidden posts

A hidden post (held, removed, community-hidden or deleted) takes no new engagement from anyone, its
author and staff included:

| Write | Rule on a hidden post | Error |
|---|---|---|
| like (`post_likes` INSERT) | refused (unlike / DELETE stays allowed) | `42501 new row violates row-level security policy "post_likes_insert_post_visible"` |
| poll vote (`poll_votes` INSERT) | refused; also after the poll ended | `42501 … policy "poll_votes_insert_poll_open"` |
| opt-in (`opt_in_to_post`) | refused | `This post is closed` |
| report (`submit_content_report`) | deleted posts refused | `post not found` |
| comment or reply (`post_comments` INSERT) | refused | `42501 … policy "post_comments_insert_post_visible"` |

## History tables (read-only for clients)

`post_revisions(id, post_id, version, edited_at, reason, fields_changed text[], snapshot jsonb, redacted_at, redactor_role)` —
one row per recorded edit, holding the superseded `version`; `snapshot` =
`{content, metadata, image_url, image_alt, max_seekers[, poll {question, options, ends_at}]}`.
`post_comment_revisions(id, comment_id, version, edited_at, content, redacted_at, redactor_role)`.
No author name in either: the author is the post's author; redactions show the role only.
Fetch: `.from('post_revisions').select('id, version, edited_at, reason, fields_changed, snapshot, redacted_at, redactor_role').eq('post_id', id).order('version', { ascending: false })`.

## Realtime

`supabase_realtime` → `posts` now also carries `version, edited_at, edit_count, image_alt, deleted_at,
needs_review_at` (not `lang`: no realtime consumer) (other members unchanged: `post_comments (id, post_id)` and `poll_votes (id, poll_id)` stay
doorbells — re-read on UPDATE). A post that becomes hidden/deleted is not delivered to viewers who can
no longer read it: drop it locally on the author's own delete and re-read on the doorbells.

## Removed

`ranked_feed` (v1). Use `ranked_feed_v2` (deleted posts are never ranked).
