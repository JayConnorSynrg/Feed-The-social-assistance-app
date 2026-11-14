# Release 3 — client contract (migrations `20261026600000_r3_foundation` + `20261026700000_r3_contract`)

Owner: Jelal Connor / SYNRG SCALING, LLC. Model and invariants: [r3-model.md](r3-model.md).
Behavioural proof: `supabase/tests/r3_foundation.smoke.sql` (238 checks, passing after the foundation and
after the contract step) and `supabase/tests/r3_foundation.race.sh` (33 races). The request shapes below
were sent through PostgREST 14.5 on a prod-identical catalog; every one answers as written here.

> **Changed on 2026-10-11 (security review round). Read these first if you coded against the earlier text.**
>
> 1. **Verified mark: ANY edit by the reporter returns a verified alert to unverified**, a lower severity
>    alone included (the earlier text said lowering severity kept the mark). After the owner's own
>    `update_safety_alert`, always take `verified` from the answer; expect `false` whenever the alert was
>    verified and anything changed. A moderator's edit of someone else's alert still keeps the mark.
>    See [Safety alerts → Rules the UI shows → Verified](#safety-alerts-31).
> 2. **Opt-ins: no client `DELETE` after the contract step.** `supabase.from('resource_opt_ins').delete()`
>    answers `403 42501 permission denied for table resource_opt_ins` once `20261026700000` is applied, for
>    every role (the seeker, the author, a platform admin). A seeker leaves through `withdraw_opt_in(p_post_id)`;
>    an author lifts a decline through `unblock_opt_in(p_opt_in_id)`. Both are unchanged and work in both
>    states. No deployed client sends the direct delete; do not add one. See
>    [Request / offer status, and opt-ins](#request--offer-status-and-opt-ins-33).
> 3. **Audit rows of alert actions carry no reporter id.** `admin_actions.details` for `safety_alert.verify`
>    and `safety_alert.remove` is now `{"version": n}` only (the `created_by` key is gone). Admin screens
>    that list alert actions show the alert (`target_id`) and the acting moderator (`actor_id`); there is no
>    reporter to show, by design.
> 4. Nothing else in a request or answer shape changed: no signature, no return type, no error token.
>
> **Added on 2026-10-11 (second review round), no shape change:** a decision, a withdrawal or an unblock and
> the seeker's account deletion no longer collide (an opt-in against the post author's own deletion still
> can; see the section linked below). When the deletion gets there first, `decide_opt_in` answers
> `PT404 opt_in_not_found` and `withdraw_opt_in` / `unblock_opt_in` answer `false`: the three "re-read the
> list" outcomes the client already handles. See
> [Account deletion and opt-ins](#account-deletion-and-opt-ins-what-can-collide-and-until-when).

This is what the Release 3 client builders code against. It covers: safety alerts (3.1), labels, comment
lock and reports (3.2), request / offer status, opt-ins, announcements and petitions (3.3).

## Release: expand / contract

| Step | File | What stays open for the client deployed today |
|---|---|---|
| 1. Expand (apply first) | `20261026600000_r3_foundation.sql` | `update_safety_alert` without a version token; the author's direct `UPDATE` of `resource_opt_ins.status`; `body_version_hash` in the petition draft insert; a direct `DELETE` of an opt-in (no deployed client sends it) |
| 2. Deploy every Release 3 client (3.1, 3.2, 3.3) | — | — |
| 3. Contract (apply after the last deploy) | `20261026700000_r3_contract.sql` | nothing: the four paths above are closed |

The contract file refuses to run before the foundation (`55000`). **Build to the contract state from day
one**: send `p_expected_version` on every alert update, decide opt-ins through `decide_opt_in`, leave an
opt-in through `withdraw_opt_in` / `unblock_opt_in` (never a direct delete), and do not send
`body_version_hash`. All four work in both states.

The prod smoke suite (`apps/web/src/__tests__/smoke/04, 12, 23, 25, 29`) reads the ledger: while
`20261026600000` is not recorded it asserts today's database (or skips what does not exist yet), and from
the moment it is recorded the Release 3 assertions always run. It is green merged-before-applied and
green once applied.

### Account deletion and opt-ins: what can collide, and until when

An account deletion removes the member's opt-ins (and, for an author, their posts with every opt-in on
them). It locks the member's profile row (or, in the deletion function's first step, the member's posts)
first and reaches the opt-in rows through the cascade.

- **A decision, a withdrawal, an unblock or the direct status update against an account deletion: no
  collision, in either release state, in any deletion shape** (the admin route's `auth.users` delete, the
  deletion function's delete of the profile row or of the member's posts), whether it is the seeker's or
  the post author's account. `decide_opt_in`, `withdraw_opt_in` and `unblock_opt_in` take the seeker's
  profile row before the post, so the two queue; the trail row of an opt-in change takes no lock at all, so
  the status update the deployed client still sends directly (`feed-panel.tsx`) has nothing to wait for.
  Whoever is first wins and the other sees a normal answer: the change is recorded and the opt-in then goes
  with the account, or the RPC answers `PT404 opt_in_not_found` (`decide_opt_in`) / `false`
  (`withdraw_opt_in`, `unblock_opt_in`), and a direct update that finds no row answers `204`. Measured on 40
  simultaneous pairs and 2 forced interleaves per shape: 0 collisions (before the third review round's fix,
  the author's direct update against that author's own deletion collided in 21, 12 and 2 of 40 pairs).
- **What can still collide** (20 simultaneous pairs per run, two independent runs; the count moves with
  timing, so the figures are ranges):
  - **Opting in at the moment the post's author deletes their account**, in every release state and on
    today's database alike: 13 to 20 of 20 (19 to 20 through the admin route, 13 to 20 when the profile is
    deleted with the posts still there). `opt_in_to_post` holds the post, then its engagement step asks for the
    author's account row; the deletion holds that row and asks for the post. **What the member sees:** the
    opt-in fails once (`40P01`) or, when the engagement step absorbs it, succeeds without its engagement
    credit, and the account deletion goes through or reports a failure and succeeds on retry. Nothing is
    half-written and no slot drifts. Not changed by this release; a follow-up reorders `opt_in_to_post`.
  - **Before the contract step only:** a seeker's direct `DELETE` of their pending opt-in (not a client
    path, see below) at the moment the author's posts are deleted: 13 to 20 of 20 (13 to 16 against the
    deletion function's removal of the author's posts, 18 to 19 against a delete of the post; today's
    database: 0 and 0; the
    slot that comes back on every delete takes the post row after the opt-in row). One side fails with
    `40P01` and succeeds on retry. No deployed client sends that DELETE, and the contract step removes it.

