'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { createClient } from '@supabase/supabase-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Globe, Search, MapPin, Package, Shield, ExternalLink, Mail } from 'lucide-react'
import { US_STATES } from '@/lib/us-states'

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

interface FederatedInstance {
  id: string
  instance_name: string
  instance_url: string
  status: string
  trust_level: string
  metadata: {
    city?: string
    state?: string
    resource_count?: number
    resource_types?: string[]
    admin_email?: string
  }
}

export default function FederationDirectoryPage() {
  const router = useRouter()
  const isAdmin = useIsAdmin()
  const [instances, setInstances] = useState<FederatedInstance[]>([])
  const [filteredInstances, setFilteredInstances] = useState<FederatedInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [adminChecked, setAdminChecked] = useState(false)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    // Allow a tick for useIsAdmin to resolve; if still false after settle, redirect
    const timer = setTimeout(() => {
      setAdminChecked(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (adminChecked && !isAdmin) {
      router.replace('/')
    }
  }, [adminChecked, isAdmin, router])

  useEffect(() => {
    if (isAdmin) {
      loadInstances()
    }
  }, [isAdmin])

  useEffect(() => {
    filterInstances()
  }, [instances, search, stateFilter, categoryFilter])

  async function loadInstances() {
    setIsLoading(true)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('federated_instances')
        .select('*')
        .eq('status', 'active')
        .order('instance_name')

      if (error) throw error

      setInstances(data || [])
    } catch (error) {
      console.error('Error loading instances:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function filterInstances() {
    let filtered = [...instances]

    // Text search
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(
        (instance) =>
          instance.instance_name.toLowerCase().includes(searchLower) ||
          instance.instance_url.toLowerCase().includes(searchLower) ||
          instance.metadata?.city?.toLowerCase().includes(searchLower)
      )
    }

    // State filter
    if (stateFilter) {
      filtered = filtered.filter(
        (instance) => instance.metadata?.state === stateFilter
      )
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(
        (instance) =>
          instance.metadata?.resource_types?.includes(categoryFilter)
      )
    }

    setFilteredInstances(filtered)
  }

  function getTrustBadge(trustLevel: string) {
    const config = {
      verified: { label: 'Verified', className: 'bg-green-100 text-green-800' },
      trusted: { label: 'Trusted', className: 'bg-blue-100 text-blue-800' },
      monitoring: { label: 'Monitoring', className: 'bg-yellow-100 text-yellow-800' },
      untrusted: { label: 'Untrusted', className: 'bg-gray-100 text-gray-800' },
    }[trustLevel] || { label: 'Unknown', className: 'bg-gray-100 text-gray-800' }

    return (
      <Badge className={config.className} variant="outline">
        <Shield className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  function getCategoryLabels(resourceTypes?: string[]) {
    if (!resourceTypes || resourceTypes.length === 0) return 'No categories'

    return resourceTypes
      .slice(0, 3)
      .map(type => RESOURCE_CATEGORIES.find(cat => cat.value === type)?.label || type)
      .join(', ') + (resourceTypes.length > 3 ? ` +${resourceTypes.length - 3} more` : '')
  }

  function handleRequestFederation(instance: FederatedInstance) {
    const adminEmail = instance.metadata?.admin_email || `admin@${instance.instance_url.replace(/^https?:\/\//, '')}`
    const subject = encodeURIComponent(`Federation Request from FEED`)
    const body = encodeURIComponent(
      `Hello ${instance.instance_name} team,\n\n` +
      `We would like to request federation with your instance to share mutual aid resources and strengthen our network.\n\n` +
      `Our instance: ${window.location.origin}\n` +
      `Your instance: ${instance.instance_url}\n\n` +
      `Please let us know the next steps to establish a trusted federation partnership.\n\n` +
      `Best regards`
    )

    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`
  }

  if (!adminChecked || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-6 flex items-center justify-center">
        <div className="text-stone-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            FEED Federation Directory
          </h1>
          <p className="text-lg text-gray-600">
            Discover mutual aid networks in your region
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search instances..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* State Filter */}
              <Select
                value={stateFilter || 'all'}
                onValueChange={(value) => setStateFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select
                value={categoryFilter || 'all'}
                onValueChange={(value) => setCategoryFilter(value === 'all' ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {RESOURCE_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        <p className="mb-4 text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${filteredInstances.length} instance${filteredInstances.length !== 1 ? 's' : ''} found`}
        </p>

        {/* Instance List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                Loading instances...
              </CardContent>
            </Card>
          ) : filteredInstances.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No instances found matching your filters
              </CardContent>
            </Card>
          ) : (
            filteredInstances.map((instance) => (
              <Card key={instance.id} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Globe className="h-5 w-5 text-blue-600" />
                        {instance.instance_name}
                      </CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <a
                          href={instance.instance_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          {instance.instance_url.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {(instance.metadata?.city || instance.metadata?.state) && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {[instance.metadata.city, instance.metadata.state]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div>{getTrustBadge(instance.trust_level)}</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Resource count */}
                    {instance.metadata?.resource_count !== undefined && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">
                          {instance.metadata.resource_count.toLocaleString()} resources
                        </span>
                      </div>
                    )}

                    {/* Categories */}
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Categories: </span>
                      {getCategoryLabels(instance.metadata?.resource_types)}
                    </div>

                    {/* Action button */}
                    <Button
                      onClick={() => handleRequestFederation(instance)}
                      className="w-full sm:w-auto"
                      variant="outline"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Request Federation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
