'use client'

// apps/web/src/components/alerts/alert-editor-dialog.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The reporter's three actions on their own safety alert — update, mark resolved, withdraw — as one
// dialog, opened from the map popup or the feed strip (specs/r3-contract.md "Writes").
//
//  - It opens from a FRESH read of the alert (never the values a marker or strip entry was holding),
//    and every update and resolve sends the version that read returned.
//  - A stale version (PT409) opens a compare step: the current version, re-read, beside the member's
//    changes carried onto it, and a choice — keep mine (sent once, with the version just read, on
//    Continue; only the fields the member changed, so the other save's remaining changes stand) or
//    use the current version (nothing is sent). Nothing is retried on its own.
//  - "No longer live" (PT410) or "gone" (PT404) closes the dialog, says so, and the surface re-reads.
//  - One send per click: a single-flight gate held in a ref, taken before the first await. A write
//    that never answers gives up after 12 s (lib/safety-alert-rpc.ts): the gate is released and the
//    dialog says the connection failed, so the member can try again. Each opening has its own gate,
//    so a write still waiting from an earlier opening never swallows a Save in this one. An answer
//    that arrives after the dialog was closed is still applied to the surface, and announces nothing.
//  - On the reporter's own verified alert the form says, before saving, that changing it returns it to
//    unverified.
//  - After a save the notice names the new expiry when the save moved it (a severity change does).
//  - A proper dialog: a title that takes focus (with a visible ring), Cancel in every state, the
//    confirmation's text as its description, Escape, and focus back to the control that opened it.
//    When that control is gone but the alert is still there (it was just marked resolved), focus goes
//    to the alert's own entry or open popup. When the alert left (withdrawn, or found ended), the
//    surface puts focus on the next sensible place. Only then is the outcome announced
//    (host.announce, a polite region — the page behind an open modal is hidden from assistive
//    technology).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { dir, type Locale } from '@/lib/i18n'
import { ALERT_SEVERITIES, alertFailureText, alertSeverityHint, alertTypeLabel, alertsT, type AlertMessages } from '@/lib/i18n-feed-alerts'
import { isAlertLive } from '@/lib/safety-alert-live'
import {
  ALERT_TYPES,
  readSafetyAlertById,
  resolveSafetyAlert,
  updateSafetyAlert,
  withdrawSafetyAlert,
  type AlertRpcFailure,
  type AlertSurface,
  type AlertType,
  type SafetyAlert,
} from '@/lib/safety-alert-rpc'
import { createSingleFlight } from '@/components/feed/composer-guards'
import type { AlertHost } from '@/hooks/use-safety-strip'
import { AlertSummary } from './alert-parts'
import { alertDraftChanges, alertDraftOf, rebaseAlertDraft, resolvedNoticeText, savedNoticeText, type AlertDraft } from './alert-edit-model'

export type AlertActionKind = 'edit' | 'resolve' | 'withdraw'

export interface AlertActionRequest {
  kind: AlertActionKind
  alertId: string
}

export type ConflictChoice = 'keep_mine' | 'use_current'

type Phase =
  | { kind: 'loading' }
  | { kind: 'load_failed' }
  /** The form (update) or the confirmation (resolve, withdraw), on the alert as last read. */
  | { kind: 'ready'; base: SafetyAlert; error: string | null }
  /** Someone saved a newer version first: `current` is that version, re-read; `mine` is the member's
   *  changes carried onto it (what "keep mine" would save). */
  | { kind: 'conflict'; current: SafetyAlert; mine: AlertDraft | null; choice: ConflictChoice }

const TITLE: Record<AlertActionKind, keyof AlertMessages> = { edit: 'editTitle', resolve: 'resolveTitle', withdraw: 'withdrawTitle' }

// stone-500 on white is 4.8:1: the field's edge is visible without relying on its fill.
const FIELD_CLASS =
  'mt-1 block w-full min-h-9 rounded-md border border-stone-500 bg-white px-3 py-2 text-sm text-stone-900 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700'