Types: `packages/database/types.ts` carries hand-edited hunks for these shapes until the release regen.
RPCs that return `jsonb` are typed `Json`; cast to the types written here.

## Errors

PostgREST turns the SQLSTATE into the HTTP status; supabase-js returns `{ code, message, details, hint }`.
Branch on `code` + `message`. Messages are stable tokens, except the five sentences kept because the
deployed client prints them (marked *sentence*).

| SQLSTATE | HTTP | `message` | What the UI does |
|---|---|---|---|
| `PT409` | 409 | `edit_conflict` | Someone changed it first. `details` is JSON: alerts `{"current_version": n, "updated_at": ts}`; posts `{"current_version": n, "edited_at": ts, "needs_review": bool}`; comments `{"current_version": n, "edited_at": ts}`. Re-read, show the current state, keep the user's draft, let them retry with the new version. |
| `PT409` | 409 | `opt_in_conflict` | `details` `{"current_status": s}`. The opt-in moved (the seeker withdrew, another tab decided). Re-read the list. |
| `PT409` | 409 | `This post is closed` (*sentence*) | `details` `{"code": "post_closed", "closed_reason": "fulfilled" \| "closed"}`. Show the closed state; no opt-in button. (A hidden post answers the same sentence with `P0001` and no details, as today.) |
| `PT409` | 409 | `petition_not_draft`, `petition_not_approved`, `petition_creator_missing` | `details` `{"status": s}` on the first two. Re-read the petition; the action no longer applies. |
| `PT409` | 409 | `petition_text_changed` | Signature insert only (the sign route): the text changed between read and sign. `details` `{"body_version_hash": current}`. Re-read the petition and ask the member to sign the text as it now stands. |
| `PT410` | 410 | `alert is no longer live` (*sentence*) | `details` `{"code": "alert_not_live", "status": s}`. Drop the alert from the strip / map (or show it resolved if `status` is `resolved`), tell the user. |
| `PT404` | 404 | `alert_not_found`, `post_not_found`, `post_deleted`, `opt_in_not_found`, `petition_not_found`, `report_target_not_found`, `comment_not_found` | Gone. Remove it locally. |
| `42501` | 403 (401 for anon) | `guest_refused`, `Account required for this action` (*sentence*, alerts + reports + opt-ins), `not_authenticated` | Send the guest to sign-up; the control should not have been offered. |
| `42501` | 403 | `p3_denied:insufficient_tier` | Not a moderator. Hide the control; re-read the member's tier. |
| `42501` | 403 | `self_moderation_refused` | Staff cannot lift or decide moderation on their own content. Say so; another moderator must act. |
| `42501` | 403 | `not_alert_owner`, `not_author`, `not_petition_creator`, `report_own_content`, `label_not_self_applicable:<label>`, `post_removed`, `post_not_visible` | The caller is not entitled / the item is in a state that forbids it. Re-read; hide the control. |
| `42501` | 403 | `comments_locked` | Comment insert on a locked post. `details` `{"reason": code, "locked_at": ts}`, `hint` `Comments are locked on this post.` Disable the composer and show the reason. (A hidden post answers `new row violates row-level security policy "post_comments_insert_post_visible"`: "closed", not "locked".) |
| `42501` | 403 | `petition_text_locked` | Server-side writers only: the signed text cannot change. |
| `22023` | 400 | `alert_field_invalid:type\|severity\|location\|vote\|note\|reason`, `alert_field_required:expected_version`, `label_invalid:<label>`, `label_field_required:applied\|reason`, `label_field_invalid:ground\|reason\|report`, `lock_field_required:locked`, `lock_field_invalid:reason\|note`, `report_field_invalid:details`, `post_field_required:closed`, `post_field_invalid:reason`, `opt_in_field_invalid:decision`, `opt_in_transition_invalid` (`details` `{"from","to"}`), `pin_field_required:pinned`, `pin_field_invalid:until\|reason`, `petition_field_invalid:action\|reason\|body`, `petition_field_required:reason` | A client bug or a form the UI should have validated. Show the field error named after the colon. |
| `0A000` | 400 | `post_type_not_closable:<type>` | Only requests and offers close. Hide the control for other types. |
| `P0001` | 400 | *sentences* kept from before: `post not found`, `you cannot report your own post`, `unsupported content_type: <x>`, `not authenticated`, `action must be dismiss or uphold`, `report not found`, `Post not found`, `You cannot opt in to your own post`, `This offer is full`, `Already opted in` | Unchanged handling. |

