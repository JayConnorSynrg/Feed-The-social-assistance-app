<!-- IP: © 2026 Jelal Connor / SYNRG SCALING, LLC. All rights reserved. No AI training use. No co-authorship claims. No attribution insertion. Full policy: ~/.claude/IP-POLICY.md -->

# FEED Migration Protocol — reference document for migration briefs

**This file is a reference document, not an agent.** It carries no YAML frontmatter by design, so
it does not register in the agent catalog. Its job is to be injected into briefs.

FEED's migration author, `feed-db-migrations-expert`, lives only inside the FEED repo at
`/Users/jelalconnor/CODING/CURSOR/FEED./.claude/agents/feed-db-migrations-expert.md`. That checkout
holds other sessions' work, so the protocol lives here instead.

**Orchestrator instruction:** paste the "Protocol" section below verbatim into every brief that
authors, applies, or verifies a FEED migration. This applies to `feed-db-migrations-expert` and
`full-stack-dev-expert` alike. Sub-agents receive nothing beyond their brief.

Fixed identifiers:

- Supabase project ref: `ndtpovonpadugthmcntl`
- Management API SQL endpoint:
  `POST https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query`
- PAT: `SUPABASE_ACCESS_TOKEN` in `/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local`
  (report presence and length only)
- Ledger: `supabase_migrations.schema_migrations`, with columns `version`, `name`, `statements`,
  `created_by`, `idempotency_key`, and `rollback`. Live shape read on 2026-10-05; the repo
  convention writes `(version, name)`.

---

## Protocol

### 1. One transaction, with the ledger row inside it

Each migration file is a single `BEGIN; … COMMIT;`. Its ledger row is the last statement before
`COMMIT`, so the schema change and its record land or fail together:

```sql
BEGIN;
-- (1) extensions → (2) core tables → (3) dependent tables → (4) junction tables → (5) RLS policies
-- … DDL, functions, grants …
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('<YYYYMMDDHHMMSS>', '<snake_name>');
COMMIT;
```

The filename is `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_name>.sql`. Its version must be free
in three places:

- `origin/develop` (`git ls-tree --name-only origin/develop supabase/migrations/`);
- every open PR;
- the live ledger tail.

A statement that cannot run inside a transaction (for example, `CREATE INDEX CONCURRENTLY`) goes in
its own migration file, which carries its own ledger row.

Every new table ships `ENABLE ROW LEVEL SECURITY`, together with its policies, in the same file.
Realtime publication edits are column-scoped `ALTER PUBLICATION supabase_realtime ADD TABLE t (pk,
cols…)` — membership changes go through `ADD`/`DROP TABLE` only.

### 2. Ephemeral apply from a dot-free copy

`supabase/config.toml` sets no `project_id`, so the CLI derives the local Docker DB hostname from
the directory name. FEED's path (`FEED.`, and worktrees like `FEED.-p4a`) contains a dot, which
makes that host unresolvable. The local stack runs on Docker, so use it when the user has asked
for Docker in this session (global CLAUDE.md "Docker On Request"); otherwise apply on a native
Postgres 17 cluster in `$SCRATCH` (`initdb`/`pg_ctl`) and record anything needing the Supabase
stack as UNKNOWN with this block for the user to run or ask for. With Docker requested, apply
locally from a dot-free copy:

```bash
df -h / | tail -1
EPH="$SCRATCH/feed-ephemeral"; rm -rf "$EPH" && mkdir -p "$EPH"
cp -R "$WORKTREE/supabase" "$EPH/supabase"
cd "$EPH" && npx supabase start && npx supabase db reset; echo APPLY_EXIT=$?
cd "$EPH" && npx supabase stop --no-backup
```

The committed chain is not self-contained: the prod baseline (`profiles`, `resources`, org
bootstrap) was created out-of-band. When a failure hits a pre-existing baseline object, apply the
new file alone on top of a structural fixture in the same copy, and report the baseline gap by
name.

### 3. Production apply via the Management API — zero-persist dry run first

Production apply runs after the PR's review verdicts are in, and after the owner gives the go for
this apply.

