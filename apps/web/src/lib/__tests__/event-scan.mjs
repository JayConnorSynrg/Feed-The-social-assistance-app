// Static scanner for every log/metric event name emitted from apps/web/src.
//
// Used by event-registry.test.ts to prove EVENT_REGISTRY covers every event the
// app can send to /api/client-log. It finds calls to logger.debug/info/warn/error,
// withMetric, logEvent, privilegedRpc and privilegedFetch, reads the event-name
// argument, and collects every string literal in it (so a ternary such as
// `ok ? 'a.x' : 'a.y'` yields both names). withMetric / privilegedRpc /
// privilegedFetch operations expand to the `<op>.complete` / `<op>.error` rows
// withMetric actually persists.
//
// A call whose name argument has no static string literal is reported as a
// dynamic site; the test pins the known dynamic sites so a new one is reviewed.

import fs from 'node:fs'
import path from 'node:path'

// Callee, optionally followed by explicit type arguments (`withMetric<{...}>(`).
const CALL_RE =
  /(?<![\w.$])(logger\.(?:debug|info|warn|error)|withMetric|logEvent|privilegedRpc|privilegedFetch)\s*(?=[(<])/g

/** From index `i` (at `(` or `<`), skip balanced type arguments; return the index just past `(`, or -1. */
function openParenAfter(src, i) {
  if (src[i] === '<') {
    let depth = 0
    for (; i < src.length; i++) {
      const ch = src[i]
      if (ch === '=' && src[i + 1] === '>') {
        i++
        continue
      }
      if (ch === '<' || ch === '{' || ch === '(' || ch === '[') depth++
      else if (ch === '>' || ch === '}' || ch === ')' || ch === ']') {
        depth--
        if (depth === 0) {
          i++
          break
        }
      }
    }
    while (/\s/.test(src[i] ?? '')) i++
  }
  return src[i] === '(' ? i + 1 : -1
}

// Index of the attrs/labels argument per callee.
const ATTRS_INDEX = {
  'logger.debug': 1,
  'logger.info': 1,
  'logger.warn': 1,
  'logger.error': 2,
  withMetric: 1,
  logEvent: 1,
  privilegedRpc: 4,
  privilegedFetch: 3,
}

/** Recursively list scannable source files (tests and smoke suites excluded). */
export function listSourceFiles(root) {
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        walk(p)
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name) && !/\.(test|smoke)\./.test(entry.name)) {
        out.push(p)
      }
    }
  }
  walk(root)
  return out
}

/**
 * Blank out // and /* *\/ comments (keeping newlines so line numbers hold) while
 * respecting string and template literals, so prose in comments is not scanned.
 */
export function stripComments(src) {
  let out = ''
  let quote = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      out += ch
      if (ch === '\\') {
        out += src[++i] ?? ''
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      out += ch
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'
        i++
      }
      i++
      continue
    }
    out += ch
  }
  return out
}

/** Split the argument list that starts right after `(` at index `start` into top-level args. */
function splitArgs(src, start) {
  const args = []
  let depth = 0
  let cur = ''
  let quote = null
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      cur += ch
      if (ch === '\\') {
        cur += src[++i] ?? ''
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '(' || ch === '{' || ch === '[') depth++
    if (ch === ')' || ch === '}' || ch === ']') {
      if (depth === 0) {
        if (cur.trim()) args.push(cur.trim())
        return args
      }
      depth--
    }
    if (ch === ',' && depth === 0) {
      args.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  return args
}

/** For `cond ? a : b`, only the branches name events — drop the condition. */
function ternaryBranches(expr) {
  let quote = null
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if (ch === '?' && expr[i + 1] !== '?' && expr[i + 1] !== '.') return expr.slice(i + 1)
  }
  return expr
}

/** Static string literals inside an expression (template literals with ${} are dynamic). */
function literals(expr) {
  expr = ternaryBranches(expr)
  const out = []
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`/g
  let m
  while ((m = re.exec(expr))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

/**
 * Scan source files. Returns:
 *   sites:   [{ callee, name, file, line, persisted, attrsArg }]  one per emitted event name
 *            (attrsArg = the source text of the label/attrs argument, when present)
 *   dynamic: [{ callee, file, line }]                   calls with no static name
 * `persisted` is true when the event can reach app_logs (warn/error, withMetric
 * rows, privileged ops, logEvent). logger.debug/info are console-only.
 */
export function scanEvents(root) {
  const sites = []
  const dynamic = []
  for (const file of listSourceFiles(root)) {
    const src = stripComments(fs.readFileSync(file, 'utf8'))
    CALL_RE.lastIndex = 0
    let m
    while ((m = CALL_RE.exec(src))) {
      const callee = m[1]
      const line = src.slice(0, m.index).split('\n').length
      const argStart = openParenAfter(src, m.index + m[0].length)
      if (argStart < 0) continue
      const args = splitArgs(src, argStart)
      const nameArg = callee === 'privilegedRpc' ? args[1] : args[0]
      const names = nameArg ? literals(nameArg) : []
      const rel = path.relative(root, file)
      if (names.length === 0) {
        dynamic.push({ callee, file: rel, line })
        continue
      }
      const attrsArg = ATTRS_INDEX[callee] !== undefined ? args[ATTRS_INDEX[callee]] : undefined
      const isOp = callee === 'withMetric' || callee === 'privilegedRpc' || callee === 'privilegedFetch'
      const persisted = isOp || callee === 'logEvent' || callee === 'logger.warn' || callee === 'logger.error'
      for (const n of names) {
        if (isOp) {
          sites.push({ callee, name: `${n}.complete`, file: rel, line, persisted, attrsArg })
          sites.push({ callee, name: `${n}.error`, file: rel, line, persisted, attrsArg })
        } else {
          sites.push({ callee, name: n, file: rel, line, persisted, attrsArg })
        }
      }
    }
  }
  return { sites, dynamic }
}