Every write refuses a guest **first** (JWT `is_anonymous`; the alert family also checks the account row),
even a guest who owns the item or holds a tier. `anon` has `EXECUTE` only on the three readers named
below; calling anything else answers `401 42501 permission denied for function …`.

## Safety alerts (3.1)

Alerts stay off realtime: poll the reader. The client draws each alert by the `shown_state` and
`shown_until` the server returned on the last read; it never uses the browser clock to decide what is
shown (`apps/web/src/lib/safety-alert-live.ts:55-58`). Changes arrive on the 60-second poll, which runs
only while the tab is visible and reads once on return (`apps/web/src/lib/safety-alerts-fetch.ts:32,79`;
`apps/web/src/hooks/use-safety-strip.ts:167`, `apps/web/src/hooks/use-safety-alerts.ts:122`). The browser
clock does one thing: when the earliest `shown_until` is still ahead on it, one extra read is asked for
at that instant (`apps/web/src/lib/safety-alert-store.ts:231-251`; `use-safety-strip.ts:178-180`,
`use-safety-alerts.ts:132-134`), in a visible tab only. Those extra reads are spaced out: one is asked
for no sooner than 5 seconds after the last read finished (`safety-alert-store.ts:41`), so alerts that
end close together share a read; an ended alert can therefore be drawn for up to about 6 seconds past
its `shown_until`, and never past the next 60-second poll. A row leaves only when the reader stops
returning it. When a read fails after one has succeeded, the rows stay exactly as last returned and
the surface says "Couldn't refresh alerts — last updated HH:MM" until a read succeeds.

### The live / shown rule (one predicate)

```ts
type ShownState = 'live' | 'resolved' | 'gone'
function shownState(a: { status: string; expires_at: string; resolved_at: string | null }, now = Date.now()): ShownState {
  if (a.status === 'live' && Date.parse(a.expires_at) > now) return 'live'
  if (a.status === 'resolved' && a.resolved_at !== null && Date.parse(a.resolved_at) > now - 6 * 3600_000) return 'resolved'
  return 'gone'
}
// live  <=> shownState === 'live'      (votes, updates, verify, resolve are possible)
// shown <=> shownState !== 'gone'      (drawn on the strip / map; history readable; owner may withdraw, staff may remove)
```

