// apps/web/src/lib/json-ld.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Serialize a value for an inline <script type="application/ld+json"> element.
//
// JSON.stringify leaves `<`, `>` and `&` as they are, so a name such as `</script><img src=x>` would
// end the script element and put markup into the page. Writing those characters — and the two line
// separators U+2028 / U+2029 that older JavaScript parsers treat as line ends — as \uXXXX escapes
// keeps the element closed to its content. Each escape sits inside a JSON string, so a JSON-LD
// reader parses back exactly the original value.

const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

/** JSON for `dangerouslySetInnerHTML` inside a JSON-LD script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => ESCAPES[char])
}
