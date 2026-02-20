'use client'

// apps/web/src/components/panels/map-panel.tsx
// Resource Map panel - shows resources on an interactive Mapbox map
// Three-column layout: Resource List | Interactive Map | Resource Details

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Search,
  Filter,
  MapPin,
  Phone,
  Globe,
  Clock,
  Navigation,
  Star,
  CheckCircle,
  X,
  List,
  Map as MapIcon,
  Loader2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MapView, ResourceMarker, ClusterMarker, type ViewState, type Resource } from '@/components/map'
import { useCluster } from '@/hooks/use-cluster'
import { useViewportResources } from '@/hooks/use-viewport-resources'
import { useGeolocation } from '@/hooks/use-geolocation'

// ============================================
// TYPES
// ============================================
interface MapResource extends Resource {
  zip_code?: string
  is_verified?: boolean
  distance?: string
  hours?: string
  rating?: number
  status?: 'open' | 'closed' | 'unknown'
}

// DEMO_RESOURCES removed - now using real Supabase data via useViewportResources

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  housing: 'bg-blue-100 text-blue-700',
  healthcare: 'bg-red-100 text-red-700',
  employment: 'bg-green-100 text-green-700',
  education: 'bg-purple-100 text-purple-700',
  legal: 'bg-yellow-100 text-yellow-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  housing: 'Housing',
  healthcare: 'Healthcare',
  employment: 'Employment',
  education: 'Education',
  legal: 'Legal',
}

// ============================================
// RESOURCE LIST ITEM
// ============================================
interface ResourceListItemProps {
  resource: MapResource
  isSelected: boolean
  onClick: () => void
}

function ResourceListItem({ resource, isSelected, onClick }: ResourceListItemProps) {
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 text-gray-700'
  const categoryLabel = CATEGORY_LABELS[resource.category] || resource.category

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-transparent hover:border-border hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm line-clamp-1">{resource.name}</h3>
            {resource.is_verified && (
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            )}
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColor}`}>
            {categoryLabel}
          </span>
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            resource.status === 'open'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {resource.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {resource.distance}
        </span>
        {resource.rating && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {resource.rating}
          </span>
        )}
      </div>
    </button>
  )
}

// ============================================
// RESOURCE DETAIL PANEL
// ============================================
interface ResourceDetailProps {
  resource: MapResource
  onClose: () => void
  onGetDirections: () => void
}

function ResourceDetail({ resource, onClose, onGetDirections }: ResourceDetailProps) {
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 text-gray-700'
  const categoryLabel = CATEGORY_LABELS[resource.category] || resource.category

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold">{resource.name}</h2>
            {resource.is_verified && (
              <CheckCircle className="w-4 h-4 text-primary" />
            )}
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
            {categoryLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
      )}

      {/* Details */}
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm">{resource.address_line1}</p>
            <p className="text-sm text-muted-foreground">
              {resource.city}, {resource.state} {resource.zip_code}
            </p>
          </div>
        </div>

        {resource.phone && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${resource.phone}`} className="text-sm hover:text-primary">
              {resource.phone}
            </a>
          </div>
        )}

        {resource.website && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <a href={resource.website} className="text-sm hover:text-primary" target="_blank" rel="noopener noreferrer">
              {resource.website.replace('https://', '')}
            </a>
          </div>
        )}

        {resource.hours && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm">{resource.hours}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 space-y-2">
        <Button className="w-full" size="sm" onClick={onGetDirections}>
          <Navigation className="w-4 h-4 mr-2" />
          Get Directions
        </Button>
        <Button
          variant="outline"
          className="w-full"
          size="sm"
          onClick={() => alert('Bookmarking coming soon!')}
        >
          Save Resource
        </Button>
      </div>
    </div>
  )
}

