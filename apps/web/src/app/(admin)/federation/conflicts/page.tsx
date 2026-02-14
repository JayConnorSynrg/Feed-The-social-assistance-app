'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2, GitMerge, ArrowLeft, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { normalizeString, levenshteinDistance } from '@feed/shared'

type ResolutionType = 'keep_local' | 'keep_remote' | 'merge'

interface MergeDecisions {
  [key: string]: 'local' | 'remote'
}

interface FederatedResourceMeta {
  resolved?: boolean
  resolution?: string
  resolved_at?: string
  local_resource_id?: string
  merge_decisions?: MergeDecisions
  [key: string]: unknown
}

interface FederatedResource {
  id: string
  source_instance_id: string
  source_resource_id: string
  name: string
  description: string | null
  resource_type: string
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  website: string | null
  hours_of_operation: unknown
  metadata: FederatedResourceMeta | null
  trust_score: number | null
  last_synced_at: string
  is_verified: boolean | null
  created_at: string
  updated_at: string
}

interface LocalResource {
  id: string
  name: string
  description: string | null
  category: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  website: string | null
  hours_of_operation: unknown
  is_verified: boolean | null
  status: string
  updated_at: string | null
  created_at: string | null
}

interface FederatedInstance {
  id: string
  instance_name: string
  instance_url: string
  status: string
}

interface Conflict {
  id: string
  federatedResource: FederatedResource
  localResource: LocalResource | null
  instanceName: string
  matchScore: number
  isResolved: boolean
  resolution: string | null
}