The server computes it (`shown_state`, `shown_until`) in every row it returns; the client shows exactly
those. The function above is the server's rule: the client applies it only to a row that carries no
`shown_state` (a pre-Release-3 answer shape) and logs `alerts.shown_state.missing` when it does
(`apps/web/src/lib/safety-alert-rpc.ts:110-117`). It never hides or expires a row the server returned.
Statuses: `live`, `resolved` (all-clear by the owner or a
moderator, shown for 6 hours), `expired` (the 5-minute job), `cleared` (three "Gone now" votes that
outnumber "Still here": gone at once), `removed` (a moderator), `withdrawn` (the owner's "delete").
Only `live` and `resolved` are ever returned by a reader.

### Which reader for which surface

| Surface | Call |
|---|---|
| Feed strip | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 5 })` — live first, then highest severity, then newest. Works logged out. Replaces the direct table read (which never shows a resolved alert and has no `is_mine`). |
| Map | `safety_alerts_in_view({ p_min_lng, p_min_lat, p_max_lng, p_max_lat, p_include_resolved: true })` |
| Popup / map focus (one alert) | `safety_alerts_in_view({ p_alert_id, p_include_resolved: true })` → 0 or 1 row; then `safety_alert_history({ p_alert_id })` for "Updated" details. |
| Admin list | `safety_alerts_in_view({ p_include_resolved: true, p_limit: 200 })` for live + resolved. The admin overview's live count is the same call (`apps/web/src/lib/safety-alert-rpc.ts:305`); no client reads the table. Removed, expired, cleared and withdrawn alerts have no reader. |

The deployed client's calls (four bbox arguments; direct reads) keep working and never see a resolved alert.

### `safety_alerts_in_view(p_min_lng float8 = NULL, p_min_lat float8 = NULL, p_max_lng float8 = NULL, p_max_lat float8 = NULL, p_alert_id uuid = NULL, p_include_resolved boolean = false, p_limit integer = NULL) → AlertRow[]`

Callers: `anon`, `authenticated`. No error tokens. A bbox needs all four numbers; with neither a bbox nor an
id the default limit is 5.

```ts
type AlertRow = {
  id: string; alert_type: 'weather' | 'road_closure' | 'speeding' | 'general'; severity: 1 | 2 | 3 | 4
  description: string | null; lng: number; lat: number
  status: 'live' | 'resolved'                // readers return nothing else; RPC answers may carry the other statuses
  confirm_count: number; clear_count: number; created_at: string; expires_at: string
  verified: boolean; is_mine: boolean        // ownership is ONLY is_mine; no reporter or verifier id exists anywhere
  version: number                            // the token for update / resolve / verify / remove
  updated_at: string | null; update_count: number   // "Updated" marker: updated_at !== null
  resolved_at: string | null; resolved_by_role: 'owner' | 'moderator' | null
  shown_state: 'live' | 'resolved'; shown_until: string   // expires_at while live; resolved_at + 6 h once resolved
}
```

Every write RPC below returns one **`AlertPublic`** = the same 20 keys as `AlertRow` (as a JSON object,
`status` and `shown_state` over their full ranges).

### `safety_alert_history(p_alert_id uuid) → AlertMessage[]`

Callers: `anon`, `authenticated`. Newest first. Empty when the alert is gone or unknown.

```ts
type AlertMessage = {
  version: number; msg_type: 'alert' | 'update' | 'all_clear' | 'cancel'; supersedes_version: number | null
  sent_at: string; alert_type: string; severity: number; description: string | null; lng: number; lat: number
  expires_at: string                         // each message carries its own expiry
  changed: string[]                          // of: alert_type, severity, description, location, expires_at, status
  severity_change: 'escalated' | 'de_escalated' | 'same'
  actor_role: 'owner' | 'moderator' | 'system'; note: string | null
}
```

### Writes (callers: `authenticated`, never a guest)

| RPC | Who | Returns | Refusals, in the order they are checked |
|---|---|---|---|
| `place_safety_alert(p_type text, p_severity integer, p_description text, p_lng float8, p_lat float8)` | any member | `AlertPublic` | `22023 alert_field_invalid:type` → `:severity` → `:location` |
| `update_safety_alert(p_alert_id uuid, p_type text = NULL, p_severity integer = NULL, p_description text = NULL, p_lng float8 = NULL, p_lat float8 = NULL, p_expected_version integer = NULL, p_note text = NULL)` | the owner, or a moderator | `AlertPublic` | (after the contract step: `22023 alert_field_required:expected_version`) → `PT404 alert_not_found` → `42501 not_alert_owner` → `PT410 alert is no longer live` → `PT409 edit_conflict` → `22023 alert_field_invalid:note` → `:type` → `:severity` → `:location` |
| `resolve_safety_alert(p_alert_id uuid, p_expected_version integer, p_note text = NULL)` | the owner, or a moderator | `AlertPublic` | `22023 alert_field_required:expected_version` → `PT404` → `42501 not_alert_owner` → `PT410` → `PT409 edit_conflict` → `22023 alert_field_invalid:note` |
| `delete_safety_alert(p_alert_id uuid)` | the owner only | nothing (204) | `PT404` → `42501 not_alert_owner` → `PT410` |
| `vote_safety_alert(p_alert_id uuid, p_vote text)` (`'confirm'` \| `'clear'`) | any member | `AlertPublic` | `22023 alert_field_invalid:vote` → `PT404` → `PT410` |
| `admin_verify_safety_alert(p_alert_id uuid, p_expected_version integer = NULL)` | a moderator, never on their own alert | `AlertPublic` | `42501 p3_denied:insufficient_tier` → `PT404` → `42501 self_moderation_refused` → `PT410` → `PT409 edit_conflict` |
| `admin_remove_safety_alert(p_alert_id uuid, p_reason text = NULL, p_expected_version integer = NULL)` | a moderator (their own alert too) | `AlertPublic` | `42501 p3_denied:insufficient_tier` → `22023 alert_field_invalid:reason` → `PT404` → `PT410` → `PT409 edit_conflict` |

Rules the UI shows:

- **Update.** An omitted argument keeps the value; `p_description: ''` clears the text; `p_lng` and `p_lat`
  go together. A call that changes nothing returns the current row (same `version`).
- **Expiry.** Raising severity restarts the expiry for the new level from the update (2 h / 6 h / 24 h /
  72 h). Lowering it never extends the alert and caps what is left at the lower level's window. Any other
  update keeps the expiry. Read `expires_at` from the answer.
- **Verified.** ANY change by the reporter returns a verified alert to unverified (`verified: false` in the
  answer): type, text, place, a higher severity, and a lower severity alone. A call that changes nothing
  keeps the mark (it is not an edit: same `version`). A moderator's edit of someone else's alert keeps the
  mark, whatever it changes. A second verify changes nothing. A moderator verifies again with
  `admin_verify_safety_alert`; the UI should tell the owner, before they save an edit of a verified alert,
  that the alert will show as unverified until a moderator checks it again.
- **Resolve.** `status: 'resolved'`, `shown_state: 'resolved'`, `shown_until` = `resolved_at` + 6 h. There is
  no reopen: a wrong all-clear is answered with a new alert.
- **Withdraw.** `delete_safety_alert` records a withdrawal (`withdrawn`); the alert leaves every reader at
  once. Possible while the alert is shown (live, or resolved within 6 h).
- **Version.** `version` moves on update, resolve, withdraw and remove; never on a vote or a verify. Always
  send the `version` you rendered.
- **Staff acting on their own alert** act as its owner (resolve is recorded "by owner"); they cannot verify it.
- **History.** `safety_alert_history` lists one complete message per version with the role that wrote it.

Direct reads of `safety_alerts` (authenticated only; RLS shows `status = 'live'` rows): every column except
`created_by` and `verified_by`. `anon` reads through the readers only. Nobody reads `safety_alert_updates`
or other members' rows of `safety_alert_votes`.

**Reporter anonymity, everywhere.** No answer, no reader row, no history message and no error text
(`message`, `details`, `hint`) of an alert RPC carries an account id. The audit rows a platform admin reads
(`admin_actions`, actions `safety_alert.verify | update | resolve | remove`) carry the alert id, the acting
moderator and `details: {"version": n}` (`update` adds `changed` and `severity_change`): never the
reporter, and never who verified. A moderation screen has no way to show "reported by", and must not try.

## Labels (3.2)

Vocabulary: `outdated`, `misleading`, `sensitive`. Labels annotate; they never change ranking.

- **Read:** `posts.labels: string[]` rides the post row (add it to the feed select; it is in the realtime
  payload). `sensitive` hides the body behind a click; the other two are notices.
- **Detail (which version, which role, when):** `post_labels`, columns `id, post_id, label, post_version,
  source_role, applied_at, retracted_at`. Everyone who can read the post reads its active records; staff
  also read retracted ones. `post_version < posts.version` means "labelled before the last edit".
  `source_role` is `author`, `community_moderator`, `resource_admin` or `platform_admin`. The reason text
  and who applied or retracted a label are not selectable by any client role.

### `admin_set_post_label(p_post_id uuid, p_label text, p_applied boolean, p_expected_version integer = NULL, p_reason text = NULL, p_ground text = 'incompatible_content', p_report_id uuid = NULL) → LabelResult`

Callers: moderators (community moderator and up). `p_reason` (≤ 500) is required to apply. `p_ground` is
`incompatible_content` or `illegal_content`. `p_report_id`, when given, must be a report about this post.

```ts
type LabelResult = { post_id: string; label: string; applied: boolean; label_id: number | null; post_version: number; changed: boolean }
```

- Applying a label the post already carries at this version: `changed: false`. At a newer version: the old
  record is retracted (`superseded`) and a new one names the current version (re-affirm after an edit).
- Retracting (`p_applied: false`) marks the record retracted; nothing is deleted.
- A moderator may label their own post and may not retract a label from it.
- **Statement-of-reasons fields.** Each label decision writes one audit row whose `details` carries, beside
  `label`, `label_id`, `supersedes_label_id`, `author_id` and `version`: `decision_visibility`
  (`CONTENT_LABELLED` | `LABEL_RETRACTED`), `decision_ground` (`INCOMPATIBLE_CONTENT` | `ILLEGAL_CONTENT`),
  `decision_facts` (the reason), `source_type` (`VOLUNTARY` | `OTHER_NOTIFICATION`), `report_id`,
  `automated_detection: false`, `automated_decision: "NOT_AUTOMATED"`, `content_type`, `application_date`,
  `redress`. **Nothing reads these in Release 3.** They are kept on purpose: the moderation screens of the
  next release (the decision log and the notice to the author) read them from this row, so the decisions
  made between now and then are already complete. Platform admins only (`admin_actions` RLS).
- Refusals, in order: `42501 guest_refused` → `not_authenticated` → `p3_denied:insufficient_tier` →
  `22023 label_invalid:<label>` → `label_field_required:applied` → `label_field_invalid:ground` →
  `label_field_invalid:reason` → `label_field_required:reason` → `PT404 post_not_found` →
  `PT409 edit_conflict` → `PT404 post_deleted` → `22023 label_field_invalid:report` →
  `42501 self_moderation_refused`.

### `set_own_post_label(p_post_id uuid, p_label text, p_applied boolean, p_expected_version integer = NULL) → { post_id, label, applied, label_id: number | null, labels: string[] }`

Callers: the post's author. Only `sensitive`. The author's record and a moderator's `sensitive` are
separate: the author retracting their own leaves the moderator's in force (`labels` in the answer says what
is in force now). Refusals, in order: `42501 guest_refused` → `not_authenticated` →
`42501 label_not_self_applicable:<label>` → `22023 label_field_required:applied` → `PT404 post_not_found` →
`PT409 edit_conflict` → `42501 not_author` → `42501 post_removed`.

**Edits.** An edit never clears a label. Editing a post that carries a moderator's label sets
`needs_review_at` (staff and author readable): the moderation queue should list it as "edited since
labelled". A moderator's label call with the current `p_expected_version` (re-affirm or retract) clears the
flag; so does a versioned hold or remove. An author's own `sensitive` never sets the flag.

## Comment lock (3.2)

- **Read:** `posts.comments_locked_at`, `comments_locked_reason` (`heated`, `off_topic`, `resolved`, `spam`,
  `other`), `comments_locked_by_role`. All three NULL = open. Add them to the feed / thread select; they
  are in the realtime payload.
- **While locked:** members, the author and guests cannot add a comment or a reply (`42501 comments_locked`,
  see Errors). Moderators still can. Existing comments stay readable; their authors can still edit and
  delete them; likes are unaffected. The lock does not move `posts.version`.

### `admin_set_comments_locked(p_post_id uuid, p_locked boolean, p_expected_version integer = NULL, p_reason text = NULL, p_note text = NULL) → { post_id, locked, locked_at: string | null, reason: string | null, changed: boolean }`

Callers: moderators. Authors cannot lock. `p_reason` (one of the five) is required to lock; `p_note`
(≤ 500) is the free text kept in the audit row. A moderator may lock their own post and may not unlock it.
The audit row of a lock / unlock carries the same statement-of-reasons fields as a label decision
(`decision_visibility`: `CONTENT_INTERACTION_RESTRICTED` | `INTERACTION_RESTRICTION_LIFTED`, plus
`lock_reason`); as there, nothing reads them in Release 3 and the next release's moderation screens do.
Refusals, in order: `42501 guest_refused` → `not_authenticated` → `p3_denied:insufficient_tier` →
`22023 lock_field_required:locked` → `lock_field_invalid:reason` → `lock_field_invalid:note` →
`PT404 post_not_found` → `PT409 edit_conflict` → `PT404 post_deleted` → `42501 self_moderation_refused`.

## Reports (3.2)

### `submit_content_report(p_content_type text, p_content_id uuid, p_reason report_reason, p_details text = NULL) → { report_count: number; hidden: boolean; accepted: boolean }`

Callers: members. `p_content_type`: `post`, `comment`, or `event` (`assistance_events.id`).

- `accepted` says whether a report was stored. It is `false` when the member already has an open report on
  the item, or their last report was resolved and the item has not changed since (posts and comments: same
  `version`; events: not updated since that report). Show "you already reported this" instead of a success.
- After an edit the same member can report again; the new report names the new version.
- Three distinct open reporters hide a **post** or a **comment** (`hidden: true`). An **org event** is never
  hidden by reports; it reaches the queue.
- Nobody reports their own content: post author (`P0001 you cannot report your own post`), comment author
  and the event's creator or an admin of its organisation (`42501 report_own_content`).
- Other refusals: `42501 Account required for this action`, `22023 report_field_invalid:details` (> 1000),
  `P0001 post not found`, `PT404 report_target_not_found` (a comment that is deleted, hidden or on a hidden
  post; an inactive or missing event), `P0001 unsupported content_type: <x>`.

### Queue (staff)

Read `content_reports` directly (staff read all; a member reads their own): `id, reporter_id, content_type,
content_id, reason, details, status, created_at, reported_version`. **Filter or group by `content_type`**
and read each target set by id (`posts`, `post_comments`, `assistance_events`). `reported_version` vs the
target's `version` gives "reported at v1, now v3". `post_comments.hidden_reason` is `moderator` or
`community_reports_threshold` (NULL when visible).

### `admin_resolve_report(p_report_id uuid, p_action text, p_expected_version integer = NULL) → { report_id, action, unhidden: boolean, needs_review: boolean }`

Same signature as today; now also for comment and event reports. `p_expected_version` is the post's or the
comment's version (ignored for events). The last dismissal lifts a community hide (`unhidden: true`), never
a moderator's hide. Self-moderation is refused for the post author, the comment author, and the event's
creator or an admin of its organisation.

### `admin_set_comment_hidden(p_comment_id uuid, p_hidden boolean, p_reason text = NULL)`

Unchanged signature. Hiding now also marks the comment's open reports upheld and records
`hidden_reason = 'moderator'`.

## Request / offer status and opt-ins (3.3)

- **Read:** `posts.closed_at`, `closed_reason` (`fulfilled` \| `closed`); both NULL = open. In the realtime
  payload. A closed post stays visible with its comments and its existing opt-ins; it takes no new opt-in.

### `set_post_closed(p_post_id uuid, p_closed boolean, p_expected_version integer = NULL, p_reason text = 'fulfilled') → { post_id, closed: boolean, closed_at: string | null, closed_reason: string | null, version: number }`

Callers: the post's author only (not staff). Only `seeker_request` and `source_offer`. `p_closed: false`
reopens. Not an edit: `version` does not move. Refusals, in order: `42501 guest_refused` →
`not_authenticated` → `22023 post_field_required:closed` → `PT404 post_not_found` → `42501 not_author` →
`0A000 post_type_not_closable:<type>` → `42501 post_removed` → `PT409 edit_conflict` →
`22023 post_field_invalid:reason`. Each call that changes the status is logged by the server, in the same
transaction: one `app_logs` row `post.closed` / `post.reopened` with the author (`user_id`), the time and the
call's `x-request-id` (send the header so the client's own telemetry row for the call joins it). A refusal, or
a call that changes nothing, logs nothing.

### `decide_opt_in(p_opt_in_id uuid, p_decision text, p_expected_status text = NULL) → { opt_in_id, post_id, status, completed_at: string | null }`

Callers: the post's author only. `p_decision`: `accept`, `decline`, `complete`. Machine: `pending → accepted`
or `declined`; `accepted → completed`. Send the status the screen showed as `p_expected_status`. An accept
on a removed or deleted post is refused; decline and complete stay possible. Refusals, in order:
`42501 guest_refused` → `not_authenticated` → `22023 opt_in_field_invalid:decision` →
`PT404 opt_in_not_found` → `42501 not_author` → `PT409 opt_in_conflict` →
`22023 opt_in_transition_invalid` → `42501 post_removed`.

Replaces `supabase.from('resource_opt_ins').update({ status })` (`feed-panel.tsx`), which stops working at
the contract step (`403 42501`; note that a direct update that matches no row answers 204, not an error).

### Leaving an opt-in: the two RPCs only

| Who | Call | Answer |
|---|---|---|
| The seeker, while their opt-in is `pending` | `withdraw_opt_in(p_post_id uuid)` | `true` if a pending opt-in was withdrawn, `false` if there was none (already decided, already gone) |
| The post's author, on a `declined` opt-in | `unblock_opt_in(p_opt_in_id uuid)` | `true`; the seeker may opt in again |

**A direct `DELETE` on `resource_opt_ins` is not a client path.** After the contract step every client role
is refused (`403 42501 permission denied for table resource_opt_ins`): the seeker, the author and a platform
admin alike. A platform admin has no direct write on opt-ins from the foundation on: the policies' admin branch
is gone, so before the contract step an admin's direct `UPDATE` or `DELETE` matches no row (`204`, nothing
changes); removing a member's opt-in is a service-side operation. Before the
contract step the old policy still lets a seeker delete their own pending row, and it must not be used: it
takes the opt-in row and the post row in the opposite order to `decide_opt_in`, and when the two coincide
one of them is aborted with `40P01 deadlock detected` (measured on simultaneous pairs: 21 and 25 of 40 by
the reviewer, 39 and 40 of 40 in the builder's runs, 17 of 40 in the third review round's run; the slots never
drifted). `withdraw_opt_in` against
`decide_opt_in` never deadlocks (0 in 40 forced interleaves and 40 simultaneous pairs, in both release
states): exactly one of the two takes effect. If the decision lands first, `withdraw_opt_in` answers `false`;
if the withdrawal lands first, `decide_opt_in` answers `PT404 opt_in_not_found`. Treat both as "re-read the
list". The same two answers come back when the seeker's account is deleted first (the opt-in went with it).

`service_role` keeps its direct `DELETE` on `resource_opt_ins` in both release states (e2e fixtures and
service-side cleanups use it); the slot comes back and the trail records the removal by the system.

### Unchanged RPCs, one new refusal

- `opt_in_to_post(p_post_id) → resource_opt_ins row`: adds `PT409 This post is closed` (+ `details.code =
  "post_closed"`) for a post its author closed.
- `withdraw_opt_in(p_post_id) → boolean`, `unblock_opt_in(p_opt_in_id) → boolean`: same answers. The slot
  comes back on every deletion of an opt-in row (these RPCs, an account deletion, a service-side delete).
  `posts.slots_remaining` always equals `max_seekers` minus the post's opt-in rows.

### Trail

`resource_opt_in_events` (authenticated; the seeker reads their rows, the author all rows of their post, a
platform admin all): `id, opt_in_id, post_id, seeker_id, event, from_status, to_status, actor_role,
created_at`. `event`: `opted_in`, `accepted`, `declined`, `completed`, `withdrawn`, `unblocked`, `removed`.
`actor_role`: `seeker`, `author`, `platform_admin`, `system`. Every row names its seeker (`seeker_id`) and, on the
server, its actor, whatever else those members are doing at that moment (a username change included);
`seeker_id` is `null` only once that account is deleted. A deleted post takes its trail rows with it.

## Announcements (3.3)

- **Read:** `posts.is_pinned`, `posts.pinned_until`. A pin is live while `is_pinned && (pinned_until ===
  null || Date.parse(pinned_until) > now)`; show the chip by that rule (nothing is written when a pin
  expires, so no realtime event arrives).

### `admin_set_post_pinned(p_post_id uuid, p_pinned boolean, p_expected_version integer = NULL, p_until timestamptz = NULL, p_reason text = NULL) → { post_id, is_pinned: boolean, pinned_until: string | null }`

Callers: moderators. A pin ends 7 days from the call unless `p_until` (a future time) names another end.
Pinning one's own post is allowed. Unpinning what is not pinned changes nothing. Refusals, in order:
`42501 guest_refused` → `not_authenticated` → `p3_denied:insufficient_tier` →
`22023 pin_field_required:pinned` → `pin_field_invalid:reason` → `pin_field_invalid:until` →
`PT404 post_not_found` → `PT409 edit_conflict` → `42501 post_not_visible` (a hidden or deleted post).

### `ranked_feed_v2(p_lat float8 = NULL, p_lng float8 = NULL, p_limit integer = 25, p_cursor_score real = NULL, p_cursor_id uuid = NULL, p_filter text = NULL) → { id: string; kind: 'post' | 'event'; score: number; distance_bucket: string }[]`

Callers: `anon`, `authenticated`. One function, six arguments, all optional (the five-argument call of the
deployed client resolves to it). `p_filter`: omitted or `'all'` = every row, as today; `'announcements'` =
live pins and org events only, paged by the same `(score, id)` cursor. Any other value returns no rows. A
live pin scores above 1,000,000.

## Petitions (3.3)

- **Draft:** the composer inserts `{ created_by, status: 'draft', title, summary, body }` into `petitions`.
  Those five (plus `body_version_hash` until the contract step) are the only insertable columns. The server
  computes `body_version_hash` = SHA-256 of `body`, hex, whatever was sent; delete `lib/petition-hash.ts`
  from the write path.
- **Read:** approved petitions are public (unchanged). A draft or a rejected petition is read by its creator
  and by staff. `status`: `draft`, `approved`, `rejected`, `archived`.
- **Signed text is fixed:** once a petition has a signature its title, summary, body and hash cannot change.
  The sign route keeps copying the stored hash into the signature; a signature carrying another hash is
  refused (`PT409 petition_text_changed`).

### `admin_review_petition(p_petition_id uuid, p_action text, p_reason text = NULL) → { petition_id, status: 'approved' | 'rejected', post_id: string | null, changed: boolean }`

Callers: moderators, never on their own petition. `approve` publishes the feed post in the same call
(`post_type = 'petition'`, authored by the creator, the title as its text); the post arrives on open feeds
through the posts INSERT event. Approving again returns the same `post_id` with `changed: false`. `reject`
needs `p_reason` (≤ 500). Refusals, in order: `42501 guest_refused` → `not_authenticated` →
`p3_denied:insufficient_tier` → `22023 petition_field_invalid:action` → `petition_field_invalid:reason` →
`petition_field_required:reason` → `PT404 petition_not_found` → `42501 self_moderation_refused` →
`PT409 petition_not_draft` → `PT409 petition_creator_missing`.

### `add_petition_update(p_petition_id uuid, p_body text) → { update_id: number; petition_id: string; created_at: string; body_version_hash: string }`

Callers: the petition's creator, on an approved petition. `p_body` 1–2000 characters after trimming. The
petition row is not written (the hash in the answer is the unchanged one). Refusals, in order:
`42501 guest_refused` → `not_authenticated` → `22023 petition_field_invalid:body` →
`PT404 petition_not_found` → `42501 not_petition_creator` → `PT409 petition_not_approved`.

Read notes from `petition_updates` (`id, petition_id, body, author_role, created_at`; `anon` and
`authenticated`, for approved petitions): `.eq('petition_id', id).order('created_at', { ascending: false })`.

## Columns a client may select directly

| Table | `anon` | `authenticated` | Rows (RLS) |
|---|---|---|---|
| `posts` — new: `labels`, `comments_locked_at`, `comments_locked_reason`, `comments_locked_by_role`, `closed_at`, `closed_reason`, `pinned_until` | yes | yes | as before (visible posts; the author's own; staff all) |
| `posts.needs_review_at`, `posts.deleted_at` | no | yes | as before |
| `safety_alerts` — all but `created_by`, `verified_by` (new: `version`, `updated_at`, `update_count`, `resolved_at`, `resolved_by_role`) | column grant only, no row | yes | `status = 'live'` |
| `safety_alert_updates` | no | no | read through `safety_alert_history` |
| `post_labels` — `id`, `post_id`, `label`, `post_version`, `source_role`, `applied_at`, `retracted_at` | yes | yes | active records of a readable post; staff: all records |
| `post_comments.hidden_reason` | yes | yes | as the comment row (a hidden comment: its author and staff) |
| `content_reports` (incl. `reported_version`) | no rows | yes | own reports; staff all |
| `resource_opt_ins` | no rows | yes | the seeker, the post's author, a platform admin |
| `resource_opt_in_events` — all but `actor_id` | no | yes | the seeker, the post's author, a platform admin |
| `petitions` | yes | yes | approved: everyone; draft / rejected: creator and staff |
| `petition_updates` — `id`, `petition_id`, `body`, `author_role`, `created_at` | yes | yes | notes of approved petitions |

Client writes that remain: comment insert (`id, post_id, user_id, content, parent_id`), likes, poll votes,
the petition draft insert, and notification read / delete. Everything else is an RPC. (`resource_opt_ins`
takes no direct client write after the contract step: no insert, no update, no delete.)

## Realtime (the posts doorbell)

`supabase_realtime` → `posts` now carries 31 columns: the 24 of today plus `labels`, `comments_locked_at`,
`comments_locked_reason`, `comments_locked_by_role`, `closed_at`, `closed_reason`, `pinned_until`. Every
other member is unchanged (`post_comments (id, post_id)` and `poll_votes (id, poll_id)` stay doorbells;
alerts, label records, opt-ins and petitions are not published). Events arrive on the existing
`posts-realtime` channel as `UPDATE` with the new row; patch the card from `payload.new`.

| Change | What arrives |
|---|---|
| Label applied or retracted | `UPDATE` with the new `labels`. A re-apply at a newer version arrives as several `UPDATE`s of one transaction (the retraction, then the new record): apply them in order, the last one is the state. |
| Author edits a post that carries a moderator's label | `UPDATE` with the new `version` / `edited_at` and `needs_review_at` set; `labels` unchanged |
| Comments locked / unlocked | `UPDATE` with the three `comments_locked_*` columns set / NULL. Disable or re-enable the composer of an open thread. |
| Closed / reopened | `UPDATE` with `closed_at`, `closed_reason` |
| Pinned / unpinned | `UPDATE` with `is_pinned`, `pinned_until`. **Expiry sends nothing**: compare `pinned_until` with the clock. |
| Opt-in taken, withdrawn or deleted | `UPDATE` with the new `slots_remaining`. An accept / decline / complete changes nothing on the post: re-read the opt-in list after the author's own action. |
| Comment hidden by three reports or by a moderator | the `post_comments` doorbell (`UPDATE`, id + post_id) → re-read the thread; and a posts `UPDATE` with the new `comment_count` |
| Petition approved | posts `INSERT` (`post_type: 'petition'`, `petition_id`) |
| Alert placed, updated, resolved, withdrawn | nothing (poll) |

A post that becomes unreadable to a viewer is not delivered to them (unchanged).

## Reserved for Release 4

Nothing in Release 3 writes these; they are named so nothing else claims them.

- **Notification types** (already in the enum, unused): `moderation`, `content_update`, `event_update`.
  The deployed client falls back to `general` for an unknown type.
- **`notifications.data jsonb`** (not created yet): the machine-readable payload beside title / message.
- **Deep-link grammar** for notification links: `/#<panel>?focus=<kind>:<uuid>[&comment=<uuid>]&n=<event_key>`.
  - `<panel>?focus=<kind>:<uuid>` is today's member deep link (`lib/deep-link.ts`); other parameters are
    ignored by `parseHash`, so `comment` and `n` are free.
  - Reserved focus kind: **`post`** (`/#feed?focus=post:<post_id>`). Release 4 adds it to `FOCUS_KINDS` with a
    feed consumer; until then such a link opens the feed without focusing.
  - Reserved parameters: `comment=<comment_id>` (scroll to a comment of the focused post), `n=<event_key>`
    (makes the link unique per event for dedup; never read by the client).
  - Reserved `n` keys: `held-<ms>`, `removed-<ms>`, `restored-<ms>`, `label-<label_id>`, `chide-<ms>`,
    `edit-v<version>`, `cancel-<occurrence_id>`, `venue-<ms>`.
  - Events keep `/#events?focus=event:<event_id>&n=cancel-<occurrence_id>`.
