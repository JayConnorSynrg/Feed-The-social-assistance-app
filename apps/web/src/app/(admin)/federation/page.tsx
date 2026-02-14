'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  AlertCircle,
  CheckCircle2,
  Globe,
  Plus,
  RefreshCw,
  Shield,
  XCircle
} from 'lucide-react'

interface FederatedInstance {
  id: string
  instance_url: string
  instance_name: string
  is_local: boolean
  public_key: string
  status: 'active' | 'suspended' | 'blocked'
  metadata: Record<string, unknown>
  last_seen_at: string | null
  created_at: string
}

interface FederationPeer {
  id: string
  local_instance_id: string
  remote_instance_id: string
  trust_score: number
  trust_level: 'untrusted' | 'pending' | 'trusted' | 'verified' | 'core'
  federation_enabled: boolean
  auto_sync_enabled: boolean
  sync_interval_minutes: number
  shared_resource_categories: string[]
  notes: string | null
  remote_instance?: FederatedInstance
}

const trustLevelColors: Record<string, string> = {
  untrusted: 'bg-red-500',
  pending: 'bg-yellow-500',
  trusted: 'bg-blue-500',
  verified: 'bg-green-500',
  core: 'bg-purple-500'
}

export default function FederationAdminPage() {
  const [peers, setPeers] = useState<FederationPeer[]>([])
  const [localInstance, setLocalInstance] = useState<FederatedInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addingPartner, setAddingPartner] = useState(false)

  // Form state for adding new partner
  const [newPartnerUrl, setNewPartnerUrl] = useState('')
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newPartnerNotes, setNewPartnerNotes] = useState('')
  const [fetchedMetadata, setFetchedMetadata] = useState<Record<string, unknown> | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadFederationData()
  }, [])

  async function loadFederationData() {
    setLoading(true)
    setError(null)

    try {
      // Get local instance
      const { data: local, error: localError } = await supabase
        .from('federated_instances')
        .select('*')
        .eq('is_local', true)
        .single()

      if (localError) {
        if (localError.code === 'PGRST116') {
          setError('Local instance not registered. Run: npm run federation:register-local')
        } else {
          throw localError
        }
        return
      }

      setLocalInstance(local)

      // Get all federation peers with remote instance details
      const { data: peerData, error: peersError } = await supabase
        .from('federation_peers')
        .select(`
          *,
          remote_instance:federated_instances!federation_peers_remote_instance_id_fkey(*)
        `)
        .eq('local_instance_id', local.id)

      if (peersError) throw peersError

      setPeers(peerData || [])
    } catch (err) {
      console.error('Failed to load federation data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load federation data')
    } finally {
      setLoading(false)
    }
  }

  async function fetchRemoteMetadata() {
    if (!newPartnerUrl) return

    try {
      const url = new URL(newPartnerUrl)
      const metadataUrl = `${url.origin}/.well-known/feed-instance`

      const response = await fetch(metadataUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status}`)
      }

      const metadata = await response.json()
      setFetchedMetadata(metadata)
      setNewPartnerName(metadata.instance_name || '')
    } catch (err) {
      console.error('Failed to fetch remote metadata:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch remote instance metadata')
      setFetchedMetadata(null)
    }
  }

  async function addFederationPartner() {
    if (!localInstance || !newPartnerUrl) return

    setAddingPartner(true)
    setError(null)

    try {
      // Ensure we have metadata
      if (!fetchedMetadata) {
        throw new Error('Please fetch remote instance metadata first')
      }

      // Check if instance already exists
      const { data: existingInstance } = await supabase
        .from('federated_instances')
        .select('id')
        .eq('instance_url', newPartnerUrl)
        .single()

      let remoteInstanceId: string

      if (existingInstance) {
        remoteInstanceId = existingInstance.id
      } else {
        // Create new federated instance record
        const { data: newInstance, error: instanceError } = await supabase
          .from('federated_instances')
          .insert({
            instance_url: newPartnerUrl,
            instance_name: newPartnerName || fetchedMetadata.instance_name,
            is_local: false,
            public_key: fetchedMetadata.public_key as string,
            status: 'active',
            metadata: fetchedMetadata.metadata || {}
          })
          .select()
          .single()

        if (instanceError) throw instanceError
        remoteInstanceId = newInstance.id
      }

      // Check if peer relationship already exists
      const { data: existingPeer } = await supabase
        .from('federation_peers')
        .select('id')
        .eq('local_instance_id', localInstance.id)
        .eq('remote_instance_id', remoteInstanceId)
        .single()

      if (existingPeer) {
        throw new Error('Federation peer relationship already exists')
      }

      // Create federation peer relationship
      const { error: peerError } = await supabase
        .from('federation_peers')
        .insert({
          local_instance_id: localInstance.id,
          remote_instance_id: remoteInstanceId,
          trust_score: 0.5,
          trust_level: 'pending',
          federation_enabled: true,
          auto_sync_enabled: true,
          sync_interval_minutes: 15,
          shared_resource_categories: ['food', 'housing', 'healthcare', 'legal', 'employment', 'education'],
          notes: newPartnerNotes || null
        })

      if (peerError) throw peerError

      // Refresh data and close dialog
      await loadFederationData()
      setAddDialogOpen(false)
      resetAddForm()
    } catch (err) {
      console.error('Failed to add federation partner:', err)
      setError(err instanceof Error ? err.message : 'Failed to add federation partner')
    } finally {
      setAddingPartner(false)
    }
  }

  async function toggleFederation(peerId: string, enabled: boolean) {
    try {
      const { error } = await supabase
        .from('federation_peers')
        .update({ federation_enabled: enabled })
        .eq('id', peerId)

      if (error) throw error
      await loadFederationData()
    } catch (err) {
      console.error('Failed to toggle federation:', err)
      setError(err instanceof Error ? err.message : 'Failed to toggle federation')
    }
  }

  function resetAddForm() {
    setNewPartnerUrl('')
    setNewPartnerName('')
    setNewPartnerNotes('')
    setFetchedMetadata(null)
  }

  function getTrustLevelBadge(level: string) {
    return (
      <Badge className={`${trustLevelColors[level] || 'bg-gray-500'} text-white`}>
        {level}
      </Badge>
    )
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'suspended':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'blocked':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
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
            <Globe className="h-8 w-8" />
            Federation Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage connections with other FEED instances
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Federation Partner</DialogTitle>
              <DialogDescription>
                Connect to another FEED instance to share resources
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="partner-url">Instance URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="partner-url"
                    placeholder="https://oakland.feed.org"
                    value={newPartnerUrl}
                    onChange={(e) => setNewPartnerUrl(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fetchRemoteMetadata}
                    disabled={!newPartnerUrl}
                  >
                    Fetch
                  </Button>
                </div>
              </div>

              {fetchedMetadata && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Instance Found</span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Name:</strong> {fetchedMetadata.instance_name as string}</p>
                      <p><strong>Version:</strong> {fetchedMetadata.version as string}</p>
                      <p><strong>Resources:</strong> {(fetchedMetadata.metadata as Record<string, unknown>)?.resource_count as number || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="partner-name">Display Name (optional)</Label>
                <Input
                  id="partner-name"
                  placeholder="Oakland FEED"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner-notes">Notes (optional)</Label>
                <Textarea
                  id="partner-notes"
                  placeholder="Notes about this partner..."
                  value={newPartnerNotes}
                  onChange={(e) => setNewPartnerNotes(e.target.value)}
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                onClick={addFederationPartner}
                disabled={!fetchedMetadata || addingPartner}
              >
                {addingPartner ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Federation Partner
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && !addDialogOpen && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local Instance Info */}
      {localInstance && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Local Instance
            </CardTitle>
            <CardDescription>Your FEED instance identity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Name</p>
                <p>{localInstance.instance_name}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">URL</p>
                <p className="truncate">{localInstance.instance_url}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  {getStatusIcon(localInstance.status)}
                  <span className="capitalize">{localInstance.status}</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Public Key</p>
                <p className="truncate text-xs font-mono">
                  {localInstance.public_key.substring(27, 60)}...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Federation Partners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Federation Partners ({peers.length})</CardTitle>
          <CardDescription>
            Connected FEED instances sharing resources with you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No federation partners yet</p>
              <p className="text-sm">Add a partner to start sharing resources</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance</TableHead>
                  <TableHead>Trust Level</TableHead>
                  <TableHead>Trust Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Federation</TableHead>
                  <TableHead>Auto Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {peers.map((peer) => (
                  <TableRow key={peer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {peer.remote_instance?.instance_name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {peer.remote_instance?.instance_url}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTrustLevelBadge(peer.trust_level)}
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
                      <div className="flex items-center gap-2">
                        {getStatusIcon(peer.remote_instance?.status || 'unknown')}
                        <span className="capitalize">
                          {peer.remote_instance?.status || 'unknown'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={peer.federation_enabled}
                        onCheckedChange={(checked) => toggleFederation(peer.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={peer.auto_sync_enabled ? 'default' : 'secondary'}>
                        {peer.auto_sync_enabled ? 'On' : 'Off'}
                      </Badge>
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
