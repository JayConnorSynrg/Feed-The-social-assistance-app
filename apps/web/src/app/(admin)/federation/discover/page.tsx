'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Alert,
  AlertDescription,
} from '@/components/ui/alert'
import {
  Globe,
  Search,
  Plus,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react'

interface WebFingerLink {
  rel: string
  type?: string
  href?: string
}

interface WebFingerResponse {
  subject: string
  links: WebFingerLink[]
}

interface InstanceMetadata {
  instance_name: string
  instance_type: string
  resource_count?: number
  federation_api?: string
  description?: string
}

interface DiscoveryResult {
  domain: string
  status: 'found' | 'not_found' | 'error'
  timestamp: string
  metadata?: InstanceMetadata
  error?: string
  webfingerUrl?: string
  instanceUrl?: string
}

export default function FederationDiscoverPage() {
  const [domain, setDomain] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentDiscoveries, setRecentDiscoveries] = useState<DiscoveryResult[]>([])
  const [isAdding, setIsAdding] = useState(false)

  const supabase = createClient()

  // Normalize domain input (remove protocol, paths, etc.)
  const normalizeDomain = (input: string): string => {
    let normalized = input.trim().toLowerCase()
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, '')
    // Remove path
    normalized = normalized.split('/')[0]
    // Remove port (optional, depending on requirements)
    normalized = normalized.split(':')[0]
    return normalized
  }

  const performWebFingerDiscovery = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain name')
      return
    }

    const normalizedDomain = normalizeDomain(domain)
    setIsSearching(true)
    setError(null)
    setDiscoveryResult(null)

    try {
      // WebFinger discovery
      const webfingerUrl = `https://${normalizedDomain}/.well-known/webfinger?resource=acct:feed@${normalizedDomain}`

      const webfingerResponse = await fetch(webfingerUrl)

      if (!webfingerResponse.ok) {
        throw new Error(`WebFinger lookup failed: ${webfingerResponse.status} ${webfingerResponse.statusText}`)
      }

      const webfingerData: WebFingerResponse = await webfingerResponse.json()

      // Find the self link to get instance info
      const selfLink = webfingerData.links.find(link => link.rel === 'self')

      if (!selfLink?.href) {
        throw new Error('WebFinger response missing self link')
      }

      // Fetch instance metadata
      const instanceResponse = await fetch(selfLink.href)

      if (!instanceResponse.ok) {
        throw new Error(`Instance metadata fetch failed: ${instanceResponse.status}`)
      }

      const instanceData = await instanceResponse.json()

      // Extract metadata
      const metadata: InstanceMetadata = {
        instance_name: instanceData.instance_name || normalizedDomain,
        instance_type: instanceData.instance_type || 'Community Instance',
        resource_count: instanceData.resource_count,
        federation_api: selfLink.href,
        description: instanceData.description
      }

      const result: DiscoveryResult = {
        domain: normalizedDomain,
        status: 'found',
        timestamp: new Date().toISOString(),
        metadata,
        webfingerUrl,
        instanceUrl: selfLink.href
      }

      setDiscoveryResult(result)

      // Add to recent discoveries
      setRecentDiscoveries(prev => [result, ...prev.slice(0, 9)])

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'

      const result: DiscoveryResult = {
        domain: normalizedDomain,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage
      }

      setDiscoveryResult(result)
      setRecentDiscoveries(prev => [result, ...prev.slice(0, 9)])
      setError(errorMessage)
    } finally {
      setIsSearching(false)
    }
  }

  const addAsFederationPartner = async () => {
    if (!discoveryResult || discoveryResult.status !== 'found' || !discoveryResult.metadata) {
      return
    }

    setIsAdding(true)
    setError(null)

    try {
      const { metadata, domain: remoteDomain } = discoveryResult

      // Get local instance
      const { data: localInstance, error: localError } = await supabase
        .from('federated_instances')
        .select('id')
        .eq('is_local', true)
        .single()

      if (localError || !localInstance) {
        throw new Error('Failed to find local instance')
      }

      // Check if instance already exists
      const { data: existingInstance } = await supabase
        .from('federated_instances')
        .select('id')
        .eq('instance_url', `https://${remoteDomain}`)
        .single()

      let remoteInstanceId: string

      if (existingInstance) {
        remoteInstanceId = existingInstance.id
      } else {
        // Insert remote instance
        const { data: newInstance, error: insertError } = await supabase
          .from('federated_instances')
          .insert({
            instance_url: `https://${remoteDomain}`,
            instance_name: metadata.instance_name,
            is_local: false,
            public_key: '', // Will be populated during first handshake
            status: 'active',
            metadata: {
              instance_type: metadata.instance_type,
              resource_count: metadata.resource_count,
              description: metadata.description,
              discovered_via: 'webfinger',
              discovered_at: new Date().toISOString()
            }
          })
          .select('id')
          .single()

        if (insertError || !newInstance) {
          throw new Error(`Failed to create instance: ${insertError?.message}`)
        }

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
        setError('This instance is already a federation partner')
        return
      }

      // Create federation peer
      const { error: peerError } = await supabase
        .from('federation_peers')
        .insert({
          local_instance_id: localInstance.id,
          remote_instance_id: remoteInstanceId,
          trust_level: 'pending',
          trust_score: 50,
          federation_enabled: true,
          auto_sync_enabled: false,
          sync_interval_minutes: 60,
          shared_resource_categories: ['general'],
          notes: `Discovered via WebFinger on ${new Date().toLocaleDateString()}`
        })

      if (peerError) {
        throw new Error(`Failed to create peer: ${peerError.message}`)
      }

      // Update discovery result to show it was added
      setDiscoveryResult(prev => prev ? { ...prev, status: 'found' as const } : null)

      // Show success message
      alert(`Successfully added ${metadata.instance_name} as a federation partner!`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add federation partner'
      setError(errorMessage)
    } finally {
      setIsAdding(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSearching) {
      performWebFingerDiscovery()
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'found':
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" /> Found</Badge>
      case 'not_found':
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" /> Not Found</Badge>
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Error</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Globe className="w-8 h-8" />
          Federation Instance Discovery
        </h1>
        <p className="text-muted-foreground">
          Discover and connect to other FEED instances using WebFinger protocol
        </p>
      </div>

      {/* Search Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Discover Instance</CardTitle>
          <CardDescription>
            Enter a domain name to discover FEED federation instances (e.g., oakland.feed.org)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter domain name (e.g., oakland.feed.org)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-9"
                disabled={isSearching}
              />
            </div>
            <Button
              onClick={performWebFingerDiscovery}
              disabled={isSearching || !domain.trim()}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Discover
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Discovery Result */}
      {discoveryResult && discoveryResult.status === 'found' && discoveryResult.metadata && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                Discovery Result
              </CardTitle>
              {getStatusBadge(discoveryResult.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-semibold">{discoveryResult.metadata.instance_name}</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Domain:</span>
                  <p className="font-medium">{discoveryResult.domain}</p>
                </div>

                <div>
                  <span className="text-muted-foreground">Instance Type:</span>
                  <p className="font-medium">{discoveryResult.metadata.instance_type}</p>
                </div>

                {discoveryResult.metadata.resource_count !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Resources:</span>
                    <p className="font-medium">{discoveryResult.metadata.resource_count.toLocaleString()}</p>
                  </div>
                )}

                {discoveryResult.metadata.federation_api && (
                  <div>
                    <span className="text-muted-foreground">Federation API:</span>
                    <p className="font-medium text-xs break-all">
                      {discoveryResult.metadata.federation_api}
                    </p>
                  </div>
                )}
              </div>

              {discoveryResult.metadata.description && (
                <div className="mt-4">
                  <span className="text-muted-foreground text-sm">Description:</span>
                  <p className="text-sm mt-1">{discoveryResult.metadata.description}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={addAsFederationPartner}
                disabled={isAdding}
                className="flex-1"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add as Federation Partner
                  </>
                )}
              </Button>

              {discoveryResult.instanceUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(discoveryResult.instanceUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Instance
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Discoveries */}
      {recentDiscoveries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Discoveries</CardTitle>
            <CardDescription>
              History of recent discovery attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Instance Name</TableHead>
                  <TableHead>Resources</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDiscoveries.map((discovery, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{discovery.domain}</TableCell>
                    <TableCell>{getStatusBadge(discovery.status)}</TableCell>
                    <TableCell>
                      {discovery.metadata?.instance_name || '-'}
                    </TableCell>
                    <TableCell>
                      {discovery.metadata?.resource_count?.toLocaleString() || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(discovery.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      {discovery.status === 'found' && discovery.instanceUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(discovery.instanceUrl, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            How Discovery Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>WebFinger Protocol:</strong> Instances are discovered using the WebFinger protocol
            at <code className="bg-white px-1 rounded">/.well-known/webfinger</code>
          </p>
          <p>
            <strong>Instance Metadata:</strong> After discovery, instance details are fetched from
            the federation API endpoint to display resource counts and capabilities.
          </p>
          <p>
            <strong>Adding Partners:</strong> Click "Add as Federation Partner" to create a pending
            trust relationship. Complete authentication via the main federation dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
