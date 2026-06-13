'use client'

/**
 * PetitionSignaturesExport — admin-only signer roster + full legal-record CSV export.
 *
 * Mounted in (admin)/moderation under the (admin)/layout is_current_user_admin gate.
 * All data access goes through SECDEF RPCs that re-assert the admin gate inside the
 * DB function body (defense-in-depth — the UI gate is not the only gate):
 *   - get_petition_signatures(p_petition_id)     → read the roster (no lock)
 *   - export_petition_signatures(p_petition_id)  → read + set the per-petition lock
 *
 * Export is the LOCKING action: once a petition is exported, exported_at is set and
 * withdrawal is disabled for every signer. Viewing the roster does NOT lock.
 *
 * CSV is built client-side from the RPC rows via the pure buildPetitionSignaturesCsv
 * helper (RFC-4180 escaped) and downloaded via a Blob + a[download].
 */

import { useState, useEffect, useCallback } from 'react'
import { ScrollText, Download, Eye, Lock, Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import {
  buildPetitionSignaturesCsv,
  type PetitionSignatureRow,
} from '@/lib/petition-csv'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AdminPetition {
  id: string
  title: string
  exported_at: string | null
  signatureCount: number
}

/** Roster row as returned by get_/export_petition_signatures. */
interface RosterRow extends PetitionSignatureRow {
  signer_display_name: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'petition'
}

function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PetitionSignaturesExport() {
  const supabase = createClient()

  const [petitions, setPetitions] = useState<AdminPetition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Per-petition roster (id → rows), open state, and busy state
  const [rosters, setRosters] = useState<Map<string, RosterRow[]>>(new Map())
  const [openId, setOpenId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  // ── Load approved petitions + counts ──────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('petitions')
        .select('id, title, exported_at')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr

      const rows = data ?? []
      const counts = await Promise.all(
        rows.map((r) =>
          supabase
            .rpc('get_petition_signature_count', { p_petition_id: r.id })
            .then(({ data: c }) => ({ id: r.id, count: (c as number | null) ?? 0 }))
        )
      )
      const countMap = new Map(counts.map((c) => [c.id, c.count]))

      setPetitions(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          exported_at: r.exported_at,
          signatureCount: countMap.get(r.id) ?? 0,
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load petitions.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  // ── View signers (no lock) ────────────────────────────────────────────────
  const handleView = useCallback(
    async (petitionId: string) => {
      // Toggle closed
      if (openId === petitionId) {
        setOpenId(null)
        return
      }
      setViewingId(petitionId)
      setError(null)
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_petition_signatures', {
          p_petition_id: petitionId,
        })
        if (rpcErr) throw rpcErr
        setRosters((prev) => new Map(prev).set(petitionId, (data ?? []) as RosterRow[]))
        setOpenId(petitionId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load signers.')
      } finally {
        setViewingId(null)
      }
    },
    [supabase, openId]
  )

  // ── Export CSV (sets the per-petition lock) ───────────────────────────────
  const handleExport = useCallback(
    async (petition: AdminPetition) => {
      setExportingId(petition.id)
      setError(null)
      try {
        const { data, error: rpcErr } = await supabase.rpc('export_petition_signatures', {
          p_petition_id: petition.id,
        })
        if (rpcErr) throw rpcErr

        const rows = (data ?? []) as RosterRow[]
        const csv = buildPetitionSignaturesCsv(rows)
        triggerCsvDownload(csv, `petition-signatures-${slugify(petition.title)}.csv`)

        // Reflect the lock locally (export sets exported_at server-side).
        const nowIso = new Date().toISOString()
        setPetitions((prev) =>
          prev.map((p) =>
            p.id === petition.id ? { ...p, exported_at: p.exported_at ?? nowIso } : p
          )
        )
        setRosters((prev) => new Map(prev).set(petition.id, rows))
        setOpenId(petition.id)
        logger.info('petition.export', { petitionId: petition.id, count: rows.length })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed.')
      } finally {
        setExportingId(null)
      }
    },
    [supabase]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="petition-signatures-export">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Petition Signatures</h2>
        <span className="text-sm text-muted-foreground">
          {petitions.length} approved petition{petitions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        View signer rosters and export the full legal record. Exporting locks the list —
        signers can no longer withdraw once a petition has been exported.
      </p>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {petitions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No approved petitions yet.
          </CardContent>
        </Card>
      ) : (
        petitions.map((p) => {
          const isLocked = p.exported_at != null
          const roster = rosters.get(p.id) ?? []
          const isOpen = openId === p.id
          return (
            <Card key={p.id} data-testid={`petition-export-${p.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-lime-700 flex-shrink-0" />
                  <CardTitle className="text-base">{p.title}</CardTitle>
                </div>
                <CardDescription className="text-xs flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  {p.signatureCount} signature{p.signatureCount !== 1 ? 's' : ''}
                  {isLocked && p.exported_at && (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Lock className="w-3 h-3" />
                      Exported {formatDate(p.exported_at)} — withdrawal locked
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={viewingId === p.id}
                    onClick={() => handleView(p.id)}
                    data-testid={`view-signers-${p.id}`}
                  >
                    {viewingId === p.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Eye className="w-3 h-3 mr-1" />
                    )}
                    {isOpen ? 'Hide signers' : 'View signers'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={exportingId === p.id}
                    onClick={() => handleExport(p)}
                    data-testid={`export-signers-${p.id}`}
                  >
                    {exportingId === p.id ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3 mr-1" />
                    )}
                    {isLocked ? 'Re-download CSV' : 'Export CSV'}
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-3 overflow-x-auto" data-testid={`roster-${p.id}`}>
                    {roster.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No signatures yet.</p>
                    ) : (
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="text-left text-stone-500 border-b border-stone-200">
                            <th className="py-1 pr-3 font-medium">Full Name</th>
                            <th className="py-1 pr-3 font-medium">Signed At</th>
                            <th className="py-1 pr-3 font-medium">Version Hash</th>
                            <th className="py-1 pr-3 font-medium">IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster.map((r, i) => (
                            <tr key={i} className="border-b border-stone-100">
                              <td className="py-1 pr-3 text-stone-900">{r.signer_full_name}</td>
                              <td className="py-1 pr-3 text-stone-600">
                                {r.signed_at ? formatDate(r.signed_at) : ''}
                              </td>
                              <td className="py-1 pr-3 text-stone-500 font-mono">
                                {r.petition_version_hash?.slice(0, 12)}
                              </td>
                              <td className="py-1 pr-3 text-stone-500 font-mono">{r.ip_address}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
