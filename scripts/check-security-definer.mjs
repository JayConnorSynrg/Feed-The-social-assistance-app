#!/usr/bin/env node
// ============================================================================
// check-security-definer.mjs
// ----------------------------------------------------------------------------
// WHAT THIS GUARDS
//   Every Postgres function declared `SECURITY DEFINER` in supabase/migrations
//   must also pin its `search_path`. A SECURITY DEFINER function runs with the
//   owner's privileges; if its search_path is left mutable, a caller can prepend
//   a schema they control and shadow the unqualified objects the function body
//   references, escalating privilege. Pinning search_path closes that class.
//
// ADVISOR ENFORCED
//   Supabase database linter 0011 "function_search_path_mutable"
//   (https://supabase.com/docs/guides/database/database-advisors). This script
//   is the always-on, zero-dependency, DB-free equivalent of that advisor: it
//   catches the same finding at authoring/PR time, before a migration is ever
//   applied to a database. (The canonical advisor — `supabase db lint
//   --level error --linked` — is documented as an optional CI step in
//   .github/workflows/ci.yml; it requires DB connectivity + a Supabase access
//   token, so this static check is the default guard.)
//
// HOW A FUNCTION PASSES
//   A SECURITY DEFINER function is considered pinned if EITHER:
//     (1) its own CREATE [OR REPLACE] FUNCTION statement contains a
//         `SET search_path = ...` clause, OR
//     (2) ANY migration in the set contains an
//         `ALTER FUNCTION <name>(...) SET search_path = ...` targeting it.
//   Rule (2) is aggregated across ALL migration files, because a function is
//   frequently created in an early migration and pinned later by a hardening
//   migration (e.g. set_resource_location created in 20260526000001 and pinned
//   by ALTER in 20260601043054). Both patterns are first-class.
//
// IMPLEMENTATION NOTES
//   - Node built-ins only (fs, path, url). No new dependencies.
//   - SQL line comments (`-- ...`) are stripped before analysis so that prose
//     mentioning "SET search_path" inside a comment never counts as a pin and
//     never masks an unpinned function.
//   - Function names are normalized by stripping an optional `public.` schema
//     prefix and lowercasing, so `public.foo` and `foo` match. Matching is by
//     base function name (argument lists are ignored for the pin check, which
//     is safe: pinning is per-function-identity in practice in this codebase).
//
// USAGE
//   node scripts/check-security-definer.mjs
//   npm run lint:security-definer
//   Exit 0 = every SECURITY DEFINER function is pinned.
//   Exit 1 = one or more are unpinned (each is named with its file + the exact
//            line to add).
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