export default function FederationConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [instances, setInstances] = useState<FederatedInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [filterInstance, setFilterInstance] = useState<string>('all')
  const [filterResolution, setFilterResolution] = useState<string>('all')
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [resolving, setResolving] = useState(false)
  const [mergeDecisions, setMergeDecisions] = useState<MergeDecisions>({})

  const supabase = createClient()

  const loadConflicts = useCallback(async () => {
    setLoading(true)
    try {
      // Load federated instances
      const { data: instancesData } = await supabase
        .from('federated_instances')
        .select('id, instance_name, instance_url, status')
        .order('instance_name')

      if (instancesData) {
        setInstances(instancesData)
      }

      // Load federated resources
      const { data: federatedData } = await supabase
        .from('federated_resources')
        .select('*')
        .order('created_at', { ascending: false })

      // Load local resources
      const { data: localData } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })

      if (!federatedData || !localData) {
        setConflicts([])
        return
      }

      // Detect conflicts by matching federated resources against local resources
      const detectedConflicts: Conflict[] = []
      const instanceMap = new Map(instancesData?.map(i => [i.id, i.instance_name]))

      for (const fedRes of federatedData) {
        // Check if already resolved in metadata
        const meta = fedRes.metadata as FederatedResourceMeta | null
        const isResolved = meta?.resolved === true
        const resolution = meta?.resolution ?? null

        // Find potential local matches
        const normalizedFedName = normalizeString(fedRes.name || '')
        const normalizedFedCity = normalizeString(fedRes.city || '')

        let bestMatch: LocalResource | null = null
        let bestScore = 0

        for (const localRes of localData) {
          const normalizedLocalName = normalizeString(localRes.name || '')
          const normalizedLocalCity = normalizeString(localRes.city || '')

          // Skip if cities don't match
          if (normalizedFedCity && normalizedLocalCity && normalizedFedCity !== normalizedLocalCity) {
            continue
          }

          // Calculate name similarity
          const nameDistance = levenshteinDistance(normalizedFedName, normalizedLocalName)
          const maxLength = Math.max(normalizedFedName.length, normalizedLocalName.length)
          const similarity = maxLength > 0 ? 1 - (nameDistance / maxLength) : 0

          // Consider it a potential conflict if similarity > 0.8
          if (similarity > 0.8 && similarity > bestScore) {
            bestScore = similarity
            bestMatch = localRes as unknown as LocalResource
          }
        }

        // Only add if there's a potential match (conflict)
        if (bestMatch) {
          detectedConflicts.push({
            id: fedRes.id,
            federatedResource: fedRes as unknown as FederatedResource,
            localResource: bestMatch,
            instanceName: instanceMap.get(fedRes.source_instance_id) || 'Unknown',
            matchScore: bestScore,
            isResolved,
            resolution
          })
        }
      }

      setConflicts(detectedConflicts)
    } catch (error) {
      console.error('Error loading conflicts:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  const handleResolve = async (conflict: Conflict, resolutionType: ResolutionType) => {
    setResolving(true)
    try {
      if (resolutionType === 'keep_local') {
        // Mark federated resource as resolved, keep local as-is
        const keepLocalMeta = {
          ...conflict.federatedResource.metadata,
          resolved: true,
          resolution: 'keep_local',
          resolved_at: new Date().toISOString(),
          local_resource_id: conflict.localResource?.id
        }
        await supabase
          .from('federated_resources')
          .update({ metadata: keepLocalMeta as unknown as never })
          .eq('id', conflict.id)

      } else if (resolutionType === 'keep_remote') {
        // Update local resource with federated data
        const remoteData = {
          name: conflict.federatedResource.name,
          description: conflict.federatedResource.description,
          address_line1: conflict.federatedResource.address_line1,
          city: conflict.federatedResource.city,
          state: conflict.federatedResource.state,
          zip_code: conflict.federatedResource.zip_code,
          phone: conflict.federatedResource.phone,
          website: conflict.federatedResource.website,
          updated_at: new Date().toISOString()
        }

        if (conflict.localResource) {
          await supabase
            .from('resources')
            .update(remoteData)
            .eq('id', conflict.localResource.id)
        }

        // Mark federated resource as resolved
        const keepRemoteMeta = {
          ...conflict.federatedResource.metadata,
          resolved: true,
          resolution: 'keep_remote',
          resolved_at: new Date().toISOString(),
          local_resource_id: conflict.localResource?.id
        }
        await supabase
          .from('federated_resources')
          .update({ metadata: keepRemoteMeta as unknown as never })
          .eq('id', conflict.id)

      } else if (resolutionType === 'merge') {
        // Apply merge decisions
        if (conflict.localResource) {
          const updates: Record<string, unknown> = {}

          Object.entries(mergeDecisions).forEach(([field, source]) => {
            if (source === 'remote') {
              if (field === 'category') {
                updates[field] = conflict.federatedResource.resource_type
              } else if (field in conflict.federatedResource) {
                updates[field] = conflict.federatedResource[field as keyof FederatedResource]
              }
            }
          })

          updates.updated_at = new Date().toISOString()

          await supabase
            .from('resources')
            .update(updates as never)
            .eq('id', conflict.localResource.id)
        }

        // Mark federated resource as resolved
        const mergeMeta = {
          ...conflict.federatedResource.metadata,
          resolved: true,
          resolution: 'merge',
          merge_decisions: mergeDecisions,
          resolved_at: new Date().toISOString(),
          local_resource_id: conflict.localResource?.id
        }
        await supabase
          .from('federated_resources')
          .update({ metadata: mergeMeta as unknown as never })
          .eq('id', conflict.id)
      }

      // Reload conflicts
      await loadConflicts()
      setSelectedConflict(null)
      setMergeDecisions({})
    } catch (error) {
      console.error('Error resolving conflict:', error)
    } finally {
      setResolving(false)
    }
  }

  const filteredConflicts = conflicts.filter(conflict => {
    if (filterInstance !== 'all' && conflict.federatedResource.source_instance_id !== filterInstance) {
      return false
    }
    if (filterResolution === 'resolved' && !conflict.isResolved) {
      return false
    }
    if (filterResolution === 'pending' && conflict.isResolved) {
      return false
    }
    return true
  })

  const stats = {
    total: conflicts.length,
    resolved: conflicts.filter(c => c.isResolved).length,
    pending: conflicts.filter(c => !c.isResolved).length,
    resolvedToday: conflicts.filter(c => {
      const meta = c.federatedResource.metadata as FederatedResourceMeta | null
      if (!c.isResolved || !meta?.resolved_at) return false
      const resolvedDate = new Date(meta.resolved_at)
      const today = new Date()
      return resolvedDate.toDateString() === today.toDateString()
    }).length
  }

  const renderFieldComparison = (field: string, label: string, localValue: any, remoteValue: any) => {
    const hasConflict = JSON.stringify(localValue) !== JSON.stringify(remoteValue)
    const decision = mergeDecisions[field] || 'local'

    return (
      <div key={field} className="border-b pb-3 mb-3 last:border-b-0">
        <div className="text-sm font-medium mb-2">{label}</div>
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
          <div className={`p-2 rounded ${decision === 'local' ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
            <div className="text-xs text-gray-500 mb-1">Local</div>
            <div className="text-sm">{JSON.stringify(localValue) || <span className="text-gray-400">None</span>}</div>
          </div>

          {hasConflict && (
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant={decision === 'local' ? 'default' : 'outline'}
                onClick={() => setMergeDecisions({ ...mergeDecisions, [field]: 'local' })}
              >
                <ArrowLeft className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={decision === 'remote' ? 'default' : 'outline'}
                onClick={() => setMergeDecisions({ ...mergeDecisions, [field]: 'remote' })}
              >
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className={`p-2 rounded ${decision === 'remote' ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
            <div className="text-xs text-gray-500 mb-1">Remote</div>
            <div className="text-sm">{JSON.stringify(remoteValue) || <span className="text-gray-400">None</span>}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Federation Conflict Review</h1>
        <p className="text-gray-600">
          Review and resolve resource conflicts from federated instances
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Resolved Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.resolvedToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Source Instance</label>
            <Select value={filterInstance} onValueChange={setFilterInstance}>
              <SelectTrigger>
                <SelectValue placeholder="All instances" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Instances</SelectItem>
                {instances.map(instance => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.instance_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Resolution Status</label>
            <Select value={filterResolution} onValueChange={setFilterResolution}>
              <SelectTrigger>
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button onClick={loadConflicts} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Conflicts</CardTitle>
          <CardDescription>
            Resources from federated instances that may conflict with local resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredConflicts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No conflicts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource Name</TableHead>
                  <TableHead>Source Instance</TableHead>
                  <TableHead>Local Match</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConflicts.map(conflict => (
                  <TableRow key={conflict.id}>
                    <TableCell className="font-medium">{conflict.federatedResource.name}</TableCell>
                    <TableCell>{conflict.instanceName}</TableCell>
                    <TableCell>{conflict.localResource?.name || 'No match'}</TableCell>
                    <TableCell>
                      <Badge variant={conflict.matchScore > 0.95 ? 'destructive' : 'secondary'}>
                        {Math.round(conflict.matchScore * 100)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {conflict.isResolved ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedConflict(conflict)
                              setMergeDecisions({})
                            }}
                          >
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Resolve Conflict</DialogTitle>
                            <DialogDescription>
                              Compare and choose how to resolve this resource conflict
                            </DialogDescription>
                          </DialogHeader>

                          {selectedConflict && (
                            <div className="space-y-6">
                              {/* Quick Actions */}
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleResolve(selectedConflict, 'keep_local')}
                                  disabled={resolving}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                  Keep Local
                                </Button>
                                <Button
                                  onClick={() => handleResolve(selectedConflict, 'keep_remote')}
                                  disabled={resolving}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                  Keep Remote
                                </Button>
                                <Button
                                  onClick={() => handleResolve(selectedConflict, 'merge')}
                                  disabled={resolving}
                                  className="flex-1"
                                >
                                  {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />}
                                  Merge Selected
                                </Button>
                              </div>

                              {/* Field Comparisons */}
                              <div className="border rounded-lg p-4">
                                <h3 className="font-semibold mb-4">Field-by-Field Comparison</h3>

                                {renderFieldComparison(
                                  'name',
                                  'Name',
                                  selectedConflict.localResource?.name,
                                  selectedConflict.federatedResource.name
                                )}

                                {renderFieldComparison(
                                  'description',
                                  'Description',
                                  selectedConflict.localResource?.description,
                                  selectedConflict.federatedResource.description
                                )}

                                {renderFieldComparison(
                                  'category',
                                  'Category',
                                  selectedConflict.localResource?.category,
                                  selectedConflict.federatedResource.resource_type
                                )}

                                {renderFieldComparison(
                                  'address_line1',
                                  'Address',
                                  selectedConflict.localResource?.address_line1,
                                  selectedConflict.federatedResource.address_line1
                                )}

                                {renderFieldComparison(
                                  'city',
                                  'City',
                                  selectedConflict.localResource?.city,
                                  selectedConflict.federatedResource.city
                                )}

                                {renderFieldComparison(
                                  'phone',
                                  'Phone',
                                  selectedConflict.localResource?.phone,
                                  selectedConflict.federatedResource.phone
                                )}

                                {renderFieldComparison(
                                  'website',
                                  'Website',
                                  selectedConflict.localResource?.website,
                                  selectedConflict.federatedResource.website
                                )}
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
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
