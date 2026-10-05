// Static scanner: every Mapbox map the app creates must turn off mapbox-gl's
// performance telemetry (performanceMetricsCollection: false).
//
// It resolves local names from every import of react-map-gl (any subpath),
// @vis.gl/react-mapbox, @vis.gl/react-maplibre and mapbox-gl — default, renamed
// default, named, `X as Y`, `default as Y` and namespace imports, single or
// double quotes — then checks:
//   - every JSX opening tag of a react-map-gl Map component carries
//     performanceMetricsCollection={false} as a top-level attribute, placed
//     after any {...spread}. The tag is parsed brace/string-aware, so `=>`
//     inside a prop does not end it, and text inside a string or a nested
//     expression never counts as the attribute.
//   - every `new <mapbox-gl Map>(...)` passes an object literal whose top-level
//     `performanceMetricsCollection: false` is not followed by a `...spread`.
//   - every dynamic import() — `import(` with any spacing — is reported when its
//     argument is not a plain string literal (not statically checkable) or when
//     the literal names one of these modules.
//   - so is any re-export (`export … from`, incl. `export *`) or require() of them,
//     because the Map component would then reach JSX under a name this file
//     cannot see.
//   - every other reference to a resolved Map binding — an alias
//     (`const M = Map`, `const C = mapboxgl.Map`), an object (`{ Map }`),
//     `React.createElement(Map, …)`, a passed-around namespace — is reported:
//     the only allowed uses are a checked JSX tag and a checked `new` expression.
//   Comments, string contents and JSX text are ignored.

import { stripComments } from './event-scan.mjs'