/** A heading that takes focus shows it. */
const FOCUSED_HEADING = 'rounded-sm focus:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2'

export interface AlertEditorDialogProps {
  /** The action and the alert; null = closed. */
  request: AlertActionRequest | null
  locale: Locale
  surface: AlertSurface
  /** The surface that opened the dialog (the strip or the map). */
  host: AlertHost
  onClose: () => void
  /** The control that opened the dialog (focus returns to it while it still exists). */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /** The viewer's zone (tests fix it). */
  tz?: string
}

export function AlertEditorDialog({ request, locale, surface, host, onClose, returnFocusRef, tz }: AlertEditorDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [draft, setDraft] = useState<AlertDraft | null>(null)
  const [busy, setBusy] = useState(false)
  // Single-flight: a second click before the first answer is ignored (taken before the first await).
  const gate = useRef(createSingleFlight())
  // What happens once the dialog has closed: the notice to announce, and whether the alert left.
  const afterClose = useRef<{ notice: string; left: boolean } | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const conflictHeadingRef = useRef<HTMLHeadingElement>(null)
  // Which opening the dialog is on: an answer that arrives for an earlier one changes no screen.
  const opening = useRef(0)
  const kind: AlertActionKind = request?.kind ?? 'edit'
  const alertId = request?.alertId ?? null
  // The alert the dialog was last open on (the request is gone by the time focus is handed back).
  const closedAlert = useRef<string | null>(null)
  useEffect(() => {
    if (alertId) closedAlert.current = alertId
  }, [alertId])
  const t = useCallback((key: keyof AlertMessages) => alertsT(locale, key), [locale])

  const finish = useCallback(
    (notice: string, left = false) => {
      afterClose.current = { notice, left }
      onClose()
    },
    [onClose],
  )

  /** The alert is gone for everyone: it leaves the surface, the surface re-reads, the member is told. */
  const gone = useCallback(
    (id: string) => {
      host.leave(id)
      host.refresh()
      finish(alertsT(locale, 'notLiveNotice'), true)
    },
    [host, finish, locale],
  )

  /** A resolved alert takes no update and no second resolve: show it resolved and say so. */
  const alreadyResolved = useCallback(
    (alert: SafetyAlert | null) => {
      if (alert) host.applyAnswer(alert)
      host.refresh()
      finish(alertsT(locale, 'nowResolvedNotice'))
    },
    [host, finish, locale],
  )

  const load = useCallback(
    async (id: string, action: AlertActionKind, isActive: () => boolean) => {
      setPhase({ kind: 'loading' })
      setDraft(null)
      setBusy(false)
      let alert: SafetyAlert | null
      try {
        alert = await readSafetyAlertById(supabase, id)
      } catch {
        if (isActive()) setPhase({ kind: 'load_failed' })
        return
      }
      if (!isActive()) return
      if (!alert) return gone(id)
      if (action !== 'withdraw' && !isAlertLive(alert)) return alreadyResolved(alert)
      setDraft(alertDraftOf(alert))
      setPhase({ kind: 'ready', base: alert, error: null })
    },
    [supabase, gone, alreadyResolved],
  )

  // Open: read the alert (server truth), every time it opens — and only then. The effect is keyed on
  // the alert id and the action (two strings); the latest `load` is reached through a ref, so a parent
  // re-render that hands over new callbacks never reads again or resets the form.
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  }, [load])
  useEffect(() => {
    opening.current += 1
    // A new opening, a new gate: a write still in flight from the last one holds only its own.
    gate.current = createSingleFlight()
    if (!alertId) return
    let active = true
    void loadRef.current(alertId, kind, () => active)
    return () => {
      active = false
    }
  }, [alertId, kind])

  // The comparison takes focus on its heading when it opens.
  useEffect(() => {
    if (phase.kind !== 'conflict') return
    const raf = requestAnimationFrame(() => conflictHeadingRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [phase.kind])

  const refuse = useCallback(
    async (failure: AlertRpcFailure, base: SafetyAlert, mine: AlertDraft | null) => {
      switch (failure.kind) {
        case 'conflict': {
          // Someone saved first. Read what they saved, show both, let the member choose.
          let current: SafetyAlert | null
          try {
            current = await readSafetyAlertById(supabase, base.id)
          } catch {
            return setPhase({ kind: 'ready', base, error: alertsT(locale, 'failNetwork') })
          }
          if (!current) return gone(base.id)
          if (!isAlertLive(current)) return alreadyResolved(current)
          return setPhase({ kind: 'conflict', current, mine: mine ? rebaseAlertDraft(base, mine, current) : null, choice: 'keep_mine' })
        }
        case 'not_live':
          return failure.resolved ? alreadyResolved(null) : gone(base.id)
        case 'not_found':
          return gone(base.id)
        default:
          return setPhase({ kind: 'ready', base, error: alertFailureText(locale, failure) })
      }
    },
    [supabase, locale, gone, alreadyResolved],
  )

  /** One send. `base` is the alert as last read: its version is the token. */
  const send = useCallback(
    async (base: SafetyAlert, mine: AlertDraft | null) => {
      await gate.current.run(async () => {
        setBusy(true)
        const sentFrom = opening.current
        // The dialog this answer belongs to was closed (or reopened) meanwhile: the surface still
        // gets the truth, and nothing is shown or announced for it.
        const stale = () => opening.current !== sentFrom
        try {
          if (kind === 'withdraw') {
            const res = await withdrawSafetyAlert(supabase, base, surface)
            if (stale()) return void (res.ok ? (host.leave(base.id), host.refresh()) : host.refresh())
            if (!res.ok) return await refuse(res.failure, base, null)
            host.leave(base.id)
            host.refresh()
            return finish(alertsT(locale, 'withdrawnNotice'), true)
          }
          if (kind === 'resolve') {
            const res = await resolveSafetyAlert(supabase, base, surface)
            if (stale()) return void (res.ok ? (host.applyAnswer(res.value), host.refresh()) : host.refresh())
            if (!res.ok) return await refuse(res.failure, base, null)
            host.applyAnswer(res.value)
            host.refresh()
            return finish(resolvedNoticeText(res.value, locale, tz))
          }
          const changes = mine ? alertDraftChanges(base, mine) : {}
          if (Object.keys(changes).length === 0) return finish(alertsT(locale, 'nothingChanged'))
          const res = await updateSafetyAlert(supabase, base, changes, surface)
          if (stale()) return void (res.ok ? (host.applyAnswer(res.value), host.refresh()) : host.refresh())
          if (!res.ok) return await refuse(res.failure, base, mine)
          host.applyAnswer(res.value)
          host.refresh()
          return finish(savedNoticeText(base, res.value, locale, tz))
        } finally {
          // A newer opening owns the Save button now (its own read reset it).
          if (!stale()) setBusy(false)
        }
      })
    },
    [kind, supabase, surface, host, finish, refuse, locale, tz],
  )

  /** The member chose. "Use current" sends nothing; "keep mine" sends once, with the current version. */
  const resolveConflict = useCallback(() => {
    if (phase.kind !== 'conflict') return
    const { current, mine, choice } = phase
    if (choice === 'use_current') {
      host.applyAnswer(current)
      host.refresh()
      return finish(alertsT(locale, kind === 'resolve' ? 'notResolvedNotice' : 'notSavedNotice'))
    }
    setDraft(mine)
    setPhase({ kind: 'ready', base: current, error: null })
    void send(current, mine)
  }, [phase, host, finish, locale, kind, send])

  const base = phase.kind === 'ready' ? phase.base : null
  const hasChanges = base !== null && draft !== null && Object.keys(alertDraftChanges(base, draft)).length > 0
  const idPrefix = `alert-${kind}-${alertId ?? 'none'}`

  return (
    <Dialog open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        hideDefaultClose
        disableOutsideClose
        lang={locale}
        dir={dir(locale)}
        // The confirmations describe themselves with their body text; the form has its own labels.
        aria-describedby={base && kind !== 'edit' ? `${idPrefix}-body` : undefined}
        className="max-h-[90vh] max-w-lg overflow-y-auto"
        data-testid="alert-editor-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          const done = afterClose.current
          afterClose.current = null
          const opener = returnFocusRef?.current
          // Focus first: back to the opener; when it is gone but the alert is still there (it was
          // just marked resolved), the alert's own entry or popup; when the alert left, the next
          // sensible place.
          if (!done?.left && opener && opener.isConnected) opener.focus()
          else if (done?.left || !closedAlert.current || !host.focusAlert(closedAlert.current)) host.focusAfterLeave()
          // Then the outcome, once (the notice region is behind the modal until it has closed).
          if (done?.notice) requestAnimationFrame(() => host.announce(done.notice))
        }}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className={`text-start ${FOCUSED_HEADING}`}>
            {t(TITLE[kind])}
          </DialogTitle>
        </DialogHeader>

        {phase.kind === 'loading' && (
          <>
            <p role="status" className="flex items-center gap-2 text-sm text-stone-700">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('loadingAlert')}
            </p>
            {/* A way out that needs no Escape key, also while the alert is being read. */}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="alert-editor-cancel-loading">
                {t('cancel')}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase.kind === 'load_failed' && (
          <>
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-red-800">
              {t('loadFailed')}
              <Button type="button" variant="outline" size="sm" onClick={() => void (alertId && load(alertId, kind, () => true))}>
                {t('retry')}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('close')}
              </Button>
            </DialogFooter>
          </>
        )}

        {base && kind === 'edit' && draft && (
          <form
            noValidate
            className="flex flex-col gap-4"
            data-testid="alert-edit-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!busy && hasChanges) void send(base, draft)
            }}
          >
            {base.verified && base.is_mine && (
              <p className="rounded-md border border-sky-300 bg-sky-50 p-2 text-sm text-sky-950" data-testid="alert-verified-notice">
                {t('verifiedNotice')}
              </p>
            )}
            <div>
              <Label htmlFor={`${idPrefix}-type`}>{t('fieldType')}</Label>
              <select
                id={`${idPrefix}-type`}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as AlertType })}
                className={FIELD_CLASS}
                data-testid="alert-edit-type"
              >
                {ALERT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {alertTypeLabel(type, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-severity`}>{t('fieldSeverity')}</Label>
              <select
                id={`${idPrefix}-severity`}
                value={String(draft.severity)}
                onChange={(e) => setDraft({ ...draft, severity: Number(e.target.value) })}
                aria-describedby={draft.severity !== base.severity ? `${idPrefix}-expiry` : undefined}
                className={FIELD_CLASS}
                data-testid="alert-edit-severity"
              >
                {ALERT_SEVERITIES.map((level) => (
                  <option key={level} value={String(level)}>
                    {alertSeverityHint(level, locale)}
                  </option>
                ))}
              </select>
              {draft.severity !== base.severity && (
                <p id={`${idPrefix}-expiry`} className="mt-1 text-xs text-stone-700">
                  {t('expiryHint')}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-description`}>{t('fieldDescription')}</Label>
              <Textarea
                id={`${idPrefix}-description`}
                dir="auto"
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
                className="mt-1 resize-none bg-white text-stone-900 placeholder:text-stone-500"
                data-testid="alert-edit-description"
              />
            </div>
            {phase.kind === 'ready' && phase.error && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900" data-testid="alert-editor-error">
                {phase.error}
              </p>
            )}
            <DialogFooter className="gap-2">
              {!hasChanges && (
                <p id={`${idPrefix}-nochanges`} className="me-auto self-center text-xs text-stone-600">
                  {t('nothingChanged')}
                </p>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                // aria-disabled (not disabled): the button keeps focus while saving / with nothing to save.
                aria-disabled={busy || !hasChanges || undefined}
                aria-describedby={!hasChanges ? `${idPrefix}-nochanges` : undefined}
                className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
                data-testid="alert-editor-save"
              >
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy ? t('saving') : t('save')}
              </Button>
            </DialogFooter>
          </form>
        )}

        {base && kind !== 'edit' && (
          <div className="flex flex-col gap-4" data-testid={`alert-${kind}-confirm`}>
            <AlertSummary alert={base} locale={locale} />
            <p id={`${idPrefix}-body`} className="text-sm text-stone-800">{t(kind === 'resolve' ? 'resolveBody' : 'withdrawBody')}</p>
            {phase.kind === 'ready' && phase.error && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900" data-testid="alert-editor-error">
                {phase.error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                aria-disabled={busy || undefined}
                onClick={() => {
                  if (!busy) void send(base, null)
                }}
                className={
                  kind === 'withdraw'
                    ? 'bg-red-700 text-white hover:bg-red-800 aria-disabled:opacity-60'
                    : 'bg-[#4a5d23] text-white hover:bg-[#3a4d1a] aria-disabled:opacity-60'
                }
                data-testid="alert-editor-confirm"
              >
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {busy ? t('saving') : t(kind === 'resolve' ? 'resolveConfirm' : 'withdrawConfirm')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {phase.kind === 'conflict' && (
          <div className="flex flex-col gap-4" data-testid="alert-conflict">
            <div>
              <h3 ref={conflictHeadingRef} tabIndex={-1} className={`text-base font-semibold text-stone-900 ${FOCUSED_HEADING}`}>
                {t('conflictTitle')}
              </h3>
              <p className="mt-1 text-sm text-stone-700">{t('conflictBody')}</p>
            </div>
            <div className={kind === 'edit' ? 'grid gap-3 sm:grid-cols-2' : undefined}>
              {kind === 'edit' && phase.mine && (
                <AlertSummary
                  alert={{ alert_type: phase.mine.type, severity: phase.mine.severity, description: phase.mine.description.trim() || null }}
                  locale={locale}
                  heading={t('yourVersion')}
                />
              )}
              <AlertSummary alert={phase.current} locale={locale} heading={t('currentVersion')} />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-stone-900">{t('conflictChoose')}</legend>
              {(['keep_mine', 'use_current'] as const).map((choice) => (
                <label key={choice} className="flex min-h-6 items-start gap-2 rounded-md border border-stone-200 p-2 text-sm text-stone-800 has-[:checked]:border-[#4a5d23]">
                  <input
                    type="radio"
                    name={`${idPrefix}-choice`}
                    value={choice}
                    checked={phase.choice === choice}
                    onChange={() => setPhase({ ...phase, choice })}
                    className="mt-0.5 h-4 w-4 accent-[#4a5d23]"
                    data-testid={`alert-conflict-${choice}`}
                  />
                  <span>
                    <span className="font-medium">
                      {choice === 'keep_mine' ? t(kind === 'resolve' ? 'resolveAnyway' : 'keepMine') : t(kind === 'resolve' ? 'leaveAsIs' : 'useCurrent')}
                    </span>
                    {kind === 'edit' && <span className="block text-xs text-stone-600">{t(choice === 'keep_mine' ? 'keepMineHint' : 'useCurrentHint')}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button type="button" onClick={resolveConflict} className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a]" data-testid="alert-conflict-continue">
                {t('continueLabel')}
              </Button>
            </DialogFooter>
          </div>
        )}

        <p role="status" className="sr-only">
          {busy ? t('saving') : ''}
        </p>
      </DialogContent>
    </Dialog>
  )
}
