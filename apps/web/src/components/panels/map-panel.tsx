'use client'

// apps/web/src/components/panels/map-panel.tsx
// Resource Map panel - shows resources on an interactive Mapbox map
// Three-column layout: Resource List | Interactive Map | Resource Details

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
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
  MessageCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MapView, ResourceMarker, ClusterMarker, type ViewState, type Resource } from '@/components/map'
import { VolunteerMarker } from '@/components/map/volunteer-marker'
import { VolunteerResourceDetail } from '@/components/map/volunteer-resource-detail'
import { useCluster } from '@/hooks/use-cluster'
import { useViewportResources } from '@/hooks/use-viewport-resources'
import { useGeolocation, calculateDistance } from '@/hooks/use-geolocation'
import { useAuth } from '@/hooks/use-auth'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useSavedResources } from '@/hooks/use-saved-resources'
import { VolunteerResourceFAB } from '@/components/volunteer/volunteer-resource-fab'
import { logger } from '@/lib/logger'

// ============================================
// GEOCODE CACHE (localStorage + in-memory, keyed by "city, state")
// ============================================
const GEOCODE_CACHE_KEY = 'feed:geocode-cache'
const GEOCODE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const GEOCODE_TIMEOUT_MS = 5_000

interface GeocodeEntry {
  lng: number
  lat: number
  ts: number
}

function readGeocodeCache(): Record<string, GeocodeEntry> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, GeocodeEntry>) : {}
  } catch {
    return {}
  }
}

function writeGeocodeCache(key: string, value: GeocodeEntry): void {
  try {
    const cache = readGeocodeCache()
    // Evict stale entries
    const now = Date.now()
    const fresh = Object.fromEntries(
      Object.entries(cache).filter(([, v]) => now - v.ts < GEOCODE_CACHE_TTL_MS)
    )
    fresh[key] = value
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(fresh))
  } catch {
    // localStorage quota or SSR — ignore
  }
}

// Module-level in-memory cache so the same city isn't geocoded twice in one session
const memGeocodeCache = new Map<string, GeocodeEntry>()

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

// Format a kilometer distance into a human-readable imperial string.
function formatDistance(km: number): string {
  const mi = km * 0.621371
  return mi < 0.1 ? `${Math.round((mi * 5280) / 10) * 10} ft` : `${mi.toFixed(1)} mi`
}

// DEMO_RESOURCES removed - now using real Supabase data via useViewportResources

const CATEGORY_COLORS: Record<string, string> = {
  food: 'bg-orange-100 text-orange-700',
  housing: 'bg-blue-100 text-blue-700',
  healthcare: 'bg-red-100 text-red-700',
  employment: 'bg-green-100 text-green-700',
  education: 'bg-purple-100 text-purple-700',
  legal: 'bg-yellow-100 text-yellow-700',
  eitc_tax_filing: 'bg-sky-100 text-sky-700',
  free_legal: 'bg-indigo-100 text-indigo-700',
  prenatal_natal_care: 'bg-pink-100 text-pink-700',
  waste_disposal: 'bg-lime-100 text-lime-700',
  free_camping: 'bg-green-100 text-green-800',
  free_goods_donation: 'bg-rose-100 text-rose-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  housing: 'Housing',
  healthcare: 'Healthcare',
  employment: 'Employment',
  education: 'Education',
  legal: 'Legal',
  eitc_tax_filing: 'Tax Filing & EITC',
  free_legal: 'Free Legal Help',
  prenatal_natal_care: 'Prenatal & Newborn Care',
  waste_disposal: 'Waste & Disposal',
  free_camping: 'Free Camping',
  free_goods_donation: 'Free Goods & Donations',
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
            <h3 className="font-medium text-sm line-clamp-1 text-stone-900">{resource.name}</h3>
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

      <div className="flex items-center gap-3 text-xs text-stone-600">
        {(() => {
          const addr = [resource.address_line1, resource.city, resource.state].filter(Boolean).join(', ')
          if (!addr && !resource.distance) return null
          return (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {addr}
                {addr && resource.distance ? ' · ' : ''}
                {resource.distance ?? ''}
              </span>
            </span>
          )
        })()}
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
  onGetHelp: (resourceName: string) => void
  onSaveResource?: (resource: MapResource) => void
  isSaved?: boolean
}

