'use client'

/**
 * post-type-body.tsx
 *
 * The typed render registry for the community feed (INV1). `PostTypeBody`
 * routes a post to its type-specific body via `postBodyKind` — the exhaustive,
 * assertNever-guarded discriminant switch in post-model.ts. Adding an 8th
 * post_type without handling it is a compile error, never a blank card.
 *
 * These bodies render the type-SPECIFIC content only; the shared card chrome
 * (author row, content text, resource chip, reactions, comments) stays in the
 * PostCard that wraps this. 'plain' (feed / resource_post) and 'petition'
 * render no extra body here — petition keeps its existing embed in PostCard.
 */

import React from 'react'
import { m, useReducedMotion } from 'motion/react'
import { BarChart3, CalendarDays, HandHelping, Gift, Loader2, MapPin, Video, Check } from 'lucide-react'
import { pollBarTransition } from './feed-motion'
import {
  postBodyKind,
  derivePollView,
  pollHasEnded,
  canCastVote,
  applyVote,
  removeVote,
  assertNever,
  type Post,
  type PollVoteState,
} from './post-model'
import { usePollData, castVote, revokeVote, POLL_CLOSED } from '@/hooks/use-poll'
import { useAuth } from '@/hooks/use-auth'
import { logger } from '@/lib/logger'
import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/i18n-event-forms'
import { cardT } from '@/lib/i18n-feed-card'
import { requestCategoryLabel } from '@/lib/i18n-feed-composer'
import { checkLocalTime, dateTimeFormat, browserTimeZone, formatEventWhen } from '@/lib/event-time'
import { memberEventWhen } from './post-model'

// ---------------------------------------------------------------------------
// Poll body (INV6)
// ---------------------------------------------------------------------------

