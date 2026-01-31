'use client'

import { useState, useCallback, useMemo } from 'react'
import { Plus, List, Map as MapIcon } from 'lucide-react'
import { MapView, ResourceMarker, ClusterMarker, ResourceSearch, type ViewState, type Resource } from '@/components/map'
import { useCluster } from '@/hooks/use-cluster'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface ResourcesContentProps {
  initialResources: Resource[]
}

export function ResourcesContent({ initialResources }: ResourcesContentProps) {
  const [resources] = useState<Resource[]>(initialResources)
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -98.5795,
    latitude: 39.8283,
    zoom: 4,
  })
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

  // Filter resources by category and search
  const filteredResources = useMemo(() => {
    let filtered = resources

    if (selectedCategory) {
      filtered = filtered.filter((r) => r.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.city?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [resources, selectedCategory, searchQuery])

  // Use clustering for map markers
  const clusters = useCluster({
    resources: filteredResources,
    zoom: viewState.zoom,
    bounds,
  })

  const handleViewStateChange = useCallback((newViewState: ViewState) => {
    setViewState(newViewState)
  }, [])

  const handleMapLoad = useCallback(() => {
    // Calculate initial bounds
    // This would be better with a ref to the map
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category)
  }, [])

  const handleLocationSearch = useCallback(
    (location: { lat: number; lng: number; name: string }) => {
      setViewState({
        latitude: location.lat,
        longitude: location.lng,
        zoom: 12,
      })
    },
    []
  )

  const handleClusterClick = useCallback(
    (clusterId: number, longitude: number, latitude: number) => {
      // Zoom in on cluster
      setViewState({
        longitude,
        latitude,
        zoom: Math.min(viewState.zoom + 2, 18),
      })
    },
    [viewState.zoom]
  )

  // Update bounds when map moves - now receives actual bounds from MapView
  const handleBoundsChange = useCallback(
    (newBounds: { west: number; south: number; east: number; north: number }) => {
      setBounds([newBounds.west, newBounds.south, newBounds.east, newBounds.north])
    },
    []
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resources</h1>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className="rounded-none"
            >
              <MapIcon className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
          <Button asChild>
            <Link href="/resources/submit">
              <Plus className="h-4 w-4 mr-1" />
              Add Resource
            </Link>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
        {viewMode === 'map' ? (
          <>
            {/* Search overlay */}
            <div className="absolute top-4 left-4 z-10 w-80">
              <ResourceSearch
                onSearch={handleSearch}
                onCategoryChange={handleCategoryChange}
                onLocationSearch={handleLocationSearch}
              />
            </div>

            {/* Resource count */}
            <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium shadow-md">
              {filteredResources.length} resources
            </div>

            {/* Map */}
            <MapView
              initialViewState={viewState}
              onViewStateChange={handleViewStateChange}
              onBoundsChange={handleBoundsChange}
              onMapLoad={handleMapLoad}
              className="h-full"
            >
              {clusters.map((cluster) =>
                cluster.isCluster ? (
                  <ClusterMarker
                    key={cluster.id}
                    longitude={cluster.longitude}
                    latitude={cluster.latitude}
                    pointCount={cluster.pointCount!}
                    onClick={() =>
                      handleClusterClick(
                        cluster.clusterId!,
                        cluster.longitude,
                        cluster.latitude
                      )
                    }
                  />
                ) : (
                  <ResourceMarker
                    key={cluster.id}
                    resource={cluster.resource!}
                  />
                )
              )}
            </MapView>
          </>
        ) : (
          /* List view */
          <div className="p-4 overflow-auto h-full">
            <ResourceSearch
              onSearch={handleSearch}
              onCategoryChange={handleCategoryChange}
              onLocationSearch={handleLocationSearch}
              className="mb-4"
            />

            {filteredResources.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No resources found
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredResources.map((resource) => (
                  <ResourceListCard key={resource.id} resource={resource} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ResourceListCard({ resource }: { resource: Resource }) {
  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="text-xs font-medium text-primary mb-1">
          {formatCategory(resource.category)}
        </div>
        <CardTitle className="text-base">{resource.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {resource.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {resource.description}
          </p>
        )}
        {resource.address_line1 && (
          <p className="text-sm">
            {resource.address_line1}
            {resource.city && `, ${resource.city}`}
            {resource.state && `, ${resource.state}`}
          </p>
        )}
        {resource.phone && (
          <p className="text-sm mt-1">
            <a href={`tel:${resource.phone}`} className="text-primary hover:underline">
              {resource.phone}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
