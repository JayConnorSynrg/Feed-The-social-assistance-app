# Post editing — data model, writers, invariants (PR-2 foundation)

Owner: Jelal Connor / SYNRG SCALING, LLC. Migration `supabase/migrations/20261026000000_post_editing_foundation.sql`.
RPC contract: [post-editing-contract.md](post-editing-contract.md).

## Decisions this model implements (user, 2026-10-09)

- Nobody rewrites someone else's text. Authors edit and delete their own posts and comments;
  community moderators hide / hold / remove; platform admins also redact private details from history.
- No edit time limit; key fields lock once people act (poll votes, capacity held by opt-ins).
- Quiet-edit grace: 5 minutes after posting, before anyone engages.
- Public history: roles, never names. Comments get "Edited" + history too.
- Member event posts stay; they gain a venue time zone.

## Entities

| Entity | New in PR-2 | Notes |
|---|---|---|
| `posts` | `version`, `edited_at`, `edit_count`, `image_alt`, `deleted_at`, `needs_review_at`, `lang` (author's app locale at posting, 14 codes or NULL); `hidden_reason` gains `author_deleted` | `version` is the concurrency token; `updated_at` stays polluted by counter triggers (likes / comments / slots) and is not an edit signal. |
| `post_revisions` | new | One row per recorded edit = the superseded version (`version`, `snapshot`, `fields_changed`, `reason`). Append-only; redaction blanks `snapshot`/`reason`/`fields_changed`. |
| `post_comments` | `version`, `edited_at`, `edit_count`, `deleted_at` | UPDATE and DELETE revoked for clients; soft delete via `delete_own_comment`; parent FK `ON DELETE SET NULL` (a hard delete never removes replies). |
| `post_comment_revisions` | new | Superseded comment text per recorded edit; append-only; redactable. |
| `polls` | (writes revoked) | Created only with its post (`create_post`); question kept equal to `posts.content`. |
| `poll_votes` | RESTRICTIVE insert: poll open + post live | Makes "close now" and soft delete real. |
| `content_reports` | `reported_version` | The version the reporter saw (NULL for reports filed before PR-2). |

## Writers (who may change what)

| Write | Path | Principal |
|---|---|---|
| create a post (+ poll) | `create_post` | signed-in member (not guest) |
| edit content fields | `edit_post` | the author only |
| soft delete | `delete_own_post` | the author only |
| redact a history row | `redact_post_revision` / `redact_comment_revision` | the author, or a platform admin (reason + audit) |
| edit a comment | `edit_comment` | the comment author |
| insert own comment / reply | direct `post_comments` INSERT (RLS) | member; only on a visible post (never on a hidden or deleted one, author and staff included) |
| delete own comment (soft) | `delete_own_comment` | the comment author only |
| like / unlike | direct `post_likes` INSERT / DELETE (RLS) | member; INSERT only on a visible post |
| hide / unhide a comment | `admin_set_comment_hidden` | community moderator+ (audit) |
| hold / remove / authorize / resolve report | `admin_*` RPCs (+ optional `p_expected_version`) | community moderator+ (audit, version in details) |
| like_count / comment_count / slots / updated_at | triggers and opt-in RPCs | system |
| petitions, resource posts | their own server paths | system |

Org admins have no post write path (org content is org events, edited through the event RPCs).

## State machine of a post (hidden_reason / deleted_at / needs_review_at)

```
visible ──report x3──▶ hidden(community_reports_threshold) ──dismissals (current version)──▶ visible
   │                         │ author edit ⇒ needs_review_at
   ├──hold──▶ hidden(hold_for_review) ──authorize(version)──▶ visible
   │                         │ author edit ⇒ needs_review_at (stays hidden)
   ├──remove──▶ hidden(admin_removal)   (author edit refused; authorize may reinstate)
   └──author delete──▶ deleted_at + hidden(author_deleted | reason kept)   (terminal for clients)
```
- `needs_review_at` = "the author changed this hidden post and no moderator has acted on that version".
  Set only by `edit_post` on a held / community-hidden post; cleared by a moderation decision made
  with `p_expected_version`, or by authorize / a lifting dismissal (which require it while set).

## Invariants and their proof

Proof ids are checks in `supabase/tests/posts_editing.smoke.sql` (S-…) and races in
`supabase/tests/posts_editing.race.sh` (C…). Every guard has a mutant that turns its test red
(106 / 106 killed on the prod-identical harness).

| # | Invariant | Proof |
|---|---|---|
| I1 | Expand (026): the deployed client's direct post / poll inserts keep working. Contract (0265): clients write posts only via `create_post`, polls only via create/edit (forged-insert and vote-wipe holes closed); 0265 refuses to run without 026 | P1, P1b, P5, M3b (both states); `run-all.sh` step 2 |
| I2 | Guests are refused first by every new RPC, even when they authored the row or hold a tier | E1, R6, D5, P4, K2, X10 |
| I3 | Only the author edits / deletes; no admin tier rewrites text | E2, D5, K2 |
| I4 | Concurrent edits never overwrite: stale version → PT409 + current version | E3b, E3c, K1a2, K2, C1, C4 |
| I5 | Per-type whitelist; protected fields (type, author, pin, counts, created_at, petition, resource, hidden, version) never change | E4, E5b, E10, E13, P2 |
| I6 | `version` moves only on content edits (never on likes, comments, opt-ins, reports, moderation) | M4, M4d, K1c, X3, X6b, N/A for grace |
| I7 | Exactly one history row per recorded edit; none in grace or for a no-op | E3, E11c, E11e, E14, K1c, K6 |
| I8 | Grace ends at 5 min or at the first like / comment / vote / opt-in / report | E11b–f, K1a, K6 |
| I9 | Capacity never drops below held opt-ins; slots reconciled | E6a–d, C3, C3b |
| I10 | Poll: question/options lock after the first vote; deadline only extended / removed / closed now; no votes after close or on a deleted poll | E8a–e, D5c, C2, C2b |
| I11 | Member events carry a server-known venue zone after create and after every edit; every problem (zone, end before start) is reported at once; legacy rows stay untouched until edited | E7a–h, P4, P4b, P6 |
| I11b | `lang` is one of the 14 app locales or NULL (invalid → NULL, never an error), set once at create, never edited, readable by anon | P9, P9a, P9b, M2, E4 |
| I12 | Held / community-hidden edits stay hidden and are re-queued; removed posts refuse edits | E12a–c, X6 |
| I13 | Images: own folder in post-images, uuid name, existing object; alt needs an image | E15, E15b, P7 |
| I14 | Soft delete keeps opt-ins / comments / votes / history; author + public lose the post; staff keep it; nothing new attaches | D1–D6, C6, C7 |
| I15 | History (posts and comments) is readable exactly when the parent is | R2, R3, K5, K5a, D4 |
| I16 | History is append-only (even for the owner); hard delete cascades | R7, R7b, R7c, R7d |
| I17 | Redaction: author or platform admin (reason, one audit row); never moderators; never the evidence of an open report | R4–R6, R8, R9 |
| I18 | Comment UPDATE / DELETE revoked (no re-pointing, no reply loss); hidden comments: author + staff only; moderators hide/unhide with one audit row | K3, K4, K5, K5b, M3 |
| I18b | Comment delete is soft (author only, guest refused): row + replies kept, text removed, edits refused, history rules unchanged; account deletion keeps others' replies (re-rooted) | K8a–K8g, C8 |
| I18c | No new likes, comments, replies or votes on a hidden or deleted post (author and staff included); unliking allowed | V1–V4, K7, K7b, D5b |
| I19 | Reports snapshot the version; dismissals lift only the community hide | X1, X2, X4, X5 |
| I20 | Versioned moderation; a legacy caller cannot publish an unseen author edit, and only a versioned decision clears the review flag | X6–X9, C5 |
| I21 | One `admin_actions` row per staff action, with the version; none for author actions | R5, K4, K5b, X4, X5a, L1–L3 |
| I22 | Deleted posts never ranked; v1 dropped | D3, F3 |
| I23 | Grants: anon reads version/edited_at/edit_count/image_alt only; SECDEF pinned; helpers not client-callable | M2, F1, F1b, Q1, Q1b, Q1c |
| I24 | Realtime posts list = previous 18 columns + 6 new; other members unchanged | Q4 |
| I25 | No function reads/returns profile display columns; `posts_user_id_fkey` kept | Q2, Q5 |

## Prototype → PR-2 changes (found while building)

1. **Comment lost update inside grace.** The prototype used `edit_count` as the comment token; grace
   edits do not bump it, so two tabs could overwrite each other. Comments now carry `version`.
2. **Not-found returned HTTP 500.** `P0002` is in PostgREST's `P0` class (500). Not-found is now
   `PT404` (404).
3. **Unseen author edit could be published by a legacy moderator call** (hold or remove without a
   version cleared the review flag, then authorize without a version published). Only versioned
   decisions clear the flag; authorize / lifting dismissal need the version while it is set.
4. **Evidence could be erased.** An author could edit a reported post, then redact the reported
   revision. Author redaction is refused while an open report points at that version.
5. **Comment history was not redactable** (public history could keep a phone number forever):
   `redact_comment_revision`.
6. **Votes after a deadline / on a deleted poll were accepted by the database** (prod enforces end
   times client-side only); "close now" needed a server rule: RESTRICTIVE `poll_votes` policy.
7. **Hidden comments were unreadable by staff**, so `admin_set_comment_hidden(false)` had no way to
   find what to unhide. Hidden comments are readable by their author and staff (posts parity).
8. **Zone-less member events could be edited without gaining a zone** (prototype required a zone
   only when times changed). Every edit now leaves a zone; the two server-unsupported zones are refused.

9. **The release would have broken posting for the apply -> deploy window** (client INSERT revoked in
   the same migration). Split into expand (026) / contract (0265).
10. **Deleting a comment deleted other people's replies** (hard DELETE + `ON DELETE CASCADE`). Soft
    delete + parent FK `SET NULL`.
11. **Likes and votes were accepted on hidden posts.** RESTRICTIVE policies.

## Out of PR-2 (later PRs)

Labels, comment locks, request/offer resolution, petition update notes, safety-alert updates and the
alert liveness rule, notification producers (edit / delete / resolve / event changes), event realtime
signals.
