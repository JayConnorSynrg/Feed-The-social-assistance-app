// apps/web/src/lib/event-time.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one place event times are formatted and checked. Built on Intl only (Safari / iOS have no
// Temporal). An event's dates are instants (timestamptz) entered as wall-clock time in the
// venue's IANA zone (assistance_events.time_zone). Every surface shows the viewer's own local
// time; when the venue's zone differs from the viewer's, the venue time with its zone
// abbreviation is shown as well. The server converts wall-clock -> instant (create_org_event /
// add_event_dates); checkLocalTime gives the same DST answer in the form before submit.

import type { Locale } from './i18n'
import { eventFormT, formatMessage } from './i18n-event-forms'

/** Area/Location shape the server accepts (assistance_events_time_zone_shape). */
export const IANA_ZONE_SHAPE = /^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/

/** Common US zones, listed first in the picker. */
export const COMMON_US_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
] as const

const FALLBACK_ZONE = 'America/New_York'

/**
 * The locale list handed to Intl for a FEED locale. 'en-US' is always the last entry, so a
 * locale Intl has no CLDR data for (ht, hmn) renders in US English on every device instead of
 * in the device's own default language.
 */
export function intlLocale(locale: Locale): string[] {
  return locale === 'en' ? ['en-US'] : [locale, 'en-US']
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** One cached Intl.DateTimeFormat per (locale, zone, options); building one is the costly part
 *  of formatting, and every card, chip and form row formats with the same few option sets.
 *  `locale` null = the fixed 'en-US' used for wall-clock arithmetic. */
export function dateTimeFormat(
  locale: Locale | null,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const tags = locale === null ? ['en-US'] : intlLocale(locale)
  const key = `${tags.join(',')}|${timeZone}|${JSON.stringify(options)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(tags, { ...options, timeZone })
    formatters.set(key, f)
  }
  return f
}

/** The viewer's IANA zone, or America/New_York when the runtime reports none / a non-IANA name. */
export function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && IANA_ZONE_SHAPE.test(tz)) return tz
  } catch {
    // fall through
  }
  return FALLBACK_ZONE
}

/** True when Intl knows the zone. */
export function isKnownTimeZone(tz: string): boolean {
  try {
    dateTimeFormat(null, tz, {})
    return true
  } catch {
    return false
  }
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function wallClockIn(instantMs: number, tz: string): WallClock {
  const parts = dateTimeFormat(null, tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { year: n('year'), month: n('month'), day: n('day'), hour: n('hour') % 24, minute: n('minute') }
}

/** UTC offset of `tz` at an instant, in minutes (east positive). */
function offsetMinutes(instantMs: number, tz: string): number {
  const w = wallClockIn(instantMs, tz)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  return Math.round((asUtc - (instantMs - (instantMs % 60000))) / 60000)
}

/** 'YYYY-MM-DD' of an instant in a zone (calendar grouping by the venue's date). */
export function venueDateKey(iso: string, tz: string): string {
  const w = wallClockIn(new Date(iso).getTime(), tz)
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`
}

export type LocalTimeCheck =
  | { kind: 'ok'; instant: Date }
  | { kind: 'gap' }
  | { kind: 'repeat' }
  | { kind: 'invalid' }

/**
 * Wall-clock `date` (YYYY-MM-DD) + `time` (HH:MM) in `tz` -> the instant, or why there is none.
 * 'gap': the time is skipped when clocks spring forward. 'repeat': it happens twice when clocks
 * fall back. Same rule as the server's event_local_to_utc: try the offsets in force a day
 * before and a day after, keep the candidates that format back to the same wall clock.
 */
export function checkLocalTime(date: string, time: string, tz: string): LocalTimeCheck {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t || !isKnownTimeZone(tz)) return { kind: 'invalid' }
  const target: WallClock = { year: +d[1], month: +d[2], day: +d[3], hour: +t[1], minute: +t[2] }
  const guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)
  const DAY = 86_400_000
  const offsets = new Set([offsetMinutes(guess - DAY, tz), offsetMinutes(guess + DAY, tz), offsetMinutes(guess, tz)])
  const hits = new Set<number>()
  for (const off of offsets) {
    const inst = guess - off * 60_000
    const w = wallClockIn(inst, tz)
    if (
      w.year === target.year && w.month === target.month && w.day === target.day &&
      w.hour === target.hour && w.minute === target.minute
    ) {
      hits.add(inst)
    }
  }
  if (hits.size === 0) return { kind: 'gap' }
  if (hits.size > 1) return { kind: 'repeat' }
  return { kind: 'ok', instant: new Date([...hits][0]) }
}

function rangeText(start: Date, end: Date, tz: string, locale: Locale, timeOnly: boolean): string {
  const time: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
  const day: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  const f = dateTimeFormat(locale, tz, { ...(timeOnly ? {} : day), ...time })
  // formatRange prints ONE zone abbreviation for the whole range, which is wrong when the range
  // crosses a DST change (12:30 EDT – 1:30 EST would read "12:30 – 1:30 AM EST"). Then each end
  // is formatted on its own, so each carries its own abbreviation.
  const crossesOffsetChange = offsetMinutes(start.getTime(), tz) !== offsetMinutes(end.getTime(), tz)
  if (!crossesOffsetChange && typeof f.formatRange === 'function') return f.formatRange(start, end)
  const sameDay = venueDateKey(start.toISOString(), tz) === venueDateKey(end.toISOString(), tz)
  const fEnd = sameDay || timeOnly ? dateTimeFormat(locale, tz, time) : f
  return `${f.format(start)} – ${fEnd.format(end)}`
}

