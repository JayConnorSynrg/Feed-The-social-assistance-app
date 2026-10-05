// Static scanner: every Mapbox map the app creates must turn off mapbox-gl's
// performance telemetry (performanceMetricsCollection: false).
//
// It resolves local names from every import of react-map-gl (any subpath),
// @vis.gl/react-mapbox, @vis.gl/react-maplibre and mapbox-gl — default, renamed
// default, named, `X as Y`, `default as Y` and namespace imports, single or
// double quotes — then checks:
//   - every JSX opening tag of a react-map-gl Map component carries
//     performanceMetricsCollection={false}, placed after any {...spread}. The
//     tag is parsed brace/string-aware, so `=>` inside a prop does not end it.
//   - every `new <mapbox-gl Map>(...)` passes performanceMetricsCollection: false.
//   - a dynamic import() of any of these modules is reported (not statically checkable).

import { stripComments } from './event-scan.mjs'

const REACT_MAP_MODULE = /^(react-map-gl(\/[\w-]+)?|@vis\.gl\/react-mapbox|@vis\.gl\/react-maplibre)$/
const MAPBOX_GL_MODULE = /^mapbox-gl(\/[\w-]+)?$/
const IMPORT_RE = /import\s+(?!type\s)([\s\S]*?)\s+from\s+(['"])([^'"]+)\2/g
const DYNAMIC_IMPORT_RE = /import\(\s*(['"`])([^'"`]+)\1\s*\)/g

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Parse an import clause into { def, ns, named: Map<imported, local> }. */
function parseClause(clause) {
  const out = { def: null, ns: null, named: new Map() }
  const brace = clause.match(/\{([\s\S]*)\}/)
  if (brace) {
    for (const part of brace[1].split(',')) {
      const p = part.trim().replace(/^type\s+/, '')
      if (!p) continue
      const m = p.match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/)
      if (m) out.named.set(m[1], m[2] ?? m[1])
    }
  }
  const rest = clause.replace(/\{[\s\S]*\}/, '').split(',').map((s) => s.trim()).filter(Boolean)
  for (const r of rest) {
    const ns = r.match(/^\*\s+as\s+([\w$]+)$/)
    if (ns) out.ns = ns[1]
    else if (/^[\w$]+$/.test(r)) out.def = r
  }
  return out
}

/** From `i` (just after the tag name), return the opening tag text up to its closing `>`. */
function readOpeningTag(src, i) {
  let depth = 0
  let quote = null
  const start = i
  for (; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) return src.slice(start, i + 1)
  }
  return src.slice(start)
}

/** From index `i` at `(`, return the balanced argument text. */
function readParens(src, i) {
  let depth = 0
  let quote = null
  const start = i
  for (; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return src.slice(start)
}

/** Positions of top-level (depth-0) `{...spread}` attributes inside an opening tag. */
function lastSpreadIndex(tag) {
  let depth = 0
  let quote = null
  let last = -1
  for (let i = 0; i < tag.length; i++) {
    const ch = tag[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '{') {
      if (depth === 0 && /^\{\s*\.\.\./.test(tag.slice(i))) last = i
      depth++
    } else if (ch === '}') depth--
  }
  return last
}

/**
 * @param {Array<{ file: string, src: string }>} files
 * @returns {{ uses: Array<{ file: string, kind: string, text: string }>, violations: Array<{ file: string, reason: string, text: string }> }}
 */
export function scanMapTelemetry(files) {
  const uses = []
  const violations = []
  for (const { file, src: raw } of files) {
    const src = stripComments(raw)
    const jsxNames = new Set()
    const ctorPatterns = []

    IMPORT_RE.lastIndex = 0
    let m
    while ((m = IMPORT_RE.exec(src))) {
      const mod = m[3]
      const isReact = REACT_MAP_MODULE.test(mod)
      const isGl = MAPBOX_GL_MODULE.test(mod)
      if (!isReact && !isGl) continue
      const { def, ns, named } = parseClause(m[1])
      if (isReact) {
        if (def) jsxNames.add(def)
        if (named.has('Map')) jsxNames.add(named.get('Map'))
        if (named.has('default')) jsxNames.add(named.get('default'))
        if (ns) {
          jsxNames.add(`${ns}.Map`)
          jsxNames.add(`${ns}.default`)
        }
      } else {
        if (def) ctorPatterns.push(`${def}.Map`)
        if (named.has('Map')) ctorPatterns.push(named.get('Map'))
        if (named.has('default')) ctorPatterns.push(`${named.get('default')}.Map`)
        if (ns) ctorPatterns.push(`${ns}.Map`, `${ns}.default.Map`)
      }
    }

    DYNAMIC_IMPORT_RE.lastIndex = 0
    while ((m = DYNAMIC_IMPORT_RE.exec(src))) {
      if (REACT_MAP_MODULE.test(m[2]) || MAPBOX_GL_MODULE.test(m[2])) {
        violations.push({ file, reason: 'dynamic import of a map library (not statically checkable)', text: m[0] })
      }
    }

    for (const name of jsxNames) {
      const re = new RegExp(`<${esc(name)}(?=[\\s/>])`, 'g')
      let t
      while ((t = re.exec(src))) {
        const tag = `<${name}` + readOpeningTag(src, t.index + t[0].length)
        uses.push({ file, kind: 'jsx', text: tag })
        const prop = tag.match(/\bperformanceMetricsCollection\s*=\s*\{\s*(\w+)\s*\}/)
        if (!prop) violations.push({ file, reason: 'missing performanceMetricsCollection={false}', text: tag })
        else if (prop[1] !== 'false') violations.push({ file, reason: `performanceMetricsCollection={${prop[1]}}`, text: tag })
        else if (lastSpreadIndex(tag) > tag.indexOf(prop[0])) violations.push({ file, reason: 'a later {...spread} can override the prop', text: tag })
      }
    }

    for (const ctor of ctorPatterns) {
      const re = new RegExp(`new\\s+${esc(ctor)}\\s*(?=\\()`, 'g')
      let c
      while ((c = re.exec(src))) {
        const args = readParens(src, c.index + c[0].length)
        uses.push({ file, kind: 'ctor', text: c[0] + args })
        if (!/\bperformanceMetricsCollection\s*:\s*false\b/.test(args)) {
          violations.push({ file, reason: 'new mapbox-gl Map without performanceMetricsCollection: false', text: c[0] + args })
        }
      }
    }
  }
  return { uses, violations }
}
