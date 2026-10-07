// fake-supabase.ts — a chainable PostgREST stand-in for loader tests. Records every call (table or
// RPC name + the chained operations), and resolves a read only when the test releases it, so
// "started together" is observable. `results[name]` is the {data, error} a read resolves to, or an
// Error it throws.

type Result = { data: unknown; error: unknown } | Error

/** A chainable PostgREST stand-in: records calls, resolves when `release(name)` is called. */
export function fakeClient(results: Record<string, Result>, { gated = true }: { gated?: boolean } = {}) {
  const calls: Array<{ name: string; ops: Array<[string, unknown[]]> }> = []
  const started: string[] = []
  const releases = new Map<string, () => void>()
  const builder = (name: string) => {
    const rec = { name, ops: [] as Array<[string, unknown[]]> }
    calls.push(rec)
    const gate = gated ? new Promise<void>((r) => releases.set(name, r)) : Promise.resolve()
    const b: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'abortSignal']) {
      b[op] = (...args: unknown[]) => { rec.ops.push([op, args]); return b }
    }
    b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
      started.push(name)
      return gate.then(() => {
        const r = results[name]
        if (r instanceof Error) throw r
        return r ?? { data: [], error: null }
      }).then(ok, bad)
    }
    return b
  }
  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => { const b = builder(fn); calls[calls.length - 1].ops.push(['args', [args]]); return b },
  }
  return { client: client as never, calls, started, release: (n: string) => releases.get(n)?.(), releaseAll: () => releases.forEach((r) => r()) }
}

