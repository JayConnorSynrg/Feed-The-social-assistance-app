# Release 3 — data model, writers, invariants (migrations `20261026600000_r3_foundation` + `20261026700000_r3_contract`)

Owner: Jelal Connor / SYNRG SCALING, LLC. Client contract: [r3-contract.md](r3-contract.md).

## Decisions this model implements (owner, 2026-10-11)

- **Alerts.** A non-escalating update keeps the expiry; raising severity restarts it for the new level from the update; lowering caps what is left at the lower level's window. The owner's delete is a recorded withdrawal. The reporter's own edit of a verified alert returns it to unverified. Three "Gone now" votes clear an alert at once. A resolved alert is shown for 6 hours. Reporter anonymity: no `created_by` / `verified_by` anywhere, ownership only as `is_mine`. Alerts stay off realtime. The sentence `alert is no longer live` is kept. `safety_alerts_in_view` keeps `id` and its id-only call. No self-moderation; a second verify keeps the first verifier.
- **Labels.** `outdated` / `misleading` / `sensitive`; moderator-applied with a reason; append-only, retracted by negation; version-aware; an author may mark their own post sensitive; labels annotate only; no self-lift.
- **Comment lock.** Moderators only, with one of `heated`, `off_topic`, `resolved`, `spam`, `other`; enforced in the insert trigger; moderators may still comment; existing comments stay editable and deletable; no self-unlock.
- **Reports.** Comments and org events are reportable; three reports on an org event reach the queue only; one open report per member per item, a new one after the item changed; posts unchanged.
- **Status and opt-ins.** Requests and offers close and reopen by their author; opt-in decisions through an audited RPC; a deleted opt-in returns its slot.
- **Announcements.** Moderators pin and unpin with a 7-day default expiry; `ranked_feed_v2` gains `p_filter`; the Announcements filter is pins + org events.
- **Petitions.** Moderators approve; approval publishes a feed post; update notes beside the unchanged signed text; a server-computed SHA-256; column-limited INSERT; the text is immutable after the first signature.
- **Notifications (Release 4).** Only the three enum values; nothing uses them.
- **Hygiene first.** The four unused privilege bits, the duplicate trigger, default privileges, pinned `search_path`, no `PUBLIC` / `anon` EXECUTE.

## Entities

| Entity | New in Release 3 | Notes |
|---|---|---|
| `safety_alerts` | `version`, `updated_at`, `update_count`, `resolved_at`, `resolved_by_role`; statuses `resolved`, `withdrawn` | Every write is an RPC; clients hold no write bit. RLS unchanged (`status = 'live'`). `verified_by` no longer selectable. |
| `safety_alert_updates` | new | One complete message per alert version (`alert`, `update`, `all_clear`, `cancel`), with `supersedes_version`, its own `expires_at`, `changed`, `severity_change`, `actor_role`, `note`. Append-only. No client grant; read through `safety_alert_history`. |
| `posts` | `labels`, `comments_locked_at` / `_reason` / `_by_role`, `closed_at` / `closed_reason`, `pinned_until` | All seven readable wherever the post is, and in the realtime column list. Written only by RPCs and triggers. |
| `post_labels` | new | One record per label decision: `label`, `post_version`, `source_role` (→ generated `source_kind` author / moderator), `applied_by`, `reason`, retraction columns. Append-only; partial unique index: one active record per (post, label, source kind). |
| `post_comments` | `hidden_reason` (`moderator` \| `community_reports_threshold`) | Set only on a hidden comment. |
| `content_reports` | `content_type` ∈ `post`, `comment`, `event`; unique-per-reporter → partial unique on open reports | Resolved reports stay as history. |
| `resource_opt_ins` | triggers: audit, slot return | INSERT revoked (the RPC is the only writer); the seeker's own DELETE stays and returns the slot; `UPDATE (status)` goes with the contract step. |
| `resource_opt_in_events` | new | One row per opt-in change (`opted_in`, `accepted`, `declined`, `completed`, `withdrawn`, `unblocked`, `removed`) with `actor_role`. Append-only. |
| `petitions` | status `rejected`; guard trigger; column-limited INSERT | `body_version_hash` = SHA-256 of the body, computed by the server. |
| `petition_signatures` | bind trigger | A signature locks the petition row for share and must carry its current hash. |
| `petition_updates` | new | Update notes (`body`, `author_role`, `created_by`). Append-only. |
| `notification_type` | `moderation`, `content_update`, `event_update` | Unused until Release 4. |

