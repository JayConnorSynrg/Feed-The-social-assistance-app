# FEED P2 — Engagement Ledger + Eco-Badges: Empirical Subsystem Model

Status: READ-ONLY MODEL (input to macro plan; nothing built). Baseline: `develop @ 3b5cc19`, prod `ndtpovonpadugthmcntl` probed 2026-09-23 02:21 UTC via Mgmt API (control query `select 1` → ok).
Evidence convention: `Q:` = live prod query result; file:line = repo / memory file.

---

## 0. Headline facts

1. **The "16 source tables" are not enumerated anywhere recoverable.** The Sprouts memory states the count only (`memory/project-sprouts-gamification.md:22` "fed by `AFTER INSERT` DB triggers (SECDEF) on 16 source tables") and lists "confirm the 16 source tables' columns" as pending (`:29`). The originating session transcript (`ad196874…`) no longer exists on disk. §1 therefore reconstructs the candidate set from live user-write tables (24 audited) and derives a 16-table set.
2. **Zero engagement traffic in prod.** Q: exact `count(*)` = 0 for posts, post_likes, post_comments, polls, poll_votes, follows, reviews, resource_opt_ins, conversations, messages, event_checkins, favorites, resource_bookmarks, saved_resources, petition_signatures. Non-zero: petitions 2, safety_alerts 3, safety_alert_votes 1, content_reports 1, resources 19,145 (99.98% ingested). auth.users = 8 (5 anonymous, 3 permanent, of which 2 admins). `n_live_tup` is stale (profiles est 1 vs 8 actual; audit_log est 18 vs 2,802).
3. **The only peer-verified primitive that exists is `reviews` → it has a live forge vector** (reviewer can UPDATE `reviewee_id`; Q: `has_column_privilege('authenticated','public.reviews','reviewee_id','UPDATE') = true`, policy `reviews_update` checks only `reviewer_id = auth.uid()`). Same class for `resource_opt_ins.status/seeker_id` (post author), `conversations.status` (either party), `event_checkins.checked_in_by` (caller-supplied). Any badge keyed on these facts inherits the forge unless the ledger records the fact at INSERT/transition time via a trigger and the columns are locked.
4. **Privilege is binary today.** `is_current_user_admin()` = `profiles.is_admin` (Q: function body); 51 RLS policies call it, 2 read `is_staff`, 33 public functions reference admin/staff. There is no moderator tier. (P3.1 supersedes this: three tiers via `profiles.admin_tier`, elevation via the `admin_set_tier` nomination RPC; the `claim-facilitator-admin` code path was retired.)
5. **No "business" entity exists.** grep for `business` in `apps/web/src` + migrations → 1 hit, seed text only. Candidates: `organizations` (0 rows, `org_type` ∈ food_bank/pantry/shelter/clinic/mutual_aid/other, admin-created only) or `profiles.user_role IN ('providing','both')`.

---

## 1. Source-table audit (question 1)

Legend — Rev = can the actor undo it themselves (and how). Trig = existing non-internal triggers (Q: pg_trigger). Rows = exact count(*) / n_live_tup.

| # | Table | Rows | Actor col | Target col | Rev | Existing triggers | Uniqueness (Q: pg_constraint/pg_indexes) |
|---|---|---|---|---|---|---|---|
| 1 | posts | 0/0 | user_id | resource_id (nullable), petition_id | **No** — no DELETE policy; table relacl `authenticated=a` only (INSERT). Admin soft-hide only | trg_posts_init_slots (SECDEF BEFORE IU), 2× updated_at | pk(id) |
| 2 | post_likes | 0/0 | user_id | post_id | **Yes** — DELETE own (`post_likes_delete_own`) | trg_sync_post_like_count (SECDEF AFTER IDU) | pk(user_id,post_id) |
| 3 | post_comments | 0/0 | user_id | post_id (+parent_id) | **Yes** — DELETE/UPDATE own; UPDATE can re-point post_id (Q: priv=true) | trg_sync_post_comment_count (SECDEF AFTER IDU), 2× updated_at | pk(id) only — unlimited per target |
| 4 | poll_votes | 0/0 | user_id | poll_id (→polls.post_id) | **Yes** — DELETE own | none | uniq(poll_id,user_id) |
| 5 | follows | 0/0 | follower_id | following_id | **Yes** — DELETE own ("Users can unfollow") | none | pk(follower_id,following_id) |
| 6 | resource_opt_ins | 0/0 | seeker_id | post_id (+resource_id denorm) | **Partly** — `withdraw_opt_in` deletes only `status='pending'`; DELETE policy also lets seeker delete any status directly | trg_resource_opt_ins_completed_at (SECDEF BEFORE U), updated_at | uniq(post_id,seeker_id) |
| 7 | reviews | 0/0 | reviewer_id | reviewee_id (+opt_in_id XOR conversation_id) | **Yes** — DELETE + UPDATE own (incl. reviewee_id!) | trg_reviews_recompute_harmony (SECDEF AFTER IDU), updated_at | uniq(opt_in_id,reviewer_id); partial uniq(conversation_id,reviewer_id) |
| 8 | conversations | 0/0 | requester_id (initiator); volunteer_id | resource_id (NOT NULL) | status editable by either party (table UPDATE grant + participant policy) | updated_at | partial uniq(volunteer_id) WHERE pending |
| 9 | messages | 0/0 | sender_id | conversation_id | No DELETE policy; UPDATE (is_read) by participants | none | pk(id) |
| 10 | petition_signatures | 0/0 | signer_id | petition_id | **Yes** — `withdraw_petition_signature` until `petitions.exported_at` set | none | uniq(petition_id,signer_id) |
| 11 | safety_alerts | 3/0 | created_by | (self — location/alert_type) | **Yes** — `delete_safety_alert` (owner) | none | pk(id) |
| 12 | safety_alert_votes | 1/0 | voter_id | alert_id | **Flip** — `vote_safety_alert` upserts `ON CONFLICT DO UPDATE SET vote` | none (counts recomputed inside RPC) | uniq(alert_id,voter_id) |
| 13 | event_checkins | 0/0 | user_id (nullable = anonymous household) / checked_in_by | occurrence_id | No DELETE policy; UPDATE own | none | partial uniq(occurrence_id,user_id) WHERE user_id NOT NULL |
| 14 | resources (user-submitted) | 19,145 (3 user_submitted, 173 admin_added) | submitted_by | self; category | UPDATE own while pending | on_resource_change_webhook ×2 (SECDEF AFTER), updated_at | uniq(external_id,source) |
| 15 | resource_bookmarks | 0/0 | user_id | resource_id | **Yes** — DELETE own | none | pk(user_id,resource_id) |
| 16 | content_reports | 1/0 | reporter_id | content_id (post) | No (no DELETE policy; RPC `ON CONFLICT DO NOTHING`) | none | uniq(reporter,type,content) |
| — | petitions | 2/0 | created_by | — | draft insert only; admin approves | updated_at | — |
| — | polls | 0/0 | via posts.user_id | post_id | DELETE own (via post owner) | none | — |
| — | favorites | 0/0 | user_id | resource_id | Yes | none | uniq(user_id,resource_id) |
| — | saved_resources | 0/0 | user_id | resource_id | Yes (ALL own) | none | partial uniq(user_id,resource_id) |
| — | organizations / organization_members | 0/0 | created_by / user_id | org_id | admin-only writes | updated_at | uniq(org_id,user_id) |
| — | impact_metrics | 0 | user_id | — | client INSERT/UPDATE own (self-writable → forgeable) | — | **dead: zero app readers/writers** (grep: only `20260525100001_add_v2b_tables.sql`) |

