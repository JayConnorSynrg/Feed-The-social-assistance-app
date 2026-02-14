'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'

interface FederationPeer {
  id: string
  remote_instance_id: string
  trust_score: number
  trust_level: string
  federation_enabled: boolean
  auto_sync_enabled: boolean
  remote_instance: {
    id: string
    instance_url: string
    instance_name: string
    status: string
    last_seen_at: string | null
  }
}

interface HealthCheck {
  id: string
  instance_id: string
  check_status: string
  response_time_ms: number | null
  error_message: string | null
  checked_at: string
}

interface TrustEvent {
  id: string
  peer_id: string
  event_type: string
  old_trust_score: number
  new_trust_score: number
  old_trust_level: string | null
  new_trust_level: string | null
  reason: string | null
  metadata: unknown
  created_by: string | null
  created_at: string
}

const trustLevelColors: Record<string, string> = {
  untrusted: 'bg-red-500',
  pending: 'bg-yellow-500',
  trusted: 'bg-blue-500',
  verified: 'bg-green-500',
  core: 'bg-purple-500',
}

const statusIcons: Record<string, React.ReactNode> = {
  healthy: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  degraded: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  unhealthy: <XCircle className="h-4 w-4 text-red-500" />,
}

export default function FederationDashboardPage() {
  const [peers, setPeers] = useState<FederationPeer[]>([])
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
  const [trustEvents, setTrustEvents] = useState<TrustEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Trust adjustment dialog
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedPeer, setSelectedPeer] = useState<FederationPeer | null>(null)
  const [adjustmentValue, setAdjustmentValue] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const supabase = createClient()

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Get local instance
      const { data: localInstance, error: localError } = await supabase
        .from('federated_instances')
        .select('id')
        .eq('is_local', true)
        .single()

      if (localError) {
        if (localError.code === 'PGRST116') {
          setError('Local instance not registered')
        } else {
          throw localError
        }
        return
      }

      // Fetch peers with instance info
      const { data: peersData, error: peersError } = await supabase
        .from('federation_peers')
        .select(`
          *,
          remote_instance:federated_instances!federation_peers_remote_instance_id_fkey(*)
        `)
        .eq('local_instance_id', localInstance.id)
        .order('trust_score', { ascending: false })

      if (peersError) throw peersError
      setPeers(peersData || [])

      // Fetch recent health checks
      const instanceIds = (peersData || []).map((p) => p.remote_instance_id)
      if (instanceIds.length > 0) {
        const { data: healthData, error: healthError } = await supabase
          .from('federation_health_checks')
          .select('*')
          .in('instance_id', instanceIds)
          .order('created_at', { ascending: false })
          .limit(100)

        if (healthError) throw healthError
        setHealthChecks(healthData || [])
      }

      // Fetch recent trust events
      const peerIds = (peersData || []).map((p) => p.id)
      if (peerIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('federation_trust_events')
          .select('*')
          .in('peer_id', peerIds)
          .order('created_at', { ascending: false })
          .limit(50)

        if (eventsError) throw eventsError
        setTrustEvents(eventsData || [])
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadDashboardData()

    // Set up real-time subscription
    const channel = supabase
      .channel('federation-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'federation_health_checks' },
        () => loadDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'federation_trust_events' },
        () => loadDashboardData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadDashboardData, supabase])

  // Calculate aggregate stats
  const stats = {
    totalPeers: peers.length,
    activePeers: peers.filter((p) => p.federation_enabled).length,
    healthyPeers: peers.filter((p) => {
      const latestCheck = healthChecks.find((h) => h.instance_id === p.remote_instance_id)
      return latestCheck?.check_status === 'healthy'
    }).length,
    avgTrustScore:
      peers.length > 0
        ? Math.round((peers.reduce((sum, p) => sum + p.trust_score, 0) / peers.length) * 100)
        : 0,
    recentIssues: healthChecks.filter((h) => h.check_status !== 'healthy').slice(0, 5).length,
  }

  // Get latest health check for a peer
  const getLatestHealthCheck = (instanceId: string): HealthCheck | undefined => {
    return healthChecks.find((h) => h.instance_id === instanceId)
  }

  // Get uptime for a peer (last 24h)
  const getUptime = (instanceId: string): number => {
    const checks = healthChecks.filter((h) => h.instance_id === instanceId)
    if (checks.length === 0) return 0
    const healthy = checks.filter((h) => h.check_status === 'healthy').length
    return Math.round((healthy / checks.length) * 100)
  }

  // Handle trust score adjustment
  async function adjustTrustScore() {
    if (!selectedPeer || !adjustmentValue || !adjustmentReason) return

    setAdjusting(true)
    setError(null)

    try {
      const adjustment = parseFloat(adjustmentValue)
      if (isNaN(adjustment) || adjustment < -1 || adjustment > 1) {
        throw new Error('Adjustment must be between -1 and 1')
      }

      const newScore = Math.max(0, Math.min(1, selectedPeer.trust_score + adjustment))

      // Update trust score
      const { error: updateError } = await supabase
        .from('federation_peers')
        .update({ trust_score: newScore })
        .eq('id', selectedPeer.id)

      if (updateError) throw updateError

      // Log the event
      await supabase.from('federation_trust_events').insert({
        peer_id: selectedPeer.id,
        event_type: adjustment > 0 ? 'manual_boost' : 'manual_penalty',
        old_trust_score: selectedPeer.trust_score,
        new_trust_score: newScore,
        reason: adjustmentReason,
        metadata: { admin_adjustment: adjustment },
        created_by: 'admin', // TODO: Get actual admin ID
      })

      // Refresh data
      await loadDashboardData()
      setAdjustDialogOpen(false)
      setAdjustmentValue('')
      setAdjustmentReason('')
      setSelectedPeer(null)
    } catch (err) {
      console.error('Failed to adjust trust score:', err)
      setError(err instanceof Error ? err.message : 'Failed to adjust trust score')
    } finally {
      setAdjusting(false)
    }
  }

  // Handle instance block/suspend
  async function updateInstanceStatus(peerId: string, instanceId: string, status: string) {
    try {
      const { error: updateError } = await supabase
        .from('federated_instances')
        .update({ status })
        .eq('id', instanceId)

      if (updateError) throw updateError

      // Log the event
      const peer = peers.find((p) => p.id === peerId)
      if (peer) {
        await supabase.from('federation_trust_events').insert({
          peer_id: peerId,
          event_type: status === 'blocked' ? 'instance_blocked' : 'instance_suspended',
          old_trust_score: peer.trust_score,
          new_trust_score: peer.trust_score,
          reason: `Instance status changed to ${status}`,
          metadata: { new_status: status },
          created_by: 'admin',
        })
      }

      await loadDashboardData()
    } catch (err) {
      console.error('Failed to update instance status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Federation Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor health and trust across federation partners
          </p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPeers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activePeers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Healthy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.healthyPeers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Trust
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTrustScore}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.recentIssues}</div>
          </CardContent>
        </Card>
      </div>

      {/* Partners with Health & Trust */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Partner Health & Trust</CardTitle>
          <CardDescription>
            Real-time status of all federation partners
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No federation partners configured</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trust Level</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Uptime (24h)</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peers.map((peer) => {
                  const latestCheck = getLatestHealthCheck(peer.remote_instance_id)
                  const uptime = getUptime(peer.remote_instance_id)

                  return (
                    <TableRow key={peer.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{peer.remote_instance?.instance_name}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {peer.remote_instance?.instance_url}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {latestCheck
                            ? statusIcons[latestCheck.check_status]
                            : <Clock className="h-4 w-4 text-gray-400" />}
                          <span className="capitalize">
                            {latestCheck?.check_status || 'unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${trustLevelColors[peer.trust_level] || 'bg-gray-500'} text-white`}
                        >
                          {peer.trust_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${peer.trust_score * 100}%` }}
                            />
                          </div>
                          <span className="text-sm">
                            {(peer.trust_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            uptime >= 95
                              ? 'text-green-600'
                              : uptime >= 80
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {uptime}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {latestCheck && latestCheck.response_time_ms !== null ? (
                          <span
                            className={
                              latestCheck.response_time_ms < 1000
                                ? 'text-green-600'
                                : latestCheck.response_time_ms < 3000
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }
                          >
                            {latestCheck.response_time_ms}ms
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {peer.remote_instance?.last_seen_at ? (
                          <span className="text-sm">
                            {new Date(peer.remote_instance.last_seen_at).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog open={adjustDialogOpen && selectedPeer?.id === peer.id}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPeer(peer)
                                  setAdjustDialogOpen(true)
                                }}
                              >
                                <Zap className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Adjust Trust Score</DialogTitle>
                                <DialogDescription>
                                  Manually adjust trust score for {peer.remote_instance?.instance_name}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label>Current Score</Label>
                                  <p className="text-2xl font-bold">
                                    {(peer.trust_score * 100).toFixed(1)}%
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="adjustment">Adjustment (-1 to +1)</Label>
                                  <Input
                                    id="adjustment"
                                    type="number"
                                    step="0.01"
                                    min="-1"
                                    max="1"
                                    value={adjustmentValue}
                                    onChange={(e) => setAdjustmentValue(e.target.value)}
                                    placeholder="e.g. 0.05 or -0.1"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="reason">Reason</Label>
                                  <Input
                                    id="reason"
                                    value={adjustmentReason}
                                    onChange={(e) => setAdjustmentReason(e.target.value)}
                                    placeholder="Reason for adjustment..."
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    className="flex-1"
                                    onClick={adjustTrustScore}
                                    disabled={adjusting || !adjustmentValue || !adjustmentReason}
                                  >
                                    {adjusting ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      'Apply'
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setAdjustDialogOpen(false)
                                      setSelectedPeer(null)
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Select
                            value={peer.remote_instance?.status}
                            onValueChange={(value) =>
                              updateInstanceStatus(peer.id, peer.remote_instance_id, value)
                            }
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="suspended">Suspend</SelectItem>
                              <SelectItem value="blocked">Block</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Trust Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trust Events</CardTitle>
          <CardDescription>
            Audit trail of trust score changes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trustEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No trust events recorded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trustEvents.slice(0, 20).map((event) => {
                const scoreChange = event.new_trust_score - event.old_trust_score
                const isPositive = scoreChange > 0
                const peer = peers.find((p) => p.id === event.peer_id)

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <div
                      className={`p-2 rounded-full ${
                        isPositive ? 'bg-green-100' : 'bg-red-100'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {peer?.remote_instance?.instance_name || 'Unknown Instance'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {event.event_type.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-mono ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {(scoreChange * 100).toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm mt-2">{event.reason}</p>
                      {event.old_trust_level !== event.new_trust_level && event.new_trust_level && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{event.old_trust_level}</Badge>
                          {isPositive ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          <Badge
                            className={`${
                              trustLevelColors[event.new_trust_level] || 'bg-gray-500'
                            } text-white`}
                          >
                            {event.new_trust_level}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
