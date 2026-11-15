// apps/web/src/app/(admin)/moderation/petition-export-run.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// One tap of "Download CSV" in Moderation › Community: one POST to
// /api/admin/petitions/[id]/export through privilegedFetch (one request id shared by the server's
// admin_actions row and both app_logs rows), then the file is saved. The in-flight flag is set
// synchronously, before the first await, so a second tap while a download runs sends nothing.
// No React here, so the guard is unit-tested directly (petition-export-run.test.ts).

import { petitionCsvFilename } from '@/lib/petition-csv'

export interface InFlightFlag {
  current: boolean
}

export interface ExportDeps {
  /** Sends the POST; resolves with the response (privilegedFetch in the component). */
  post: (url: string) => Promise<Response>
  /** Hands the file to the browser. */
  save: (file: Blob, filename: string) => void
  now: () => Date
}

export type ExportRun =
  | { status: 'busy' }
  | { status: 'done'; rowCount: number }
  | { status: 'error'; code: string }

export function petitionExportUrl(petitionId: string): string {
  return `/api/admin/petitions/${encodeURIComponent(petitionId)}/export`
}

/** The file name the server sent (Content-Disposition), else the same id+date name. */
export function filenameFrom(response: Response, petitionId: string, now: Date): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')
  return match?.[1] ?? petitionCsvFilename(petitionId, now)
}

export async function runPetitionExport(flag: InFlightFlag, petitionId: string, deps: ExportDeps): Promise<ExportRun> {
  if (flag.current) return { status: 'busy' }
  flag.current = true
  try {
    const response = await deps.post(petitionExportUrl(petitionId))
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null
      return { status: 'error', code: typeof body?.code === 'string' ? body.code : `http_${response.status}` }
    }
    const file = await response.blob()
    deps.save(file, filenameFrom(response, petitionId, deps.now()))
    return { status: 'done', rowCount: Number(response.headers.get('X-Row-Count') ?? 0) }
  } catch {
    return { status: 'error', code: 'network' }
  } finally {
    flag.current = false
  }
}
