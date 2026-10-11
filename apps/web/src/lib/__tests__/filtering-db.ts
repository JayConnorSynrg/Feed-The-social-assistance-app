// filtering-db.ts — a PostgREST stand-in that APPLIES the filters a reader chains, so a test can tell
// a reader that asks for "visible rows only" from one that forgot to. A read returns a row only when
// every .eq() / .in() it chained matches that row; .single() answers PGRST116 otherwise, as PostgREST
// does for zero rows. Every read is recorded (table, columns, filters) for column-list assertions.
//
// It does not model row-level security: it shows what the READER asks for. A reader whose filter is
// removed here returns rows the real database's policies might still hide — the point of the tests
// built on it is that the application's own rule is stated in the query and cannot silently go.

export type FakeRow = Record<string, unknown>

export interface RecordedRead {
  table: string
  columns: string
  filters: Array<{ op: 'eq' | 'in'; column: string; value: unknown }>
}

export interface FilteringDb {
  /** The rows each table holds; a table not listed is empty. */
  tables: Record<string, FakeRow[]>
  /** Every read made through `client`, in order. */
  reads: RecordedRead[]
  /** When set, the next read throws it (a connection failure, not a PostgREST error object). */
  failWith: Error | null
  client: { from: (table: string) => unknown }
  reset: () => void
}

const NO_ROWS = { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }

export function filteringDb(): FilteringDb {
  const db: FilteringDb = {
    tables: {},
    reads: [],
    failWith: null,
    client: { from: () => null },
    reset() {
      db.tables = {}
      db.reads.length = 0
      db.failWith = null
    },
  }

  db.client.from = (table: string) => {
    const read: RecordedRead = { table, columns: '', filters: [] }
    const matches = (): FakeRow[] =>
      (db.tables[table] ?? []).filter((row) =>
        read.filters.every((f) =>
          f.op === 'eq' ? row[f.column] === f.value : (f.value as unknown[]).includes(row[f.column])
        )
      )
    const one = async () => {
      if (db.failWith) throw db.failWith
      const rows = matches()
      return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: NO_ROWS }
    }
    const query: Record<string, unknown> = {
      select(columns: string) {
        read.columns = columns
        db.reads.push(read)
        return query
      },
      eq(column: string, value: unknown) {
        read.filters.push({ op: 'eq', column, value })
        return query
      },
      in(column: string, value: unknown[]) {
        read.filters.push({ op: 'in', column, value })
        return query
      },
      single: one,
      maybeSingle: async () => {
        if (db.failWith) throw db.failWith
        const rows = matches()
        return rows.length > 1 ? { data: null, error: NO_ROWS } : { data: rows[0] ?? null, error: null }
      },
    }
    return query
  }

  return db
}