function ResourceDetail({ resource, onClose, onGetDirections, onGetHelp, onSaveResource, isSaved }: ResourceDetailProps) {
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
        <p className="text-sm text-stone-600 mb-4">{resource.description}</p>
      )}

      {/* Details */}
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <MapPin className="w-4 h-4 text-stone-600 mt-0.5" />
          <div>
            <p className="text-sm text-stone-800">{resource.address_line1}</p>
            <p className="text-sm text-stone-600">
              {resource.city}, {resource.state} {resource.zip_code}
            </p>
          </div>
        </div>

        {resource.phone && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Phone className="w-4 h-4 text-stone-600" />
            <a href={`tel:${resource.phone}`} className="text-sm text-stone-800 hover:text-primary">
              {resource.phone}
            </a>
          </div>
        )}

        {resource.website && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Globe className="w-4 h-4 text-stone-600" />
            <a href={resource.website} className="text-sm text-stone-800 hover:text-primary" target="_blank" rel="noopener noreferrer">
              {resource.website.replace('https://', '')}
            </a>
          </div>
        )}

        {resource.hours && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 text-stone-600" />
            <p className="text-sm text-stone-800">{resource.hours}</p>
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
          className="w-full bg-[#4a5d23] hover:bg-[#3a4a1a] text-white"
          size="sm"
          onClick={() => onGetHelp(resource.name)}
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Get Help
        </Button>
        <Button
          variant="outline"
          className={`w-full ${isSaved ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}`}
          size="sm"
          onClick={() => onSaveResource?.(resource)}
          disabled={isSaved}
        >
          {isSaved ? 'Saved' : 'Save Resource'}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// MAIN MAP PANEL
// ============================================
interface MapPanelProps {
  onNavigateToChat?: (resourceContext?: string) => void
}

export function MapPanel({ onNavigateToChat }: MapPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResource, setSelectedResource] = useState<MapResource | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -98.5795, // Default: US center
    latitude: 39.8283,
    zoom: 4,
  })
  const [bounds, setBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null)
  // userHasMovedMap: set true ONLY when the user manually pans/zooms the map.
  // Profile-based auto-centering (Priority 1a/1b) is allowed until this is true.
  // Browser geolocation (Priority 2) uses a separate hasGeocentered flag so it
  // never pre-empts the profile center.
  const [userHasMovedMap, setUserHasMovedMap] = useState(false)
  const [hasGeocentered, setHasGeocentered] = useState(false)

  // Shell panel navigation
  const { setActivePanel } = usePanelContext()

  // Saved resources
  const { saveResource, isResourceSavedByName } = useSavedResources()

  // Auth profile for location-based centering
  const { profile, loading: authLoading } = useAuth()

  // Real geolocation
  const { position, getCurrentPosition } = useGeolocation()

  // Origin point for distance estimates: live GPS if available, else profile.
  // Deps use the exact property paths the React Compiler infers (non-optional)
  // so the compiler can preserve this memo without bailing out on the component.
  const userOrigin = useMemo<[number, number] | null>(() => {
    if (position?.coords) return [position.coords.longitude, position.coords.latitude]
    if (
      profile?.latitude != null &&
      profile?.longitude != null &&
      (profile.latitude !== 0 || profile.longitude !== 0)
    ) {
      return [profile.longitude, profile.latitude]
    }
    return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.coords?.longitude, position?.coords?.latitude, profile?.latitude, profile?.longitude])

  // Priority 1a: Use stored lat/lng from profile (instant, no network call).
  // Fires whenever profile lat/lng become available; respects manual pans only.
  // setState in effect is correct here: syncing Mapbox viewState from an external
  // data source (Supabase profile) that arrives asynchronously after first render.
  useEffect(() => {
    if (userHasMovedMap) return
    if (!profile?.latitude || !profile?.longitude) return

    setViewState((prev) => ({
      ...prev,
      longitude: profile.longitude!,
      latitude: profile.latitude!,
      zoom: 11,
    }))
    // Profile center applied — block further auto-centering by marking map as "moved"
    // so browser-geo and the geocode fallback don't override it.
    setUserHasMovedMap(true)
  }, [profile?.latitude, profile?.longitude, userHasMovedMap])

  // Priority 1b: Geocode profile city/state via Mapbox — async, non-blocking, cached.
  // Only runs when profile has no stored lat/lng and user hasn't manually panned.
  // setState in effect is correct here: syncing Mapbox viewState from an external
  // geocoding service (Mapbox API + localStorage cache) whose result is unavailable
  // at render time.
  const geocodeAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (userHasMovedMap) return
    if (!profile?.location_city || !profile?.location_state) return
    if (profile?.latitude && profile?.longitude) return // lat/lng stored — Priority 1a handles it

    const city = `${profile.location_city}, ${profile.location_state}`
    const t0 = Date.now()

    // 1. In-memory cache hit — instant, no network
    const memHit = memGeocodeCache.get(city)
    if (memHit) {
      logger.info('map.geocode', { city, ms: 0, cached: 'memory' })
      setViewState((prev) => ({ ...prev, longitude: memHit.lng, latitude: memHit.lat, zoom: 11 }))
      setUserHasMovedMap(true)
      return
    }

    // 2. localStorage cache hit — instant, no network
    const diskCache = readGeocodeCache()
    const diskHit = diskCache[city]
    if (diskHit && Date.now() - diskHit.ts < GEOCODE_CACHE_TTL_MS) {
      memGeocodeCache.set(city, diskHit)
      logger.info('map.geocode', { city, ms: 0, cached: 'localStorage' })
      setViewState((prev) => ({ ...prev, longitude: diskHit.lng, latitude: diskHit.lat, zoom: 11 }))
      setUserHasMovedMap(true)
      return
    }

    // 3. Network call — async, 5s timeout, does NOT block map render
    geocodeAbortRef.current?.abort()
    const controller = new AbortController()
    geocodeAbortRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    const query = encodeURIComponent(city)
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timeoutId)
        if (data.features?.[0]?.center) {
          const [lng, lat] = data.features[0].center as [number, number]
          const ms = Date.now() - t0
          const entry: GeocodeEntry = { lng, lat, ts: Date.now() }
          memGeocodeCache.set(city, entry)
          writeGeocodeCache(city, entry)
          logger.info('map.geocode', { city, ms, cached: false })
          setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: 11 }))
          setUserHasMovedMap(true)
        }
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId)
        if (err instanceof DOMException && err.name === 'AbortError') return // timeout or unmount — expected
        logger.info('map.geocode', { city, ms: Date.now() - t0, cached: false, error: String(err) })
        // Fall through — browser geolocation (Priority 2) takes over
      })

    return () => {
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [profile?.location_city, profile?.location_state, profile?.latitude, profile?.longitude, userHasMovedMap])

  // Priority 2: Browser geolocation — fallback only when profile has no location.
  // Kicks off the GPS request once on mount.
  useEffect(() => {
    getCurrentPosition()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply browser-geo position only when profile provided no center (userHasMovedMap
  // is still false) and we haven't already applied it.
  // setState in effect is correct here: syncing Mapbox viewState from the Geolocation
  // API, an external platform API that delivers position asynchronously via a callback.
  useEffect(() => {
    if (userHasMovedMap) return
    if (hasGeocentered) return
    if (!position) return

    setViewState({
      longitude: position.coords.longitude,
      latitude: position.coords.latitude,
      zoom: 12,
    })
    setHasGeocentered(true)
    // Do NOT set userHasMovedMap here — profile center (Priority 1a/1b) may still
    // arrive after GPS and should override browser-geo for the initial center.
  }, [position, userHasMovedMap, hasGeocentered])

  // Real Supabase resources query
  const { resources: realResources, loading: resourcesLoading } = useViewportResources({
    bounds,
    enabled: !!bounds && !authLoading,
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

  // Sort filtered resources by proximity to current map center
  const sortedResources = useMemo(() => {
    return [...filteredResources]
      .sort((a, b) => {
        const distA = Math.hypot(a.latitude - viewState.latitude, a.longitude - viewState.longitude)
        const distB = Math.hypot(b.latitude - viewState.latitude, b.longitude - viewState.longitude)
        return distA - distB
      })
      .map((r) => ({
        ...r,
        distance: userOrigin
          ? formatDistance(calculateDistance(userOrigin[1], userOrigin[0], r.latitude, r.longitude))
          : undefined,
      }))
  }, [filteredResources, viewState.latitude, viewState.longitude, userOrigin])

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

  const handleGetHelp = useCallback(
    (resourceName: string) => {
      onNavigateToChat?.(resourceName)
    },
    [onNavigateToChat]
  )

  const handleMessage = useCallback(() => {
    setActivePanel('messages')
  }, [setActivePanel])

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel: Resource List */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
        {/* Search Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Resources</h2>
            <div
              role="tablist"
              aria-label="Map or list view"
              className="flex gap-1"
            >
              <Button
                role="tab"
                aria-selected={viewMode === 'map'}
                aria-controls="map-view-panel"
                id="map-tab-map"
                tabIndex={viewMode === 'map' ? 0 : -1}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${viewMode === 'map' ? 'bg-[#4a5d23] text-white hover:bg-[#3a4a1a]' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
                onClick={() => setViewMode('map')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setViewMode(viewMode === 'map' ? 'list' : 'map')
                  }
                }}
              >
                <MapIcon className="w-4 h-4" />
                <span className="sr-only">Map view</span>
              </Button>
              <Button
                role="tab"
                aria-selected={viewMode === 'list'}
                aria-controls="map-view-panel"
                id="map-tab-list"
                tabIndex={viewMode === 'list' ? 0 : -1}
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${viewMode === 'list' ? 'bg-[#4a5d23] text-white hover:bg-[#3a4a1a]' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
                onClick={() => setViewMode('list')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setViewMode(viewMode === 'map' ? 'list' : 'map')
                  }
                }}
              >
                <List className="w-4 h-4" />
                <span className="sr-only">List view</span>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
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
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  !selectedCategory ? 'bg-[#4a5d23] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
        <div className="flex-1 relative overflow-hidden">
          <div className="h-full overflow-y-auto space-y-1 pb-8">
            {sortedResources.map((resource) => (
              <ResourceListItem
                key={resource.id}
                resource={resource}
                isSelected={selectedResource?.id === resource.id}
                onClick={() => handleResourceSelect(resource)}
              />
            ))}
            {resourcesLoading && (
              <div className="text-center py-8 text-stone-600">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                <p className="text-xs">Loading resources...</p>
              </div>
            )}
            {!resourcesLoading && sortedResources.length === 0 && (
              <div className="text-center py-8 text-stone-600">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No resources found</p>
                <p className="text-xs mt-1">Pan the map to search this area</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#faf9f6] to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Center: Interactive Map */}
      <div id="map-view-panel" role="tabpanel" aria-labelledby={`map-tab-${viewMode}`} className="relative flex-1 min-w-0 rounded-xl overflow-hidden">
        <MapView
          initialViewState={viewState}
          onViewStateChange={handleViewStateChange}
          onBoundsChange={handleBoundsChange}
          onUserInteraction={() => setUserHasMovedMap(true)}
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
            ) : cluster.resource?.is_volunteer_resource ? (
              <VolunteerMarker
                key={cluster.id}
                resource={cluster.resource}
                onClick={() => handleResourceSelect(cluster.resource as MapResource)}
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
        <VolunteerResourceFAB />
      </div>

      {/* Right Panel: Resource Details (conditional) */}
      {selectedResource && (
        <div className="w-64 flex-shrink-0 bg-card/50 rounded-xl p-4 overflow-y-auto">
          {selectedResource.is_volunteer_resource ? (
            <VolunteerResourceDetail
              resource={selectedResource}
              onClose={() => setSelectedResource(null)}
              onNavigateToMessages={handleMessage}
            />
          ) : (
            <ResourceDetail
              resource={selectedResource}
              onClose={() => setSelectedResource(null)}
              onGetDirections={handleGetDirections}
              onGetHelp={handleGetHelp}
              onSaveResource={(r) =>
                saveResource({
                  resource_name: r.name,
                  resource_category: r.category || null,
                  resource_address:
                    [r.address_line1, r.city, r.state].filter(Boolean).join(', ') || null,
                  resource_phone: r.phone || null,
                  resource_website: r.website || null,
                })
              }
              isSaved={isResourceSavedByName(selectedResource.name)}
            />
          )}
        </div>
      )}
    </div>
  )
}
