'use client'

// apps/web/src/components/events/event-card-admin-menu.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The ⋯ menu on an event card (community feed and Events tab) for the people who may manage that
// event — a platform admin, or an admin of the event's organization (components/feed/event-card-menu.ts).
// Everyone else gets nothing here, and so does everyone in server HTML and the first, hydrating
// client render (the same rule as "Edit in admin").
//
//   Edit event     the admin scheduler's edit dialog (components/events/event-edit-dialog.tsx), filled
//                  from the event read by id (lib/event-edit-target.ts) — the read starts when the
//                  menu opens, so the dialog is usually ready when the item is chosen
//   Add dates      the scheduler's add-dates dialog
//   Cancel date    the scheduler's cancel confirmation, for the card's shown date
//   Edit in admin  the shared "Edit in admin" link (ClientAdminEditLink), as the menu item itself
//
// Every save is the dialog's ONE RPC (lib/event-admin-rpc.ts: permission decided in the database,
// one app_logs row labelled surface=feed_card). After a save the card's owner re-reads that one
// card (`onChanged`). Each dialog returns focus to the ⋯ trigger when it closes. The dialogs are
// loaded on first use, so members never download them.

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { CalendarPlus, CalendarX, ExternalLink, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import type { Locale } from '@/lib/i18n'
import { eventFormT, formatMessage } from '@/lib/i18n-event-forms'
import { eventMemberT } from '@/lib/i18n-event-member'
import { loadEditTarget } from '@/lib/event-edit-target'
import { useAdminViewer } from '@/hooks/use-admin-viewer'
import { ClientAdminEditLink, useHydrated } from '@/components/admin/client-admin-edit-link'
import type { AdminEditSource } from '@/components/admin/admin-edit-link'
import { CardActionsMenu, type CardMenuSection } from '@/components/feed/card-actions-menu'
import { eventMenuEntries, type EventMenuEntry } from '@/components/feed/event-card-menu'
import type { EventCardItem } from '@/components/feed/post-model'
import type { EditTarget } from './event-edit-dialog'

export const LazyEventEditDialog = dynamic(() => import('./event-edit-dialog').then((m) => m.EventEditDialog), { ssr: false })
export const LazyEventDatesDialog = dynamic(() => import('./event-dates-dialog').then((m) => m.EventDatesDialog), { ssr: false })
export const LazyCancelDateConfirm = dynamic(() => import('./cancel-date-confirm').then((m) => m.CancelDateConfirm), { ssr: false })

/** What a save from the menu changed (the card owner re-reads the card and announces it). */
export type EventCardChange =
  | { kind: 'updated' }
  | { kind: 'retired' }
  | { kind: 'dates_added'; changed: number }
  | { kind: 'date_cancelled' }

export type EventMenuSource = Extract<AdminEditSource, 'feed_event_menu' | 'events_panel_menu'>

/** The announcement after a save; `gone` = the re-read card is no longer listed. */
export function eventChangeNotice(change: EventCardChange, gone: boolean, locale: Locale): string {
  const saved =
    change.kind === 'retired'
      ? eventFormT(locale, 'retiredNotice')
      : change.kind === 'dates_added'
        ? change.changed > 0
          ? formatMessage(eventFormT(locale, 'datesAdded'), { count: change.changed })
          : eventFormT(locale, 'datesNoneAdded')
        : change.kind === 'date_cancelled'
          ? eventFormT(locale, 'dateCancelled')
          : eventFormT(locale, 'savedNotice')
  return gone ? `${saved} ${eventMemberT(locale, 'cardGoneNotice')}` : saved
}

/** The menu's sections for these entries (pure: the items and what choosing each one does). */
export function eventMenuSections({
  entries,
  event,
  locale,
  source,
  onEdit,
  onAddDates,
  onCancelDate,
}: {
  entries: readonly EventMenuEntry[]
  event: Pick<EventCardItem, 'eventId' | 'orgId' | 'title'>
  locale: Locale
  source: EventMenuSource
  onEdit: () => void
  onAddDates: () => void
  onCancelDate: () => void
}): CardMenuSection[] {
  const icon = (I: typeof Pencil) => <I className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
  const manage: CardMenuSection = { id: 'manage', items: [] }
  const admin: CardMenuSection = { id: 'admin', items: [] }
  const danger: CardMenuSection = { id: 'danger', items: [] }
  for (const entry of entries) {
    switch (entry.action) {
      case 'edit':
        manage.items = [...manage.items, { kind: 'action', id: 'edit', label: eventFormT(locale, 'editTitle'), icon: icon(Pencil), onSelect: onEdit, testId: `event-menu-edit-${event.eventId}` }]
        break
      case 'add_dates':
        manage.items = [...manage.items, { kind: 'action', id: 'add_dates', label: eventFormT(locale, 'addDates'), icon: icon(CalendarPlus), onSelect: onAddDates, testId: `event-menu-add-dates-${event.eventId}` }]
        break
      case 'cancel_date':
        danger.items = [
          entry.unavailable === null
            ? { kind: 'action', id: 'cancel_date', label: eventFormT(locale, 'cancelDate'), icon: icon(CalendarX), destructive: true, onSelect: onCancelDate, testId: `event-menu-cancel-${event.eventId}` }
            : {
                kind: 'unavailable',
                id: 'cancel_date',
                label: eventFormT(locale, 'cancelDate'),
                reason: eventMemberT(locale, entry.unavailable === 'cancelled' ? 'cancelUnavailableCancelled' : 'cancelUnavailableEnded'),
                icon: icon(CalendarX),
                testId: `event-menu-cancel-${event.eventId}`,
              },
        ]
        break
      case 'open_admin':
        admin.items = [
          {
            kind: 'link',
            id: 'open_admin',
            element: (
              <ClientAdminEditLink
                target={{ kind: 'event', id: event.eventId, orgId: event.orgId }}
                itemName={event.title}
                source={source}
                locale={locale}
                icon={icon(ExternalLink)}
                data-testid={`admin-edit-event-${event.eventId}`}
              />
            ),
          },
        ]
        break
    }
  }
  return [manage, admin, danger]
}

// One dialog at a time, mounted only while open: every open is a fresh form (and a fresh
// idempotency key inside it).
/**
 * The edit dialog's event read for one card: `prefetch` (the menu opened) starts a fresh read
 * unless one is still running; `take` (Edit event chosen) waits for it — or starts one — and
 * resolves the target (null = the read failed or found no event). Choices made while one read runs
 * share it.
 */
export function createEditTargetLoader(load: () => Promise<EditTarget | null>) {
  let pending: { promise: Promise<EditTarget | null>; settled: boolean } | null = null
  const start = () => {
    const entry = { settled: false, promise: load() }
    entry.promise = entry.promise.finally(() => {
      entry.settled = true
    })
    pending = entry
    return entry.promise
  }
  return {
    prefetch() {
      if (!pending || pending.settled) void start()
    },
    async take(): Promise<EditTarget | null> {
      const p = pending?.promise ?? start()
      try {
        return await p
      } finally {
        // The next choice (after this dialog closes) reads afresh.
        if (pending?.promise === p) pending = null
      }
    },
  }
}

type OpenDialog =
  | { kind: 'edit'; target: EditTarget }
  | { kind: 'dates'; initialDate: string }
  | { kind: 'cancel' }

export function EventCardAdminMenu({
  event,
  locale,
  source,
  onChanged,
}: {
  event: EventCardItem
  locale: Locale
  source: EventMenuSource
  /** A save from the menu went through (the owner re-reads this card). */
  onChanged?: (eventId: string, change: EventCardChange) => void
}) {
  const hydrated = useHydrated()
  const viewer = useAdminViewer(true)
  const supabase = useMemo(() => createClient(), [])
  const triggerRef = useRef<HTMLButtonElement>(null)
  // "Now" for the cancel rule: the mount time, refreshed each time the menu opens.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [dialog, setDialog] = useState<OpenDialog | null>(null)
  const [opening, setOpening] = useState(false)
  const [editError, setEditError] = useState(false)
  // Reads the event for the edit dialog (fresh on every menu open; one choice → one dialog).
  const [editTargets] = useState(() =>
    createEditTargetLoader(() =>
      loadEditTarget(supabase, event.eventId).catch((err: { code?: string; name?: string } | null) => {
        logger.warn('events.card.edit_load_failed', { code: err?.code || err?.name || 'unknown' })
        return null
      }),
    ),
  )

  const entries = hydrated ? eventMenuEntries(event, viewer, nowMs) : []
  // Every dialog opened from the menu returns focus to the ⋯ trigger when it closes.
  const restoreFocus = useCallback((e: Event) => {
    e.preventDefault()
    triggerRef.current?.focus()
  }, [])

  const openEdit = async () => {
    setEditError(false)
    setOpening(true)
    const target = await editTargets.take()
    setOpening(false)
    if (!target) {
      setEditError(true)
      return
    }
    setDialog({ kind: 'edit', target })
  }

  if (entries.length === 0) return null

  const sections = eventMenuSections({
    entries,
    event,
    locale,
    source,
    onEdit: () => void openEdit(),
    onAddDates: () => setDialog({ kind: 'dates', initialDate: format(new Date(), 'yyyy-MM-dd') }),
    onCancelDate: () => setDialog({ kind: 'cancel' }),
  })
  const close = () => setDialog(null)
  const changed = (change: EventCardChange) => onChanged?.(event.eventId, change)

  return (
    <div className="flex flex-col items-end gap-1">
      <CardActionsMenu
        sections={sections}
        triggerLabel={formatMessage(eventMemberT(locale, 'cardMenuAria'), { title: event.title })}
        locale={locale}
        triggerRef={triggerRef}
        testId={`event-menu-${event.eventId}`}
        busy={opening}
        onOpenChange={(open) => {
          if (!open) return
          setNowMs(Date.now())
          setEditError(false)
          // Read the event for the edit dialog now, so choosing "Edit event" opens it at once with
          // the current values.
          editTargets.prefetch()
        }}
      />
      {editError && (
        <p role="alert" className="max-w-[14rem] text-end text-xs text-red-700">
          {eventMemberT(locale, 'editLoadError')}
        </p>
      )}

      {dialog?.kind === 'edit' && (
        <LazyEventEditDialog
          open
          onOpenChange={(open) => {
            if (!open) close()
          }}
          locale={locale}
          event={dialog.target}
          surface="feed_card"
          onCloseAutoFocus={restoreFocus}
          onSaved={(action) => changed({ kind: action === 'retire' ? 'retired' : 'updated' })}
        />
      )}
      {dialog?.kind === 'dates' && (
        <LazyEventDatesDialog
          open
          onOpenChange={(open) => {
            if (!open) close()
          }}
          locale={locale}
          event={{ id: event.eventId, title: event.title, org_id: event.orgId, time_zone: event.timeZone }}
          initialDate={dialog.initialDate}
          surface="feed_card"
          onCloseAutoFocus={restoreFocus}
          onAdded={(count) => changed({ kind: 'dates_added', changed: count })}
        />
      )}
      {dialog?.kind === 'cancel' && (
        <LazyCancelDateConfirm
          target={{
            occurrenceId: event.occurrenceId,
            eventId: event.eventId,
            orgId: event.orgId,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            timeZone: event.timeZone,
          }}
          locale={locale}
          surface="feed_card"
          onClose={close}
          onCloseAutoFocus={restoreFocus}
          onCancelled={() => {
            close()
            changed({ kind: 'date_cancelled' })
          }}
        />
      )}
    </div>
  )
}
