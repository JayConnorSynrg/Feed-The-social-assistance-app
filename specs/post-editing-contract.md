# Post editing — RPC contract (PR-2, migrations `20261026000000_post_editing_foundation` + `20261026500000_post_editing_contract`)

Owner: Jelal Connor / SYNRG SCALING, LLC. Model and invariants: [post-editing-model.md](post-editing-model.md).
Behavioural proof: `supabase/tests/posts_editing.smoke.sql` (192 checks, passing in both release states) + `supabase/tests/posts_editing.race.sh` (20 races).

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
- `grace: true` = a quiet edit: within 5 min of creation, post visible, nobody has ever engaged (`posts.engaged_at IS NULL`: no like, poll vote, comment or opt-in, ever; an unlike, unvote, withdrawn opt-in, deleted or hidden comment keeps the window closed) and no report. No history row; `edited_at` / `edit_count` unchanged (no "Edited" label). `version` still increments.
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
before (direct `post_comments` INSERT), with **only** `id`, `post_id`, `user_id`, `content`, `parent_id` (column grant;
`created_at`, `version`, `edit_count`, `edited_at`, `deleted_at`, `is_hidden` take their defaults, any other column →
`42501 permission denied for table post_comments`); **UPDATE and DELETE are revoked** (use this RPC and
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

### Counters and the first-engagement marker (implemented in 20261026000000)

**`posts.comment_count`** = the post's comments with `deleted_at IS NULL AND NOT is_hidden`, replies included; a
deleted parent's "Comment deleted" placeholder is not a comment. This is the client's `liveCommentCount`
(`apps/web/src/hooks/use-comments.ts`), so a closed card and an open thread show the same number. No client change.
**`posts.like_count`** = the post's like rows (meaning unchanged).

- **Triggers** `sync_post_comment_count` / `sync_post_like_count` (same `AFTER INSERT OR UPDATE OR DELETE` triggers, new
  bodies; `SECURITY DEFINER`, `search_path = public, pg_temp`, no client EXECUTE) lock the post row(s), then recount in
  a separate statement. Comments recount on insert, hard delete, soft delete, hide, unhide, un-delete and a `post_id`
  change (both posts, locked in id order). An update that leaves the comment on the same post and in the same
  counted / not-counted state (a content edit) does not touch the post row.
- **Concurrency:** recount under the post row lock. Under READ COMMITTED the recount statement takes its snapshot
  after the lock is granted, so it sees the change of the session that held the lock before. The previous bodies
  recounted inside the locking UPDATE (snapshot from before the wait) and lost one of two concurrent changes:
  reproduced for likes when the author likes their own post while another member likes it (`like_count` 1, 2 rows).
  The like path is serialized by the engagement trigger's profile lock in every other case. A recount, unlike a relative ±1,
  rewrites the true value on every change, so a stale number never outlives the next change to its post.
- **`posts.engaged_at`** (`timestamptz NULL`): the first like, poll vote, comment or opt-in, set once
  (`COALESCE(engaged_at, now())`) and never cleared. Likes and comments set it in the count trigger's UPDATE, under the
  post lock. Votes and opt-ins set it in `mark_post_engaged`, a `BEFORE INSERT` trigger. It runs BEFORE so the post is
  locked ahead of the vote's foreign-key lock on `polls`: that is `edit_post`'s order (post, then poll), so a vote and
  an options edit cannot deadlock. A comment moved onto a post (`post_id` change, owner path only) also sets it there.
  Server-only: no SELECT, UPDATE or INSERT column grant, not in the realtime column list.
  Between 026 and 0265 the deployed client keeps table-level INSERT on `posts`, so a direct insert can preset
  `engaged_at` on the author's own new post: that only closes the author's own grace (harmless). 0265 revokes it.
- **Grace:** `edit_post` keys on `p.engaged_at IS NULL` (plus the unchanged "no report" term). An unlike, unvote,
  withdrawn opt-in, deleted or hidden comment does not reopen quiet edits. A like in flight makes a concurrent edit wait
  and then record (race C12).
- **Report threshold:** `submit_content_report` locks the post row before counting open reporters. Two concurrent
  reports (the 2nd and 3rd) no longer both count 2 and leave a 3-report post visible (reproduced before the fix).
- **Backfills** (026 takes SHARE on `post_likes`, `poll_votes`, `resource_opt_ins` and holds ACCESS EXCLUSIVE on
  `posts` / `post_comments`, so nothing lands under the old triggers): `comment_count` and `like_count` recounted
  (changed rows only); `engaged_at` set for every post with a like, vote, comment or opt-in row, at the earliest
  such `created_at` (`now()` when none carries one). Production on 2026-10-09: 2 posts, 0 comments, 1 like, 1 vote,
  0 count drift, so the counts change 0 rows and `engaged_at` is set on the engaged posts.
- **`post_id` re-point:** no client role has UPDATE on `post_comments` (revoked in 026), and no function changes
  `post_id`. Only the table owner / `service_role` can, and the trigger recounts both posts (smoke N9).
- **Lock order: the post row, then profiles.** The engagement triggers (outside 026, unchanged) lock the engager's and
  the author's profiles. `lock_post_for_engagement` (`BEFORE INSERT` on `post_likes` and `post_comments`) locks the
  post first, ahead of the foreign-key check and those triggers. All post locks taken by triggers are
  `FOR NO KEY UPDATE`, the mode a posts UPDATE takes, which never conflicts with another insert's foreign-key share
  lock. Before this, a like or comment held the post's foreign-key share lock and the author's profile, then waited
  for the post. A second like, comment or first vote held the post and waited for the profile, and Postgres aborted
  one with `40P01 deadlock detected`. That was a regression from the earlier `FOR UPDATE` recount lock and the vote
  marker; the production base does not deadlock. Races C13–C16.

| Path | Locks, in order (before → after) | Status |
|---|---|---|
| like insert | post FK share → profiles → post update lock (`FOR UPDATE`) → **post (BEFORE) → FK → profiles → recount** | Fixed (C14, C16) |
| comment / reply insert | post FK share → profiles → post update lock → **post (BEFORE) → FK → profiles → recount** | Fixed (C15) |
| poll vote insert | post (BEFORE, first vote only) → polls FK → profiles; later votes: profiles only | Already post-first (C16) |
| `opt_in_to_post` | post `FOR UPDATE` → opt-in insert → author profile (`credit_post_created` → `recompute_badge_summary`) | Already post-first (C13) |
| `withdraw_opt_in`, `unblock_opt_in` | post `FOR UPDATE` → opt-in delete → slots; no profile lock | Post only |
| opt-in accept / complete (author's direct UPDATE) | opt-in row → profiles (`engagement_on_opt_in`); no post lock | Profiles only |
| unlike, comment edit / delete / hide, `submit_content_report`, `edit_post`, `delete_own_post`, moderation RPCs | post only (no profile lock; `record_admin_action` only inserts) | Post only |

Counter audit (every stored count maintained on the tables 026 touches):

| Counter | Writer | Status |
|---|---|---|
| `posts.comment_count` | `sync_post_comment_count` | **Fixed**: lock, then recount; live + visible meaning (C9, C9b) |
| `posts.like_count` | `sync_post_like_count` | **Fixed**: lock, then recount (C10, C10b) |
| open-report threshold (`report_count`, auto-hide at 3) | `submit_content_report` | **Fixed**: post locked before the count (C11) |
| `posts.slots_remaining` | `opt_in_to_post` (−1), `withdraw_opt_in` / `unblock_opt_in` (+1), `edit_post` reconcile | Already safe: each locks the post `FOR UPDATE` first; relative ±1 in a later statement, reconcile counts after the lock (C3, C3b) |
| `posts.version`, `edit_count`; `post_comments.version`, `edit_count` | `edit_post`, `edit_comment` | Already safe: row locked `FOR UPDATE`, version token (C1, C4) |
| `user_engagement_counters.count` | `record_engagement_event` (via the like / vote / comment / opt-in engagement triggers) | Already safe: `INSERT … ON CONFLICT DO UPDATE SET count = count + n` applies to the latest row version. Out of 026's tables. |
| badge summaries, `profiles.harmony_*` | `recompute_*` (profile locked first), `submit_review` | Out of scope: not on 026's tables (badges recompute from source under `lock_two_profiles`) |
| poll results | none stored | No counter: read from `poll_votes` |

Readers of `posts.comment_count` and what the new meaning changes:

| Reader | Effect |
|---|---|
| `ranked_feed_v2` (`log10(1 + like_count + comment_weight * comment_count)`) | Ranks on live, visible comments. A post whose comments were deleted or hidden ranks slightly lower than before. This is intended. `ranked_feed` (v1) is dropped in 026. |
| `edit_post` grace | No longer reads it (`engaged_at` instead). |
| Feed list select (`FEED_POST_SELECT` in `post-model.ts`), `rowToPost`, card comment button (`post-card.tsx`) | Shows live, visible comments: the number the open thread shows. |
| Realtime `posts` column list (`comment_count` already published) + `applyPostRowPatch` (`post-model.ts`, absolute value) | Delete, hide and unhide now emit a `posts` UPDATE carrying the new number; a content edit no longer emits one. |
| `/s/post/[id]` share page | Reads `posts.comment_count` (and `like_count`) in its explicit column list, so it shows the same live, visible number as the feed card. It no longer counts `post_comments` rows (that count included soft-deleted comments). |

Probe (`scratchpad/edit-build/db/probe/comment_count.sql`, identical for 026 alone and 026 + 0265):

| step | `posts.comment_count` | rows | live (not deleted) | rows the thread renders | live and not hidden |
|---|---|---|---|---|---|
| 4 comments (one a reply) | 4 | 4 | 4 | 4 | 4 |
| a leaf soft-deleted (no replies) | 3 | 4 | 3 | 3 | 3 |
| a parent soft-deleted (it has a reply) | 2 | 4 | 2 | 3 (2 + its "Comment deleted" placeholder) | 2 |
| one comment hidden by a moderator | 1 | 4 | 2 | 2 | 1 |

Smoke: N1–N9 (each comment transition), N10a–c (the only comment deleted / hidden: grace stays closed), N11 + G8a +
G8b (every post in the database matches, including rows that existed before 026), N12 (trigger hygiene), G1–G7
(no engagement → quiet; like/unlike, vote/unvote, opt-in/withdraw → closed; later engagement never moves
`engaged_at`; clients cannot write it), E13. Races: C9, C9b, C10, C10b, C11, C12, C13–C16 (lock order).

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
| `engaged_at` | — | — | triggers only (first like / vote / comment / opt-in; never cleared) |
| `location` | — | — | (unchanged) |

Row visibility (`posts_select_public` for anon, `posts_select_member` for signed-in users): visible posts to
everyone; a hidden (held / removed / community-hidden) post to its author and staff; a **deleted** post to staff only.
`post_comments` (`post_comments_select_visible` anon, `post_comments_select_member` signed-in) + both history tables
follow the parent: readable exactly when the parent is readable; a hidden comment by its author + staff only.
Staff = community moderator tier and up, through `current_user_tier_at_least('community_moderator')`. No read policy
reads a `profiles` column, so a client-role REVOKE of `profiles` columns (Settings C2) cannot break post or comment
reads. Equivalent to the previous `profiles.is_staff` test: production 2026-10-09 has 0 of 23 profiles where
`is_staff <> (admin_tier IS NOT NULL)`, and `community_moderator` is the lowest tier (smoke S1–S3).

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
Clients have no privilege on their id sequences (`post_revisions_id_seq`, `post_comment_revisions_id_seq`).
Fetch: `.from('post_revisions').select('id, version, edited_at, reason, fields_changed, snapshot, redacted_at, redactor_role').eq('post_id', id).order('version', { ascending: false })`.

## Realtime

`supabase_realtime` → `posts` now also carries `version, edited_at, edit_count, image_alt, deleted_at,
needs_review_at` (not `lang`: no realtime consumer; not `engaged_at`: server-only) (other members unchanged: `post_comments (id, post_id)` and `poll_votes (id, poll_id)` stay
doorbells — re-read on UPDATE). A post that becomes hidden/deleted is not delivered to viewers who can
no longer read it: drop it locally on the author's own delete and re-read on the doorbells.

## Removed

`ranked_feed` (v1). Use `ranked_feed_v2` (deleted posts are never ranked).
