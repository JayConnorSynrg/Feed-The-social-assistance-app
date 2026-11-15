'use client'

// apps/web/src/app/(admin)/moderation/people-tab.tsx
// P3.1 People tab (RA+). Lists people with their current tier and lets the viewer grant/revoke
// exactly the tiers admin_set_tier would accept (grantableTiers mirrors the server). Every grant
// requires a reason and mints one x-request-id shared by the RPC's audit row and the app_logs
// telemetry. The DB is authoritative; a {ok:false, code} response surfaces inline.
// Language: the admin's (lib/i18n-admin-people.ts; tier names are roleLabel). The shell marks the tab
// with it; the confirmation dialog, a portal, carries its own lang/dir. A person's name and username
// keep their own language and direction (lang="" dir="auto").
// Keyboard and screen reader: the table stays on screen while the list re-reads (the loading line is
// the first load's only); after a tier change focus returns to that row's select and "Tier updated"
// is announced in the tab's one always-mounted status region; a refusal shows inside the open
// dialog in its one always-mounted alert. Apply stays focusable (aria-disabled, guarded handler).

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserCog } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { logger } from '@/lib/logger'
import { privilegedRpc } from '@/lib/privileged-action'
import { grantableTiers, type AdminTier, type GrantOption } from '@/lib/admin-tier'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate, splitPlaceholders } from '@/lib/format-message'
import { roleLabel } from '@/lib/i18n-feed-card'
import { adminShellT } from '@/lib/i18n-admin-shell'
import { adminPeopleT, denialText, grantOptionLabel } from '@/lib/i18n-admin-people'

type Person = {
  id: string
  first_name: string | null
  username: string | null
  avatar_url: string | null
  admin_tier: AdminTier | null
  joined_at: string | null
}

type PendingAction = { person: Person; option: GrantOption }

/** The confirmation sentence, its {tier} and {name} slots as bold elements (the name in its own direction). */
function PendingDescription({ pending, locale }: { pending: PendingAction; locale: Locale }) {
  const name = pending.person.first_name ?? pending.person.username
  const template = adminPeopleT(locale, pending.option.value ? 'grantTo' : 'revokeFrom')
  return (
    <>
      {splitPlaceholders(template).map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : part.name === 'tier' && pending.option.value ? (
          <strong key={i}>{roleLabel(pending.option.value, locale)}</strong>
        ) : part.name === 'name' ? (
          name ? (
            <strong key={i} lang="" dir="auto">{name}</strong>
          ) : (
            <strong key={i}>{adminPeopleT(locale, 'thisPerson')}</strong>
          )
        ) : null,
      )}{' '}
      {adminPeopleT(locale, 'reasonRequired')}
    </>
  )
}

