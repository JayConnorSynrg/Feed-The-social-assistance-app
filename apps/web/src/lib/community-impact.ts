// apps/web/src/lib/community-impact.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The community figures the "Impact overview" card shows, as community_impact_summary() returns them
// (specs/impact-metrics-contract.md, sections 2 and 5). The database counts, suppresses below k and rounds;
// this file only reads its answer:
//   - a figure shows its number only when the server marked it not suppressed and sent a finite number;
//     anything else is the suppressed line, never 0;
//   - the card is titled Reach until an outcome figure is shown, then Impact.

export const IMPACT_FIGURE_IDS = [
  'resources_available',
  'resources_curated',
  'snap_retailers',
  'zip_codes_covered',
  'organizations_listed',
  'event_dates_next_30_days',
  'petition_signers',
  'needs_met',
  'people_served_at_events',
  'alerts_verified',
  'member_resources_approved',
] as const

export type ImpactFigureId = (typeof IMPACT_FIGURE_IDS)[number]

/** What the directory holds: counts of resources, retailers, places and dates, shown in full. */
export const DIRECTORY_FIGURE_IDS: readonly ImpactFigureId[] = [
  'resources_available',
  'resources_curated',
  'snap_retailers',
  'zip_codes_covered',
  'organizations_listed',
  'event_dates_next_30_days',
]

/** Figures about people, each shown only once enough people contribute. */
export const COMMUNITY_FIGURE_IDS: readonly ImpactFigureId[] = [
  'needs_met',
  'people_served_at_events',
  'alerts_verified',
  'member_resources_approved',
  'petition_signers',
]

/** Outcomes (a need met, people served, an alert confirmed, a resource accepted): any one shown makes the
 *  card an Impact card. Everything else is an output and is Reach. */
export const OUTCOME_FIGURE_IDS: ReadonlySet<ImpactFigureId> = new Set<ImpactFigureId>([
  'needs_met',
  'people_served_at_events',
  'alerts_verified',
  'member_resources_approved',
])

export interface ImpactFigure {
  value: number | null
  suppressed: boolean
  unit: string
  window: 'all_time' | 'next_30_days'
}

export type ImpactSummary = Partial<Record<ImpactFigureId, ImpactFigure>>

/** The server's answer, keeping only the figures this card knows. */
export function parseImpactSummary(data: unknown): ImpactSummary {
  const out: ImpactSummary = {}
  if (!data || typeof data !== 'object' || Array.isArray(data)) return out
  const raw = data as Record<string, unknown>
  for (const id of IMPACT_FIGURE_IDS) {
    const f = raw[id]
    if (!f || typeof f !== 'object') continue
    const { value, suppressed, unit, window } = f as Record<string, unknown>
    out[id] = {
      value: typeof value === 'number' ? value : null,
      suppressed: suppressed !== false,
      unit: typeof unit === 'string' ? unit : '',
      window: window === 'next_30_days' ? 'next_30_days' : 'all_time',
    }
  }
  return out
}

/** The number to show, or null for the suppressed line. */
export function shownValue(figure: ImpactFigure | undefined): number | null {
  if (!figure || figure.suppressed) return null
  return typeof figure.value === 'number' && Number.isFinite(figure.value) ? figure.value : null
}

export function cardKind(summary: ImpactSummary): 'reach' | 'impact' {
  for (const id of OUTCOME_FIGURE_IDS) if (shownValue(summary[id]) !== null) return 'impact'
  return 'reach'
}

/** How many of the figures present show the suppressed line (a log label). */
export function suppressedCount(summary: ImpactSummary): number {
  return IMPACT_FIGURE_IDS.filter((id) => summary[id] && shownValue(summary[id]) === null).length
}
