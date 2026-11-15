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
