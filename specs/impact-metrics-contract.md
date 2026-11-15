# Community impact v1 — data contract

Owner: Jelal Connor / SYNRG SCALING, LLC

Canonical copy: `specs/impact-metrics-contract.md`. Author of the SQL: feed-db-migrations-expert, in one migration
(`supabase/migrations/20261027500000_community_impact_v1.sql`; proof `supabase/tests/community_impact.smoke.sql`). The client (`apps/web/src/hooks/use-community-impact.ts`,
`apps/web/src/components/layout/impact-overview-card.tsx`) is built against section 5 of this file.
Live figures below were read through the read-only Management API (`current_user = supabase_read_only_user`) on
2026-11-15 03:33 UTC against prod `ndtpovonpadugthmcntl`, at origin/develop `5973158`.

What a visitor or member gets: the "Impact overview" card under every panel shows what the FEED directory
holds (in full) and each community figure either as a rounded count from enough people or as the line
"Not enough activity yet to share". The card is titled **Community reach** until at least one outcome figure is
shown, then **Community impact**.

Owner rulings carried here: staff and admin accounts are counted (every figure, no role filter); impact history
is kept after account deletion (section 3).

## 1. Rules every figure follows

| Rule | Value |
|---|---|
| k for a people-derived figure | shown only when **10 or more distinct member accounts** contribute (`k = 10`); live distinct members + member accounts carried at deletion |
| k for a household sum | **20 confirmed visits** (FEED's `community_people_fed` floor) **and** 10 distinct identities. An identity is a confirmed visit's `household_key`, or else its member account. A visit with neither (an anonymous walk-in, or a visit whose account was deleted) adds to the visits and to the sum, never to the identities. A deleted member's identity is carried once (section 3) |
| Rounding of a shown people-derived figure | down to a multiple of 5: `n - n % 5` (10..14 shows 10) |
| Suppressed answer | `{ "value": null, "suppressed": true, ... }`; the count never leaves the database |
| Catalog figures | describe the directory, not people: shown in full, `suppressed` always `false`, no rounding |
| Staff / admin accounts | **included** in every figure (owner ruling); there is no role predicate anywhere |
| Guest accounts (`auth.users.is_anonymous`) | add to every **value**, never to **k** (orchestrator decision b, 2026-11-15): guest accounts cost nothing to create, so they cannot open a figure. A guest who becomes a member counts from then on |
| Anonymous walk-ins | add to visits and to the sum, never to the identities (orchestrator decision a, 2026-11-15): a walk-in has no identity to be distinct, and counting each one let a single organizer open the figure and read another household's size from the rounding steps |
| Windows | v1 has no windowed people figure. The only windowed figure is a catalog one (event dates ahead). A future windowed people figure is shown only when the window **and** the remaining all-time figure each reach k |
| Account deletion | never lowers a figure or its k: what an account deletion takes away (ledger rows, the account, a member's event identity) is carried as counts (section 3) |

## 2. Figures

`id` is the JSON key and the client dictionary key (`impactMessages[locale].<labelKey>`).

| id | Reach / Impact | Source (table, rule) | Unit | Contributors used for k | k | Rounding | History unit |
|---|---|---|---|---|---|---|---|
| `resources_available` | Reach | `resources`, `status = 'approved'`, `count(*)` | resources | — (catalog) | none | none | live only (catalog) |
| `resources_curated` | Reach | `resources`, `status = 'approved' AND source NOT IN ('imls','hud')`, `count(*)` | resources | — | none | none | live only |
| `snap_retailers` | Reach | `snap_retailers`, `count(*)` | retailers | — | none | none | live only |
| `zip_codes_covered` | Reach | `resources`, `status = 'approved'`, `count(DISTINCT zip_code) WHERE nullif(btrim(zip_code),'') IS NOT NULL` | ZIP codes | — | none | none | live only |
| `organizations_listed` | Reach | `organizations`, `is_active AND status = 'approved'`, `count(*)` (businesses and local organizations) | organizations | — | none | none | live only |
| `event_dates_next_30_days` | Reach | `event_occurrences o JOIN assistance_events e ON e.id = o.event_id`, `e.is_active AND o.status = 'upcoming' AND o.starts_at >= now() AND o.starts_at < now() + interval '30 days'`, `count(*)` | event dates (scheduled, not yet held) | — | none | none | live only (`window = next_30_days`) |
| `petition_signers` | Reach | ledger `engagement_events.kind = 'petition_signature'` (one row per signer and petition; trigger-written) | people (one per account) | distinct **member** signers: `count(DISTINCT actor_id)` of non-guest actors + carried `k_contributors`; the value is all distinct signers (guests included) + carried `contributors` | 10 | `n - n % 5` | carried counts |
| `needs_met` | Impact (provider-reported) | ledger `kind = 'opt_in_completed_seeker'` (one row per completed opt-in; written when the provider marks it completed, `accepted -> completed`) | completed opt-ins | distinct **member seekers**: non-guest `count(DISTINCT actor_id)` + carried `k_contributors` | 10 | `n - n % 5` | carried counts |
| `people_served_at_events` | Impact | `event_checkins`, `status = 'confirmed'`, `coalesce(sum(household_size), 0)` | people in the households checked in | visits `count(*)` ≥ 20 **and** identities ≥ 10: `count(DISTINCT CASE WHEN household_key IS NOT NULL THEN 'k:'||household_key WHEN user_id IS NOT NULL AND NOT is_anonymous THEN 'u:'||user_id END)` + carried `k_contributors` | 20 / 10 | `n - n % 5` | visits and sum live (check-ins survive account deletion, `user_id ... ON DELETE SET NULL`); a deleted member's identity carried |
| `alerts_verified` | Impact | ledger `kind = 'safety_alert_verified'` (written when a moderator other than the reporter verifies) | alerts | distinct **member reporters**: non-guest `count(DISTINCT actor_id)` + carried `k_contributors` | 10 | `n - n % 5` | carried counts |
| `member_resources_approved` | Impact | ledger `kind = 'resource_approved'` (a member-submitted resource approved by someone other than the submitter) | resources | distinct **member submitters**: non-guest `count(DISTINCT actor_id)` + carried `k_contributors` | 10 | `n - n % 5` | carried counts |

Notes per figure (also the "How we count" copy in the client):
- `resources_available` includes bulk-imported public-library (IMLS, 17,582) and HUD housing (1,358) listings.
  `resources.is_verified` means "came from a trusted feed", so no label says "verified resources".
- `needs_met` is reported by the person who gave the help; the seeker does not confirm it (`resource_opt_ins`
  update is author-only). The label says "reported by the helper".
- `people_served_at_events` counts confirmed check-ins only (early check-ins are not counted).
- `event_dates_next_30_days` are scheduled dates, not delivered events.
- For ledger figures the value `n` is `count(*)` of live ledger rows of that kind plus the carried `count`;
  for `petition_signers` the value is the number of distinct signers (guests included, live + carried `contributors`);
  k counts member accounts only (section 1).

Why ledger rows: one row per (actor, kind, target) (`engagement_events_once`), written only by server triggers,
self-actions excluded, so repeat clicks and actions on one's own content add nothing
(`supabase/migrations/20261005000000_p2_1a_engagement.sql:173-191`, `:831-856`).

## 3. History that survives account deletion — `community_impact_rollup`

Every people-derived ledger figure reads `engagement_events`, whose `actor_id` is `ON DELETE CASCADE`
(`20261005000000_p2_1a_engagement.sql:173`). Accounts are deleted by members and, every night, by the cron job
`cleanup-anonymous-users` (`0 3 * * *`, `DELETE FROM auth.users WHERE is_anonymous IS TRUE AND created_at < now() - interval '30 days'`).
Without a carry, every figure a guest contributed to falls 30 days later.

The carry is written **at deletion time, in the deleting transaction**:

```sql
CREATE TABLE public.community_impact_rollup (
  metric_id       text        NOT NULL,   -- 'petition_signers', 'needs_met', 'alerts_verified', 'member_resources_approved', 'people_served_at_events'
  period_start    date        NOT NULL,   -- first day of the UTC month of the carried rows / visits
  period_end      date        NOT NULL,   -- first day of the next month (exclusive)
  count           bigint      NOT NULL DEFAULT 0 CHECK (count >= 0),            -- carried ledger rows
  contributors    bigint      NOT NULL DEFAULT 0 CHECK (contributors >= 0),     -- carried accounts (guests included)
  k_contributors  bigint      NOT NULL DEFAULT 0 CHECK (k_contributors >= 0),   -- carried member accounts / identities
  written_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_id, period_start),
  CHECK (metric_id IN ('petition_signers','needs_met','alerts_verified','member_resources_approved','people_served_at_events')),
  CHECK (period_end > period_start),
  CHECK (k_contributors <= contributors)
);
ALTER TABLE public.community_impact_rollup ENABLE ROW LEVEL SECURITY;   -- no policies: no client reads or writes
REVOKE ALL ON public.community_impact_rollup FROM PUBLIC, anon, authenticated;
```

No user id, no target id, counts only. Read only through `community_impact_summary()`.

Writer — one row-level BEFORE DELETE trigger on `auth.users` (the only writer):

```sql
CREATE FUNCTION public.community_impact_carry_departed()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ ... $$;
REVOKE ALL ON FUNCTION public.community_impact_carry_departed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_community_impact_carry_departed
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.community_impact_carry_departed();
```

Why here (2026-11-15, review finding P3): every deletion path is a `DELETE FROM auth.users` (the member's
`delete-account` function, the admin delete route, the nightly guest cleanup). Before the row goes, the account's
ledger rows, its check-ins and its `is_anonymous` flag are all readable; after it, the flag is gone, so an AFTER
trigger on `engagement_events` or `event_checkins` cannot tell a guest from a member. Postgres also refuses transition
tables on a trigger with a column list (`AFTER UPDATE OF user_id ... REFERENCING`), measured.

Body rule, for the deleted account `OLD`:
1. Its ledger rows of a carried kind (`petition_signature -> petition_signers`, `opt_in_completed_seeker -> needs_met`,
   `safety_alert_verified -> alerts_verified`, `resource_approved -> member_resources_approved`), which
   `ON DELETE CASCADE` is about to remove: per (metric, month of `created_at`) `count += rows`; per metric
   `contributors += 1` in the month of its earliest row of that kind.
2. Its event identity: if it has a confirmed visit with no `household_key` (its identity is the account, which
   `ON DELETE SET NULL` erases), `people_served_at_events` gets `contributors += 1` in the month of its earliest such
   visit. The visits and their sum stay live; a visit with a `household_key` keeps its identity and carries nothing.
3. `k_contributors` receives the same `+1` only when `OLD.is_anonymous` is not true: a guest's rows add to values, its
   account to no k, before and after the nightly guest cleanup alike.
4. `INSERT ... ON CONFLICT (metric_id, period_start) DO UPDATE` adding `count`, `contributors`, `k_contributors`.
5. A failure inside the carry must not block an account deletion: `BEGIN ... EXCEPTION WHEN OTHERS` calls
   `public.log_engagement_failure('impact_carry', SQLERRM)` and the trigger returns `OLD`.

Exactly once: the trigger runs once per deleted `auth.users` row; a delete that finds no row (the same path firing
twice) runs none. A deleted account is never live again, so live + carried is the exact count. The preflight refuses
if any other BEFORE DELETE row trigger exists on `auth.users` (one could cancel a deletion after the carry ran).
Rows deleted for any other reason (a direct ledger delete, an event deleted with its check-ins) are not carried.
Catalog figures are not about people.

### Scheduled job

**None in v1.** Every write happens inside the transaction that deletes the account, so the carry is never late,
never missing, and never runs twice. A monthly snapshot job (the evidence's first sketch) was compared and not
chosen: it would give all-time people figures only as person-periods (distinct people cannot be re-derived from
per-month counts), leave the current month unprotected until close, and add a cron job plus a backfill.
The `period_start` key keeps the carried counts monthly, so a per-month view can be added with no table change if
one is asked for. Decision recorded for the orchestrator in the build report.

### Tables not used (candidates to drop in P7, owner's words needed)

| Table | Why not used | Proposed P7 action |
|---|---|---|
| `impact_metrics` | environmental columns (`trees_planted`, `waste_reduced_kg`, `co2_saved_kg`); RLS lets members insert and update their own rows, so any figure in it could be forged; 0 rows; no reader or writer | `DROP TABLE public.impact_metrics;` |
| `community_stats` + `refresh_community_stats()` | labels are wrong (`resources_accessed` counts resources created; `active_users` counts `profiles.updated_at`, bumped by badge recomputes); anyone may SELECT; 0 rows; no caller, no cron job | `DROP FUNCTION public.refresh_community_stats(); DROP TABLE public.community_stats;` |

Both stay until the owner authorizes the drop.

## 4. The RPC — `community_impact_summary()`

```sql
CREATE FUNCTION public.community_impact_summary()
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$ ... $$;
REVOKE EXECUTE ON FUNCTION public.community_impact_summary() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.community_impact_summary() TO anon, authenticated;
```

- No arguments. Callable by a logged-out visitor (`anon`), a guest (anon-auth, role `authenticated`) and a member.
  The card renders under every panel at `/`, which `proxy.ts` serves to logged-out visitors, so `anon` needs EXECUTE.
  Nothing in the answer depends on who calls.
- `SECURITY DEFINER` reads the source tables as the owner; the caller gains no table privilege and the answer
  carries counts and flags only. `anon` keeps no SELECT on `community_impact_rollup` or `engagement_events`.
- Suppression and rounding happen inside the function; a suppressed figure's count is never returned.

Return shape — one JSON object keyed by figure id, every id in section 2 always present:

```jsonc
{
  "resources_available":       { "value": 19121, "suppressed": false, "unit": "resources",     "window": "all_time" },
  "resources_curated":         { "value": 181,   "suppressed": false, "unit": "resources",     "window": "all_time" },
  "snap_retailers":            { "value": 251574,"suppressed": false, "unit": "retailers",     "window": "all_time" },
  "zip_codes_covered":         { "value": 16704, "suppressed": false, "unit": "zip_codes",     "window": "all_time" },
  "organizations_listed":      { "value": 2,     "suppressed": false, "unit": "organizations", "window": "all_time" },
  "event_dates_next_30_days":  { "value": 5,     "suppressed": false, "unit": "event_dates",   "window": "next_30_days" },
  "petition_signers":          { "value": null,  "suppressed": true,  "unit": "people",        "window": "all_time" },
  "needs_met":                 { "value": null,  "suppressed": true,  "unit": "completions",   "window": "all_time" },
  "people_served_at_events":   { "value": null,  "suppressed": true,  "unit": "people",        "window": "all_time" },
  "alerts_verified":           { "value": null,  "suppressed": true,  "unit": "alerts",        "window": "all_time" },
  "member_resources_approved": { "value": null,  "suppressed": true,  "unit": "resources",     "window": "all_time" }
}
```

`value` is a JSON integer when `suppressed` is `false` and `null` when `true`. `unit` and `window` are the closed
vocabularies shown above.

Body outline (for one ledger figure; the others follow the table in section 2):

```sql
SELECT count(*), count(DISTINCT e.actor_id) FILTER (WHERE u.is_anonymous IS NOT TRUE) INTO n_live, d_live
  FROM engagement_events e JOIN auth.users u ON u.id = e.actor_id WHERE e.kind = 'opt_in_completed_seeker';
SELECT coalesce(sum(count),0), coalesce(sum(k_contributors),0) INTO n_carried, d_carried
  FROM community_impact_rollup WHERE metric_id = 'needs_met';
n := n_live + n_carried;  d := d_live + d_carried;
v := v || jsonb_build_object('needs_met', jsonb_build_object(
       'value', CASE WHEN d >= 10 THEN to_jsonb(n - n % 5) ELSE 'null'::jsonb END,
       'suppressed', d < 10, 'unit', 'completions', 'window', 'all_time'));
```

Cost: the candidate aggregate measured 46 ms execution + 31 ms planning live (EXPLAIN ANALYZE, read-only, evidence
section 4); the client calls it once per shell mount. `engagement_events` has an index on `actor_id`; an index on
`(kind, actor_id)` is the migration author's call after reading the plan. Not added in v1: prod holds 3 ledger rows, the
read's cost is the `snap_retailers` and `resources` counts, and the index would add a write to every ledger insert.

## 5. Client mapping

```ts
// apps/web/src/lib/community-impact.ts
export const IMPACT_FIGURE_IDS = ['resources_available', 'resources_curated', 'snap_retailers', 'zip_codes_covered',
  'organizations_listed', 'event_dates_next_30_days', 'petition_signers', 'needs_met', 'people_served_at_events',
  'alerts_verified', 'member_resources_approved'] as const
export type ImpactFigureId = (typeof IMPACT_FIGURE_IDS)[number]
export interface ImpactFigure { value: number | null; suppressed: boolean; unit: string; window: 'all_time' | 'next_30_days' }
export type ImpactSummary = Partial<Record<ImpactFigureId, ImpactFigure>>
```

- Outcome ids (title switch to "Community impact" when any of them is shown): `needs_met`,
  `people_served_at_events`, `alerts_verified`, `member_resources_approved`.
- A figure renders its number only when `suppressed === false` and `value` is a finite number; anything else
  renders the suppressed line. Unknown ids are ignored; a missing id is not rendered.
- Dictionary: `lib/i18n-impact.ts`, label key = `label_<id>` (e.g. `label_needs_met`).
- After the migration, regenerate `packages/database/types.ts`; the hook then calls `supabase.rpc('community_impact_summary')`
  with the generated name (the step-1 cast is gone; `types.ts` carries `community_impact_summary` and `community_impact_rollup`).

## 6. Proof expected from the migration (SQL smokes, each an outcome)

Run in a rolled-back transaction on a disposable database (native Postgres 17 or the branch database; no Docker
unless the owner asks), plus the live read-only checks marked *prod*.

| # | Outcome | How |
|---|---|---|
| a | A logged-out visitor can call the RPC and reads no raw row through it | `SET ROLE anon; SELECT community_impact_summary();` returns the object; `SELECT * FROM community_impact_rollup`, `engagement_events` as anon both fail `42501` or return 0 rows; the answer's keys are exactly section 2's ids and each value object has exactly `value, suppressed, unit, window` |
| b | 9 distinct people: suppressed; 10: shown, rounded down to 5 | seed 9 accounts with `opt_in_completed_seeker` rows (some with 2 rows each, n = 13): `needs_met = {value:null, suppressed:true}`; add a 10th account (n = 14): `{value:10, suppressed:false}`; n = 15 shows 15 |
| b2 | One person cannot pass k alone | one account with 40 ledger rows of one kind: suppressed |
| b3 | Household floor | 19 confirmed visits from 19 households: `people_served_at_events` suppressed; 20 visits from 20 households: shown, `sum(household_size)` rounded down to 5; 25 visits from 1 household: suppressed |
| c | Deleting a contributing account leaves every all-time figure unchanged | 12 contributors, read the RPC; `DELETE FROM auth.users WHERE id = <one contributor>` (also via the guest-cleanup statement for an anonymous contributor); read again: identical JSON; `community_impact_rollup` holds the carried count and 1 contributor in the right month |
| c2 | Rows deleted for another reason are not carried | delete a live actor's ledger row directly: no rollup change |
| p2 | Anonymous walk-ins open nothing and reveal nothing | 19 walk-ins + 1 member household: suppressed, value null; 30 more size-1 walk-ins one at a time: the answer never changes |
| p3 | A deleted account's visits never become many households | one member with 20 visits deletes the account: still suppressed; 1 identity carried; members deleted in one statement, two statements and repeats: JSON identical |
| sybil | Guest accounts add to values, never to k | 9 members + 20 guests: suppressed; +1 member: shown with the guests' rows in the value; the guest cleanup cron: JSON identical, carried k 0 |
| c3 | Re-running cannot double-count | delete two accounts in one statement and in two statements: carried totals equal the rows removed, each account counted once |
| d | EXECUTE is revoked from PUBLIC and search_path is pinned (*prod* after apply) | `SELECT proacl, proconfig, prosecdef FROM pg_proc WHERE proname = 'community_impact_summary'`: `proacl` has no `=X/` (PUBLIC) entry, has `anon=X` and `authenticated=X`; `proconfig = {search_path=public, pg_temp}`; `prosecdef = true`; same `proconfig`/`prosecdef` and no anon/authenticated EXECUTE on `community_impact_carry_departed` |
| e | The rollup table is closed to clients (*prod*) | `relrowsecurity = true`, no row in `pg_policies` for it, `relacl` has no anon/authenticated grant |
| f | Staff and admin rows count | an admin account's ledger rows contribute to `d` and `n` like any other |
| g | Catalog figures are exact (*prod*) | RPC values equal the section 7 counts read directly the same minute |

## 7. Under today's prod data (2026-11-15 03:33 UTC)

| id | Live source reading | Shown today |
|---|---|---|
| `resources_available` | 19,121 approved (17,582 imls, 1,358 hud, 134 admin_added, 45 osm, 2 user_submitted) | **19,121** |
| `resources_curated` | 181 | **181** |
| `snap_retailers` | 251,574 | **251,574** |
| `zip_codes_covered` | 16,704 non-blank (16,705 counting one blank string) | **16,704** |
| `organizations_listed` | 2 (1 business, 1 local organization) | **2** |
| `event_dates_next_30_days` | 5 (of 26 upcoming) | **5** |
| `petition_signers` | 2 rows, 1 distinct signer | suppressed |
| `needs_met` | 0 | suppressed |
| `people_served_at_events` | 0 confirmed visits | suppressed |
| `alerts_verified` | 1 row, 1 reporter | suppressed |
| `member_resources_approved` | 0 (all 12 approved submissions were self-approved by admins) | suppressed |

Card title today: **Community reach** (no outcome figure passes k). Six directory figures show in full; five
community figures show "Not enough activity yet to share" and turn into numbers on their own once 10 people
contribute, with no new release.