function PollBody({ post, locale }: { post: Post; locale: Locale }) {
  const reduce = useReducedMotion()
  // Keyed on the post's version: an author edit of the question / options / deadline re-reads the poll.
  const { poll, userVote, loading, error, setVoteState, settleVotes } = usePollData(post.id, post.version)
  const { isAuthenticated } = useAuth()
  const [busyIndex, setBusyIndex] = React.useState<number | null>(null)
  const [voteError, setVoteError] = React.useState<string | null>(null)

  if (loading) {
    return (
      <div data-testid={`poll-loading-${post.id}`} className="mb-3 flex items-center gap-2 text-xs text-stone-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        {cardT(locale, 'pollLoading')}
      </div>
    )
  }
  if (error || !poll) {
    // A poll post with no poll row: surface nothing extra (content still shows).
    return null
  }

  const options = Array.isArray(poll.options) ? (poll.options as unknown[]).map(String) : []
  const optionViews = derivePollView(options, poll.tallies, poll.totalVotes, userVote)
  const ended = pollHasEnded(poll.ends_at)
  const votingAllowed = canCastVote(isAuthenticated, poll.ends_at)
  const showResults = userVote !== null || ended || poll.totalVotes > 0

  // The server refuses a vote once the poll closed or its post is hidden / deleted (poll_votes RLS).
  const voteMessage = (err: string) => (err === POLL_CLOSED ? cardT(locale, 'voteClosed') : cardT(locale, 'voteFailed'))

  const handleOptionClick = async (index: number) => {
    if (!votingAllowed || busyIndex !== null) return
    setVoteError(null)
    setBusyIndex(index)
    // Snapshot the pre-click state so we can both apply an immediate optimistic
    // update and revert to server-backed values if the DB write fails. The
    // displayed result does NOT depend on the poll_votes realtime channel
    // (dead until W1.4): we settle from a fresh read after the write succeeds.
    const prevState: PollVoteState = { tallies: poll.tallies, totalVotes: poll.totalVotes, userVote }
    const isRevoke = userVote === index
    setVoteState(isRevoke ? removeVote(prevState) : applyVote(prevState, index))
    // Tracks whether a write has already mutated the server on this path. A
    // switch vote's revoke succeeds BEFORE its cast; once that revoke lands the
    // pre-click snapshot no longer matches the database, so any later failure
    // must reconcile to server truth (settleVotes) rather than revert to a
    // stale prevState that would falsely show the old choice as still active.
    let serverMutated = false
    try {
      let writeErr: string | null = null
      if (isRevoke) {
        // Toggle off — revoke the existing vote.
        const { error: revErr } = await revokeVote(poll.id)
        writeErr = revErr
      } else {
        if (userVote !== null) {
          // Switch vote: revoke the prior choice first (UNIQUE(poll_id,user_id)).
          const { error: revErr } = await revokeVote(poll.id)
          if (revErr) {
            // Revoke failed — nothing was written; the pre-click snapshot is
            // still server-accurate, so revert to it.
            setVoteError(voteMessage(revErr))
            setVoteState(prevState)
            return
          }
          // Revoke landed: the server now holds zero votes for this user.
          serverMutated = true
        }
        const { error: castErr } = await castVote(poll.id, index)
        writeErr = castErr
      }
      if (writeErr) {
        setVoteError(voteMessage(writeErr))
        if (serverMutated) {
          // Switch-vote cast failed after the revoke already committed —
          // reconcile the display to server truth (zero votes), never to the
          // stale prevState showing the revoked choice as active.
          await settleVotes()
        } else {
          // Fresh cast or revoke-only failure: no write mutated the server, so
          // reverting the optimistic UI to the pre-click snapshot is correct.
          setVoteState(prevState)
        }
        return
      }
      // Settle the mark + tallies from server truth (both directions).
      await settleVotes()
    } catch (err) {
      logger.error('poll.vote.click', err, { pollId: poll.id, optionIndex: index })
      setVoteError(cardT(locale, 'voteFailed'))
      if (serverMutated) {
        // An unexpected throw after the switch-vote revoke committed: the
        // server truth (zero votes) differs from prevState — reconcile to it.
        await settleVotes()
      } else {
        setVoteState(prevState)
      }
    } finally {
      setBusyIndex(null)
    }
  }

  return (
    <div data-testid={`poll-body-${post.id}`} className="mb-3 rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-[#4a5d23] flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-[#4a5d23] uppercase tracking-wide">{cardT(locale, 'pollLabel')}</span>
        {ended && <span className="text-[10px] text-stone-600">{cardT(locale, 'pollClosed')}</span>}
      </div>
      <p dir="auto" className="text-sm font-semibold text-stone-900 mb-2 leading-snug">{poll.question}</p>
      <div className="flex flex-col gap-1.5" role="group" aria-label={cardT(locale, 'pollOptionsAria')}>
        {optionViews.map((opt) => (
          <button
            key={opt.index}
            type="button"
            data-testid={`poll-option-${post.id}-${opt.index}`}
            onClick={() => handleOptionClick(opt.index)}
            disabled={!votingAllowed || busyIndex !== null}
            aria-pressed={opt.isUserChoice}
            className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors disabled:cursor-default ${
              opt.isUserChoice
                ? 'border-[#4a5d23] bg-lime-50 text-[#3a4d1a]'
                : 'border-stone-200 bg-white text-stone-700 hover:border-[#4a5d23]'
            }`}
          >
            {showResults && (
              // W1.5 — the decorative tally bar glides on W1.4 live tally
              // updates. initial={false} keeps the first paint from sweeping
              // from 0; reduced motion snaps (pollBarTransition → duration 0).
              <m.span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-lime-100/70"
                initial={false}
                animate={{ width: `${opt.pct}%` }}
                transition={pollBarTransition(reduce)}
              />
            )}
            <span className="relative flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                {opt.isUserChoice && <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
                {busyIndex === opt.index && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                <span dir="auto">{opt.label}</span>
              </span>
              {showResults && (
                <span className="text-[11px] text-stone-600">
                  {opt.count} · {opt.pct}%
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-stone-600">
          {formatMessage(cardT(locale, 'pollVotes'), { n: poll.totalVotes })}
        </span>
        {!isAuthenticated && !ended && (
          <span className="text-[11px] text-stone-600">{cardT(locale, 'pollSignIn')}</span>
        )}
      </div>
      {voteError && <p role="alert" className="mt-1 text-[11px] text-red-700">{voteError}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event body
// ---------------------------------------------------------------------------

/** A legacy member event's wall clock exactly as entered ("Oct 10, 6:00 PM"), never shifted by a zone. */
function formatWallClock(local: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return local
  // Format the digits as a UTC instant in UTC: the same wall clock, whatever the viewer's zone.
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
  return dateTimeFormat(locale, 'UTC', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
}

/** The when line of a member event: zoned events in the viewer's time (+ venue time when it
 *  differs); a legacy event posted before zones exactly as entered, labelled "local time". */
export function memberEventWhenText(meta: NonNullable<Post['eventMeta']>, locale: Locale, viewerTz: string = browserTimeZone()): { main: string; venue: string | null } {
  const when = memberEventWhen(meta, checkLocalTime)
  if (when.kind === 'zoned') {
    if (!when.endIso) {
      const start = dateTimeFormat(locale, viewerTz, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
      return { main: start.format(new Date(when.startIso)), venue: null }
    }
    const r = formatEventWhen(when.startIso, when.endIso, when.timeZone, locale, { viewerTz })
    return { main: r.text, venue: r.venue }
  }
  const range = when.end ? `${formatWallClock(when.start, locale)} – ${formatWallClock(when.end, locale)}` : formatWallClock(when.start, locale)
  return { main: formatMessage(cardT(locale, 'localTime'), { when: range }), venue: null }
}

function EventBody({ post, locale }: { post: Post; locale: Locale }) {
  const meta = post.eventMeta
  if (!meta) return null
  const when = memberEventWhenText(meta, locale)
  return (
    <div data-testid={`event-body-${post.id}`} className="mb-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5 text-sky-700 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-sky-800 uppercase tracking-wide">{cardT(locale, 'eventLabel')}</span>
      </div>
      <div className="text-xs text-stone-700">
        <span className="font-semibold text-stone-900" data-testid={`event-starts-${post.id}`}>
          {when.main}
        </span>
        {when.venue && <span className="block text-stone-700">{when.venue}</span>}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-stone-700">
        {meta.isOnline ? (
          <>
            <Video className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {cardT(locale, 'onlineEvent')}
          </>
        ) : meta.location ? (
          <>
            <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate" dir="auto">{meta.location}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seeker-request / source-offer body
// ---------------------------------------------------------------------------

function RequestOfferBody({ post, intent, locale }: { post: Post; intent: 'request' | 'offer'; locale: Locale }) {
  const isRequest = intent === 'request'
  const Icon = isRequest ? HandHelping : Gift
  const label = cardT(locale, isRequest ? 'seekingHelp' : 'offeringHelp')
  const tone = isRequest
    ? 'border-orange-200 bg-orange-50/60 text-orange-800'
    : 'border-green-200 bg-green-50/60 text-green-800'
  return (
    <div data-testid={`${intent}-body-${post.id}`} className={`mb-3 rounded-xl border p-3 flex flex-col gap-2 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {post.requestCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.requestCategories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center rounded-full bg-white/70 border border-current/20 px-2 py-0.5 text-[11px] font-medium"
            >
              {requestCategoryLabel(cat, locale)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registry entry point (INV1)
// ---------------------------------------------------------------------------

export function PostTypeBody({ post, locale = 'en' }: { post: Post; locale?: Locale }) {
  const kind = postBodyKind(post.postType)
  switch (kind) {
    case 'poll':
      return <PollBody post={post} locale={locale} />
    case 'event':
      return <EventBody post={post} locale={locale} />
    case 'request':
      return <RequestOfferBody post={post} intent="request" locale={locale} />
    case 'offer':
      return <RequestOfferBody post={post} intent="offer" locale={locale} />
    case 'petition':
    case 'plain':
      // Petition keeps its existing embed in PostCard; plain types have no
      // type-specific body beyond the shared chrome.
      return null
    default:
      // A new PostBodyKind without a case here is a compile error (INV1).
      return assertNever(kind)
  }
}
