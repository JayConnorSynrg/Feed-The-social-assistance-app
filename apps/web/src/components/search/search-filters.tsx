'use client'

import { useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

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

const MAX_RESULTS_OPTIONS = [10, 25, 50, 100]

const FEDERATION_PREF_KEY = 'feed-search-federated-pref'

interface SearchFiltersProps {
  query: string
  onQueryChange: (query: string) => void
  category: string | null
  onCategoryChange: (category: string | null) => void
  includeFederated: boolean
  onIncludeFederatedChange: (include: boolean) => void
  partnerCount?: number
  maxResults: number
  onMaxResultsChange: (max: number) => void
  isSearching?: boolean
  onSearch: () => void
}

export function SearchFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  includeFederated,
  onIncludeFederatedChange,
  partnerCount = 0,
  maxResults,
  onMaxResultsChange,
  isSearching = false,
  onSearch,
}: SearchFiltersProps) {
  // Load federation preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FEDERATION_PREF_KEY)
      if (stored !== null) {
        const preference = stored === 'true'
        onIncludeFederatedChange(preference)
      }
    } catch (error) {
      console.error('Failed to load federation preference:', error)
    }
  }, [onIncludeFederatedChange])

  // Handle federation toggle change
  const handleFederationToggle = (checked: boolean) => {
    onIncludeFederatedChange(checked)
    try {
      localStorage.setItem(FEDERATION_PREF_KEY, String(checked))
    } catch (error) {
      console.error('Failed to save federation preference:', error)
    }
  }

  // Handle Enter key on search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="search-query">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-query"
                type="text"
                placeholder="Search resources..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="category-select">Category</Label>
            <Select
              value={category || 'all'}
              onValueChange={(value) =>
                onCategoryChange(value === 'all' ? null : value)
              }
            >
              <SelectTrigger id="category-select">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {RESOURCE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max Results Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="max-results-select">Max Results</Label>
            <Select
              value={String(maxResults)}
              onValueChange={(value) => onMaxResultsChange(Number(value))}
            >
              <SelectTrigger id="max-results-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_RESULTS_OPTIONS.map((max) => (
                  <SelectItem key={max} value={String(max)}>
                    {max}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Federation Toggle */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="federated-toggle" className="cursor-pointer">
                Include partner results
              </Label>
              <Switch
                id="federated-toggle"
                checked={includeFederated}
                onCheckedChange={handleFederationToggle}
              />
            </div>
            {includeFederated && partnerCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Searching {partnerCount} partner{partnerCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Search Button */}
          <div className="flex items-end md:col-span-2 lg:col-span-2">
            <Button
              onClick={onSearch}
              disabled={isSearching}
              className="w-full"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
