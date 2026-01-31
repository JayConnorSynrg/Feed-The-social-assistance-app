'use client'

// apps/web/src/components/panels/map-panel.tsx
// Resource Map panel - shows resources on a map with list and detail view
// Three-column layout: Resource List | Map | Resource Details

import React, { useState } from 'react'
import {
  Search,
  Filter,
  MapPin,
  Phone,
  Globe,
  Clock,
  ChevronRight,
  Navigation,
  Star,
  CheckCircle,
  X,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ============================================
// TYPES
// ============================================
interface Resource {
  id: string
  name: string
  category: string
  address: string
  city: string
  distance?: string
  phone?: string
  website?: string
  hours?: string
  isVerified?: boolean
  rating?: number
  status?: 'open' | 'closed' | 'unknown'
}

// ============================================
// MOCK DATA
// ============================================
const MOCK_RESOURCES: Resource[] = [
  {
    id: '1',
    name: 'LA Regional Food Bank',
    category: 'Food',
    address: '1734 E 41st Street',
    city: 'Los Angeles',
    distance: '2.3 mi',
    phone: '(323) 234-3030',
    website: 'lafoodbank.org',
    hours: 'Mon-Fri: 8AM-5PM',
    isVerified: true,
    rating: 4.8,
    status: 'open',
  },
  {
    id: '2',
    name: 'PATH Housing Services',
    category: 'Housing',
    address: '340 N Madison Ave',
    city: 'Los Angeles',
    distance: '3.1 mi',
    phone: '(323) 644-2200',
    hours: '24/7 Emergency',
    isVerified: true,
    rating: 4.5,
    status: 'open',
  },
  {
    id: '3',
    name: 'Community Health Center',
    category: 'Healthcare',
    address: '1500 S Central Ave',
    city: 'Los Angeles',
    distance: '4.2 mi',
    phone: '(213) 555-0123',
    hours: 'Mon-Sat: 9AM-6PM',
    isVerified: true,
    rating: 4.3,
    status: 'closed',
  },
  {
    id: '4',
    name: 'WorkSource Career Center',
    category: 'Employment',
    address: '4060 Whittier Blvd',
    city: 'Los Angeles',
    distance: '5.8 mi',
    phone: '(323) 887-7000',
    hours: 'Mon-Fri: 8AM-5PM',
    isVerified: false,
    rating: 4.1,
    status: 'open',
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  Food: 'bg-orange-100 text-orange-700',
  Housing: 'bg-blue-100 text-blue-700',
  Healthcare: 'bg-red-100 text-red-700',
  Employment: 'bg-green-100 text-green-700',
  Education: 'bg-purple-100 text-purple-700',
  Legal: 'bg-yellow-100 text-yellow-700',
}

// ============================================
// RESOURCE LIST ITEM
// ============================================
interface ResourceListItemProps {
  resource: Resource
  isSelected: boolean
  onClick: () => void
}

function ResourceListItem({ resource, isSelected, onClick }: ResourceListItemProps) {
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 text-gray-700'

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
            {resource.isVerified && (
              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            )}
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryColor}`}>
            {resource.category}
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
  resource: Resource
  onClose: () => void
}

function ResourceDetail({ resource, onClose }: ResourceDetailProps) {
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 text-gray-700'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-semibold">{resource.name}</h2>
            {resource.isVerified && (
              <CheckCircle className="w-4 h-4 text-primary" />
            )}
          </div>
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
            {resource.category}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Details */}
      <div className="space-y-3 flex-1">
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm">{resource.address}</p>
            <p className="text-sm text-muted-foreground">{resource.city}</p>
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
            <a href={`https://${resource.website}`} className="text-sm hover:text-primary" target="_blank">
              {resource.website}
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
        <Button className="w-full" size="sm">
          <Navigation className="w-4 h-4 mr-2" />
          Get Directions
        </Button>
        <Button variant="outline" className="w-full" size="sm">
          Save Resource
        </Button>
      </div>
    </div>
  )
}

// ============================================
// MAP PLACEHOLDER
// ============================================
function MapPlaceholder({ resources }: { resources: Resource[] }) {
  return (
    <div className="h-full bg-muted/30 rounded-xl relative overflow-hidden">
      {/* Fake map background */}
      <div className="absolute inset-0 opacity-50">
        <div className="w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Map markers */}
      {resources.map((resource, idx) => (
        <div
          key={resource.id}
          className="absolute"
          style={{
            left: `${20 + (idx * 15)}%`,
            top: `${30 + (idx * 10)}%`,
          }}
        >
          <div className="relative">
            <MapPin className="w-8 h-8 text-primary fill-primary" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full text-[10px] font-bold flex items-center justify-center shadow">
              {idx + 1}
            </span>
          </div>
        </div>
      ))}

      {/* Map location label */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Los Angeles</span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-lg shadow flex items-center justify-center hover:bg-card">
          +
        </button>
        <button className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-lg shadow flex items-center justify-center hover:bg-card">
          −
        </button>
      </div>
    </div>
  )
}

// ============================================
// MAIN MAP PANEL
// ============================================
export function MapPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const filteredResources = MOCK_RESOURCES.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex gap-4">
      {/* Left Panel: Resource List */}
      <div className="w-72 flex-shrink-0 flex flex-col">
        {/* Search Header */}
        <div className="mb-4">
          <h2 className="font-semibold mb-2">Resources</h2>
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
              variant="outline"
              size="icon"
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredResources.map((resource) => (
            <ResourceListItem
              key={resource.id}
              resource={resource}
              isSelected={selectedResource?.id === resource.id}
              onClick={() => setSelectedResource(resource)}
            />
          ))}
        </div>
      </div>

      {/* Center: Map */}
      <div className="flex-1">
        <MapPlaceholder resources={filteredResources} />
      </div>

      {/* Right Panel: Resource Details (conditional) */}
      {selectedResource && (
        <div className="w-72 flex-shrink-0 bg-card/50 rounded-xl p-4">
          <ResourceDetail
            resource={selectedResource}
            onClose={() => setSelectedResource(null)}
          />
        </div>
      )}
    </div>
  )
}
