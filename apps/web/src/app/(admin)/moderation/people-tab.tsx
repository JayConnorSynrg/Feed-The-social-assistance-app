'use client'

// apps/web/src/app/(admin)/moderation/people-tab.tsx
// P3.1 People tab (RA+). Lists people with their current tier and lets the viewer grant/revoke
// exactly the tiers admin_set_tier would accept (grantableTiers mirrors the server). Every grant
// requires a reason and mints one x-request-id shared by the RPC's audit row and the app_logs
// telemetry. The DB is authoritative; a {ok:false, code} response surfaces inline.

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCog } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { logger } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { grantableTiers, tierLabel, type AdminTier, type GrantOption } from '@/lib/admin-tier'

type Person = {
  id: string
  first_name: string | null
  username: string | null
  avatar_url: string | null
  admin_tier: AdminTier | null
  joined_at: string | null
}

type PendingAction = { person: Person; option: GrantOption }

const DENIAL_MESSAGES: Record<string, string> = {
  self: 'You cannot change your own tier.',
  founder_only: 'Only the founder can grant or revoke the Admin tier.',
  insufficient_tier: 'Your tier cannot grant that tier.',
  no_change: 'That person already holds this tier.',
  target_invalid: 'That account cannot receive a tier.',
  auth: 'Sign in to manage tiers.',
}

export function PeopleTab({ viewerTier, isFounder }: { viewerTier: AdminTier | null; isFounder: boolean }) {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [reason, setReason] = useState('')
  const [isActioning, setIsActioning] = useState(false)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('admin_list_people', { p_search: q || undefined })
    if (error) {
      logger.warn('admin.people.list_failed', { code: error.code })
      setError("Couldn't load people — please retry.")
      setPeople([])
    } else {
      setPeople((data as Person[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  const applyAction = async () => {
    if (!pending || !reason.trim()) return
    setIsActioning(true)
    setRowError(null)
    const supabase = createClient()
    const targetId = pending.person.id
    try {
      // Routed through privilegedRpc: one request id sent as x-request-id (admin_set_tier COALESCEs
      // it into the durable admin_actions row) and shared with the withMetric telemetry.
      const { data, error, requestId } = await privilegedRpc<{ ok?: boolean; code?: string }>(
        supabase,
        'admin.tier.set',
        'admin_set_tier',
        { p_target: targetId, p_tier: pending.option.value, p_reason: reason.trim() },
        { action: 'tier.set', target_id: targetId },
      )

      const result = (data ?? {}) as { ok?: boolean; code?: string }
      if (error) {
        logger.warn('admin.denied', { action: 'tier.set', target_id: targetId, code: error.code ?? error.message, request_id: requestId })
        setRowError({ id: targetId, message: 'The tier change failed — please retry.' })
      } else if (!result.ok) {
        const code = result.code ?? 'unknown'
        logger.warn('admin.denied', { action: 'tier.set', target_id: targetId, code, request_id: requestId })
        setRowError({ id: targetId, message: DENIAL_MESSAGES[code] ?? `Denied (${code}).` })
      } else {
        logger.info('admin.tier.set', {
          target_id: targetId,
          to: pending.option.value,
          request_id: requestId,
        })
        setPending(null)
        setReason('')
        await load(search)
      }
    } catch {
      logger.warn('admin.denied', { action: 'tier.set', target_id: targetId, code: 'exception' })
      setRowError({ id: targetId, message: 'The tier change failed — please retry.' })
    } finally {
      setIsActioning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <UserCog className="h-4 w-4 text-[#4a5d23]" />
          People
        </h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') load(search) }}
          placeholder="Search name or username…"
          className="ml-auto text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-500"
        />
        <button
          onClick={() => load(search)}
          className="px-3 py-1.5 rounded-lg bg-lime-600 text-white text-sm font-medium hover:bg-lime-700 transition-colors"
        >
          Search
        </button>
      </div>

      {error && (
        <div className="py-3 px-4 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200">{error}</div>
      )}

      {loading ? (
        <div className="py-6 text-stone-500 text-sm">Loading people…</div>
      ) : people.length === 0 ? (
        <div className="py-6 text-stone-400 text-sm">No people found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-stone-100 bg-stone-50/60">
                <TableHead className="h-9 px-4 text-xs font-medium text-stone-500">Person</TableHead>
                <TableHead className="h-9 px-4 text-xs font-medium text-stone-500">Tier</TableHead>
                <TableHead className="h-9 px-4 text-xs font-medium text-stone-500">Set tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const options = grantableTiers(viewerTier, isFounder, person.admin_tier)
                const label = tierLabel(person.admin_tier)
                return (
                  <TableRow key={person.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {person.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-[#4a5d23]">
                              {(person.first_name ?? person.username ?? '?').slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {person.first_name ?? <span className="text-stone-400 italic">No name</span>}
                          </p>
                          <p className="text-xs text-stone-500 truncate">{person.username ? `@${person.username}` : '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {label ? (
                        <Badge className="bg-lime-100 text-lime-800 border-0 text-xs rounded-full px-2.5">{label}</Badge>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {options.length === 0 ? (
                        <span className="text-xs text-stone-300">No actions</span>
                      ) : (
                        <select
                          value=""
                          onChange={(e) => {
                            const opt = options.find((o) => String(o.value) === e.target.value)
                            if (opt) { setPending({ person, option: opt }); setReason(''); setRowError(null) }
                          }}
                          className="text-sm border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-500"
                        >
                          <option value="">Change…</option>
                          {options.map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      {rowError && rowError.id === person.id && (
                        <p className="mt-1 text-xs text-red-600">{rowError.message}</p>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reason-gated confirmation */}
      <Dialog open={!!pending} onOpenChange={(open: boolean) => { if (!open) { setPending(null); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.option.label}</DialogTitle>
            <DialogDescription>
              {pending && (
                <>
                  {pending.option.value
                    ? <>Grant <strong>{tierLabel(pending.option.value)}</strong> to </>
                    : <>Revoke the tier from </>}
                  <strong>{pending.person.first_name ?? pending.person.username ?? 'this person'}</strong>. A reason is required and is recorded in the admin action log.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full text-sm rounded-lg border border-stone-200 px-3 py-2 text-stone-900 placeholder:text-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-lime-500"
            rows={3}
            placeholder="Reason (required)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <DialogFooter>
            <button
              onClick={() => { setPending(null); setReason('') }}
              className="px-4 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={applyAction}
              disabled={!reason.trim() || isActioning}
              className="px-4 py-2 rounded-lg bg-lime-600 hover:bg-lime-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            >
              {isActioning ? 'Applying…' : 'Apply'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
