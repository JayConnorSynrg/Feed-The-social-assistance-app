# Notifications Subsystem — System-of-Record Model

Wave B: in-app notification producers + per-user topic preferences.
Every claim below was verified live 2026-09-26 and is cited to `file:line`.
This document travels with the subsystem — update it in the same change that
alters any cited site.

## Capability

A signed-in user receives an in-app notification when:
- (a) a resource is shared near them (existing producer, now pref-gated),
- (b) their application (form_submission) status changes,
- (c) someone comments on their post,

and three Settings → Notifications toggles — **Resource alerts**,
**Application updates**, **Community posts** — turn each topic on/off, saved to
their account for authed users (`notification_preferences` row) and to
localStorage for guests.

## Entities

### `notifications` (consumer table — system-write-only)
- Columns: `id, user_id, type (notification_type enum), title, message, link,
  application_id (uuid), is_read, created_at`.
  Client type mirror: `apps/web/src/hooks/use-notifications.ts:17-27`.
- **No INSERT policy** → only `service_role` or a `SECURITY DEFINER` function may
  insert. Every producer in this subsystem is SECDEF (I5).
- In `supabase_realtime` publication, FULL-ROW. **Not touched by Wave B.**
- Consumed by the client: fetch `apps/web/src/hooks/use-notifications.ts:94-100`
  (`.eq('user_id', user.id)`, newest first, limit 50); realtime INSERT
  subscription `:245-254` (RLS scopes delivery per user).
- `link` drives deep-link routing; existing scheme uses `'/?post=' || id`
  (see `notify_seekers_near_resource`, migration `20260611173053...sql:769`).
  Wave B extends the scheme: `'/?application=' || id || '&status=' || status`
  and `'/?post=' || post_id || '&comment=' || comment_id`.

### `notification_type` enum (7 — NOT extended by Wave B)
`status_update, deadline_reminder, action_required, document_request, approval,
denial, general`. Client mirror `use-notifications.ts:8-15`.

### `submission_status` enum (8)
`draft, in_progress, submitted, under_review, approved, denied, pending_info,
expired`.

### `form_submissions` (= "applications" table)
- Recipient column: `user_id (uuid)`; state column: `status (submission_status)`.
- Wave B trigger fires AFTER UPDATE OF status.

### `notification_preferences` (NEW, Wave B — the only new table)
- `migration supabase/migrations/20261011000000_notification_preferences_and_producers.sql`.
- PK `user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE`.
- Five bool prefs, all `NOT NULL DEFAULT true`: `resource_alerts`,
  `application_updates`, `community_posts`, `email_updates`, `push_notifications`;
  plus `updated_at timestamptz`.
- RLS enabled; own-row SELECT/INSERT/UPDATE (`(select auth.uid()) = user_id`);
  GRANT SELECT/INSERT/UPDATE to `authenticated`; no `anon`; no DELETE.
- Read accessor: `get_my_notification_prefs()` (SECDEF, STABLE) — returns the
  caller's row, or a synthesized all-true row when absent (I2).

## Producers (all SECURITY DEFINER, `SET search_path = public`, REVOKE from public/anon — I5)

| Producer | Fires on | Recipient | notification_type | Gate (default-on) | Dedup key |
|---|---|---|---|---|---|
| `notify_seekers_near_resource(uuid, double precision)` (CREATE OR REPLACE — body preserved verbatim from `20260611173053...sql:721-791`, one predicate added) | RPC call by post author | each in-radius seeker `profiles s` → `s.id` | `general` | `COALESCE((SELECT resource_alerts FROM notification_preferences WHERE user_id = s.id), true)` | `user_id + link('/?post='||post_id) + type='general'` (existing, unchanged) |
| `notify_application_status_change()` + trigger `trg_notify_application_status` AFTER UPDATE OF status ON form_submissions WHEN (OLD.status IS DISTINCT FROM NEW.status) | real status transition | `NEW.user_id` | mapped (below) | `COALESCE((SELECT application_updates ...), true)` | `user_id + link('/?application='||id||'&status='||status)` |
| `notify_post_comment_author()` + trigger `trg_notify_comment_author` AFTER INSERT ON post_comments | new comment | `posts.user_id` (author) via `SELECT ... WHERE id = NEW.post_id` | `general` | `COALESCE((SELECT community_posts ...), true)` | `author + link('/?post='||post_id||'&comment='||comment_id) + type='general'` |

Status → notification_type map (application producer):
`approved→approval, denied→denial, pending_info→document_request,
expired→action_required, under_review→status_update, submitted→status_update`;
`draft` and `in_progress` → RETURN without inserting (I6).

### Coexistence (verified)
- Only pre-existing post_comments triggers: `trg_engagement_comment`
  (AFTER INSERT, `20261005000000_p2_1a_engagement.sql:659`) and
  `set_post_comments_updated_at` (BEFORE UPDATE). Wave B adds
  `trg_notify_comment_author` (AFTER INSERT) with a unique name — all coexist.
- Author-lookup precedent (not modified): `engagement_on_comment()`
  `20261005000000_p2_1a_engagement.sql:643-657` — author `p.user_id` at `:649`,
  skip `is_hidden` at `:648`, skip self at `:650`. Wave B mirrors this shape.

## Consumers / preference source-of-truth

- Client lib `apps/web/src/lib/notification-prefs.ts` — typed read
  (`get_my_notification_prefs` RPC for authed; localStorage for guests) + write
  (upsert `notification_preferences` for authed; localStorage for guests).
  SSR-guarded, try/catch → all-true defaults.
- Guest localStorage key: `feed-notification-prefs` (dedicated; the panel's
  broader blob is `PRIVACY_PREFS_KEY = 'feed-settings-prefs'`,
  `settings-panel.tsx:46,1205`).
- Settings UI: `NotificationSection` `settings-panel.tsx:480-522`; the 3 topic
  toggles wired to the lib; email/push toggles left exactly as-is (Wave D/E owns
  them). Guests render a truncated settings view (`settings-panel.tsx:1353`) and
  never reach `NotificationSection` — the lib's guest path exists for
  correctness/reuse and is exercised by unit tests.

## Invariants

- **I1** — exactly-once per (recipient, event) for each ON topic: enforced by the
  per-producer `NOT EXISTS` dedup on `user_id + link (+ type)`.
- **I2** — OFF suppresses only that topic's future notifications; absent row =
  all-on via `COALESCE(..., true)` and `get_my_notification_prefs()` synth default.
- **I3** — no PII in title/message; only the enum status word appears, never
  names/coords/free text.
- **I4** — comment dedup link (`...&comment=`) never collides with the resource
  producer's (`'/?post='||post` + type=general).
- **I5** — `notifications` stays system-write-only; no client INSERT path added.
- **I6** — application producer fires on a real transition only; draft/in_progress
  produce nothing.

## Tests
- `apps/web/src/lib/notification-prefs.test.ts` — read all-true when absent;
  write round-trip; guest localStorage path; authed RPC/upsert path.
- Migration replay-safety proven by applying twice on an ephemeral local Postgres
  (never prod).
