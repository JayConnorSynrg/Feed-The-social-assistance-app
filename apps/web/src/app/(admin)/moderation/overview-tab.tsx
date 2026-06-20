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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MoreHorizontal } from 'lucide-react'

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

type UserRow = {
  id: string
  full_name: string | null
  email: string | null
  user_role: string | null
  is_staff: boolean
  joined_at: string | null
  last_sign_in_at: string | null
  provider: string | null
  banned_until: string | null
  email_confirmed: boolean
}

type NoteRow = {
  id: string
  note: string
  created_by: string | null
  created_at: string
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
  const [users, setUsers] = useState<UserRow[]>([])
  const [notesUser, setNotesUser] = useState<UserRow | null>(null)
  const [userNotes, setUserNotes] = useState<NoteRow[]>([])
  const [newNote, setNewNote] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [isActioning, setIsActioning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBanToggle = async (user: UserRow) => {
    setIsActioning(user.id)
    const isBanned = user.banned_until && new Date(user.banned_until) > new Date()
    const ban_duration = isBanned ? 'none' : '876000h'
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ban_duration }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === user.id
          ? { ...u, banned_until: isBanned ? null : new Date(Date.now() + 1e13).toISOString() }
          : u
        ))
        logger.info('[admin:overview] ban_toggle success', { userId: user.id, action: isBanned ? 'unban' : 'ban' })
      } else {
        const err = await res.json()
        logger.error('[admin:overview] ban_toggle failed', { userId: user.id, error: err.error })
      }
    } catch (e) {
      logger.error('[admin:overview] ban_toggle error', { userId: user.id })
    } finally {
      setIsActioning(null)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    setIsActioning(deleteTarget.id)
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}/delete`, { method: 'DELETE' })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
        logger.info('[admin:overview] delete_user success', { userId: deleteTarget.id })
      } else {
        const err = await res.json()
        logger.error('[admin:overview] delete_user failed', { userId: deleteTarget.id, error: err.error })
      }
    } catch (e) {
      logger.error('[admin:overview] delete_user error', { userId: deleteTarget?.id })
    } finally {
      setIsActioning(null)
      setDeleteTarget(null)
    }
  }

  const handleOpenNotes = async (user: UserRow) => {
    setNotesUser(user)
    setUserNotes([])
    setNewNote('')
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
    const { data } = await rpc('admin_get_user_notes', { p_user_id: user.id })
    const rows = data as NoteRow[] | null
    setUserNotes(rows ?? [])
    logger.info('[admin:overview] admin_get_user_notes', { userId: user.id, count: rows?.length ?? 0 })
  }

  const handleAddNote = async () => {
    if (!notesUser || !newNote.trim()) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
    const { data: rawNoteId } = await rpc('admin_add_user_note', {
      p_user_id: notesUser.id,
      p_note: newNote.trim(),
    })
    const noteId = rawNoteId as string | null
    if (noteId) {
      const newNoteRow: NoteRow = { id: noteId, note: newNote.trim(), created_by: null, created_at: new Date().toISOString() }
      setUserNotes(prev => [newNoteRow, ...prev])
      setNewNote('')
      logger.info('[admin:overview] admin_add_user_note', { userId: notesUser.id })
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = supabase.rpc.bind(supabase) as (fn: string, args?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>
    await rpc('admin_delete_user_note', { p_note_id: noteId })
    setUserNotes(prev => prev.filter(n => n.id !== noteId))
    logger.info('[admin:overview] admin_delete_user_note', { noteId })
  }

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
          usersRes,
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
          rpc('admin_list_users'),
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

        const userList = (usersRes.data as UserRow[]) ?? []
        setUsers(userList)
        logger.info('[admin:overview] admin_list_users', { count: userList.length })

        setLoading(false)

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

        const suppressed = (peopleFedRes.data as PeopleFed[])?.[0]?.suppressed ?? false
        logger.info('admin.overview.loaded', {
          duration_ms: Date.now() - startTime,
          org_id: selectedOrgId,
          suppressed,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load overview')
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    if (!selectedOrgId) return
    let cancelled = false

    const fetchAiSummary = async () => {
      setAiLoading(true)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10_000)
        const res = await fetch('/api/community-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: selectedOrgId }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { themes?: AiTheme[] }
          setAiThemes(data.themes ?? [])
        }
      } catch (err) {
        if (!cancelled) console.error('AI summary fetch error:', err)
      } finally {
        if (!cancelled) setAiLoading(false)
      }
    }

    fetchAiSummary()
    return () => { cancelled = true }
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

      {users.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-[#4a5d23]" />
              Registered Users
              <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                {users.length}
              </span>
            </h3>
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-stone-100 bg-stone-50/60">
                    <TableHead className="h-9 px-4 text-xs font-medium text-stone-500">User</TableHead>
                    <TableHead className="h-9 px-4 text-xs font-medium text-stone-500 hidden md:table-cell">Provider</TableHead>
                    <TableHead className="h-9 px-4 text-xs font-medium text-stone-500 hidden lg:table-cell">Last Sign In</TableHead>
                    <TableHead className="h-9 px-4 text-xs font-medium text-stone-500">Status</TableHead>
                    <TableHead className="h-9 px-4 text-xs font-medium text-stone-500 w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isBanned = !!(user.banned_until && new Date(user.banned_until) > new Date())
                    const providerLabel = user.provider === 'google' ? 'Google'
                      : user.provider === 'apple' ? 'Apple'
                      : user.provider === 'email' || !user.provider ? 'Email'
                      : user.provider
                    return (
                      <TableRow
                        key={user.id}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors"
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-semibold text-[#4a5d23]">
                                {(user.full_name ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">
                                {user.full_name ?? <span className="text-stone-400 italic">No name</span>}
                              </p>
                              <p className="text-xs text-stone-500 truncate">{user.email ?? '—'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className="text-xs rounded-full border-stone-200 text-stone-600 px-2.5"
                          >
                            {providerLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-stone-500">
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {isBanned ? (
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs rounded-full px-2.5">Paused</Badge>
                          ) : user.is_staff ? (
                            <Badge className="bg-lime-100 text-lime-800 border-0 text-xs rounded-full px-2.5">Staff</Badge>
                          ) : (
                            <Badge className="bg-stone-100 text-stone-600 border-0 text-xs rounded-full px-2.5">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 w-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-stone-100 transition-colors disabled:opacity-40"
                                disabled={isActioning === user.id}
                                aria-label="User actions"
                              >
                                <MoreHorizontal className="h-4 w-4 text-stone-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => handleOpenNotes(user)}>
                                View Notes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleBanToggle(user)}>
                                {isBanned ? 'Unban Account' : 'Pause Account'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(user)}
                                className="text-red-600 focus:text-red-600"
                              >
                                Delete Account
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Delete confirmation dialog */}
          <Dialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account permanently?</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{deleteTarget?.full_name ?? deleteTarget?.email ?? 'this user'}</strong> and all their data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-lg border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Notes sheet */}
          <Sheet open={!!notesUser} onOpenChange={(open: boolean) => !open && setNotesUser(null)}>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-stone-900">
                  Notes — {notesUser?.full_name ?? notesUser?.email ?? 'User'}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-3 h-full">
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2 text-stone-900 placeholder:text-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-lime-500"
                    rows={3}
                    placeholder="Add a note…"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    maxLength={2000}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-3 py-2 rounded-lg bg-lime-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-lime-700 transition-colors self-start"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {userNotes.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-6">No notes yet</p>
                  ) : userNotes.map((note) => (
                    <div key={note.id} className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700 relative group border border-stone-100">
                      <p>{note.note}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs text-stone-400">
                          {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  )
}