export interface EventWhen {
  /** Start–end in the viewer's zone, with that zone's abbreviation. */
  text: string
  /** The same range in the venue's zone, labelled as venue time; null when the zones agree. */
  venue: string | null
}

export interface FormatEventWhenOptions {
  /** The viewer's IANA zone; defaults to the browser's (tests pass it explicitly). */
  viewerTz?: string
  /** Times only, no weekday / date — for calendar chips that already sit under a day. */
  timeOnly?: boolean
}

/**
 * Format an event date for display: the viewer's local time with its zone abbreviation, plus —
 * whenever the venue's UTC offset differs from the viewer's at the start or end — the venue time
 * with the venue zone's abbreviation, labelled as venue time. The same wall clock in both zones
 * needs no second line.
 */
export function formatEventWhen(
  startsAt: string,
  endsAt: string,
  venueTz: string | null | undefined,
  locale: Locale,
  options: FormatEventWhenOptions = {},
): EventWhen {
  const viewerTz = options.viewerTz ?? browserTimeZone()
  const timeOnly = options.timeOnly ?? false
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const venue = venueTz && isKnownTimeZone(venueTz) ? venueTz : viewerTz
  const text = rangeText(start, end, viewerTz, locale, timeOnly)
  const same =
    offsetMinutes(start.getTime(), venue) === offsetMinutes(start.getTime(), viewerTz) &&
    offsetMinutes(end.getTime(), venue) === offsetMinutes(end.getTime(), viewerTz)
  if (same) return { text, venue: null }
  return {
    text,
    venue: formatMessage(eventFormT(locale, 'whenVenueTime'), {
      when: rangeText(start, end, venue, locale, timeOnly),
    }),
  }
}

/** Long localized name of a zone ("Eastern Standard Time"), or the IANA id when Intl has none. */
function zoneLongName(tz: string, locale: Locale, at: Date): string {
  try {
    const part = dateTimeFormat(locale, tz, { timeZoneName: 'long' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')
    return part?.value ?? tz
  } catch {
    return tz
  }
}

export interface ZoneOption {
  value: string
  label: string
}

/**
 * Zones left out of the picker because the production database's time-zone data disagrees with
 * current browsers' (probed 2026-10-07, PostgreSQL 17.6 pg_timezone_names vs Node ICU 78 /
 * tzdata 2025c): America/Asuncion still has winter DST on the server (UTC-4 in July) while
 * browsers have Paraguay on UTC-3 all year, so the form's DST check and the server's
 * conversion would disagree by an hour; America/Coyhaique is not a zone the server knows, so
 * create_org_event would refuse it. Remove an entry once the server's tzdata catches up.
 */
export const SERVER_UNSUPPORTED_ZONES: ReadonlySet<string> = new Set(['America/Asuncion', 'America/Coyhaique'])

/**
 * Picker options: the common US zones first (localized long name + id), then every other IANA
 * Area/Location zone Intl knows and the server converts the same way, by id. The current value
 * is always present.
 */
export function timeZoneOptions(locale: Locale, current: string, at: Date = new Date()): {
  common: ZoneOption[]
  all: ZoneOption[]
} {
  const common = COMMON_US_ZONES.map((tz) => ({ value: tz, label: `${zoneLongName(tz, locale, at)} (${tz})` }))
  const commonSet = new Set<string>(COMMON_US_ZONES)
  let ids: string[] = []
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ids = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : []
  } catch {
    ids = []
  }
  const rest = new Set(
    ids.filter((tz) => IANA_ZONE_SHAPE.test(tz) && !commonSet.has(tz) && !SERVER_UNSUPPORTED_ZONES.has(tz)),
  )
  if (current && !commonSet.has(current)) rest.add(current)
  return { common, all: [...rest].sort().map((tz) => ({ value: tz, label: tz })) }
}

/** "Eastern Standard Time (America/New_York)" — the read-only zone line of the edit form. */
export function zoneLabel(tz: string, locale: Locale, at: Date = new Date()): string {
  return `${zoneLongName(tz, locale, at)} (${tz})`
}

/** "Sat, Apr 10, 2027" for a venue-local calendar date (YYYY-MM-DD) — a date with no time, so
 *  it reads the same in every viewer zone. */
export function formatCalendarDate(
  date: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
): string {
  const [y, m, d] = date.split('-').map(Number)
  return dateTimeFormat(locale, 'UTC', options).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** "Sat, Oct 10" — the date of an instant in the viewer's zone (default: the browser's). */
export function formatShortDate(iso: string, locale: Locale, viewerTz: string = browserTimeZone()): string {
  return dateTimeFormat(locale, viewerTz, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
}

const relativeFormats = new Map<Locale, Intl.RelativeTimeFormat | null>()

/**
 * "In 3 days" — a future amount in the viewer's language through Intl.RelativeTimeFormat, which
 * carries each language's plural forms (Arabic dual, Russian few/many). Sentence-cased for a
 * label. null when this runtime has no relative-time data for the locale (ht and hmn have none
 * in CLDR): the caller then uses its own translated phrase rather than an English one.
 */
export function relativeTimeText(n: number, unit: 'minute' | 'hour' | 'day', locale: Locale): string | null {
  let f = relativeFormats.get(locale)
  if (f === undefined) {
    const tags = intlLocale(locale)
    f =
      typeof Intl.RelativeTimeFormat === 'function' && Intl.RelativeTimeFormat.supportedLocalesOf(tags[0]).length > 0
        ? new Intl.RelativeTimeFormat(tags, { numeric: 'always', style: 'long' })
        : null
    relativeFormats.set(locale, f)
  }
  if (!f) return null
  const text = f.format(n, unit)
  const tag = f.resolvedOptions().locale
  return text.charAt(0).toLocaleUpperCase(tag) + text.slice(1)
}
