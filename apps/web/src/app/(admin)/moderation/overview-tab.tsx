'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, TrendingUp, Users, Zap, AlertTriangle, ClipboardList, Eye, type LucideIcon } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { logger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

type AdoptionStats = {
  total_users: number
  guest_sessions: number
  seekers: number
  providers: number
  facilitators: number
  new_users_30d: number
  new_users_7d: number
}

type ResourceStat = {
  category: string
  resource_count: number
  active_count: number
}

type PetitionMomentum = {
  total_petitions: number
  total_signatures: number
  active_petitions: number
  top_petition_id: string | null
  top_petition_sigs: number | null
}

type EventStats = {
  total_orgs: number
  active_events: number
  upcoming_30d: number
  total_checkins_30d: number
  people_fed_30d: number
}

type PeopleFed = {
  period_start: string
  period_end: string
  total_visits: number
  people_fed: number | null
  suppressed: boolean
}

type OrgRow = {
  id: string
  name: string
}

type ForecastRow = {
  forecast_date: string
  projected_visits: number | null
  projected_people_fed: number | null
  confidence: string
  suppressed: boolean
  reason: string
  history_count: number
}

type AiTheme = {
  theme: string
  summary: string
  sentiment: string
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const userGrowthChartConfig: ChartConfig = {
  new_users_7d: { label: 'New (7d)', color: '#4a5d23' },
  new_users_30d: { label: 'New (30d)', color: '#a3c55a' },
}

const resourceChartConfig: ChartConfig = {
  resource_count: { label: 'Resources', color: '#4a5d23' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextSaturday(): string {
  const d = new Date()
  const day = d.getDay()
  const daysUntilSat = (6 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilSat)
  return d.toISOString().slice(0, 10)
}

function thirtyDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'text-green-700 bg-green-100',
  medium: 'text-yellow-700 bg-yellow-100',
  low: 'text-stone-600 bg-stone-100',
  insufficient: 'text-stone-500 bg-stone-100',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  locked,
}: {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  locked?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4 flex flex-col gap-1 min-h-[80px]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-stone-500 font-medium">{label}</span>
        {locked ? (
          <Lock className="h-3.5 w-3.5 text-stone-300" />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5 text-stone-300" />
        ) : null}
      </div>
      <span className="text-xl sm:text-2xl font-bold text-stone-900">{locked ? '—' : value}</span>
      {sub && !locked && <span className="text-xs text-stone-400">{sub}</span>}
    </div>
  )
}

function ForecastTile({ orgName, forecast }: { orgName: string; forecast: ForecastRow | null }) {
  if (!forecast) return null
  const confStyle = CONFIDENCE_STYLES[forecast.confidence] ?? CONFIDENCE_STYLES.low
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[#4a5d23]" />
        <span className="text-xs font-semibold text-stone-700 truncate">{orgName}</span>
      </div>
      {forecast.suppressed ? (
        <p className="text-xs text-stone-500 italic">{forecast.reason}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-stone-500">Projected Visits</p>
              <p className="text-lg font-bold text-stone-800">
                {forecast.projected_visits !== null ? forecast.projected_visits : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">People Fed</p>
              <p className="text-lg font-bold text-[#4a5d23]">
                {forecast.projected_people_fed !== null ? forecast.projected_people_fed : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confStyle}`}>
              {forecast.confidence} confidence
            </span>
            <span className="text-xs text-stone-400">{forecast.reason}</span>
          </div>
        </>
      )}
      <p className="text-xs text-stone-400">Forecast for: {forecast.forecast_date}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverviewTab({ selectedOrgId }: { selectedOrgId: string }) {
  const [adoption, setAdoption] = useState<AdoptionStats | null>(null)
  const [resources, setResources] = useState<ResourceStat[]>([])
  const [petition, setPetition] = useState<PetitionMomentum | null>(null)
  const [events, setEvents] = useState<EventStats | null>(null)
  const [peopleFed, setPeopleFed] = useState<PeopleFed | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [forecasts, setForecasts] = useState<Record<string, ForecastRow | null>>({})
  const [pendingModeration, setPendingModeration] = useState<number | null>(null)
  const [activeSafetyAlerts, setActiveSafetyAlerts] = useState<number | null>(null)
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null)
  const [aiThemes, setAiThemes] = useState<AiTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const startTime = Date.now()
    const supabase = createClient()

    async function load() {
      try {
        // RPCs added in migration 20260614150000_w5_dashboard_rpcs.sql;
        // types.ts predates this migration — cast until next regen.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = supabase.rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>

        const [
          adoptionRes,
          resourcesRes,
          petitionRes,
          eventsRes,
          peopleFedRes,
          orgsRes,
          pendingRes,
          alertsRes,
          totalProfilesRes,
          completedProfilesRes,
        ] = await Promise.all([
          rpc('dashboard_adoption_stats'),
          rpc('dashboard_resource_stats'),
          rpc('dashboard_petition_momentum'),
          rpc('dashboard_event_stats'),
          rpc('community_people_fed', { p_start_date: thirtyDaysAgo(), p_end_date: todayIso() }),
          supabase.from('organizations').select('id, name').eq('is_active', true).limit(10),
          supabase.from('resources').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('safety_alerts').select('id', { count: 'exact', head: true }).eq('status', 'live'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .not('full_name', 'is', null)
            .not('phone', 'is', null),
        ])

        if (adoptionRes.error) throw new Error(adoptionRes.error.message)
        if (resourcesRes.error) throw new Error(resourcesRes.error.message)
        if (petitionRes.error) throw new Error(petitionRes.error.message)
        if (eventsRes.error) throw new Error(eventsRes.error.message)
        if (peopleFedRes.error) throw new Error(peopleFedRes.error.message)

        setAdoption((adoptionRes.data as AdoptionStats[])?.[0] ?? null)
        setResources((resourcesRes.data as ResourceStat[]) ?? [])
        setPetition((petitionRes.data as PetitionMomentum[])?.[0] ?? null)
        setEvents((eventsRes.data as EventStats[])?.[0] ?? null)
        setPeopleFed((peopleFedRes.data as PeopleFed[])?.[0] ?? null)

        const orgList = (orgsRes.data ?? []) as OrgRow[]
        setOrgs(orgList)

        setPendingModeration(pendingRes.count ?? null)
        setActiveSafetyAlerts(alertsRes.count ?? null)

        const total = totalProfilesRes.count ?? 0
        const completed = completedProfilesRes.count ?? 0
        setProfileCompletion(total > 0 ? Math.round((completed / total) * 100) : null)

        // projected_turnout — handle gracefully if RPC absent
        if (orgList.length > 0) {
          const satDate = nextSaturday()
          try {
            const forecastResults = await Promise.all(
              orgList.map((org) =>
                supabase.rpc('projected_turnout' as Parameters<typeof supabase.rpc>[0], { p_org_id: org.id, p_date: satDate })
              )
            )
            const forecastMap: Record<string, ForecastRow | null> = {}
            orgList.forEach((org, i) => {
              const res = forecastResults[i]
              const rows = res.data as ForecastRow[] | null
              forecastMap[org.id] = rows?.[0] ?? null
            })
            setForecasts(forecastMap)
          } catch {
            setForecasts({})
          }
        }

        // AI community themes — show section only if API responds with data
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10_000)
          const themesRes = await fetch('/api/community-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_id: selectedOrgId }),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          if (themesRes.ok) {
            const json = (await themesRes.json()) as { themes?: AiTheme[] }
            setAiThemes(json.themes ?? [])
          }
        } catch {
          // AI themes unavailable — section stays hidden
        }

        const suppressed = (peopleFedRes.data as PeopleFed[])?.[0]?.suppressed ?? false
        logger.info('admin.overview.loaded', {
          duration_ms: Date.now() - startTime,
          org_id: selectedOrgId,
          suppressed,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [selectedOrgId])

  if (loading) {
    return <div className="py-6 text-stone-500 text-sm">Loading overview...</div>
  }

  if (error) {
    return (
      <div className="py-4 text-red-600 text-sm bg-red-50 rounded-xl border border-red-200 px-4">
        Overview error: {error}
      </div>
    )
  }

  const userGrowthData = adoption
    ? [
        {
          label: 'This Week',
          new_users_7d: Number(adoption.new_users_7d),
          new_users_30d: Number(adoption.new_users_30d),
        },
      ]
    : []

  const topResources = resources.slice(0, 10)
  const hasForecast = orgs.length > 0 && Object.keys(forecasts).length > 0
  const peopleFedSuppressed = peopleFed?.suppressed ?? false

  return (
    <div className="space-y-4">
      {/* Row 1 — 5 stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile
          label="Registered Users"
          value={adoption ? Number(adoption.total_users) : '—'}
          sub={adoption ? `+${Number(adoption.new_users_30d)} this month` : undefined}
          icon={Users}
        />
        <StatTile
          label="Guest Sessions"
          value={adoption ? Number(adoption.guest_sessions) : '—'}
          sub="anonymous visitors"
          icon={Eye}
        />
        <StatTile
          label="New This Week"
          value={adoption ? Number(adoption.new_users_7d) : '—'}
          icon={Zap}
        />
        <StatTile
          label="People Fed (30d)"
          value={peopleFed && !peopleFedSuppressed ? (peopleFed.people_fed ?? '—') : '—'}
          sub={peopleFed && !peopleFedSuppressed ? `${Number(peopleFed.total_visits)} visits` : undefined}
          locked={peopleFedSuppressed}
        />
        <StatTile
          label="Active Events"
          value={events ? Number(events.active_events) : '—'}
          sub={events ? `${Number(events.upcoming_30d)} upcoming` : undefined}
        />
      </div>

      {/* Row 2 — 2 charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">User Growth</h3>
          {userGrowthData.length > 0 ? (
            <ChartContainer config={userGrowthChartConfig} className="h-48 w-full">
              <BarChart accessibilityLayer data={userGrowthData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="new_users_7d" fill="#4a5d23" radius={[4, 4, 0, 0]} />
                <Bar dataKey="new_users_30d" fill="#a3c55a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-xs text-stone-400 py-4">No data</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Resources by Category</h3>
          {topResources.length > 0 ? (
            <ChartContainer config={resourceChartConfig} className="h-48 w-full">
              <BarChart accessibilityLayer data={topResources} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="category" type="category" width={110} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="resource_count" fill="#4a5d23" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-xs text-stone-400 py-4">No data</p>
          )}
        </div>
      </div>

      {/* Row 3 — petitions + checkins */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          label="Active Petitions"
          value={petition ? Number(petition.active_petitions) : '—'}
        />
        <StatTile
          label="Total Signatures"
          value={petition ? Number(petition.total_signatures) : '—'}
        />
        <StatTile
          label="Check-ins (30d)"
          value={events ? Number(events.total_checkins_30d) : '—'}
        />
      </div>

      {/* Row 4 — additional KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile
          label="Pending Moderation"
          value={pendingModeration ?? '—'}
          icon={ClipboardList}
        />
        <StatTile
          label="Live Safety Alerts"
          value={activeSafetyAlerts ?? '—'}
          icon={AlertTriangle}
        />
        <StatTile
          label="Profile Completion"
          value={profileCompletion !== null ? `${profileCompletion}%` : '—'}
          sub="full_name + phone"
        />
      </div>

      {/* Row 5 — Forecast strip */}
      {hasForecast && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#4a5d23]" />
            Projected Turnout — Next Saturday
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orgs.map((org) => (
              <ForecastTile key={org.id} orgName={org.name} forecast={forecasts[org.id] ?? null} />
            ))}
          </div>
        </div>
      )}

      {/* Row 6 — AI Community Themes */}
      {aiThemes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Community Themes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiThemes.slice(0, 3).map((theme, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-stone-200 p-4 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 truncate">{theme.theme}</span>
                  {theme.sentiment && (
                    <span className="text-xs text-stone-400 ml-2 shrink-0">{theme.sentiment}</span>
                  )}
                </div>
                <p className="text-xs text-stone-500 line-clamp-3">{theme.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
