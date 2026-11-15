/**
 * Test-only helpers that read text out of renderToStaticMarkup output.
 * Entities are decoded in one pass, so "&amp;lt;" stays "&lt;" (never double-decoded),
 * and tags are removed until none remain.
 */
const ENTITIES: Record<string, string> = { '&amp;': '&', '&#x27;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' }

export function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|#x27|quot|lt|gt);/g, (m) => ENTITIES[m])
}

export function markupText(s: string): string {
  let out = s
  let prev: string
  do {
    prev = out
    out = out.replace(/<[^<>]*>/g, '')
  } while (out !== prev)
  return decodeEntities(out).trim()
}

/** Removes every <script>…</script> block (any case) by index scanning, so no regex can miss a variant. */
export function withoutScripts(s: string): string {
  const lower = s.toLowerCase()
  let out = ''
  let i = 0
  while (i < s.length) {
    const start = lower.indexOf('<script', i)
    if (start === -1) { out += s.slice(i); break }
    out += s.slice(i, start)
    const end = lower.indexOf('</script', start)
    if (end === -1) break
    const close = lower.indexOf('>', end)
    i = close === -1 ? s.length : close + 1
  }
  return out
}
