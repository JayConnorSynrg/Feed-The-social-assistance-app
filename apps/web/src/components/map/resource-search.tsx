'use client'

import { useState, useCallback } from 'react'
import { Search, MapPin, X, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const RESOURCE_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'food', label: 'Food & Nutrition' },
  { value: 'housing', label: 'Housing' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'employment', label: 'Employment' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'financial', label: 'Financial Assistance' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'substance_abuse', label: 'Substance Abuse' },
  { value: 'domestic_violence', label: 'Domestic Violence' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'senior_services', label: 'Senior Services' },
  { value: 'disability_services', label: 'Disability Services' },
  { value: 'veteran_services', label: 'Veteran Services' },
  { value: 'immigration', label: 'Immigration' },
  { value: 'other', label: 'Other' },
  { value: 'eitc_tax_filing', label: 'Tax Filing & EITC' },
  { value: 'free_legal', label: 'Free Legal Help' },
  { value: 'prenatal_natal_care', label: 'Prenatal & Newborn Care' },
  { value: 'waste_disposal', label: 'Waste & Disposal' },
  { value: 'free_camping', label: 'Free Camping' },
  { value: 'free_goods_donation', label: 'Free Goods & Donations' },
]

interface ResourceSearchProps {
  onSearch?: (query: string) => void
  onCategoryChange?: (category: string | null) => void
  onLocationSearch?: (location: { lat: number; lng: number; name: string }) => void
  isLoading?: boolean
  className?: string
}

export function ResourceSearch({
  onSearch,
  onCategoryChange,
  onLocationSearch,
  isLoading = false,
  className = '',
}: ResourceSearchProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [locationQuery, setLocationQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = useCallback(() => {
    onSearch?.(query)
  }, [query, onSearch])

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategory(value)
      onCategoryChange?.(value === 'all' ? null : value)
    },
    [onCategoryChange]
  )

  const handleLocationSearch = useCallback(async () => {
    if (!locationQuery.trim()) return

    // Use Mapbox Geocoding API
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || token.includes('placeholder')) return

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          locationQuery
        )}.json?access_token=${token}&country=us&types=place,address,postcode`
      )
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lng, lat] = feature.center
        onLocationSearch?.({ lat, lng, name: feature.place_name })
      }
    } catch (error) {
      console.error('Location search failed:', error)
    }
  }, [locationQuery, onLocationSearch])

  const clearQuery = useCallback(() => {
    setQuery('')
    onSearch?.('')
  }, [onSearch])

  const clearLocation = useCallback(() => {
    setLocationQuery('')
  }, [])

  return (
    <Card className={className}>
      <CardContent className="p-3 space-y-3">
        {/* Main search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-8"
            />
            {query && (
              <button
                onClick={clearQuery}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="space-y-3 pt-2 border-t">
            {/* Location search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="City, address, or zip code..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                  className="pl-9 pr-8"
                />
                {locationQuery && (
                  <button
                    onClick={clearLocation}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button variant="outline" onClick={handleLocationSearch}>
                Go
              </Button>
            </div>

            {/* Category filter */}
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { RESOURCE_CATEGORIES }