export function PeopleTab({ viewerTier, isFounder, locale = 'en' }: { viewerTier: AdminTier | null; isFounder: boolean; locale?: Locale }) {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  // The first read has finished: later re-reads keep the rows on screen (no loading swap).
  const [loaded, setLoaded] = useState(false)
  // The tab's one status line ("Tier updated."), always mounted so each change is announced.
  const [announcement, setAnnouncement] = useState('')
  // The list read failed (its sentence is chosen at render, in the admin's language).
  const [error, setError] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [reason, setReason] = useState('')
  const [isActioning, setIsActioning] = useState(false)
  // A refused or failed tier change: shown in the open dialog's alert.
  const [dialogError, setDialogError] = useState<string | null>(null)
  // The confirmation keeps its text while it animates out (pending is already null by then).
  const lastPending = useRef<PendingAction | null>(null)
  if (pending) lastPending.current = pending
  const shownPending = pending ?? lastPending.current
  // The row whose select opened the dialog: focus goes back to it when the dialog closes.
  const returnFocusId = useRef<string | null>(null)
  const selects = useRef(new Map<string, HTMLSelectElement>())
  const inFlight = useRef(false)
  const searchId = useId()
  const reasonId = useId()

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setError(false)
    const supabase = createClient()
    const { data, error } = await supabase.rpc('admin_list_people', { p_search: q || undefined })
    if (error) {
      logger.warn('admin.people.list_failed', { code: error.code })
      setError(true)
      setPeople([])
    } else {
      setPeople((data as Person[]) ?? [])
    }
    setLoading(false)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load('')
  }, [load])

  const canApply = !!pending && reason.trim() !== '' && !isActioning

  const closeDialog = () => {
    setPending(null)
    setReason('')
    setDialogError(null)
  }

  const applyAction = async () => {
    // aria-disabled keeps Apply focusable, so the guard lives here (and one call at a time).
    if (!pending || !reason.trim() || inFlight.current) return
    inFlight.current = true
    setIsActioning(true)
    setDialogError(null)
    setAnnouncement('')
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
        { action: 'tier.set' },
      )

      const result = (data ?? {}) as { ok?: boolean; code?: string }
      if (error) {
        logger.warn('admin.denied', { action: 'tier.set', code: error.code ?? 'unknown', request_id: requestId })
        setDialogError(adminPeopleT(locale, 'changeFailed'))
      } else if (!result.ok) {
        const code = result.code ?? 'unknown'
        logger.warn('admin.denied', { action: 'tier.set', code, request_id: requestId })
        setDialogError(denialText(code, locale))
      } else {
        logger.info('admin.tier.set', {
          to: pending.option.value,
          request_id: requestId,
        })
        closeDialog()
        // The rows stay while the list re-reads; then the result is announced (focus is back on
        // the row's select: onCloseAutoFocus below).
        await load(search)
        setAnnouncement(adminPeopleT(locale, 'tierUpdated'))
      }
    } catch {
      logger.warn('admin.denied', { action: 'tier.set', code: 'exception' })
      setDialogError(adminPeopleT(locale, 'changeFailed'))
    } finally {
      inFlight.current = false
      setIsActioning(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <UserCog className="h-4 w-4 text-[#4a5d23]" aria-hidden="true" />
          {adminShellT(locale, 'tabPeople')}
        </h3>
        <div className="ms-auto flex min-w-0 flex-1 basis-56 flex-col gap-1 sm:flex-none">
          {/* A visible label: it stays when typing starts (a placeholder would not). */}
          <label htmlFor={searchId} className="text-xs font-medium text-stone-700">
            {adminPeopleT(locale, 'searchLabel')}
          </label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(search) }}
              className="min-h-9 min-w-0 flex-1 text-sm border border-stone-500 rounded-lg px-3 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700 sm:w-64 sm:flex-none"
            />
            <button
              onClick={() => load(search)}
              className="min-h-9 shrink-0 px-3 py-1.5 rounded-lg bg-lime-700 text-white text-sm font-medium hover:bg-lime-800 transition-colors"
            >
              {adminPeopleT(locale, 'search')}
            </button>
          </div>
        </div>
      </div>

      {/* The tab's one alert and one status line, always mounted: only their text changes. */}
      <div role="alert" className={error ? 'py-3 px-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200' : 'sr-only'}>
        {error ? adminPeopleT(locale, 'loadFailed') : ''}
      </div>
      <p role="status" data-testid="people-status" className={!loaded ? 'py-6 text-stone-600 text-sm' : 'sr-only'}>
        {!loaded ? adminPeopleT(locale, 'loading') : announcement}
      </p>

      {!loaded ? null : people.length === 0 ? (
        <div className="py-6 text-stone-600 text-sm">{adminPeopleT(locale, 'empty')}</div>
      ) : (
        <div aria-busy={loading || undefined} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-stone-100 bg-stone-50/60">
                <TableHead className="h-9 px-4 text-start text-xs font-medium text-stone-600">{adminPeopleT(locale, 'colPerson')}</TableHead>
                <TableHead className="h-9 px-4 text-start text-xs font-medium text-stone-600">{adminPeopleT(locale, 'colTier')}</TableHead>
                <TableHead className="h-9 px-4 text-start text-xs font-medium text-stone-600">{adminPeopleT(locale, 'colSetTier')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const options = grantableTiers(viewerTier, isFounder, person.admin_tier)
                const label = person.admin_tier ? roleLabel(person.admin_tier, locale) : null
                const personName = person.first_name ?? person.username ?? adminPeopleT(locale, 'noName')
                return (
                  <TableRow key={person.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {person.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span lang="" dir="auto" className="text-xs font-semibold text-[#4a5d23]">
                              {(person.first_name ?? person.username ?? '?').slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {person.first_name ? (
                              <span lang="" dir="auto">{person.first_name}</span>
                            ) : (
                              <span className="text-stone-600 italic">{adminPeopleT(locale, 'noName')}</span>
                            )}
                          </p>
                          <p className="text-xs text-stone-600 truncate">
                            {person.username ? <span lang="" dir="auto">@{person.username}</span> : '—'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {label ? (
                        <Badge className="bg-lime-100 text-lime-800 border-0 text-xs rounded-full px-2.5">{label}</Badge>
                      ) : (
                        <span className="text-xs text-stone-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {options.length === 0 ? (
                        <span className="text-xs text-stone-600">{adminPeopleT(locale, 'noActions')}</span>
                      ) : (
                        <select
                          ref={(node: HTMLSelectElement | null) => {
                            if (node) selects.current.set(person.id, node)
                            else selects.current.delete(person.id)
                          }}
                          aria-label={formatMessage(adminPeopleT(locale, 'setTierFor'), { name: isolate(personName) })}
                          value=""
                          onChange={(e) => {
                            const opt = options.find((o) => String(o.value) === e.target.value)
                            if (opt) {
                              returnFocusId.current = person.id
                              setPending({ person, option: opt })
                              setReason('')
                              setDialogError(null)
                              setAnnouncement('')
                            }
                          }}
                          className="min-h-9 max-w-full text-sm border border-stone-500 rounded-lg px-2 py-1.5 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-lime-700"
                        >
                          <option value="">{adminPeopleT(locale, 'change')}</option>
                          {options.map((o) => (
                            <option key={String(o.value)} value={String(o.value)}>{grantOptionLabel(o, locale)}</option>
                          ))}
                        </select>
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
      <Dialog open={!!pending} onOpenChange={(open: boolean) => { if (!open) closeDialog() }}>
        {/* A portal: it carries the admin's language itself (the dialog primitive defaults to English).
            Closing (Apply, Cancel, Escape, X) returns focus to the select of the row that opened it. */}
        <DialogContent
          lang={locale}
          dir={dir(locale)}
          closeLabel={adminPeopleT(locale, 'close')}
          onCloseAutoFocus={(e: Event) => {
            const target = returnFocusId.current ? selects.current.get(returnFocusId.current) : undefined
            if (target) {
              e.preventDefault()
              target.focus()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{shownPending ? grantOptionLabel(shownPending.option, locale) : null}</DialogTitle>
            <DialogDescription>{shownPending && <PendingDescription pending={shownPending} locale={locale} />}</DialogDescription>
          </DialogHeader>
          <label htmlFor={reasonId} className="text-sm font-medium text-stone-700">
            {adminPeopleT(locale, 'reasonLabel')}
          </label>
          <textarea
            id={reasonId}
            className="w-full text-sm rounded-lg border border-stone-500 px-3 py-2 text-stone-900 resize-none focus:outline-none focus:ring-2 focus:ring-lime-700"
            rows={3}
            required
            aria-required="true"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          {/* The dialog's one alert, always mounted: a refusal or failure while it is open. */}
          <p role="alert" data-testid="people-dialog-alert" className={dialogError ? 'text-sm text-red-700' : 'sr-only'}>
            {dialogError ?? ''}
          </p>
          <DialogFooter>
            <button
              onClick={closeDialog}
              className="px-4 py-2 rounded-lg border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              {adminPeopleT(locale, 'cancel')}
            </button>
            <button
              onClick={() => void applyAction()}
              aria-disabled={!canApply || undefined}
              data-testid="people-apply"
              className="px-4 py-2 rounded-lg bg-lime-700 hover:bg-lime-800 text-white text-sm font-medium aria-disabled:cursor-not-allowed aria-disabled:opacity-60 transition-colors"
            >
              {isActioning ? adminPeopleT(locale, 'applying') : adminPeopleT(locale, 'apply')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