## Writers (who may change what)

| Write | Path | Principal |
|---|---|---|
| place an alert | `place_safety_alert` | signed-in member (not a guest) |
| update / resolve an alert | `update_safety_alert` / `resolve_safety_alert` | the owner, or a moderator (audited when it is not the owner) |
| withdraw an alert | `delete_safety_alert` | the owner only |
| vote | `vote_safety_alert` | member |
| verify / remove an alert | `admin_verify_safety_alert` / `admin_remove_safety_alert` | moderator (verify: never their own) |
| expire alerts | `expire_safety_alerts` (cron, unchanged) | system |
| apply / retract a label | `admin_set_post_label` | moderator (retract: never from their own post) |
| mark own post sensitive | `set_own_post_label` | the author |
| lock / unlock comments | `admin_set_comments_locked` | moderator (unlock: never their own post) |
| report a post, comment or org event | `submit_content_report` | member, never on their own content |
| resolve a report | `admin_resolve_report` | moderator, never on their own content |
| hide / unhide a comment | `admin_set_comment_hidden` | moderator |
| close / reopen a request or offer | `set_post_closed` | the author only |
| opt in / withdraw / unblock | `opt_in_to_post` / `withdraw_opt_in` / `unblock_opt_in` (or the seeker's direct delete of a pending opt-in) | seeker / seeker / author |
| accept / decline / complete an opt-in | `decide_opt_in` (until the contract step also the author's direct `UPDATE (status)`) | the post's author only |
| pin / unpin | `admin_set_post_pinned` | moderator |
| draft a petition | direct INSERT (column-limited) | member |
| approve / reject a petition | `admin_review_petition` | moderator, never their own |
| add a petition update note | `add_petition_update` | the creator |
| sign a petition | `/api/petitions/sign` (service role, unchanged) | member |

## Alert states

```
live --update (version +1)--> live          live --resolve--> resolved --6 h--> gone (reader only; the row stays resolved)
live --expiry job--> expired                live --3 clears > confirms--> cleared
live | resolved(<6 h) --owner withdraw--> withdrawn        live | resolved(<6 h) --moderator remove--> removed
```

`shown_state(status, expires_at, resolved_at)`: `live` = status live and not past expiry; `resolved` = resolved less than 6 hours ago; `gone` = everything else. No transition leaves `expired`, `cleared`, `removed`, `withdrawn` or a resolved alert past its 6 hours.

## Invariants and their proof

Proof ids are checks in `supabase/tests/r3_foundation.smoke.sql` (229 checks, passing after the foundation and after the contract step) and races in `supabase/tests/r3_foundation.race.sh` (21 races). Each mutant is one edit of a migration file, applied to a fresh copy of the prod catalog; the ids after it are the checks that turn red. **265 mutants, 265 killed, 0 surviving.**

| # | Area | Invariant | Smoke | Race | Mutants (killed by) |
|---|---|---|---|---|---|
| H1 | Hygiene | No relation in `public` leaves TRUNCATE, REFERENCES, TRIGGER or MAINTAIN with `anon` or `authenticated` (extension-owned relations aside). | HY1, HY1b | — | H1 (HY1, HY1b) |
| H2 | Hygiene | `posts` has exactly one `updated_at` trigger, and `updated_at` still moves on every update. | HY2 | — | H2 (HY2) |
| H3 | Hygiene | A table, sequence or function that `postgres` creates in `public` is born without `anon` / `authenticated` privileges; the four new tables and their sequences carry no client write privilege. | HY3, Z3, Z4 | — | H3a (HY3); H3b (HY3); H3c (HY3) |
| H4 | Hygiene | Every function the release creates or replaces pins `search_path = public, pg_temp`. | HY5 | — | H4 (HY5) |
| H5 | Hygiene | EXECUTE: `PUBLIC` on none of them; `anon` only on the three readers (`safety_alerts_in_view`, `safety_alert_history`, `ranked_feed_v2`); `authenticated` on the member RPCs and readers, never on a helper or trigger function. One signature per name. | HY4, HY6, HY7 | — | H5a (HY6, E2a); H5b (HY6, A10a); H5c (HY6); H5d (HY7) |
| H6 | Hygiene | `notification_type` holds `moderation`, `content_update`, `event_update`; no row and no function of this release uses one. | HY8 | — | H6 (HY8) |
| A1 | Alerts | Only the owner (a non-NULL `created_by` equal to the caller) or a moderator updates or resolves an alert; only the owner withdraws it. An alert whose reporter is gone belongs to nobody. | A1a, A1b, A1c, A1d, A8a | — | A1a (A1d, A8d); A1b (A1a, A1b, A1c); A1c (A8a, A8b); A1d (A1c) |
| A2 | Alerts | Every signed-in member (each staff tier included) places an alert. A guest is refused by every alert write, also when the guest owns the alert and holds the top tier; `anon` cannot execute one. | A0a, A0e, A1e, A5a, A5j, A10a | — | A2 (A0a, A1a, A1b, A1d, A1e, A5a, A5b, A5c, A5d, A5e, A5f, A5i, A5j, A7b, A8a, A10a) |
| A3 | Alerts | Update, resolve, vote and verify need a live alert; withdraw and remove need a shown one. Nothing changes a gone alert. | A6d, A6e, A6f, A6g, A9b | R1c | A3a (A6d, A6e, A6f, A6h); A3b (A6d, A6e, A6f, A6h); A3c (A6d, A6e); A3d (A6f, A6h, A9b); A3e (A6f, A6h); A3f (A6d, A6e, A8c, A10b); A3g (A6d, A6e, A6f, A6h) |
| A4 | Alerts | Expiry: an update at the same severity keeps it; raising severity sets it to the update time + the new level's lifetime (2 h / 6 h / 24 h / 72 h); lowering sets it to the smaller of the current expiry and the update time + the lower level's lifetime. | A0c, A2a-A2h, A4b | — | A4a (A2a, A2h); A4b (A2c, A2e, A2f); A4c (A2g, A2h); A4d (A2b, A2c, A2d, A2e, A2f, A4b); A4e (A2b, A4b); A4f (A2b, A2d, A4b) |
| A5 | Alerts | `version` is +1 on every content update, resolve, withdrawal and removal, and on nothing else (not a vote, a verify, or an update that changes nothing). A stale token is refused `PT409` with the current version; resolve always needs the token; update needs it after the contract step. | A1b, A2f, A3a-A3d, A5d, A6g, A9a, A10c | R1, R1b | A5a (A3a, A3b, A4a, A4g); A5b (A3c, A3d, A4a, A4g, A5g, A5h, A7b); A5c (A2f, A3a, A3b, A4a, A4g); A5d (smoke aborts); A5e (A3c, A3d, A4a, A4g, A5g, A5h, A7b); A5f (A3d); A5g (A6g, A9a, A9b); A5r (race R1) |
| A6 | Alerts | History: exactly one complete message per version, each naming the version it supersedes and its own expiry; append-only for every writer; a message leaves only with its alert; an account deletion clears the actor and nothing else. Alerts that existed before the migration have their message 1. | A0c, A4a, A4b, A4e, A4f, A8b, A9a, BF1, X2, X3, X5 | — | A6a (A9a); A6b (A4e, A4f); A6c (X2, X3); A6d (A4e); A6e (smoke aborts); A6f (A4e, A4f); A6g (A8b); BF1 (BF1) |
| A7 | Alerts | Reporter anonymity: no RPC answer, reader row, history row or column grant carries `created_by`, `verified_by` or the acting account; ownership is exposed only as `is_mine`, true for the owner alone. | A4c, A4d, A4g, A7a, A7c, A11a-A11d | — | A7a (A11a); A7b (A11c, A11d); A7c (A4d); A7d (A7c); A7e (A4g); A7f (A11a) |
| A8 | Alerts | The reporter's own change of type, text or place, or a raise of severity, returns a verified alert to unverified (verifier cleared). Lowering severity alone keeps the mark; so does a moderator's edit of someone else's alert. | A5e-A5h | — | A8a (A5f, A5h); A8b (A5g); A8c (A5e); A8d (A5h); A8e (A5f) |
| A9 | Alerts | No self-moderation: a moderator cannot verify their own alert; resolving or updating their own alert is recorded as the owner's act (no audit row). A second verify keeps the first verifier and writes no second audit row. | A5b, A5c, A5f, A5l, A8e | R1d | A9a (A5b, A5c, A5l); A9b (A5c); A9c (A8e) |
| A10 | Alerts | A resolved alert is shown for exactly 6 hours through the reader with `p_include_resolved`, with `shown_state = 'resolved'` and `shown_until = resolved_at + 6 h`; it is never live: the default reader, the table policy (`status = 'live'`), the vote and the expiry job treat it as not live. | A6a-A6c, A6h, A6i, A8b, A8c | — | A10a (A6a, A6b, A6f, A6h); A10b (A6a, A6b, A7b, A8c); A10c (A6a, A6i, A8c); A10d (A6a, A6b, A6c, A6f, A6h, A7b, A7d, A7e, A8b, A8c); A10e (A6c) |
| A11 | Alerts | Three "Gone now" votes that outnumber "Still here" clear the alert at once: status `cleared`, gone from every reader, never shown as resolved. | A10b-A10d | — | A11a (A10b); A11b (A10d); A11c (A10b, A10c, A10d) |
| A12 | Alerts | One reader: `id` and the 13 columns the deployed client reads, in their order, then 7 new ones; a bbox call, an id-only call and the strip call (5 rows, live first, highest severity, newest) resolve to it; the deployed client's direct reads keep working. | A7a-A7e, A11e | — | A12a (A7d); A12b (A7d); A12c (A7b); A12d (A7a, A7c); A12e (A7e) |
| A13 | Alerts | A moderator acting on someone else's alert (update, resolve, verify, remove) writes exactly one `admin_actions` row; an owner's write writes none. | A1g, A1h, A5b, A5i, A5k, A8d | — | A13a (A1g, A1h); A13b (A1g, A5f); A13c (A5k, A8d) |
| A14 | Alerts | Every liveness refusal answers the kept sentence `alert is no longer live` with SQLSTATE `PT410`. | A6d, A6f, A8c, A9b, A10b | — | A14 (A6d, A8c, A10b); A14b (A6d) |
| A15 | Alerts | No alert table is in the realtime publication. | A12, P1 | — | A15 (A12, P1) |
| A16 | Alerts | The owner's delete is a recorded withdrawal: the row and its votes stay, status `withdrawn`, one `cancel` message. | A9a, A9b, A6g | — | A16 (A6g, A9a, A9b) |
| A17 | Alerts | Input is validated before any write and refused with a token (`22023 alert_field_invalid:*`); no constraint error (with its failing-row DETAIL) reaches a client. | A0d, A2i, A10a | — | A17a (A0d); A17b (A2i) |
| B1 | Labels | Only a moderator (any of the three tiers) applies or retracts a moderator label; applying needs a reason; the vocabulary is closed (`outdated`, `misleading`, `sensitive`); a report named in the audit row is about that post. | B1a-B1f, B3a, B4e | — | B1a (B1a, B1b, B3a, B3b, B4c); B1b (B1d, B1e, B4a, B4c, B4d, B4e, B7); B1c (B1a, B1b, B1c, B2b, B3a, B3b); B1d (B1d, B1e, B4a, B4c, B4d, B4e, B7) |
| B2 | Labels | Label records are append-only for every writer: the one change is the retraction (negation, nothing else moves); a record leaves only with its post; an account deletion clears the actor columns and nothing else; at most one active record per label and source class. | B3b, B3e, B3f, X2, X3, X5 | — | B2a (B3e, B3f, B5c); B2b (B3e, B3f, B5c); B2c (B3e, B5a, X2, X3); B2d (B3e); B2e (smoke aborts); B2f (B3e, B3f, B5a, B5c) |
| B3 | Labels | Version-aware: a record names the post version it was applied to; applying again at a newer version retracts the old record as `superseded` and writes a new one; a stale token is refused `PT409`. | B1b, B1d, B5a-B5c | — | B3a (smoke aborts); B3b (B5c, B5e, B7); B3c (B1d, B1e, B4a, B4c, B4d, B4e, B5b, B5c, B7); B3d (B5c) |
| B4 | Labels | `posts.labels` is the sorted set of the labels of the active records, after every apply and retraction. | B2a, B3b, B4c, B5a | R4, R4b, R4c | B4a (B2a, B3b, B4a, B4c, B5a, B5b, B5d, B5e, B6); B4b (B3b, B4e, B5a); B4c (B3b, B4e, B5a) |
| B5 | Labels | An author may set and lift `sensitive` on their own post and nothing else; the author's record and a moderator's are separate, so the author never lifts the moderator's. | B4a-B4d | R4c | B5a (B4b, B4c, B4d, B4e); B5b (B4b); B5c (B4c, B4d, B4e, B7); B5d (B4c, B4e, B7); B5e (B4b); B5f (B4b) |
| B6 | Labels | No self-lift: a moderator may label their own post and cannot retract a label from it. | B3d | — | B6 (B3d) |
| B7 | Labels | Labels annotate only: every ranked score equals the score before any label existed, and labelled posts stay in the feed. | B6 | — | B7 (B6); B7b (B6) |
| B8 | Labels | An edit never clears a label. Editing a post with an active moderator label flags it for review; an author-only label does not; a versioned label action by another moderator clears the flag, one's own never does. | B5a-B5e | — | B8a (B5a, B5b, B5e); B8b (B5d); B8c (B5e); B8d (B5c); B8e (B5a) |
| B9 | Labels | Read surface: `posts.labels` and the public columns of active records wherever the post is readable; retracted records for staff only; the reason and the actors selectable by no client role; no client write. | B2a-B2e, B3c | — | B9a (B2c); B9b (B3c); B9c (B2e); B9d (B2c); B9e (B2a, P2) |
| B10 | Labels | One `admin_actions` row per moderator label decision, carrying the statement-of-reasons fields; none for a no-change call, a refusal, or an author's own label. | B1b, B1e, B1f, B3b, B4a, B5c, B7 | R4 | B10a (B7); B10b (B1f, B7); B10c (B7) |
| C1 | Comment lock | Only a moderator (any of the three tiers) locks or unlocks; the post's author cannot; a lock needs one of the five reasons; the three lock columns hold together. | C1a-C1c, C7 | — | C1a (C1a, C2a); C1b (C1b); C1c (C1a, C2a); C1d (C7) |
| C2 | Comment lock | The lock is enforced in the comment insert trigger from the locked post row: a comment or a reply on a locked post is refused `42501 comments_locked` with the reason, also when it races the lock. | C3a, C3b | R2, R2b | C2a (C3a, C3b, C3c, C4); C2r (race R2); C2b (C3a) |
| C3 | Comment lock | Moderators (all three tiers) and service-side writers may still comment; a guest never counts as a moderator. | C3a, C3c | — | C3a (C3c, C4); C3b (C3a); C3c (C3c, C4) |
| C4 | Comment lock | Existing comments stay readable, editable and deletable by their authors; likes are unaffected. | C4 | — | C4 (C4) |
| C5 | Comment lock | No self-lift: a moderator may lock their own post and cannot unlock it. | C5a | — | C5 (C5a) |
| C6 | Comment lock | A lock is a status: the post's version does not move and no revision is written; everyone who reads the post reads when, the reason code and the role, never who; unlocking clears all three columns. | C1b, C2a, C2b, C5b | — | C6a (C2a, C5b, F4c); C6b (C2b, P2); C6c (C1b, C2a); C6d (C1c, C5a, C5b, C7) |
| C7 | Comment lock | One `admin_actions` row per lock or unlock (naming the reason locked or lifted); none when nothing changes. | C2a, C5b | — | C7a (C2a, C2b, C3a, C5b); C7b (C5b) |
| D1 | Reports | Post reporting is unchanged: first report stored, self-report refused, three distinct open reporters hide the post, a deleted post is not reportable. | D1a-D1c, D2c | — | D1a (D1a, D1b, D2a, D2b, D2c, D5); D1b (D2c); D1c (D1c, D5) |
| D2 | Reports | A member whose report was resolved can report the item again only after it changed (posts and comments: a newer version; org events: updated since); the new report names the version reported; the answer says `accepted`. | D1b, D2a, D2b, D2e, D3i, D4d | — | D2a (D2a, D2b, D2e, D3i); D2b (D4d); D2c (D2b, D2c, D2d, D2e, D3a, D3c, D3i, D4d, D5); D2d (D2b) |
| D3 | Reports | At most one open report per member per item, for every writer. | D2d | R7 | D3a (D2d, D5); D3b (D2b, D2c, D2d, D2e, D3a, D3c, D3i, D4d, D5); D3r (race R7) |
| D4 | Reports | Comments: reportable by others while visible on a visible post; three reporters hide it with reason `community_reports_threshold`; the last dismissal lifts that hide and never a moderator's; a moderator's hide records `moderator` and upholds the open reports. | D3a-D3g | R7b | D4a (D3c, D3e); D4b (D3f); D4c (D3f); D4d (D3b, D3c); D4e (D3c, D3d, D3e); D4f (D3f); D4g (D3d, D3e); D4h (D3e); D4i (D3a, D3c); BF3 (BF3) |
| D5 | Reports | Org events: reportable; never hidden or deactivated by reports or by their resolution; the organisation's own admin cannot report its event. | D4a, D4b, D4e, D6 | — | D5a (D4b, D4e, D4d, D5, F3a, F3c, F4a); D5b (D4a, D4b, D5); D5c (D4b, D4c, D4e, D4d, D5) |
| D6 | Reports | Only a moderator resolves a report or hides a comment (guests and `anon` never). No self-resolution: the post author, the comment author and the event's creator or an admin of its organisation cannot dismiss or uphold a report on their own content. | D2f, D3h, D3j, D4c | — | D6a (D3h); D6b (D4c); D6c (D2f) |
| D7 | Reports | A comment report is resolved against the comment version the moderator saw (`PT409` when stale). | D3h | — | D7 (D3h) |
| E1 | Status | Only the author closes or reopens (not staff, not a guest); only requests and offers; closing is a status (same version, no revision, nothing hidden); a removed post cannot be closed; the closed columns hold together. | E1a-E1h, E5 | — | E1a (E1a); E1b (E1g); E1c (E1c); E1d (E1a); E1e (E1f, E1g, E2c, E2d, E3a, E3c); E1f (E5); E1g (E1b); E1h (E1c, E1f) |
| E2 | Status | A closed post takes no new opt-in (`PT409`, the kept sentence, code `post_closed`); comments and existing opt-ins are untouched; reopening takes opt-ins again. | E0, E1e, E1f | — | E2a (E1e, E1f); E2b (E1e) |
| E3 | Opt-ins | `decide_opt_in`: the post's author only; `pending → accepted | declined`, `accepted → completed`, nothing else; a stale status is refused `PT409`; no accept on a removed or deleted post. | E2a-E2c, E5 | — | E3a (E2a, E2b, E2c, E3a); E3b (E2b, E2c, E2d); E3c (E2b, E2c); E3d (E5); E3e (E2a, E2b, E2c, E3a); E3f (E2a); E3g (E5) |
| E4 | Opt-ins | Every opt-in change writes exactly one trail row with the acting role, whichever path made it (RPC, direct update, direct delete, cleanup, account deletion); the trail is append-only, read only by its parties and platform admins, and never exposes the acting account. | E3a-E3d, E4a, E4f, E4h, X3 | — | E4a (E3a, E3c, E3d, E4a, E4h, E4f, X1, X3); E4b (E3c); E4c (E3d); E4d (E3d); E4h (E3d); E4e (E4a, E4h, E4f, X3); E4f (E3a); E4i (E4h); E4g (E3c) |
| E5 | Opt-ins | `slots_remaining = max_seekers` minus the post's opt-in rows after every path: opt-in, `withdraw_opt_in`, decline + `unblock_opt_in`, a direct delete by the seeker, a delete by the table owner, an account deletion; an offer drained before the migration is repaired by it. A direct delete reaches only one's own pending opt-in (and, as before, any opt-in for a platform admin); nobody inserts directly. | E4a-E4h, X3 | R3, R3b, R3c | E5a (E4a, E4b, E4c, E4d, E4e, E4h, E4f, X3); E5b (E4c, E4f, E4g, X1); E5c (E4f, E4g, X1, X3); E5d (E4g); E5e (E4d); E5f (E4e, E4h, E4f); E5r (race R3b) |
| E6 | Opt-ins | An account deletion goes through with rows in every new table (no append-only trigger or foreign key blocks it), keeps the histories and clears only the actor columns. | X1-X4 | — | E6 (X2, X3) |
| F1 | Announcements | Only a moderator pins or unpins; a pin ends 7 days from the call unless a future end is named; a hidden or deleted post cannot be pinned; an end without a pin is impossible. | F1a, F1b, F2a, F2b, F4b | R5b | F1a (F1a, F2c, F3a, F3c, F4a); F1b (F2a, F2b); F1c (F1b); F1d (F1b); F1e (F2a, F2b, F2c); F1f (F1a, F2c, F3a, F3c, F4a); F1g (F1b, F4a) |
| F2 | Announcements | A pin floats (score ≥ 1,000,000) only while `pinned_until` is in the future; when it passes the post ranks by its own score again; no other score moves; unpinning clears both columns; no client writes the pin directly. | F2c, F4a, F4b, F4c | R5 | F2a (F4a); F2b (F2c, F3c); F2c (F4b) |
| F3 | Announcements | `ranked_feed_v2` has one signature (six arguments, all defaulted) and its return shape of today; `p_filter` NULL / `all` return the rows of the five-argument call; `announcements` returns live pins and org events only, paged by the same keyset; an unknown filter returns nothing; `anon` keeps EXECUTE. | F3a-F3d | — | F3a (F3a, F3c, F4a); F3b (F3a, F3c, F4a); F3c (smoke aborts); F3d (F3b); F3e (HY6); F3f (F4a) |
| F4 | Announcements | One `admin_actions` row per pin change, saying whether it is the moderator's own post; none when nothing changes. | F2a, F2b, F4b | R5 | F4a (F4b); F4b (F2a, F2b) |
| G1 | Petitions | A member inserts a draft with `created_by` (self), `status = 'draft'`, title, summary, body only (and the hash until the contract step); no client updates or deletes a petition. | G1a, G1c, G1d, G1e | — | G1a (G1d); G1b (G1c, G1d); G1c (G1e, G2, G3c, G3d, G3e) |
| G2 | Petitions | `body_version_hash` is the server's SHA-256 of the body, whatever the client sent, and follows every text change; unsigned petitions that existed before the migration are re-hashed, signed ones keep the value their signatures recorded. | G1b, G4a, BF2 | — | G2a (G1b, BF2); G2b (G1b, G4a, G4c, BF2); G2c (BF2); G2d (refused at apply); G2e (G4a, G4c) |
| G3 | Petitions | Review: a moderator only, never on their own petition; a rejection needs a reason; approval sets `approved` and publishes exactly one feed post authored by the creator, in one transaction; approving again returns the same post; only a draft is reviewed; a draft without a creator cannot be approved. | G3a-G3j | R6, R6b, R6c | G3a (G3g, G3h, G5c, G5e); G3b (G3c, G3d, G3e); G3c (G3d, G3e, G5b, G5d); G3d (G3b, G3c, G3d, G3e, G5b, G5d); G3e (D3j, D4c); G3f (G3c); G3g (G3h, G5c, G5e); G3h (G3c); G3i (G3a, G3c); G3r (race R6,R6b,R6c) |
| G4 | Petitions | Once a petition has a signature, its title, summary, body and hash cannot change, for any writer; a signature must carry the petition's current hash; both hold when the first signature and a text change race. | G4a-G4c, BF2 | R6d, R6e | G4a (G4c); G4b (G4b, G4c); G4c (G4c); G4d (G4a, G4c); G4r (race R6d,R6e) |
| G5 | Petitions | Update notes: the creator only, on an approved petition; the petition row is not written; notes are append-only, readable with their approved petition, never exposing who wrote them. | G5a-G5e | — | G5a (G5a, G5b, G5d); G5b (G5b); G5c (G5e); G5d (G5c); G5e (G5d); G5i (G5d); G5f (G5d); G5g (G5c); G5h (G5a) |
| G6 | Petitions | A draft or rejected petition is read by its creator and by staff, nobody else; the status vocabulary is closed. | G2, G3h, G3i, G3j | — | G6a (G2, G3h, G3j); G6b (G2, G3h, G3j, X1, X4); G6c (G3j); G6d (G3g, G3h, G3j, G5c, G5e) |
| P1 | Realtime | The publication: `posts` carries the 24 previous columns and the 7 new ones, in order, each readable by a client role; every other member is exactly what it was. | P1, P2 | — | P1a (P1); P1b (P1); P1c (P1, P2) |
| Z1 | Release | The contract migration refuses to run on a database without the foundation (SQLSTATE `55000`) and writes nothing. | release rehearsal: the contract file alone on a database without the foundation | — | Z1 (rehearsal: contract file alone) |
| Z2 | Release | The three legacy paths (alert update without a token, direct `UPDATE (status)` on opt-ins with its policy, `INSERT (body_version_hash)`) are open after the foundation and closed after the contract step; nothing else differs between the two states. | A3b, E2d, G1a, Z1, Z2 | — | Z2a (A3b, A4a, Z2); Z2b (E2d, Z2); Z2c (G1a, Z2); Z2d (E2d, Z2); Z2g (E2d, Z2); Z2e (A6d, A6e, A6f, A6h); Z2f (A3b, A4a, E2d, G1a, Z2) |
| Z3 | Release | Each migration writes its own ledger row in its transaction. | Z1 | — | Z3 (20261026600000_r3_foundation is not applied) |

Notes on the mutant column: *refused at apply* = the edited migration does not apply (the database itself refuses it, e.g. the petition guard stops a re-hash of a signed petition); *smoke aborts* = the smoke stops with an SQL error at the first check that needs the broken object; *race …* = the single-transaction smoke cannot reach the interleaving, the race script does.

## Known properties (not defects)

- **Opt-in lock order.** The RPCs lock the post, then the opt-in. A direct delete of an opt-in row locks the opt-in, then (in the slot trigger) the post. The same seeker firing `withdraw_opt_in` and a direct delete of the same row at the same instant can therefore meet in a deadlock, which Postgres resolves by aborting one of the two; the state stays consistent (race R3c runs both orders). The app only calls the RPC.
- **A locked and hidden post** answers a comment insert with `comments_locked` (the trigger runs before the policy), so the lock reason of a hidden post is visible to a signed-in member who knows its id.
- **A pin's expiry writes nothing**: no realtime event; clients compare `pinned_until` with the clock.
- **Votes and the expiry job write no history message** and do not move `version`; the history is the record of people's decisions on an alert's content and state.
- **`postgres` cannot revoke** the privileges `supabase_admin` granted on the three PostGIS relations it owns (`spatial_ref_sys`, `geometry_columns`, `geography_columns`); they are outside this migration.