const REACT_MAP_MODULE = /^(react-map-gl(\/[\w-]+)?|@vis\.gl\/react-mapbox|@vis\.gl\/react-maplibre)$/
const MAPBOX_GL_MODULE = /^mapbox-gl(\/[\w-]+)?$/
const IMPORT_RE = /import\s+(?!type\s)([\s\S]*?)\s+from\s+(['"])([^'"]+)\2/g
const DYNAMIC_IMPORT_RE = /(?<![\w$.])import\s*(?=\()/g
const PLAIN_LITERAL_RE = /^(['"])([^'"\\]*)\1$|^`([^`$\\]*)`$/
const REEXPORT_RE = /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"]+)\1/g
const REQUIRE_RE = /require\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g

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

/** Replace string-literal contents with spaces (quotes and length kept). */
function blankStrings(src) {
  let out = ''
  let quote = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') {
        out += '  '
        i++
        continue
      }
      if (ch === quote) {
        quote = null
        out += ch
      } else out += ch === '\n' ? '\n' : ' '
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    out += ch
  }
  return out
}

const CODE_KEYWORDS = /(?:^|[^\w$])(return|export|default|typeof|await|yield|in|of|case|void|throw|extends)$/

/**
 * Is the token at `i` in a code position (not JSX text)? Code follows an
 * operator/punctuator, an arrow, or a keyword. JSX text follows `>` (a tag end)
 * or plain words, so "Interactive Map" inside an element is skipped.
 */
function inCodePosition(src, i) {
  const before = src.slice(0, i).replace(/\s+$/, '')
  if (before === '') return true
  if (before.endsWith('=>')) return true
  const last = before[before.length - 1]
  if ('(,=[{:?&|!+-*%^~;'.includes(last)) return true
  return CODE_KEYWORDS.test(before)
}

const tagBefore = (src, i) => /<\/?\s*$/.test(src.slice(Math.max(0, i - 8), i))
const newBefore = (src, i) => /(?:^|[^\w$.])new\s+$/.test(src.slice(Math.max(0, i - 12), i))

/** Split `text` on commas at bracket depth 0. */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

/**
 * The LAST top-level (brace depth 0) `name={…}` attribute of a string-blanked
 * opening tag: { value, index } or null. Text inside an attribute expression or
 * a nested object is at depth >= 1 and never matches.
 */
function topLevelJsxProp(tag, name) {
  let depth = 0
  let found = null
  for (let i = 0; i < tag.length; i++) {
    const ch = tag[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (depth === 0 && tag.startsWith(name, i) && !/[\w$]/.test(tag[i - 1] ?? '')) {
      const m = tag.slice(i).match(new RegExp(`^${name}\\s*=\\s*\\{`))
      if (!m) continue
      let d = 0
      let j = i + m[0].length - 1
      for (; j < tag.length; j++) {
        if (tag[j] === '{') d++
        else if (tag[j] === '}' && --d === 0) break
      }
      found = { value: tag.slice(i + m[0].length, j).trim(), index: i }
      i = j
    }
  }
  return found
}

/**
 * Verdict for `new Map(<args>)` (string-blanked args incl. parens): null when the
 * first argument is an object literal whose LAST top-level
 * performanceMetricsCollection is `false` and no `...spread` follows it.
 */
function ctorOptionVerdict(args) {
  const first = (splitTopLevel(args.slice(1, -1))[0] ?? '').trim()
  if (!first.startsWith('{') || !first.endsWith('}')) {
    return 'new mapbox-gl Map without an inline options object (not statically checkable)'
  }
  const props = splitTopLevel(first.slice(1, -1)).map((p) => p.trim())
  let optAt = -1
  let optValue = null
  props.forEach((p, k) => {
    const pm = p.match(/^['"]?performanceMetricsCollection['"]?\s*:\s*([\s\S]+)$/)
    if (pm) {
      optAt = k
      optValue = pm[1].trim()
    }
  })
  if (optAt < 0 || optValue !== 'false') return 'new mapbox-gl Map without performanceMetricsCollection: false'
  if (props.slice(optAt + 1).some((p) => p.startsWith('...'))) return 'new mapbox-gl Map: a later ...spread can override performanceMetricsCollection'
  return null
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
    const isMapModule = (mod) => REACT_MAP_MODULE.test(mod) || MAPBOX_GL_MODULE.test(mod)

    const reactNames = new Set() // identifiers bound to the react-map-gl Map component
    const reactNs = new Set() // namespaces of a react-map-gl module
    const glCtors = new Set() // identifiers bound to mapbox-gl's Map class
    const glObjects = new Set() // default/namespace bindings of mapbox-gl (their .Map)

    // Code with import statements and string contents blanked, for reference scanning.
    let code = src

    IMPORT_RE.lastIndex = 0
    let m
    while ((m = IMPORT_RE.exec(src))) {
      const mod = m[3]
      if (!isMapModule(mod)) continue
      code = code.slice(0, m.index) + ' '.repeat(m[0].length) + code.slice(m.index + m[0].length)
      const { def, ns, named } = parseClause(m[1])
      if (REACT_MAP_MODULE.test(mod)) {
        if (def) reactNames.add(def)
        if (named.has('Map')) reactNames.add(named.get('Map'))
        if (named.has('default')) reactNames.add(named.get('default'))
        if (ns) reactNs.add(ns)
      } else {
        if (def) glObjects.add(def)
        if (ns) glObjects.add(ns)
        if (named.has('Map')) glCtors.add(named.get('Map'))
        if (named.has('default')) glObjects.add(named.get('default'))
      }
    }
    code = blankStrings(code)

    // Dynamic import(): matched in the string-blanked code (so `import(` inside a
    // string is ignored), argument read from the comment-stripped source.
    DYNAMIC_IMPORT_RE.lastIndex = 0
    while ((m = DYNAMIC_IMPORT_RE.exec(code))) {
      const open = code.indexOf('(', m.index)
      const argText = readParens(src, open).slice(1, -1).trim()
      const lit = argText.match(PLAIN_LITERAL_RE)
      if (!lit) {
        violations.push({ file, reason: 'dynamic import with a non-literal argument (not statically checkable)', text: `import(${argText})` })
      } else if (isMapModule(lit[2] ?? lit[3])) {
        violations.push({ file, reason: 'dynamic import of a map library (not statically checkable)', text: `import(${argText})` })
      }
    }

    for (const [re, reason] of [
      [REEXPORT_RE, 're-export of a map library (its Map would escape this check)'],
      [REQUIRE_RE, 'require() of a map library (not statically checkable)'],
    ]) {
      re.lastIndex = 0
      while ((m = re.exec(src))) {
        if (isMapModule(m[2])) violations.push({ file, reason, text: m[0] })
      }
    }

    // Both checks read the string-blanked `code`, so a matching text inside a
    // string literal never counts.
    const checkTag = (name, start, matchLen) => {
      const tag = code.slice(start, start + matchLen) + readOpeningTag(code, start + matchLen)
      const text = src.slice(start, start + tag.length)
      uses.push({ file, kind: 'jsx', text: text.replace(/\s+/g, ' ').slice(0, 200) })
      const prop = topLevelJsxProp(tag, 'performanceMetricsCollection')
      if (!prop) violations.push({ file, reason: 'missing performanceMetricsCollection={false}', text })
      else if (prop.value !== 'false') violations.push({ file, reason: `performanceMetricsCollection={${prop.value}}`, text })
      else if (lastSpreadIndex(tag) > prop.index) violations.push({ file, reason: 'a later {...spread} can override the prop', text })
    }
    const checkCtor = (start, matchLen) => {
      const args = readParens(code, start + matchLen)
      const text = src.slice(start, start + matchLen + args.length)
      uses.push({ file, kind: 'ctor', text: text.replace(/\s+/g, ' ').slice(0, 200) })
      const verdict = ctorOptionVerdict(args)
      if (verdict) violations.push({ file, reason: verdict, text })
    }
    const refViolation = (text) =>
      violations.push({ file, reason: 'Map binding referenced outside a checked JSX tag / new expression', text })

    // react-map-gl: direct bindings
    for (const name of reactNames) {
      const re = new RegExp(`(?<![\\w$.])${esc(name)}(?![\\w$])`, 'g')
      let t
      while ((t = re.exec(code))) {
        const i = t.index
        if (tagBefore(code, i)) {
          if (!/<\/\s*$/.test(code.slice(Math.max(0, i - 8), i)) && /^[\s/>]/.test(code.slice(i + name.length))) {
            const lt = code.lastIndexOf('<', i)
            checkTag(name, lt, i + name.length - lt)
          }
          continue
        }
        const after = code.slice(i + name.length)
        const isObjectKey = /^\s*:(?!:)/.test(after) && /[{,]\s*$/.test(code.slice(0, i))
        if (!isObjectKey && inCodePosition(code, i)) refViolation(code.slice(Math.max(0, i - 30), i + name.length + 20).trim())
      }
    }

    // react-map-gl: namespaces (ns.Map / ns.default, possibly spaced)
    for (const ns of reactNs) {
      const re = new RegExp(`(?<![\\w$.])${esc(ns)}(?![\\w$])(\\s*\\.\\s*([\\w$]+))?`, 'g')
      let t
      while ((t = re.exec(code))) {
        const i = t.index
        const member = t[2]
        const isMapMember = member === 'Map' || member === 'default'
        if (tagBefore(code, i)) {
          if (isMapMember && !/<\/\s*$/.test(code.slice(Math.max(0, i - 8), i))) {
            const lt = code.lastIndexOf('<', i)
            checkTag(`${ns}.${member}`, lt, i + t[0].length - lt)
          }
          continue
        }
        if ((isMapMember || !member) && inCodePosition(code, i)) refViolation(t[0])
      }
    }

    // mapbox-gl: named Map class bindings
    for (const name of glCtors) {
      const re = new RegExp(`(?<![\\w$.])${esc(name)}(?![\\w$])`, 'g')
      let t
      while ((t = re.exec(code))) {
        if (newBefore(code, t.index) && /^\s*\(/.test(code.slice(t.index + name.length))) {
          const start = code.lastIndexOf('new', t.index)
          checkCtor(start, t.index + name.length - start)
        } else if (inCodePosition(code, t.index)) refViolation(t[0])
      }
    }

    // mapbox-gl: default / namespace objects — only `new obj.Map(...)` is allowed
    for (const obj of glObjects) {
      const re = new RegExp(`(?<![\\w$.])${esc(obj)}(?![\\w$])((?:\\s*\\.\\s*default)?\\s*\\.\\s*([\\w$]+)|\\s*\\[)?`, 'g')
      let t
      while ((t = re.exec(code))) {
        const i = t.index
        const member = t[2]
        if (member === 'Map') {
          if (newBefore(code, i) && /^\s*\(/.test(code.slice(i + t[0].length))) {
            const start = code.lastIndexOf('new', i)
            checkCtor(start, i + t[0].length - start)
          } else refViolation(t[0])
        } else if (t[1] && t[1].trim() === '[') {
          violations.push({ file, reason: 'computed member access on mapbox-gl (not statically checkable)', text: t[0] })
        } else if (!t[1] && inCodePosition(code, i)) {
          refViolation(t[0]) // the whole mapbox-gl object aliased or passed on
        }
      }
    }
  }
  return { uses, violations }
}