Derived 16 (rows 1–16) = every table where an authenticated human creates a row that names a counterparty or a community object. None are missing live; **all 16 exist**. The ones the memory implies but that need a note: "weather pins" = `safety_alerts` with `alert_type='weather'` (CHECK: weather/road_closure/speeding/general); `polls` rows are a child of a `posts` insert (count as the post, not separately).

Writers (who performs the INSERT — matters because trigger-time `auth.jwt()` differs):
- Client direct (RLS): posts (6 sites in `post-type-wizard.tsx`: :246, :316, :485, :600, :723 petitions, + feed composer), post_likes, post_comments, poll_votes, follows, bookmarks, favorites, event_checkins (`checkin-sheet.tsx:55`, `organizer-checkin-display.tsx:75`), conversations, messages, resource_opt_ins (direct INSERT allowed by `opt_ins_insert` — bypasses the RPC's own-post + capacity checks).
- SECDEF RPC: opt_in_to_post, submit_review (sole review path: no INSERT policy), vote_safety_alert, place_safety_alert, submit_content_report.
- **Service role (API route)**: petition_signatures via `apps/web/src/app/api/petitions/sign/route.ts:121-133`. In a trigger on this table `auth.jwt()` is the service-role JWT, so a JWT-based guest check is blind there.

---

## 2. "Successful interaction" — cheap vs completed vs peer-verified (question 2)

| Interaction | Tier | "Completed" means | State column that proves it | Who confirms (peer?) | Forge surface (live) |
|---|---|---|---|---|---|
| post_likes | cheap, reversible | row exists | — | nobody | like/unlike loop → use once-per-(user,post) |
| post_comments | cheap, reversible | row exists and `is_hidden=false` | is_hidden | nobody | unlimited per post (no uniq) |
| poll_votes | cheap, reversible | row exists | — | nobody | delete/re-vote |
| follows | cheap, reversible | row exists | — | nobody | follow/unfollow |
| resource_bookmarks/favorites | cheap, private | row exists | — | nobody | — |
| petition_signatures | medium (legal affirmation, server-stamped) | row exists, petition `status='approved'` | petitions.status, exported_at (locks withdraw) | nobody (self-affirmed) | withdraw until export |
| safety_alerts | medium | alert live; **admin-verified** | `verified`, `verified_by`, `verified_at` (admin_verify_safety_alert) | admin | owner can delete |
| safety_alert_votes | medium | vote cast | vote ∈ confirm/clear | nobody (it IS the peer check of someone else's alert) | flip allowed |
| resource_opt_ins | **completed** | `status='completed'` (CHECK pending/accepted/declined/completed) + `completed_at` set by BEFORE U trigger | status, completed_at | **post author alone** (unilateral UPDATE, `opt_ins_update` policy) | author can UPDATE status/seeker_id (Q: priv true); direct INSERT bypasses RPC |
| conversations | **completed** | `status='completed'` (enum pending/active/completed/declined/cancelled) | status | intended volunteer-only (`use-conversations.ts:383-390` client `.eq('volunteer_id')`), **DB lets either participant** (`conversations_update_participants`) | either party |
| reviews | **peer-verified** | row exists for a `completed` opt-in/conversation, reviewer = the counterparty (`submit_review` body) | rating, would_recommend | **the counterparty** — the only true peer confirmation in the schema | reviewer can UPDATE reviewee_id/rating or DELETE (Q: priv true) |
| event_checkins | completed attendance | row exists | checked_in_by ≠ user_id → organizer-verified | organizer, *if* `checked_in_by` is an org admin | `checked_in_by` is client-supplied (Q: INSERT priv true; policy only constrains user_id) — self check-in sets checked_in_by = self |
| resources (user-submitted) | **admin-verified contribution** | status pending → `approved` via `approve_resource` | status, moderated_by, moderated_at | admin | none after approval (UPDATE only while pending) |
| content_reports | moderation | status open → `upheld` | status (admin_resolve_report) | admin | — |

Peer-verified set (another party confirms): **reviews** (counterparty), **opt-in completion** (offerer confirms seeker's receipt, but unilateral), **conversation completion** (unilateral), **safety_alert confirm votes** (other users confirm an alert), **admin approve** (resources, safety alerts, reports upheld), **organizer check-in** (only if checked_in_by is locked). The strongest two-sided proof available is: `completed` opt-in/conversation **AND** a review from the counterparty with `would_recommend = true` (or rating ≥ 4).

State machines (live CHECK/enum):
- resource_opt_ins: `pending → accepted | declined → completed` (no DB enforcement of ordering; author can jump pending→completed). pending → deleted via withdraw.
- conversations: `pending → active | declined | cancelled; active → completed` (ordering unenforced).
- safety_alerts: `live → expired | cleared (≥3 clear & clear>confirm, in vote_safety_alert) | removed (admin)`; verified is orthogonal.
- resources: `pending → approved | rejected → archived`.
- petitions: `draft → approved → archived`; exported_at locks signatures.
- content_reports: `open → dismissed | upheld`; 3 distinct open reporters auto-hide the post.

---

## 3. Category attribution (question 3)

Target taxonomy: `resource_category` enum, 25 values (Q: pg_enum): food, housing, healthcare, employment, education, legal, transportation, utilities, clothing, financial, mental_health, substance_abuse, domestic_violence, childcare, senior_services, disability_services, veteran_services, immigration, other, eitc_tax_filing, free_legal, prenatal_natal_care, waste_disposal, free_camping, free_goods_donation.

| Interaction | Path to resource_category | Coverage |
|---|---|---|
| posts (resource_post / source_offer with a resource) | `posts.resource_id → resources.category` | only when resource_id set (nullable) |
| seeker_request / source_offer chips | `posts.metadata->'categories'` — **different vocabulary**: `OE_CATEGORIES` = Food, Housing, Goods, Transit, Health, Money, Care, Education, Work, Legal (`post-type-wizard.tsx:97-100`) | needs a 10→25 crosswalk |
| likes / comments / poll_votes | via `post_id → posts.resource_id → resources.category` | only if parent post has resource_id |
| resource_opt_ins | `resource_id` (denormalized from post by `opt_in_to_post`) → category | as good as the post's resource_id |
| reviews | `opt_in_id → resource_opt_ins.resource_id` or `conversation_id → conversations.resource_id` | conversation path **always** has a category (resource_id NOT NULL) |
| conversations | `resource_id NOT NULL → resources.category` | 100% |
| bookmarks / favorites / saved_resources | `resource_id → category` (saved_resources also has free-text `resource_category`) | 100% (nullable in saved_resources) |
| resources (submitted) | `category` directly | 100% |
| petitions / signatures | `petitions.cause_category` text — live values `land_rights`, `infrastructure` (not the enum) | separate vocabulary |
| safety_alerts / votes | `alert_type` (weather/road_closure/speeding/general) | no resource category |
| event_checkins | `occurrence → assistance_events.event_type` (text) / `organizations.org_type` | no resource category |
| follows, content_reports, messages | none | **no category path** |

Data-reality caveat (Q): approved resources by category — `other` 17,631 (92%, mostly IMLS libraries), `housing` 1,364, food 21, everything else ≤ 14. Category-weighted badges will be dominated by "other" unless `other` is excluded or IMLS is remapped (e.g. libraries → education).

---

## 4. Reusable patterns (question 4)

- **Denormalized counter trigger**: `sync_post_like_count` / `sync_post_comment_count` — SECDEF, `SET search_path public,pg_temp`, AFTER I/D/U, recompute `count(*)` for `COALESCE(NEW.x, OLD.x)`, handles re-point on UPDATE, `RETURN NULL` (Q: pg_get_functiondef). Recompute-from-source is idempotent — contrasts with the ledger's append-only increment model.
- **Aggregate on profiles**: `recompute_harmony` (`supabase/migrations/20260604150000_reviews_and_harmony.sql:96-125`) AVG+COUNT per reviewee into `profiles.harmony_score/harmony_reviews_count`; trigger-maintained because the badge renders on many surfaces (memory phaseC "Harmony = trigger-maintained denormalized column").
- **Forge-guard lesson** (`20260604150000…:23-40`, memory `pattern-feed-social-resource-matching-phaseC.md` defect 1): a new meaningful profiles column inherits table-level UPDATE; fix = `REVOKE UPDATE ON profiles` table-level then `GRANT UPDATE(<user-editable list>)`. Live state now: profiles relacl has **no** table-level UPDATE for authenticated (only `m`), all writes are column grants (Q: attacl) → a new badge/level column is non-writable by default; it needs an explicit `GRANT SELECT(col)` to anon + authenticated to be readable.
- **Guest guard inline**: `COALESCE((SELECT (auth.jwt()->>'is_anonymous')::boolean), false)` at top of every SECDEF RPC (submit_review, opt_in_to_post, vote_safety_alert…).
- **Immutable-ledger precedent (`audit_log`)**: no UPDATE/DELETE policy, but **"Users insert own audit events" INSERT policy + table-level ALL grants to anon/authenticated** (Q) — it is append-only, not forge-proof. A ledger modeled on it must drop the client INSERT policy (trigger-only writes).
- **Atomic slot RPC**: `SELECT … FOR UPDATE` in `opt_in_to_post` (Q body).
- **Admin elevation**: `admin_set_tier` (nomination by a strictly higher tier; the founder for anything touching platform admin). P3.1 retired the `claim-facilitator-admin` code path and its `admin_code_redemptions` table.

---

## 5. Where badges surface (question 5)

| Surface | File | Current author/profile read | Badge-add implication |
|---|---|---|---|
| Feed card author row | `apps/web/src/components/feed/post-model.ts:188-193` `FEED_POST_SELECT` embeds `user:profiles!posts_user_id_fkey(id, first_name, avatar_url, is_staff, harmony_score, harmony_reviews_count)`; `rowToPost` :243-253 maps to `PostAuthor` (:137-144) | explicit column list | add column(s) to embed + `FeedPostRow.user` + `PostAuthor`; `HarmonyBadge` rendered at `feed-panel.tsx:908-910, 1109` is the sibling slot |
| Ranked feed | `ranked_feed` returns `TABLE(id, score, distance_bucket)` only (Q) → hydrated via FEED_POST_SELECT | none | no RPC change needed |
| Realtime | publication `posts` column list excludes location and carries no author; **profiles is not in supabase_realtime** (Q) | — | badge changes do not stream; card refresh = next fetch |
| Opt-in seeker list | `feed-panel.tsx:1439` embeds `seeker:profiles(... harmony_score, harmony_reviews_count)` | explicit | second author surface |
| Public profile | `apps/web/src/app/profile/[username]/page.tsx:66-71` selects `id, username, first_name, avatar_url, bio, is_verified, created_at, is_staff`; posts at :94-97 | explicit | badge shelf goes here (SSR route, not a panel) |
| Overview/Impact | `apps/web/src/components/panels/overview-panel.tsx` (358 lines) — reads posts + post_likes for Recent Activity (:183-209), static QuickAction cards (:270-312), Reminders placeholder (:346-352) | own rows only | Sprouts memory anchor `overview-panel.tsx:345-353` has **drifted** (now the Reminders placeholder); entry card must be re-anchored |
| Panel registry | `feed-shell.tsx:59` PanelType union, `:515` VALID_PANELS | — | new `'sprouts'`/badges panel = union + VALID_PANELS + PanelRenderer entry |

Grant constraint (Q: pg_attribute.attacl): profiles has column-only grants; `harmony_score/harmony_reviews_count` = `{authenticated=r, anon=r}`; `full_name`, `last_name`, `location`, `is_admin` are unreadable by clients. Any new profile column shown on the feed must receive `GRANT SELECT(col) TO anon, authenticated`, or the embedded select 401/42501s for the whole query (memory `pattern-feed-column-pii-gate-requires-read-path-first`). A separate `user_badges` table joined into FEED_POST_SELECT would need its own FK path from posts/profiles and SELECT policy + grants for anon.

---

## 6. Guests (question 6)

- Identity: `auth.users.is_anonymous` (Q: 5 of 8 users true) and JWT claim `is_anonymous` (`20260611173053_guest_access_anonymous_gating.sql:8-16`). Guests run as Postgres role `authenticated`, not `anon`.
- Enforcement: RESTRICTIVE `…_block_anon_insert/update` policies on posts, post_likes, post_comments, follows, resource_bookmarks, resource_opt_ins, resources, conversations, messages, profiles(update), audit_log (Q: pg_policies) + inline guard in SECDEF RPCs.
- **Gaps (live)**: no RESTRICTIVE guest block on `poll_votes`, `event_checkins`, `favorites`, `saved_resources` (Q); `withdraw_petition_signature` and `delete_safety_alert` have no guest guard (Q bodies); the petition sign route checks `getUser()` only, not `is_anonymous` (`route.ts:61-70`), and inserts with service role → guests can sign petitions today.
- Ledger implication: the trigger must decide guest-ness from `SELECT is_anonymous FROM auth.users WHERE id = <actor>` (works for service-role writers), not from `auth.jwt()`. A guest who later links an identity keeps the same `auth.users.id` with `is_anonymous` flipping to false — so skip-at-write means pre-conversion activity is never credited (consistent with "guests read-only").

---

## 7. Data reality → thresholds (question 7)

- Permanent users: 3 (2 admins). Guests: 5. First signup 2026-06-07, last 2026-09-20 (Q).
- Peer-verified interactions ever: 0 reviews, 0 completed opt-ins, 0 conversations (Q).
- app_logs last 30 d: feed.load.complete 9 events from 2 users; top events are realtime subscribe + admin checks (Q) — traffic is operator/dev.
- Implication: any absolute threshold (e.g. "10 verified exchanges → Community Moderator") yields zero eligible users for the foreseeable future; any low threshold (1–3) is trivially gamed by two colluding accounts given the forge surfaces in §2. Thresholds must be config (a table row, like `ranking_config` which already exists with 1 row) rather than constants, so they can be tuned once real traffic exists. Backfill is a no-op (source tables empty) — the ledger can start clean.

---

## 8. Entities for the P2 design (derived, not built)

- `engagement_events` (append-only): actor_id, event_type, target_type, target_id, category (resource_category, nullable), verification ('self'|'peer'|'admin'), source_table, source_pk, metadata jsonb, created_at. Uniqueness `(actor_id, event_type, target_id)` enforces award-once-per-pair-ever for reversible types. Writers: SECDEF AFTER triggers only; no client INSERT/UPDATE/DELETE policy; SELECT own.
- `user_engagement_counters`: user_id, per-event-type and per-category counts, xp. Written by the same trigger transaction.
- `badges` catalog + `user_badges` (earned, monotonic — never revoked by source-row deletion, per "never wilt" `memory:17`).
- Privilege ladder: role column/enum or `admin_role_requests` table with approver_id (higher tier) → requires touching `is_current_user_admin()` semantics (51 policies) or adding a parallel `current_user_role_at_least(role)` helper.

Invariants to hold between rows:
1. Every `engagement_events` row points at a source row that existed at insert time (source_pk), and its actor is non-anonymous per auth.users.
2. For reversible sources, delete of the source row never deletes the event (append-only) and re-insert never creates a second event (unique pair).
3. `peer`-verification events are emitted on the state TRANSITION (opt-in → completed, review insert by counterparty), and require the verifying column to be non-writable by the beneficiary — today reviews.reviewee_id, opt_ins.status/seeker_id, conversations.status, event_checkins.checked_in_by are all beneficiary- or counterparty-writable.
4. Counters = f(events) (recomputable from the ledger); badges = monotone f(counters).
5. Any profiles column exposed on posts has anon+authenticated SELECT column grants.

Where the traffic will be (by design, not data — data is 0): likes > comments > follows > poll votes (cheap, high-volume, reversible) ≫ opt-ins/conversations ≫ reviews (low-volume, high-trust). A ledger row per cheap action is the volume driver; peer-verified rows are the privilege driver.

---

# P2.1a — AS BUILT (wave feed-fullfeed-p2-1a-engagement)

Migration `supabase/migrations/20261005000000_p2_1a_engagement.sql` (ledger tip 20261004000000). Replays cleanly twice on PG17 (local harness) and is PG15-safe by construction (no PG16/17-only syntax; FILTER aggregates PG9.4+, `gen_random_uuid()` core PG13+, no MERGE). Verified: 9 behavioural cases + 7 vitest units + smoke 26 (gated).

## Entities built
- **`engagement_events`** (append-only ledger): `id, actor_id→auth.users, kind, target_type, target_id, category (family key, nullable), verified, weight, source_table, source_pk, metadata, created_at`. `UNIQUE(actor_id, kind, target_id)` = award-once-per-pair-ever. RLS on; own-SELECT only; no client write policy; table `REVOKE ALL`, `GRANT SELECT` to authenticated. NOT in `supabase_realtime`.
- **`user_engagement_counters`** (`user_id, dimension, count, updated_at`, PK `(user_id,dimension)`): `dimension` is `family:<key>` (weighted points) or `badge:<key>` (event count). RLS own-SELECT; no client writes.
- **`badge_config`** (single row, mirrors `ranking_config`): `level1/2/3_threshold` default `3/10/25`, ordered CHECK, singleton CHECK+UNIQUE. Public SELECT; no client writes. An UPDATE fires `recompute_all_badge_summaries()`.
- **`opt_in_declines`** (private marker, PK `(author_id, seeker_id)` — per author across all their posts): `first_declined_at, last_declined_at, times_declined`. RLS author-only SELECT; no client writes; not published (WAL-safe).
- **`profiles.badge_summary jsonb`**: `{families:{<fam>:{count,level}}, badges:{<badge>:{count,level}}}` — NO `updated_at` key (timing-leak fix), only level>0 dimensions present, and rewritten only when the value changes (`IS DISTINCT FROM`), so `profiles.updated_at` bumps only on a real level/count change. `GRANT SELECT(badge_summary)` to anon+authenticated (profiles has column-only grants); no UPDATE grant. PII columns (full_name etc.) stay private (regression-guarded in smoke 26).

## I1 derivation table (as built)
See the migration header for the authoritative table. **18 kinds** + reserved `appreciation_gift` (`conversation_completed` split into `_volunteer`/`_requester`; the full public/private classification and the final kind list live in the "DECISIONS A + B" and "Round-3" sections below). Completed opt-in credits BOTH provider (Helper, public) and seeker (family, private). `review_received` keys on the anchor `COALESCE(opt_in_id,conversation_id)`, `comment` on the post. Verified facts: `review_received` (peer, private), `safety_alert_verified` (admin, private), `resource_approved` (admin, public); P3 reads verified ledger rows server-side, never a summary.

## Weights / dimensions
Family points += kind weight (like/poll_vote/comment 1; opt_in_completed_seeker 2; opt_in_completed_provider / conversation_completed / review_received / resource_approved 3). Community-badge dimension += 1 per qualifying event. Community badges: `voice`←comment, `helper`←opt_in_completed_provider, `connector`←conversation_completed, `advocate`←petition_signature, `watcher`←safety_alert_verified.

## Category-family crosswalk (`engagement_category_family`)
25 `resource_category` → 10 families (food, housing, goods, transit, health, money, care, education, work, legal). `other` → NULL (excluded — 92% of approved resources are `other`/IMLS libraries and would swamp the families). `utilities`→money, `waste_disposal`→goods, `free_camping`→housing, `domestic_violence/childcare/senior_services/disability_services/veteran_services`→care.

## I3 summary correctness
`recompute_badge_summary(user)` rebuilds the jsonb from the user's counters + config. `recompute_user_engagement(user)` rebuilds counters from the ledger then re-derives the summary (full recompute). The incremental trigger path (`record_engagement_event`) is proven equal to the full recompute (behavioural case 5). A `badge_config` UPDATE recomputes every user's summary (case 6). All write helpers are SECDEF, `SET search_path=public,pg_temp`, `REVOKE EXECUTE FROM PUBLIC,anon,authenticated` (recompute fns GRANTed to service_role for ops).

## I5 unblock flow
`unblock_opt_in(opt_in)` (SECDEF, authenticated-only, guest-guarded): checks the caller authored the post and the opt-in is `declined`, then **DELETEs the declined opt-in row and restores the slot exactly once** (rowcount-gated under a post `FOR UPDATE` lock, so two concurrent unblocks cannot both restore a slot / overbook). The seeker then opts in again themselves via `opt_in_to_post`. The P2.0 `enforce_opt_in_transition` graph is **untouched** (no `declined→pending` edge, no GUC bypass; md5(prosrc) unchanged, asserted in smoke 26). A declined opt-in never completed, so it has no reviews to cascade. The private `opt_in_declines` marker survives the unblock and is author-only (RLS), never in the seeker's view, a public view, or the WAL. The client Unblock button carries a `createSingleFlight` gate (double-click fires the RPC once).

## UI (capability delivered)
- Profile page (`app/profile/[username]/page.tsx`) renders an accessible **Community Badges** section from `badge_summary` via the pure `lib/engagement-badges.ts` mapper (+ empty state). Family color from `CATEGORY_META`; lucide icons; earth-tone styling.
- Author opt-in management (`components/panels/feed-panel.tsx`): an **Unblock** button on `declined` opt-ins (calls `unblock_opt_in`) and a private **"Declined before"** marker label on seekers in `opt_in_declines` (loaded author-only).

## Postdeploy order (see GIT_PLAN)
The migration is fully additive/non-breaking to the currently-deployed client (new tables/column/RPC; no read path changes for the old client). The new client READS `profiles.badge_summary` and CALLS `unblock_opt_in` + reads `opt_in_declines`, so the migration MUST be live before the new Vercel deploy serves traffic. Because it is additive it is applied to prod BEFORE the deploy (zero risk to the old client): (1) apply migration + record ledger row `20261005000000`; (2) regenerate `packages/database/types.ts` from prod (reconciles the hand-added types); (3) confirm Vercel deploy READY for the develop tip; (4) run smoke 26.

---

# P2.1a — FIX ROUND (adversarial-review corrections; supersedes the AS-BUILT prose above where they differ)

Verified on BOTH PG15 and PG17 (migration applied twice; 16 behavioural cases + race.sh + eq.sql all green).

1. **Review farm closed.** `review_received` keys on the ANCHOR `COALESCE(opt_in_id, conversation_id)` (per reviewee), NOT `reviews.id`. 3× submit/delete of the same review leaves exactly 1 verified row.
2. **Lost update + deadlock closed (I3 under concurrency).** `recompute_badge_summary` locks the profile row **`FOR NO KEY UPDATE`** (not `FOR UPDATE`, which conflicts with the `FOR KEY SHARE` inbound FK checks take → a mutual follow deadlocked and the catch dropped a credit); two-party events lock both profiles in uuid order. Proven by race2.sh on both PG versions: R1 two concurrent likes → both families, incremental==full; R2 two-party completion race → 4 ledger rows, both summaries==recompute; R3 mutual follow with a widened FK→engagement window → 2/2 follow credits, 0 deadlocks.
3. **I7 core-first.** Every engagement trigger body runs in a `BEGIN … EXCEPTION WHEN OTHERS THEN log_engagement_failure(); END` subtransaction, so a ledger failure never aborts the user's source write (RAISE WARNING + best-effort `app_logs`). `reconcile_engagement(p_user default null)` (SECDEF, service_role-only) re-derives missed events idempotently from the source tables. Proven: an injected ledger failure lets the like commit with 0 ledger rows; reconcile then recovers the event.
4. **Comment farm closed.** `comment` (Voice) keys on `(actor, POST)`, not the comment row. Delete + re-post on the same post never re-awards.
5. **Self-verification earns nothing.** `resource_approved` skips `moderated_by = submitted_by`; `safety_alert_verified` skips `verified_by = created_by`. Applied identically in the backfill.
6. **Coverage (all interactions earn).** Added kinds (each once per (actor,target), non-verified, weight 1): `post_created` (family via resource or post chip), `event_checkin` (attendee), `safety_alert_vote`, `message` (once per conversation), `resource_bookmark`, `saved_resource`. A one-time idempotent BACKFILL (`SELECT reconcile_engagement(NULL)` at the end of the migration) credits existing prod facts through the same functions (the corrected backfill figure is in "Round-3 — corrected backfill" below). A **nightly pg_cron job** (`engagement_reconcile_nightly`, `27 4 * * *`, `SELECT public.reconcile_engagement();`) re-derives any missed events (I7 recovery); scheduled idempotently (unschedule-if-exists → schedule), guarded on the pg_cron extension, with `SET lock_timeout='5s'` on `reconcile_engagement`.
7. **Timing leak closed.** `badge_summary` no longer carries `updated_at`, and the row is rewritten only when the computed value changes (`IS DISTINCT FROM`), so `profiles.updated_at` bumps only on a real level/count change.
8. **Unblock = delete-and-requeue (user's words); double-unblock closed.** `unblock_opt_in` (SECDEF, author-only, declined-only) locks the post `FOR UPDATE`, DELETEs the still-`declined` row, and restores the slot **exactly once — only when its own DELETE rowcount > 0** (mirrors withdraw_opt_in), so two concurrent unblocks cannot both restore a slot / overbook. The seeker re-opts themselves via `opt_in_to_post`. The `enforce_opt_in_transition` graph is the P2.0 body verbatim (no `declined→pending` edge, no GUC bypass). The private `opt_in_declines` marker survives. Client Unblock button carries a `createSingleFlight` gate. UI copy: "Unblock — they can request again". Proven by dbl.sh on both versions: after two concurrent unblocks, `slots_remaining` is correct (second returns false, no double-restore).
9. **types.ts** hand-augmented with all engagement functions (level, category_family, family_from_chip, weight, community_dim, record_engagement_event, recompute_*, reconcile_engagement, log_engagement_failure) and `unblock_opt_in` now returns boolean — to be reconciled by regen post-apply.
10. **Smoke 26** additionally asserts: triggers are AFTER + ROW; `badge_summary` UPDATE denied to authenticated; the 4 new tables are absent from `supabase_realtime`; `unblock_opt_in` + `reconcile_engagement` are SECDEF with a pinned search_path; `reconcile_engagement` is not authenticated-executable. 16 source triggers checked.
11. **Postdeploy order (GIT_PLAN):** review clean → apply migration → verify → insert ledger row → regenerate types.ts from prod and push to the PR branch → CI green → merge (auto-deploys) → Vercel READY → run smoke 26.

---

# P2.1a — DECISIONS A + B (community-confirmed earning + public/private split) [final]

Verified on PG15 (15.19) + PG17 (17.7), migration applied twice; ab.sql + i1/i5/i7/race2/dbl + v2 all green.

## Decision A — community-confirmed
- **A1**: an action whose actor OWNS the target earns nothing — own like/comment/poll-vote/alert-vote/bookmark/save are skipped at the trigger (no ledger row, no family, no post_created). Opt-in/review are already cross-party; resource_approved/safety_alert_verified already exclude the self case.
- **A2**: `post_created` credits the author EXACTLY ONCE at the FIRST qualifying engagement by a DIFFERENT non-guest user (like / comment / opt-in) — never at creation. Key `(author, post_created, post_id)` is stable, so later engagements never re-award; a post deleted before outside engagement earns nothing; after credit, deleting the post keeps it. Implemented via `credit_post_created(post, engager)` called from the like/comment/opt-in-insert triggers; the posts-AFTER-INSERT credit is removed.
- **Collusion**: two accounts engaging each other still earns credit — accepted. Those credits are UNVERIFIED (`verified=false`) and never gate privilege (P3 reads verified ledger rows only).

## Decision B — public / private split (classification from LIVE RLS)

| kind | can another user see THIS actor did it? (live RLS) | scope |
|---|---|---|
| like | post_likes SELECT `USING true` → yes | **public** |
| poll_vote | poll_votes SELECT `USING true` → yes | **public** (contradicts the tentative "private" guess; decided from evidence) |
| follow | follows SELECT `USING true` → yes | **public** |
| comment | post_comments SELECT `USING (NOT is_hidden)` → yes | **public** |
| post_created | posts SELECT public → the post is visible | **public** |
| opt_in_completed_provider | opt-in row is author/seeker-scoped, but records HELPING others | **public** |
| conversation_completed_volunteer | records HELPING others | **public** |
| safety_alert_verified | safety_alerts.created_by has NO client grant (only verified_at/verified_by granted) → a public write would unmask the reporter via `profiles.updated_at = verified_at` | **private** (→ Watcher is a private badge) |
| resource_approved | resources SELECT `status='approved'` → visible | **public** |
| petition_signature | petition_signatures SELECT `signer_id = auth.uid()` → signer-only | **private** (so **Advocate** is a private badge) |
| event_checkin | event_checkins SELECT own/admin only | **private** |
| safety_alert_vote | safety_alert_votes SELECT `voter_id = auth.uid()` | **private** |
| message | messages SELECT participants-only (private correspondence) | **private** |
| resource_bookmark | resource_bookmarks SELECT `user_id = auth.uid()` | **private** |
| saved_resource | saved_resources ALL `user_id = auth.uid()` | **private** |
| opt_in_completed_seeker | receiving help | **private** |
| conversation_completed_requester | receiving help | **private** |
| review_received | reviews SELECT parties+admin only (not arbitrary users) | **private** (verified=true; feeds P3 via ledger, not the summary) |

Community badges: **Voice/Helper/Connector = public**; **Watcher + Advocate = private** (Watcher — the reporter is unmaskable via timestamp correlation; Advocate — petition signatures are signer-only). `conversation_completed` is split into `_volunteer` (public) and `_requester` (private). **18 kinds** total + reserved `appreciation_gift`.

## B2 — storage
- Public credit → `profiles.badge_summary` (recompute locks the profile row `FOR NO KEY UPDATE`, writes only on change, never writes an empty summary over NULL → `profiles.updated_at` untouched for public-empty users).
- Private credit → `user_private_badge_summary` (owner PK; RLS owner-SELECT only; `REVOKE ALL` + `GRANT SELECT` to authenticated; no client write policy; **not** in `supabase_realtime`; no FK/embed path). Recompute locks the private owner row `FOR NO KEY UPDATE`; **writing private credit never touches profiles**.
- `user_engagement_counters` gains a `scope` column (`public`/`private`, in the PK); one event bumps only its scope's counters and recomputes only that scope's summary. `recompute_user_engagement` rebuilds BOTH scopes from the ledger; incremental == full for both (proven).

## B3 — verified / P3 unaffected
Verified facts may be public (`safety_alert_verified`, `resource_approved`) or private (`review_received`). P3 eligibility reads the ledger server-side (`verified=true`), never a summary.

## UI
Own-profile view shows public **Community Badges** plus a **"Private — only you can see this"** section (from `user_private_badge_summary`, fetched only when `isOwnProfile`). Other viewers see public badges only. Pure mapper (`summaryToBadgeList`) is scope-agnostic; unit-tested for public and private inputs.

## Predicted prod backfill (re-derived; superseded by the round-3 figure below)
See "Round-3 — corrected backfill" at the end of this document. Under A1/A2 + the round-3 privacy fix (`safety_alert_verified` now private), the public backfill is **0 rows** and the single `safety_alert_verified` credit lands in the private ledger, below the level-1 threshold.

---

# P2.1a — Round-3 (privacy audit against COLUMN grants, deadlock, oracle) [authoritative]

Verified on PG15 (15.19) + PG17 (17.7), migration applied twice; a1a2 / conc / oracle / state26 / race2 / dbl / i1 / i5 / i7 / ab all green.

## Fix 1 — safety_alert_verified is PRIVATE (column-grant audit, B1)
B1 visibility covers COLUMN grants, not just row RLS. The corrected audit of every PUBLIC kind's actor↔target link (live grants):

| kind | actor column | readable by another user? | verdict |
|---|---|---|---|
| like | post_likes.user_id | table SELECT grant (relacl `r`) + RLS `USING true` | public ✓ |
| poll_vote | poll_votes.user_id | table SELECT grant + RLS `USING true` | public ✓ |
| comment | post_comments.user_id | table SELECT grant + RLS `NOT is_hidden` | public ✓ |
| follow | follows.follower_id | table SELECT grant + RLS `USING true` | public ✓ |
| post_created | posts.user_id | column grant `{anon=r,authenticated=r}` (posts table has no table SELECT, but user_id is column-granted) | public ✓ |
| opt_in_completed_provider | posts.user_id (author) | author is public; badge is an aggregate, actor not hidden | public ✓ |
| conversation_completed_volunteer | volunteer (helping) | helping-others signal; actor not hidden | public ✓ |
| resource_approved | resources.submitted_by | table SELECT grant (relacl `r`) → submitted_by readable on approved rows | public ✓ |
| **safety_alert_verified** | **safety_alerts.created_by** | **NO grant** (table relacl lacks `r`, created_by attacl NULL) while **verified_at IS granted** → a public write bumps `profiles.updated_at`, and anyone can join `profiles.updated_at = verified_at` to unmask the hidden reporter | **PRIVATE** ✗→moved |

`safety_alert_verified` is the only kind whose actor is hidden yet correlatable via a granted timestamp, so it moves to private (Watcher → private badge). **Regression** (`oracle.sql`): after admin verifies a reporter's alert, an authenticated observer joining `profiles.updated_at = safety_alerts.verified_at` finds NO reporter row — `profiles.updated_at` and `badge_summary` are unchanged (private credit never touches profiles).

## Fixes 2–8
2. **Smoke 26 / state26** trigger list corrected: `posts/trg_engagement_post_created` removed, `resource_opt_ins/trg_engagement_opt_in_insert` (INSERT bit) added → 16 triggers; asserts `credit_post_created` not executable by anon/authenticated. state26 on a migrated cluster matches every expected value (both versions).
3. **Deadlock**: every trigger path that may credit two profiles calls `lock_two_profiles(a,b)` (uuid order, `FOR NO KEY UPDATE`) BEFORE recording — applied to like/comment/poll_vote (actor + author via post_created) and the two-party completions. `conc.sh` C2 cross-like: 0 deadlocks, all credits present, both versions. Private owner rows use the same `FOR NO KEY UPDATE` discipline.
4. **Reconcile ⇔ live post_created parity**: qualifying outside engagement = like, NON-HIDDEN comment, **poll vote**, or opt-in — identical in the live triggers and reconcile's EXISTS. `a1a2.sql`: poll-only post → post_created=1 (live and reconcile); hidden-comment-only → 0 (both). Migration header line fixed.
5. **Public summary = levels only** (no raw counts), rewritten only when a level changes; the private summary keeps counts. UI mapper + tests updated (`BadgeEntry.count` optional; public badges carry no count).
6. **Petition self-sign**: `signer_id <> petitions.created_by` in both trigger and reconcile (`a1a2`: creator self-sign → 0).
7. **Nightly reconcile** carries `SET lock_timeout='5s'` on the function; no batching (8 users). **Scaling note**: at ~10k users a full `reconcile_engagement(NULL)` scan is the known cost point — revisit with per-user batching or an incremental cursor then; not needed now.
8. **LOW-8 (by design)**: engagement credit SURVIVES source moderation/deletion (unlike/unpost/hide after credit) — awards never disappear. Consequence: a destructive `delete engagement_events; reconcile` does NOT recreate credits whose source rows were since deleted (reconcile derives from CURRENT source); the nightly job is ADDITIVE-only and never removes credits, so this is not reachable in production. `a1a2` shows this as "only-in-live" rows for a post whose like/comment were deleted after crediting — expected, and orthogonal to the poll-only/hidden-comment parity (fix 4).

## Round-3 — corrected backfill = **0 public rows**
Under A1/A2 + `safety_alert_verified` now private (measured live 2026-09-23): the single prod `like`/`poll_vote`/`safety_alert_vote` are self-interactions (A1 → 0); the 2 posts have no outside engagement (A2 → 0 `post_created`); all 12 approved user-submitted resources are self-approved (0 `resource_approved`); the one peer-verified alert credits **`safety_alert_verified` into the PRIVATE ledger** for its reporter (count 1, below the level-1 threshold of 3 → invisible in the private summary too). Net public backfill = **0 rows**; net private = 1 ledger row / 1 counter, sub-threshold.

---

# P2.1b — AS BUILT (wave feed-fullfeed-p2-1b-appreciation)

**Migration:** `supabase/migrations/20261006000000_p2_1b_appreciation.sql`. Validated against
prod (`ndtpovonpadugthmcntl`, PG 17.6) inside a single `BEGIN; … ROLLBACK;` on 2026-09-23 —
the migration applied cleanly and the `give_appreciation` calls exercised I1/I2/I3/I6.

## The gift model (USER RULING: "Appreciated" counts distinct PEOPLE, not gifts)
A giver sends one of **12 items** — `heart, smile, cheer, flower, sunflower, leaf, bread,
apple, soup, sun, seedling, tree` — to another member via the SECDEF RPC
`give_appreciation(p_receiver, p_item, p_post_id?)`. Rows live in `public.appreciation_gifts`
(`giver_id`, `receiver_id`, `item`, optional `post_id`), `UNIQUE(giver_id, receiver_id, item)`,
`CHECK giver_id <> receiver_id`, `CHECK item IN (…12…)`. All 12 items stay individually
giftable and all show on the receiver's private shelf. `giver_id`/`receiver_id` →
`profiles(id) ON DELETE CASCADE` (enables the receiver-shelf embed AND lets account deletion
cascade, since `profiles.id → auth.users ON DELETE CASCADE`); `post_id → posts ON DELETE SET
NULL` (gifts are permanent). The RPC validates caller non-null + non-guest + not-self +
**recipient exists AND is non-guest** (a guest receiver is rejected with the SAME generic
`Recipient not found` as a nonexistent recipient — MEDIUM-2, no guest-status oracle) + item
valid; the optional `p_post_id` is **pure context** — if the referenced post is missing,
hidden, or not authored by the recipient the RPC **silently drops it** (`p_post_id := NULL`)
so a valid gift always succeeds regardless of the post's visibility (LOW-1), and missing /
hidden / wrong-author are indistinguishable (no post oracle). It inserts `ON CONFLICT DO
NOTHING`; and on a NEW gift row records the receiver's ledger credit inline (same transaction —
the gift is the core write, so it fails loudly / rolls back atomically).

## Public/private split (user ruling)
- **PUBLIC:** the earned community-badge **LEVEL** "Appreciated" (`badge:appreciated`,
  thresholds 3/10/25 from `badge_config`, level only, no count) on `profiles.badge_summary`.
  `engagement_is_public('appreciation_gift') = true`; `engagement_community_dim(…) =
  'badge:appreciated'`.
- **PRIVATE (the edge):** *who gave which item to whom* lives ONLY in `appreciation_gifts`,
  RLS-restricted to the two parties (`giver_id = auth.uid() OR receiver_id = auth.uid()`). No
  view, grant, SECDEF function, or realtime publication exposes a giver→receiver edge to a
  third party. The receiver reads their own shelf (per-item counts + giver names) via the
  RLS-scoped SELECT + a `profiles!appreciation_gifts_giver_fk` embed; the giver reads only
  their own sent rows (to mark already-sent items in the picker).

### `profiles.updated_at` timing channel — evaluated, acceptable
A public credit calls `recompute_badge_summary(receiver)`, which rewrites `badge_summary` and
bumps `profiles.updated_at` **only when the receiver's Appreciated LEVEL changes** (at 3/10/25),
never per gift, and the write carries no giver identity. `appreciation_gifts.created_at` is not
readable by a third party (RLS), so it cannot be joined to `updated_at` — unlike the P2.1a
`safety_alert_verified` case, where a *granted* `verified_at` equalled the bump and unmasked the
reporter (that kind stayed private for exactly this reason). The Appreciated bump is
indistinguishable from every other public badge threshold crossing (Voice/Helper/Connector).
**Conclusion: no new giver→receiver channel; acceptable without mitigation.**

## Ledger key = the GIVER (realises P2.1a reserved line 71; USER RULING)
The P2.1a header reserved `appreciation_gift` as `actor=recipient, target=giver, private`.
**This wave:** `actor = receiver`, **`target_id = giver_id`**, `kind = appreciation_gift`,
weight 1, family none, community `badge:appreciated`, **PUBLIC (level only)**.
The ledger `UNIQUE(actor_id, kind, target_id) = (receiver, appreciation_gift, giver)` makes the
FIRST gift from a giver the only counted event; every later gift from the same giver still
creates its gift row (all 12 items giftable) but is an `ON CONFLICT` no-op credit. So the public
`badge:appreciated` counter = **the number of distinct non-guest givers**, exactly once per
(receiver, giver) — never per item, never zero for a giver who gave. `source_pk` is
deterministic per pair (`receiver:giver`). `reconcile_engagement`'s `appreciation_gifts` loop
iterates **DISTINCT (receiver_id, giver_id)** and writes the byte-identical row, so a
wipe-ledger→reconcile rebuild reproduces the same counters+summary (verified in-txn: A gives B
heart+smile+leaf → B's counter 1; C gives B → 2; wipe+reconcile → identical). The classifier
`CREATE OR REPLACE`s leave every P2.1a kind's public/private verdict unchanged.

## Account deletion of a giver — awards never disappear (I3a)
`engagement_events.target_id` has **no FK** (bare uuid), so deleting a giver's account —
which CASCADEs their `profiles` row and thus their `appreciation_gifts` rows away — does NOT
delete the receiver's credit (keyed `actor=receiver, target=giver`). The counter is derived
from the surviving ledger row, so it is stable. `reconcile_engagement` is **additive-only**
(`ON CONFLICT DO NOTHING`; it never DELETEs a ledger row), consistent with every other kind
(P2.1a Round-3 fix 8 / LOW-8 — a like/comment credit likewise survives its source's deletion
because reconcile only inserts). The nightly job therefore never drops a deleted-giver credit;
the only path that would is a test-only "wipe the ledger then rebuild from current source"
harness, unreachable in production. Documented choice: production honours "awards never
disappear"; reconcile-from-source is inherently limited to surviving source rows, like every
other kind.

## Client surfaces (click paths)
- **Feed author row** (`components/panels/feed-panel.tsx` PostCard): `FEED_POST_SELECT` now
  embeds `badge_summary`; a compact **top-3 public badge strip** (`AuthorBadgeStrip`,
  `topBadgesByLevel`) renders after `HarmonyBadge`. The author avatar/name are buttons that
  open the **profile sheet** (`components/appreciation/appreciation-sheet.tsx`): name, avatar,
  Harmony, full public badge list (`EngagementBadges` public mode), Follow (reusing the feed's
  `doFollow`/`doUnfollow`), and — for a signed-in, non-guest, non-self viewer — an **Appreciate**
  button opening the **12-item picker** (`PixelItemIcon` hand-authored pixel art). Already-sent
  items show a check + are disabled; a single-flight `useRef` gate blocks double-submit; each
  give is optimistic and settles from the RPC result; failures show an inline error. Guests see
  the sheet with a `CreateAccountPrompt` in place of the picker (matching Follow's guest gating).
- **Settings → Profile** (`components/panels/settings-panel.tsx`): a **Gifts received** shelf
  (`GiftsReceivedShelf`) under the badges card — each received item with icon, count, and
  (owner-only) giver names; empty / loading / error+Retry states mirror the badges card.
- Shared client lib `lib/appreciation.ts` (12 items single source + `giveAppreciation`,
  `listSentTo`, `aggregateShelf`/`myReceivedShelf`, each `AbortSignal.timeout(12s)`, error≠empty).
  `lib/engagement-badges.ts` adds `appreciated` to `COMMUNITY_META` (icon `Gift`, `#9a6a1f`) so
  `summaryToBadgeList` no longer drops it, plus `topBadgesByLevel`.

**Smoke:** `apps/web/src/__tests__/smoke/27-p2-1b-appreciation.smoke.ts` (gated on ledger row
`20261006000000`): table + RLS + no client writes (relacl + attacl), SECDEF+pinned RPC,
authenticated-only EXECUTE, the 3 CHECKs, `appreciation_gift` public + dim `appreciated`, no
realtime, no view leaks the edge, reconcile stays locked, and the P2.1a like/watcher verdicts
are undisturbed.
