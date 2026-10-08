// apps/web/src/lib/supabase/embed-fk-hint.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Every PostgREST embed of `profiles` names its foreign key: `profiles!<fk_name>(...)`.
//
// Why: posts reaches profiles two ways on production — many-to-one posts_user_id_fkey (the author)
// and many-to-many through post_likes (PK (user_id, post_id)). An untargeted `user:profiles(...)`
// on posts fails with PGRST201 (HTTP 300), the read returns null, and /s/post/<id>, the OG image,
// and the profile post list 404 or render empty. Naming the FK also pins the embed to the author
// row, so a liker can never be returned in its place.
//
// The failure is a PostgREST schema-cache contract with no unit-observable runtime, so this test
// scans source: every string literal (including the pieces of a `.select(` built across lines)
// under apps/web/src and supabase/functions that embeds `profiles(` must carry a `!<fk_name>` hint
// naming a foreign-key constraint (`*_fkey` / `*_fk`). `!inner` / `!left` alone are join modifiers,
// and a table hint such as `!post_likes` selects the many-to-many likers path — neither counts.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC_ROOT = fileURLToPath(new URL('../..', import.meta.url)) // apps/web/src
const FUNCTIONS_ROOT = fileURLToPath(new URL('../../../../../supabase/functions', import.meta.url))

// `profiles` as an embed target, followed by optional `!hint` segments, then `(`.
const PROFILES_EMBED = /(?<![\w.])profiles((?:\s*!\s*\w+)*)\s*\(/g
const JOIN_MODIFIERS = new Set(['inner', 'left'])
const FK_CONSTRAINT = /_(fkey|fk)$/

/** Returns each `profiles(` embed in `text` that names no foreign-key constraint. */
function untargetedProfilesEmbeds(text: string): string[] {
  const hits: string[] = []
  for (const m of text.matchAll(PROFILES_EMBED)) {
    const hints = (m[1].match(/\w+/g) ?? []).filter((h) => !JOIN_MODIFIERS.has(h))
    if (!hints.some((h) => FK_CONSTRAINT.test(h))) hits.push(m[0])
  }
  return hits
}

/** String-literal text of a TS/TSX source (comments excluded by construction). */
function stringLiterals(fileName: string, source: string): string[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, kind)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push(node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** `file:literal` for every untargeted profiles embed in a source text. */
function scanSource(fileName: string, source: string): string[] {
  return stringLiterals(fileName, source).flatMap((lit) =>
    untargetedProfilesEmbeds(lit).map((hit) => `${fileName}: ${hit} in ${JSON.stringify(lit)}`),
  )
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p)
    if (!/\.(ts|tsx)$/.test(e.name) || /\.(test|smoke)\.tsx?$/.test(e.name)) return []
    return [p]
  })
}

describe('PostgREST embeds of profiles name their foreign key', () => {
  it('control: the scanner catches planted untargeted embeds, including a select built across lines', () => {
    const planted = [
      "supabase.from('posts').select('id, user:profiles(first_name)')",
      "supabase.from('posts').select('id, author:profiles!inner(id)')",
      "supabase.from('posts').select(\n  'id, content, ' +\n  'user:profiles(id, first_name)'\n)",
      'const S = `id, profiles ( id )`',
      "supabase.from('posts').select('id, user:profiles!post_likes(id)')",
    ]
    for (const src of planted) {
      expect(scanSource('planted.ts', src), src).toHaveLength(1)
    }
  })

  it('control: targeted embeds, other tables, and comments are not flagged', () => {
    const clean = [
      "select('user:profiles!posts_user_id_fkey(id, first_name)')",
      "select('user:profiles!posts_user_id_fkey!inner(id)')",
      "select('giver:profiles!appreciation_gifts_giver_fk(id)')",
      "select('id, user_secure_profiles(id), post:posts(content)')",
      '// follower_id uuid NOT NULL → profiles(id) ON DELETE CASCADE',
    ]
    for (const src of clean) {
      expect(scanSource('clean.ts', src), src).toEqual([])
    }
  })

  it('every profiles embed under apps/web/src names an explicit FK', () => {
    const files = sourceFiles(SRC_ROOT)
    expect(files.length).toBeGreaterThan(100) // the walk reached the tree
    const offenders = files.flatMap((f) =>
      scanSource(path.relative(SRC_ROOT, f), fs.readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('every profiles embed under supabase/functions names an explicit FK', () => {
    const files = sourceFiles(FUNCTIONS_ROOT)
    expect(files.length).toBeGreaterThan(10) // the walk reached the edge functions
    const offenders = files.flatMap((f) =>
      scanSource(path.relative(FUNCTIONS_ROOT, f), fs.readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
