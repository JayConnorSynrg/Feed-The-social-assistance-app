'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Search, TrendingUp, Zap, Database, Clock } from 'lucide-react'

interface SearchMetric {
  id: string
  query: string
  category: string | null
  has_location: boolean
  include_federated: boolean
  total_results: number
  local_results: number
  federated_results: number
  query_time_ms: number
  cache_hit: boolean
  realtime_partners_queried: number | null
  realtime_partners_succeeded: number | null
  realtime_query_time_ms: number | null
  created_at: string
}

interface PartnerContribution {
  instance_name: string
  instance_url: string
  resource_count: number
  avg_trust_score: number
  last_sync: string | null
}

interface QueryCount {
  query: string
  count: number
  avg_results: number
}

interface CategoryDistribution {
  category: string
  count: number
  avg_query_time: number
}

export default function SearchAnalyticsPage() {
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [metrics, setMetrics] = useState<SearchMetric[]>([])
  const [partnerContributions, setPartnerContributions] = useState<PartnerContribution[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const supabase = createClient()

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      const hoursBack = dateRange === '24h' ? 24 : dateRange === '7d' ? 168 : 720
      const startDate = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)

      const { data, error } = await (supabase
        .from('federation_search_metrics' as never)
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false }) as unknown as Promise<{ data: SearchMetric[] | null; error: { code?: string; message: string } | null }>)

      if (error) {
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setTableExists(false)
          setMetrics([])
        } else {
          console.error('Error fetching metrics:', error)
        }
      } else {
        setTableExists(true)
        setMetrics(data || [])
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
      setTableExists(false)
      setMetrics([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, supabase])

  // Accumulator type for the groupBy reduce — named so Object.values is typed.
  interface GroupedInstance {
    instance_name: string
    instance_url: string
    resource_count: number
    total_trust_score: number
    last_sync: string | null
  }

  const fetchPartnerContributions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('federated_resources')
        .select(`
          source_instance_id,
          trust_score,
          last_synced_at,
          federated_instances!inner(
            instance_name,
            instance_url
          )
        `)

      if (error) {
        console.error('Error fetching partner contributions:', error)
        return
      }

      // The FK federated_resources→federated_instances is now in the generated
      // Database types (regen 2026-06-01). The query builder infers the embedded
      // join shape directly — no local interface or cast needed.
      const rows = data ?? []

      // Group by instance
      const grouped = rows.reduce<Record<string, GroupedInstance>>((acc, resource) => {
        const instanceId = resource.source_instance_id
        if (!acc[instanceId]) {
          acc[instanceId] = {
            instance_name: resource.federated_instances?.instance_name ?? 'Unknown',
            instance_url: resource.federated_instances?.instance_url ?? '',
            resource_count: 0,
            total_trust_score: 0,
            last_sync: null,
          }
        }
        acc[instanceId].resource_count++
        acc[instanceId].total_trust_score += resource.trust_score || 0
        if (resource.last_synced_at) {
          if (!acc[instanceId].last_sync || resource.last_synced_at > acc[instanceId].last_sync!) {
            acc[instanceId].last_sync = resource.last_synced_at
          }
        }
        return acc
      }, {})

      const contributions: PartnerContribution[] = Object.values(grouped).map((item) => ({
        instance_name: item.instance_name,
        instance_url: item.instance_url,
        resource_count: item.resource_count,
        avg_trust_score: item.resource_count > 0 ? item.total_trust_score / item.resource_count : 0,
        last_sync: item.last_sync,
      }))

      setPartnerContributions(contributions.sort((a, b) => b.resource_count - a.resource_count))
    } catch (error) {
      console.error('Error fetching partner contributions:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchMetrics()
    fetchPartnerContributions()
  }, [fetchMetrics, fetchPartnerContributions])

  // Calculate stats
  const totalSearches = metrics.length
  const avgQueryTime = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + m.query_time_ms, 0) / metrics.length)
    : 0
  const cacheHitRate = metrics.length > 0
    ? Math.round((metrics.filter(m => m.cache_hit).length / metrics.length) * 100)
    : 0
  const federationRatio = metrics.length > 0
    ? Math.round((metrics.filter(m => m.include_federated && m.federated_results > 0).length / metrics.length) * 100)
    : 0

  // Popular queries
  const queryCount = metrics.reduce((acc, m) => {
    const query = m.query.toLowerCase().trim()
    if (!acc[query]) {
      acc[query] = { count: 0, totalResults: 0 }
    }
    acc[query].count++
    acc[query].totalResults += m.total_results
    return acc
  }, {} as Record<string, { count: number; totalResults: number }>)

  const popularQueries: QueryCount[] = Object.entries(queryCount)
    .map(([query, data]) => ({
      query,
      count: data.count,
      avg_results: Math.round(data.totalResults / data.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Category distribution
  const categoryCount = metrics.reduce((acc, m) => {
    const category = m.category || 'uncategorized'
    if (!acc[category]) {
      acc[category] = { count: 0, totalTime: 0 }
    }
    acc[category].count++
    acc[category].totalTime += m.query_time_ms
    return acc
  }, {} as Record<string, { count: number; totalTime: number }>)

  const categoryDistribution: CategoryDistribution[] = Object.entries(categoryCount)
    .map(([category, data]) => ({
      category,
      count: data.count,
      avg_query_time: Math.round(data.totalTime / data.count),
    }))
    .sort((a, b) => b.count - a.count)

  // Performance metrics (percentiles)
  function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)] || 0
  }

  const queryTimes = metrics.map(m => m.query_time_ms)
  const p50 = percentile(queryTimes, 50)
  const p95 = percentile(queryTimes, 95)
  const p99 = percentile(queryTimes, 99)

  // Export to CSV
  const exportToCSV = () => {
    if (metrics.length === 0) return

    const headers = [
      'Query',
      'Category',
      'Has Location',
      'Include Federated',
      'Total Results',
      'Local Results',
      'Federated Results',
      'Query Time (ms)',
      'Cache Hit',
      'Realtime Partners Queried',
      'Realtime Partners Succeeded',
      'Realtime Query Time (ms)',
      'Created At',
    ]

    const rows = metrics.map(m => [
      m.query,
      m.category || '',
      m.has_location,
      m.include_federated,
      m.total_results,
      m.local_results,
      m.federated_results,
      m.query_time_ms,
      m.cache_hit,
      m.realtime_partners_queried || '',
      m.realtime_partners_succeeded || '',
      m.realtime_query_time_ms || '',
      m.created_at,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `search-metrics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Search Analytics</h1>
          <p className="text-muted-foreground">
            Monitor search performance and federation metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as '24h' | '7d' | '30d')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={exportToCSV}
            disabled={metrics.length === 0}
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!tableExists && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-900">No Search Data Yet</CardTitle>
            <CardDescription className="text-amber-700">
              Search metrics will appear once users begin searching. Partner contribution data is shown below.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {tableExists && (
        <>
          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSearches.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  in selected period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgQueryTime}ms</div>
                <p className="text-xs text-muted-foreground">
                  average response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheHitRate}%</div>
                <p className="text-xs text-muted-foreground">
                  served from cache
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Federation Ratio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{federationRatio}%</div>
                <p className="text-xs text-muted-foreground">
                  include federated results
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Popular Queries */}
          {popularQueries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Popular Queries</CardTitle>
                <CardDescription>Most searched terms</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg Results</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popularQueries.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.query}</TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">{item.avg_results}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Category Distribution */}
          {categoryDistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>Searches by category</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg Query Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryDistribution.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium capitalize">
                          {item.category}
                        </TableCell>
                        <TableCell className="text-right">{item.count}</TableCell>
                        <TableCell className="text-right">{item.avg_query_time}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          {metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Query latency percentiles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">P50 (Median)</p>
                    <p className="text-2xl font-bold">{p50}ms</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">P95</p>
                    <p className="text-2xl font-bold">{p95}ms</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">P99</p>
                    <p className="text-2xl font-bold">{p99}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Partner Contribution - Always shown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Partner Contribution
          </CardTitle>
          <CardDescription>Resource distribution across federated partners</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : partnerContributions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No federated resources yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance</TableHead>
                  <TableHead className="text-right">Resources</TableHead>
                  <TableHead className="text-right">Avg Trust Score</TableHead>
                  <TableHead className="text-right">Last Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerContributions.map((partner, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{partner.instance_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {partner.instance_url}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{partner.resource_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {partner.avg_trust_score.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {partner.last_sync
                        ? new Date(partner.last_sync).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
