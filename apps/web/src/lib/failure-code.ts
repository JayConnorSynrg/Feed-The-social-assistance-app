// apps/web/src/lib/failure-code.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The code a failure's log row carries: PostgREST's own code (or SQLSTATE) when the error has one,
// else the error's class, else 'unknown'. Never the message: a PostgREST or edge-function message
// can quote the values it was given (names, addresses).

export function failureCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code) return code
  return err instanceof Error ? err.name : 'unknown'
}
