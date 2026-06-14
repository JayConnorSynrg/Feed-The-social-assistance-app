'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

type AdoptionStats = {
  total_users: number
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

const roleChartConfig: ChartConfig = {
  count: { label: 'Users', color: '#4a5d23' },
}

const resourceChartConfig: ChartConfig = {
  resource_count: { label: 'Total', color: '#4a5d23' },
  active_count: { label: 'Active', color: '#a3c55a' },
}

function StatTile({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4 flex flex-col gap-1">
      <span className="text-xs text-stone-500 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-stone-800">
        {value === null || value === undefined ? '—' : value}
      </span>
    </div>
  )
}

export function DashboardSection() {
  const [adoption, setAdoption] = useState<AdoptionStats | null>(null)
  const [resources, setResources] = useState<ResourceStat[]>([])
  const [petition, setPetition] = useState<PetitionMomentum | null>(null)
  const [events, setEvents] = useState<EventStats | null>(null)
  const [peopleFed, setPeopleFed] = useState<PeopleFed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      try {
        const [
          adoptionRes,
          resourcesRes,
          petitionRes,
          eventsRes,
          peopleFedRes,
        ] = await Promise.all([
          supabase.rpc('dashboard_adoption_stats'),
          supabase.rpc('dashboard_resource_stats'),
          supabase.rpc('dashboard_petition_momentum'),
          supabase.rpc('dashboard_event_stats'),
          supabase.rpc('community_people_fed'),
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="py-6 text-stone-500 text-sm">Loading dashboard...</div>
    )
  }

  if (error) {
    return (
      <div className="py-4 text-red-600 text-sm bg-red-50 rounded-xl border border-red-200 px-4">
        Dashboard error: {error}
      </div>
    )
  }

  const roleChartData = adoption
    ? [
        { role: 'Seekers', count: Number(adoption.seekers) },
        { role: 'Providers', count: Number(adoption.providers) },
        { role: 'Facilitators', count: Number(adoption.facilitators) },
      ]
    : []

  const topResources = resources.slice(0, 10)

  return (
    <div className="space-y-6">
      <h2 className="text-stone-800 font-semibold text-lg">Community Dashboard</h2>

      {/* Adoption stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Users" value={adoption ? Number(adoption.total_users) : null} />
        <StatTile label="New (7d)" value={adoption ? Number(adoption.new_users_7d) : null} />
        <StatTile label="New (30d)" value={adoption ? Number(adoption.new_users_30d) : null} />
        <StatTile label="Total Providers" value={adoption ? Number(adoption.providers) : null} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users by Role */}
        <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Users by Role</h3>
          <ChartContainer config={roleChartConfig} className="h-48 w-full">
            <BarChart accessibilityLayer data={roleChartData}>
              <XAxis dataKey="role" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#4a5d23" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Resources by Category */}
        <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4">
          <h3 className="text-sm font-semibold text-stone-700 mb-3">Resources by Category</h3>
          <ChartContainer config={resourceChartConfig} className="h-48 w-full">
            <BarChart accessibilityLayer data={topResources} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="category" type="category" width={110} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="resource_count" fill="#4a5d23" radius={[0, 4, 4, 0]} />
              <Bar dataKey="active_count" fill="#a3c55a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Lower tiles row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Assistance Events */}
        <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Assistance Events</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-stone-500">Active Orgs</p>
              <p className="text-lg font-bold text-stone-800">{events ? Number(events.total_orgs) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Active Events</p>
              <p className="text-lg font-bold text-stone-800">{events ? Number(events.active_events) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Upcoming 30d</p>
              <p className="text-lg font-bold text-stone-800">{events ? Number(events.upcoming_30d) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Check-ins 30d</p>
              <p className="text-lg font-bold text-stone-800">{events ? Number(events.total_checkins_30d) : '—'}</p>
            </div>
          </div>
        </div>

        {/* People Fed */}
        <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">People Fed (30d)</h3>
          {peopleFed?.suppressed ? (
            <div className="flex items-start gap-2 text-stone-500">
              <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span className="text-xs">Data suppressed (k&lt;20 — insufficient check-in volume)</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-stone-500">People Fed</p>
                <p className="text-lg font-bold text-[#4a5d23]">
                  {peopleFed?.people_fed !== null && peopleFed?.people_fed !== undefined
                    ? Number(peopleFed.people_fed)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Total Visits</p>
                <p className="text-lg font-bold text-stone-800">
                  {peopleFed ? Number(peopleFed.total_visits) : '—'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Petitions */}
        <div className="bg-stone-50/95 rounded-xl border border-stone-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Petitions</h3>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">Total Petitions</span>
              <span className="text-base font-bold text-stone-800">
                {petition ? Number(petition.total_petitions) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">Total Signatures</span>
              <span className="text-base font-bold text-stone-800">
                {petition ? Number(petition.total_signatures) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">Active (30d)</span>
              <span className="text-base font-bold text-[#4a5d23]">
                {petition ? Number(petition.active_petitions) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