// ----------------------------------------------------------------------------
// Strip SQL line comments so comment prose never influences the analysis.
// Keeps newlines intact so line numbers stay accurate for reporting.
// ----------------------------------------------------------------------------
function stripLineComments(sql) {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

// Normalize a function reference to a comparable key: strip `public.` and lowercase.
function normalizeName(rawName) {
  return rawName.trim().replace(/^public\./i, '').toLowerCase();
}

// ----------------------------------------------------------------------------
// Collect every base function name pinned by an ALTER FUNCTION ... SET
// search_path statement, across ALL migrations (cross-file aggregation).
// ----------------------------------------------------------------------------
function collectAlterPinned(strippedSqlByFile) {
  const pinned = new Set();
  // ALTER FUNCTION [public.]name ( ...optional args... ) ... SET search_path
  const alterRe =
    /alter\s+function\s+([a-z0-9_."]+)\s*(?:\([^)]*\))?[^;]*?set\s+search_path/gis;
  for (const sql of Object.values(strippedSqlByFile)) {
    let m;
    while ((m = alterRe.exec(sql)) !== null) {
      pinned.add(normalizeName(m[1]));
    }
  }
  return pinned;
}

// ----------------------------------------------------------------------------
// Find every CREATE [OR REPLACE] FUNCTION statement, capture its name, and
// determine the bounds of its statement body so we can tell whether the body
// itself contains SECURITY DEFINER and/or an inline SET search_path.
//
// A CREATE statement runs from the CREATE keyword to the semicolon that
// terminates the whole statement. Postgres allows the function attributes
// (LANGUAGE, SECURITY DEFINER, SET search_path) to appear EITHER before the
// `AS $$...$$` body (e.g. CREATE ... SECURITY DEFINER SET search_path AS $$..$$;)
// OR after it (e.g. CREATE ... AS $$..$$ LANGUAGE plpgsql SECURITY DEFINER;).
// So the analyzed span must reach the terminating semicolon AFTER the closing
// dollar-quote — stopping at the dollar-quote would miss trailing attributes
// and wrongly classify such a function as non-definer / unpinned.
//
// We therefore find the dollar-quoted body (to skip over semicolons that live
// inside the body), then take the first semicolon AFTER the body closes. If no
// dollar-quote is present (rare; e.g. LANGUAGE sql one-liners), fall back to the
// first semicolon after the CREATE.
// ----------------------------------------------------------------------------
function findCreatedFunctions(strippedSql, file) {
  const results = [];
  const createRe = /create\s+(?:or\s+replace\s+)?function\s+([a-z0-9_."]+)\s*\(/gis;
  let m;
  while ((m = createRe.exec(strippedSql)) !== null) {
    const name = normalizeName(m[1]);
    const startIdx = m.index;

    // Locate the opening dollar-quote tag (e.g. $$, $function$) after AS.
    const tagMatch = /\bas\s+(\$[a-z0-9_]*\$)/is.exec(strippedSql.slice(startIdx));
    let scanFrom;
    if (tagMatch) {
      const tag = tagMatch[1];
      const openAt = startIdx + tagMatch.index + tagMatch[0].length - tag.length;
      const closeAt = strippedSql.indexOf(tag, openAt + tag.length);
      // Scan for the statement terminator AFTER the body closes, so trailing
      // attributes (LANGUAGE ... SECURITY DEFINER SET search_path) are included.
      scanFrom = closeAt === -1 ? strippedSql.length : closeAt + tag.length;
    } else {
      scanFrom = startIdx;
    }
    const semi = strippedSql.indexOf(';', scanFrom);
    const bodyEnd = semi === -1 ? strippedSql.length : semi;

    const statement = strippedSql.slice(startIdx, bodyEnd);
    const isDefiner = /security\s+definer/is.test(statement);
    const hasInlinePin = /set\s+search_path/is.test(statement);
    const line = strippedSql.slice(0, startIdx).split('\n').length;

    results.push({ name, file, line, isDefiner, hasInlinePin });
  }
  return results;
}

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    console.log(`No migrations directory at ${MIGRATIONS_DIR} — nothing to check.`);
    process.exit(0);
  }

  // Read + strip comments once per file.
  const strippedByFile = {};
  for (const f of files) {
    strippedByFile[f] = stripLineComments(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'));
  }

  const alterPinned = collectAlterPinned(strippedByFile);

  // Collect every CREATE statement, then AGGREGATE PER FUNCTION NAME across the
  // whole migration set. A function is frequently redefined by a later
  // migration: an early unpinned CREATE may be superseded by a later
  // CREATE OR REPLACE / DROP+CREATE that DOES pin inline (e.g. log_audit_event
  // pinned in 20260531120000; get_instance_uptime re-created pinned in
  // 20260601043054). The live object's final state is what matters, so we treat
  // a function name as pinned if ANY of its CREATEs pins inline OR ANY ALTER
  // pins it. We surface the EARLIEST definer occurrence of an unpinned function
  // so the report points at where the gap was introduced.
  const allCreates = [];
  for (const f of files) {
    for (const fn of findCreatedFunctions(strippedByFile[f], f)) {
      allCreates.push(fn);
    }
  }

  const byName = new Map(); // name -> { isDefiner, pinnedSomewhere, firstDefiner }
  for (const fn of allCreates) {
    const entry = byName.get(fn.name) ?? {
      isDefiner: false,
      pinnedSomewhere: alterPinned.has(fn.name),
      firstDefiner: null,
    };
    if (fn.hasInlinePin) entry.pinnedSomewhere = true;
    if (fn.isDefiner) {
      entry.isDefiner = true;
      if (!entry.firstDefiner) entry.firstDefiner = fn; // earliest, since files are sorted
    }
    byName.set(fn.name, entry);
  }

  const definerNames = [...byName.values()].filter((e) => e.isDefiner);
  const offenders = definerNames
    .filter((e) => !e.pinnedSomewhere)
    .map((e) => e.firstDefiner);

  const checked = definerNames.length;
  if (offenders.length === 0) {
    console.log(
      `search_path guard passed: all ${checked} SECURITY DEFINER function${
        checked === 1 ? '' : 's'
      } across ${files.length} migration files are pinned ` +
        `(Supabase advisor 0011 function_search_path_mutable satisfied).`
    );
    process.exit(0);
  }

  // Positive-language failure: state the required action for each offender.
  console.error(
    `search_path guard found ${offenders.length} SECURITY DEFINER function${
      offenders.length === 1 ? '' : 's'
    } to pin (Supabase advisor 0011 function_search_path_mutable):\n`
  );
  for (const o of offenders) {
    console.error(
      `  • ${o.name}  (${basename(o.file)}:${o.line})\n` +
        `      Pin it: add  SET search_path = public  to its CREATE statement,\n` +
        `      or add  ALTER FUNCTION ${o.name}(...) SET search_path = public;  in the migration.`
    );
  }
  console.error(
    `\nEach SECURITY DEFINER function must pin search_path so a caller cannot ` +
      `shadow its unqualified object references. Pin the function${
        offenders.length === 1 ? '' : 's'
      } above and re-run: node scripts/check-security-definer.mjs`
  );
  process.exit(1);
}

main();
