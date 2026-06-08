'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Settings,
  Save,
  Check,
  Loader2,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react'

interface FederatedInstance {
  id: string
  instance_url: string
  instance_name: string
  status: string
}

interface FederationPeer {
  id: string
  local_instance_id: string
  remote_instance_id: string
  federation_enabled: boolean
  shared_resource_categories: string[] | null
  remote_instance?: FederatedInstance
}

const RESOURCE_CATEGORIES = [
  { value: 'food', label: 'Food' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'housing', label: 'Housing' },
  { value: 'financial', label: 'Financial' },
  { value: 'legal', label: 'Legal' },
  { value: 'employment', label: 'Employment' },
  { value: 'education', label: 'Education' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'senior_services', label: 'Senior Services' },
  { value: 'veterans', label: 'Veterans' },
  { value: 'other', label: 'Other' },
  { value: 'eitc_tax_filing', label: 'Tax Filing & EITC' },
  { value: 'free_legal', label: 'Free Legal Help' },
  { value: 'prenatal_natal_care', label: 'Prenatal & Newborn Care' },
  { value: 'waste_disposal', label: 'Waste & Disposal' },
  { value: 'free_camping', label: 'Free Camping' },
  { value: 'free_goods_donation', label: 'Free Goods & Donations' },
]

export default function SyncConfigPage() {
  const [peers, setPeers] = useState<FederationPeer[]>([])
  const [categorySelections, setCategorySelections] = useState<Map<string, string[]>>(new Map())
  const [originalSelections, setOriginalSelections] = useState<Map<string, string[]>>(new Map())
  const [hasChanges, setHasChanges] = useState<Map<string, boolean>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [savingPeerId, setSavingPeerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadPeers()
  }, [])

  async function loadPeers() {
    setIsLoading(true)
    setError(null)

    try {
      // Get all federation peers with remote instance details
      const { data: peerData, error: peersError } = await supabase
        .from('federation_peers')
        .select(`
          id,
          local_instance_id,
          remote_instance_id,
          federation_enabled,
          shared_resource_categories,
          remote_instance:federated_instances!federation_peers_remote_instance_id_fkey(
            id,
            instance_name,
            instance_url,
            status
          )
        `)
        .eq('federation_enabled', true)

      if (peersError) throw peersError

      const loadedPeers = peerData || []
      setPeers(loadedPeers)

      // Initialize category selections from existing data
      const selections = new Map<string, string[]>()
      const original = new Map<string, string[]>()
      const changes = new Map<string, boolean>()

      loadedPeers.forEach((peer) => {
        // Get categories from shared_resource_categories
        const categories: string[] = peer.shared_resource_categories || []

        selections.set(peer.id, categories)
        original.set(peer.id, [...categories])
        changes.set(peer.id, false)
      })

      setCategorySelections(selections)
      setOriginalSelections(original)
      setHasChanges(changes)
    } catch (err) {
      console.error('Failed to load federation peers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load federation peers')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCategory = useCallback((peerId: string, category: string) => {
    setCategorySelections((prev) => {
      const newSelections = new Map(prev)
      const currentCategories = newSelections.get(peerId) || []

      if (currentCategories.includes(category)) {
        newSelections.set(
          peerId,
          currentCategories.filter((c) => c !== category)
        )
      } else {
        newSelections.set(peerId, [...currentCategories, category])
      }

      // Check if there are changes
      const original = originalSelections.get(peerId) || []
      const updated = newSelections.get(peerId) || []
      const changed = JSON.stringify([...original].sort()) !== JSON.stringify([...updated].sort())

      setHasChanges((prevChanges) => {
        const newChanges = new Map(prevChanges)
        newChanges.set(peerId, changed)
        return newChanges
      })

      return newSelections
    })
  }, [originalSelections])

  const selectAllCategories = useCallback((peerId: string) => {
    setCategorySelections((prev) => {
      const newSelections = new Map(prev)
      const allCategories = RESOURCE_CATEGORIES.map((cat) => cat.value)
      newSelections.set(peerId, allCategories)

      // Check if there are changes
      const original = originalSelections.get(peerId) || []
      const changed = JSON.stringify([...original].sort()) !== JSON.stringify([...allCategories].sort())

      setHasChanges((prevChanges) => {
        const newChanges = new Map(prevChanges)
        newChanges.set(peerId, changed)
        return newChanges
      })

      return newSelections
    })
  }, [originalSelections])

  const deselectAllCategories = useCallback((peerId: string) => {
    setCategorySelections((prev) => {
      const newSelections = new Map(prev)
      newSelections.set(peerId, [])

      // Check if there are changes
      const original = originalSelections.get(peerId) || []
      const changed = original.length > 0

      setHasChanges((prevChanges) => {
        const newChanges = new Map(prevChanges)
        newChanges.set(peerId, changed)
        return newChanges
      })

      return newSelections
    })
  }, [originalSelections])

  async function saveConfiguration(peerId: string) {
    setSavingPeerId(peerId)
    setError(null)
    setSuccessMessage(null)

    try {
      const selectedCategories = categorySelections.get(peerId) || []
      const peer = peers.find((p) => p.id === peerId)

      if (!peer) {
        throw new Error('Peer not found')
      }

      // Update shared_resource_categories
      const { error: updateError } = await supabase
        .from('federation_peers')
        .update({
          shared_resource_categories: selectedCategories
        })
        .eq('id', peerId)

      if (updateError) throw updateError

      // Update original selections to mark as saved
      setOriginalSelections((prev) => {
        const newOriginal = new Map(prev)
        newOriginal.set(peerId, [...selectedCategories])
        return newOriginal
      })

      // Clear has changes flag
      setHasChanges((prev) => {
        const newChanges = new Map(prev)
        newChanges.set(peerId, false)
        return newChanges
      })

      setSuccessMessage(
        `Configuration saved for ${peer.remote_instance?.instance_name || 'peer'}`
      )

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (err) {
      console.error('Failed to save configuration:', err)
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setSavingPeerId(null)
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading sync configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Sync Category Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose which resource types to sync from each federation partner
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {peers.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Active Federation Partners</p>
              <p className="text-sm">
                Add federation partners to configure sync categories
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {peers.map((peer) => {
            const selectedCategories = categorySelections.get(peer.id) || []
            const peerHasChanges = hasChanges.get(peer.id) || false
            const isSaving = savingPeerId === peer.id

            return (
              <Card key={peer.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Globe className="h-5 w-5" />
                        {peer.remote_instance?.instance_name || 'Unknown Instance'}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        {peer.remote_instance?.instance_url}
                        <span className="mx-1">|</span>
                        <span className="flex items-center gap-1">
                          Status: {getStatusIcon(peer.remote_instance?.status || 'unknown')}
                          <span className="capitalize">
                            {peer.remote_instance?.status || 'unknown'}
                          </span>
                        </span>
                      </CardDescription>
                    </div>
                    {peerHasChanges && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Unsaved Changes
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Bulk Actions */}
                    <div className="flex gap-3 pb-4 border-b">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => selectAllCategories(peer.id)}
                        disabled={isSaving}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => deselectAllCategories(peer.id)}
                        disabled={isSaving}
                      >
                        Deselect All
                      </Button>
                      <div className="flex-1" />
                      <Badge variant="secondary">
                        {selectedCategories.length} of {RESOURCE_CATEGORIES.length} selected
                      </Badge>
                    </div>

                    {/* Category Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {RESOURCE_CATEGORIES.map((category) => {
                        const isChecked = selectedCategories.includes(category.value)
                        return (
                          <div
                            key={category.value}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`${peer.id}-${category.value}`}
                              checked={isChecked}
                              onCheckedChange={() => toggleCategory(peer.id, category.value)}
                              disabled={isSaving}
                            />
                            <Label
                              htmlFor={`${peer.id}-${category.value}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {category.label}
                            </Label>
                          </div>
                        )
                      })}
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={() => saveConfiguration(peer.id)}
                        disabled={!peerHasChanges || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-6 flex justify-center">
        <Button
          variant="outline"
          onClick={loadPeers}
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Partners
        </Button>
      </div>
    </div>
  )
}