// ============================================
// MAIN MAP PANEL
// ============================================
export function MapPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResource, setSelectedResource] = useState<MapResource | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -118.2437, // Default: Los Angeles
    latitude: 34.0522,
    zoom: 11,
  })
  const [bounds, setBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null)
  const [hasAutocentered, setHasAutocentered] = useState(false)

  // Real geolocation
  const { position, getCurrentPosition } = useGeolocation()

  // Auto-center on user location once
  useEffect(() => {
    if (!hasAutocentered) {
      getCurrentPosition()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (position && !hasAutocentered) {
      setViewState({
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        zoom: 12,
      })
      setHasAutocentered(true)
    }
  }, [position, hasAutocentered])

  // Real Supabase resources query
  const { resources: realResources, loading: resourcesLoading } = useViewportResources({
    bounds,
    enabled: !!bounds,
  })

  // Map real resources to MapResource interface
  const mapResources: MapResource[] = useMemo(() => {
    return realResources.map((r) => ({
      ...r,
      hours: r.hours_of_operation
        ? Object.entries(r.hours_of_operation).map(([day, hours]) => `${day}: ${hours}`).join(', ')
        : undefined,
    }))
  }, [realResources])

  // Filter resources by search query and category
  const filteredResources = useMemo(() => {
    let filtered = mapResources
    if (selectedCategory) {
      filtered = filtered.filter((r) => r.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return filtered
  }, [searchQuery, selectedCategory, mapResources])

  // Use clustering for map markers
  const clusters = useCluster({
    resources: filteredResources,
    zoom: viewState.zoom,
    bounds: bounds ? [bounds.west, bounds.south, bounds.east, bounds.north] : null,
  })

  const handleViewStateChange = useCallback((newViewState: ViewState) => {
    setViewState(newViewState)
  }, [])

  const handleBoundsChange = useCallback(
    (newBounds: { west: number; south: number; east: number; north: number }) => {
      setBounds(newBounds)
    },
    []
  )

  const handleResourceSelect = useCallback((resource: MapResource) => {
    setSelectedResource(resource)
    // Pan to selected resource
    setViewState({
      longitude: resource.longitude,
      latitude: resource.latitude,
      zoom: 14,
    })
  }, [])

  const handleClusterClick = useCallback(
    (clusterId: number, longitude: number, latitude: number) => {
      setViewState({
        longitude,
        latitude,
        zoom: Math.min(viewState.zoom + 2, 18),
      })
    },
    [viewState.zoom]
  )

  const handleGetDirections = useCallback(() => {
    if (selectedResource) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedResource.latitude},${selectedResource.longitude}`
      window.open(url, '_blank')
    }
  }, [selectedResource])

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel: Resource List */}
      <div className="w-72 flex-shrink-0 flex flex-col">
        {/* Search Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Resources</h2>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('map')}
              >
                <MapIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9"
              />
            </div>
            <Button
              variant={showCategoryFilter ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
          {showCategoryFilter && (
            <div className="flex flex-wrap gap-1 mt-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  !selectedCategory ? 'bg-[#4a5d23] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    selectedCategory === key ? 'bg-[#4a5d23] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredResources.map((resource) => (
            <ResourceListItem
              key={resource.id}
              resource={resource}
              isSelected={selectedResource?.id === resource.id}
              onClick={() => handleResourceSelect(resource)}
            />
          ))}
          {resourcesLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
              <p className="text-xs">Loading resources...</p>
            </div>
          )}
          {!resourcesLoading && filteredResources.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No resources found</p>
              <p className="text-xs mt-1">Pan the map to search this area</p>
            </div>
          )}
        </div>
      </div>

      {/* Center: Interactive Map */}
      <div className="flex-1 rounded-xl overflow-hidden">
        <MapView
          initialViewState={viewState}
          onViewStateChange={handleViewStateChange}
          onBoundsChange={handleBoundsChange}
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
                onClick={() => handleResourceSelect(cluster.resource as MapResource)}
              />
            )
          )}
        </MapView>
      </div>

      {/* Right Panel: Resource Details (conditional) */}
      {selectedResource && (
        <div className="w-72 flex-shrink-0 bg-card/50 rounded-xl p-4">
          <ResourceDetail
            resource={selectedResource}
            onClose={() => setSelectedResource(null)}
            onGetDirections={handleGetDirections}
          />
        </div>
      )}
    </div>
  )
}
