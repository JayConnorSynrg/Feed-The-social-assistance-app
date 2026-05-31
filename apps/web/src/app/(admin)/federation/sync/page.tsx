'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'

interface SyncLogEntry {
  id: string
  peer_id: string
  sync_status: string
  started_at: string
  completed_at: string | null
  resources_fetched: number | null
  resources_created: number | null
  resources_updated: number | null
  resources_deleted: number | null
  sync_duration_ms: number | null
  error_message: string | null
  federation_peers?: {
    id: string
    auto_sync_enabled: boolean
    sync_interval_minutes: number
    federated_instances?: {
      id: string
      instance_name: string
      instance_url: string
    }
  }
}

interface PartnerSyncStatus {
  peerId: string
  partnerName: string
  partnerUrl: string
  lastSync: string | null
  status: string
  resourcesFetched: number
  resourcesCreated: number
  resourcesUpdated: number
  duration: number | null
  nextScheduledSync: Date | null
  syncIntervalMinutes: number
  autoSyncEnabled: boolean
}

interface StatsData {
  totalSyncsToday: number
  resourcesSyncedToday: number
  activeSyncs: number
  errorCount: number
}

export default function SyncStatusPage() {
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([])
  const [partnerStatuses, setPartnerStatuses] = useState<PartnerSyncStatus[]>([])
  const [stats, setStats] = useState<StatsData>({
    totalSyncsToday: 0,
    resourcesSyncedToday: 0,
    activeSyncs: 0,
    errorCount: 0
  })
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [syncingPeers, setSyncingPeers] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const fetchSyncData = useCallback(async () => {
    try {
      // Fetch sync logs with joins
      const { data: logs, error: logsError } = await supabase
        .from('federation_sync_log')
        .select(`
          *,
          federation_peers!inner(
            id,
            auto_sync_enabled,
            sync_interval_minutes,
            federated_instances!federation_peers_remote_instance_id_fkey(
              id,
              instance_name,
              instance_url
            )
          )
        `)
        .order('started_at', { ascending: false })
        .limit(100)

      if (logsError) {
        logger.error('federation.sync_logs.fetch_failed', logsError instanceof Error ? logsError : new Error(String(logsError)), {})
        return
      }

      setSyncLogs(logs || [])

      // Calculate stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayLogs = (logs || []).filter(log => new Date(log.started_at) >= today)

      const totalSyncsToday = todayLogs.length
      const resourcesSyncedToday = todayLogs.reduce((sum, log) => {
        return sum + (log.resources_created || 0) + (log.resources_updated || 0)
      }, 0)
      const activeSyncs = (logs || []).filter(log => log.sync_status === 'in_progress').length
      const errorCount = todayLogs.filter(log => log.sync_status === 'error').length

      setStats({
        totalSyncsToday,
        resourcesSyncedToday,
        activeSyncs,
        errorCount
      })

      // Build partner statuses
      const partnerMap = new Map<string, PartnerSyncStatus>()

      for (const log of logs || []) {
        if (!log.federation_peers?.federated_instances) continue

        const peerId = log.peer_id
        const partner = log.federation_peers.federated_instances

        if (!partnerMap.has(peerId)) {
          const lastCompletedLog = (logs || [])
            .filter(l => l.peer_id === peerId && l.completed_at)
            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]

          let nextScheduledSync: Date | null = null
          if (lastCompletedLog?.completed_at && log.federation_peers.auto_sync_enabled) {
            nextScheduledSync = new Date(lastCompletedLog.completed_at)
            nextScheduledSync.setMinutes(
              nextScheduledSync.getMinutes() + log.federation_peers.sync_interval_minutes
            )
          }

          const latestLog = (logs || [])
            .filter(l => l.peer_id === peerId)
            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]

          partnerMap.set(peerId, {
            peerId,
            partnerName: partner.instance_name,
            partnerUrl: partner.instance_url,
            lastSync: latestLog?.started_at || null,
            status: latestLog?.sync_status || 'unknown',
            resourcesFetched: latestLog?.resources_fetched || 0,
            resourcesCreated: latestLog?.resources_created || 0,
            resourcesUpdated: latestLog?.resources_updated || 0,
            duration: latestLog?.sync_duration_ms || null,
            nextScheduledSync,
            syncIntervalMinutes: log.federation_peers.sync_interval_minutes,
            autoSyncEnabled: log.federation_peers.auto_sync_enabled
          })
        }
      }

      setPartnerStatuses(Array.from(partnerMap.values()))
    } catch (error) {
      logger.error('federation.sync_data.fetch_failed', error instanceof Error ? error : new Error(String(error)), {})
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSyncData()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('sync-log-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'federation_sync_log'
        },
        () => {
          fetchSyncData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchSyncData])

  const handleManualSync = async (peerId: string) => {
    setSyncingPeers(prev => new Set(prev).add(peerId))

    try {
      const { data, error } = await supabase.functions.invoke('federation-sync', {
        body: { peerId }
      })

      if (error) {
        logger.error('federation.sync.error', error instanceof Error ? error : new Error(String(error)), { peerId })
        alert(`Sync failed: ${error.message}`)
      } else {
        logger.info('federation.sync.triggered', { peerId, result: JSON.stringify(data) })
      }
    } catch (error) {
      logger.error('federation.sync.trigger_failed', error instanceof Error ? error : new Error(String(error)), { peerId })
      alert('Failed to trigger sync')
    } finally {
      setSyncingPeers(prev => {
        const next = new Set(prev)
        next.delete(peerId)
        return next
      })
      // Refresh data after sync completes
      setTimeout(fetchSyncData, 2000)
    }
  }

  const formatDuration = (ms: number | null): string => {
    if (!ms) return '-'
    const seconds = ms / 1000
    return seconds < 1 ? `${ms}ms` : `${seconds.toFixed(1)}s`
  }

  const formatRelativeTime = (dateStr: string | null): string => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const formatNextSync = (nextSync: Date | null): string => {
    if (!nextSync) return 'Manual only'
    const now = new Date()
    const diffMs = nextSync.getTime() - now.getTime()

    if (diffMs < 0) return 'Overdue'

    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 60) return `in ${diffMins}m`
    if (diffHours < 24) return `in ${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    return `in ${diffDays}d`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const filteredLogs = filterStatus === 'all'
    ? syncLogs
    : syncLogs.filter(log => log.sync_status === filterStatus)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sync Status Monitor</h1>
          <p className="text-muted-foreground">Monitor federation resource synchronization</p>
        </div>
        <Button onClick={fetchSyncData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Syncs Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSyncsToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources Synced</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resourcesSyncedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Syncs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSyncs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors Today</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.errorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Partner Sync Table */}
      <Card>
        <CardHeader>
          <CardTitle>Federation Partners</CardTitle>
          <CardDescription>Synchronization status for each federation partner</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resources</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Next Sync</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partnerStatuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No partner sync data available
                  </TableCell>
                </TableRow>
              ) : (
                partnerStatuses.map((partner) => (
                  <TableRow key={partner.peerId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{partner.partnerName}</div>
                        <div className="text-sm text-muted-foreground">{partner.partnerUrl}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatRelativeTime(partner.lastSync)}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(partner.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div>Fetched: {partner.resourcesFetched}</div>
                        <div>Created: {partner.resourcesCreated}</div>
                        <div>Updated: {partner.resourcesUpdated}</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDuration(partner.duration)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatNextSync(partner.nextScheduledSync)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManualSync(partner.peerId)}
                        disabled={syncingPeers.has(partner.peerId)}
                      >
                        {syncingPeers.has(partner.peerId) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Sync
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Sync Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sync Operations</CardTitle>
              <CardDescription>Detailed log of synchronization activities</CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No sync logs found
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(log.sync_status)}
                      <span className="font-medium">
                        {log.federation_peers?.federated_instances?.instance_name || 'Unknown Partner'}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(log.started_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fetched:</span>
                      <span className="ml-2 font-medium">{log.resources_fetched || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="ml-2 font-medium">{log.resources_created || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="ml-2 font-medium">{log.resources_updated || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-2 font-medium">{formatDuration(log.sync_duration_ms)}</span>
                    </div>
                  </div>

                  {log.error_message && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        <div>
                          <div className="font-medium text-red-900">Error Details</div>
                          <div className="text-red-700 mt-1">{log.error_message}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