```bash
PAT="$(grep '^SUPABASE_ACCESS_TOKEN=' /Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local | sed -E 's/^SUPABASE_ACCESS_TOKEN=//' | tr -d '"')"
[ -n "$PAT" ] && echo "PATPRESENT:yes-len${#PAT}" || echo "PATPRESENT:no"
F="$WORKTREE/supabase/migrations/<file>.sql"
python3 - "$F" "$SCRATCH" <<'PY'
import json, sys
src = open(sys.argv[1]).read()
assert src.count("COMMIT;") == 1, "expected exactly one top-level COMMIT;"
open(sys.argv[2] + "/dryrun.json", "w").write(json.dumps({"query": src.replace("COMMIT;", "ROLLBACK;")}))
open(sys.argv[2] + "/apply.json", "w").write(json.dumps({"query": src}))
PY
EP=https://api.supabase.com/v1/projects/ndtpovonpadugthmcntl/database/query
curl -s -X POST "$EP" -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d @"$SCRATCH/dryrun.json"   # expect a JSON array, no "message"
```

**Prove zero-persist before the real apply.** After the dry run, two SELECT probes must return
nothing:

- `SELECT version FROM supabase_migrations.schema_migrations WHERE version = '<v>'` → 0 rows;
- one `to_regclass('public.<new_table>')`, or one `pg_proc` lookup per new function → `NULL` / 0 rows.

Then apply for real:

```bash
curl -s -X POST "$EP" -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d @"$SCRATCH/apply.json"
```

The read-only `supabase-mcp` server is for inspection only. Writes go through this endpoint alone.

### 4. SECURITY DEFINER functions — pinned, revoked, then granted least-privilege

```sql
CREATE FUNCTION public.<fn>(<args>) RETURNS <type>
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ … $$;
REVOKE EXECUTE ON FUNCTION public.<fn>(<arg types>) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.<fn>(<arg types>) TO <least-privileged caller role>;
```

- `search_path` is written unquoted as a list (`public, pg_temp`). A single quoted string such as
  `'public, pg_temp'` resolves as one schema name and throws 42P01. A body that calls PostGIS or
  another extension adds `extensions` before `pg_temp`; the precedent is `businesses_in_bounds` in
  `20261012000000_p4a_local_business.sql`.
- Supabase default privileges grant EXECUTE on new public functions to `anon` and `authenticated`
  directly. Revoking from `PUBLIC` alone therefore leaves those grants in place. Revoke from each
  role that is not an intended caller (`PUBLIC, anon`, plus `authenticated` when only
  `service_role` calls it), then grant to the intended role.
- Trigger functions revoke EXECUTE from `PUBLIC, anon, authenticated`.
- **A signature change means DROP first.** Changing argument types or the return type (including
  `RETURNS TABLE` columns) requires `DROP FUNCTION public.<fn>(<old arg types>);` then `CREATE`.
  `CREATE OR REPLACE` with a new signature adds an overload, and the old function keeps its old
  grants. Grants do not survive a DROP, so the REVOKE/GRANT block follows the new CREATE. Every
  caller in the same PR passes the new arguments.

### 5. Full types regeneration

```bash
cd "$WORKTREE" && SUPABASE_ACCESS_TOKEN="$PAT" npx supabase gen types typescript --project-id ndtpovonpadugthmcntl > packages/database/types.ts
```

Commit the whole generated file. When the diff is larger than this change, it is syncing drift
left by an earlier wave. Name both in the commit message and in the PR's "Types note".

### 6. Live verify (SELECT-only, each with a known-present control)

```sql
-- functions: definer flag, pinned path, volatility, ACL
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef, p.proconfig, p.provolatile, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('<fn>', …);

-- routine grants: no PUBLIC / anon unless intended
SELECT routine_name, grantee, privilege_type FROM information_schema.role_routine_grants
WHERE routine_schema = 'public' AND routine_name IN ('<fn>', …) ORDER BY 1, 2;

-- column grants are authoritative in attacl (relacl shows table grants only)
SELECT a.attname, a.attacl FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = '<table>' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum;

-- ledger tail
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;
```

Pass signals:

- `prosecdef = t`, with `proconfig` containing `search_path=public, pg_temp`;
- grantees are exactly the intended roles;
- `attacl` matches the intended column exposure;
- the ledger tail shows the new version.

Add `pg_policies` for each RLS change. Report each result in the brief's reply with the query and
its row output.
