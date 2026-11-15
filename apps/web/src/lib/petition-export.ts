// apps/web/src/lib/petition-export.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Reading every signature of one petition for the CSV export. PostgREST caps each response at
// max_rows (1000 on prod, read from the Management API on 2026-11-15), and an RPC answer is capped
// the same way, so one call to export_petition_signatures returns at most 1000 rows. The export
// reads pages of PAGE_SIZE until a page comes back short, then checks the total against the
// petition's signature count read BEFORE the first page: fewer rows than that count means a page
// was cut short (a lower max_rows, a failed page), and the export fails instead of downloading a
// partial file. Exporting locks withdrawals, so the count can only grow while the pages are read.

/** Rows per page. Equal to prod max_rows; a smaller server cap is caught by the count check. */
export const PETITION_EXPORT_PAGE_SIZE = 1000

export type PageFetcher<T> = (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string; code?: string } | null }>

export type CollectResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; code: 'read_failed' | 'incomplete'; message?: string; read: number }

/**
 * Reads pages [0, size-1], [size, 2*size-1], … until a page holds fewer than `size` rows, then
 * requires at least `expected` rows in total.
 */
export async function collectAllPages<T>(
  fetchPage: PageFetcher<T>,
  expected: number,
  size: number = PETITION_EXPORT_PAGE_SIZE,
): Promise<CollectResult<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await fetchPage(from, from + size - 1)
    if (error) return { ok: false, code: 'read_failed', message: error.message, read: rows.length }
    const page = data ?? []
    rows.push(...page)
    if (page.length < size) break
  }
  if (rows.length < expected) return { ok: false, code: 'incomplete', read: rows.length }
  return { ok: true, rows }
}
