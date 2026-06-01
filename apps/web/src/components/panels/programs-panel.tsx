'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  Phone,
  Globe,
  Mail,
  MapPin,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  ExternalLink,
  FileDown,
} from 'lucide-react'
import { useProgramBrowser, type Resource } from '@/hooks/use-program-browser'
import { useSavedResources } from '@/hooks/use-saved-resources'
import { usePanelContext } from '@/components/layout/feed-shell'
import { CATEGORY_DISPLAY, hasApplicationForm, getFormTypesForCategory } from '@/lib/category-form-map'
import { US_STATES, STATE_TO_ABBR } from '@/lib/us-states'
import { logger } from '@/lib/logger'

function CategoryBadge({ category }: { category: string }) {
  const display = CATEGORY_DISPLAY[category] ?? CATEGORY_DISPLAY['other']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${display.color}`}>
      {display.label}
    </span>
  )
}

interface ProgramTileProps {
  resource: Resource
  isExpanded: boolean
  onToggle: () => void
  onSave: (resource: Resource) => void
  isSaved: boolean
  onStartApplication: (resource: Resource) => void
}

function ProgramTile({ resource, isExpanded, onToggle, onSave, isSaved, onStartApplication }: ProgramTileProps) {
  const locationParts = [resource.city, resource.state].filter(Boolean)
  const hasForm = hasApplicationForm(resource.category as string)

  return (
    <div data-testid={`program-card-${resource.id}`} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-stone-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-stone-900 text-sm leading-snug">{resource.name}</span>
              {resource.is_verified && (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <CategoryBadge category={resource.category as string} />
              {locationParts.length > 0 && (
                <span className="text-xs text-stone-500">{locationParts.join(', ')}</span>
              )}
            </div>
            {resource.description && (
              <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                {resource.description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-stone-400 mt-0.5">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-stone-100">
          <div className="pt-3 space-y-3">
            {resource.description && (
              <p className="text-sm text-stone-700 leading-relaxed">{resource.description}</p>
            )}

            {resource.eligibility_requirements && (
              <div>
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Eligibility</h4>
                <p className="text-sm text-stone-700 leading-relaxed">{resource.eligibility_requirements}</p>
              </div>
            )}

            {resource.services_offered && resource.services_offered.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Services Offered</h4>
                <div className="flex flex-wrap gap-1.5">
                  {resource.services_offered.map((service, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-700">
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {resource.phone && (
                <a
                  href={`tel:${resource.phone}`}
                  className="flex items-center gap-2 text-sm text-stone-700 hover:text-[#4a5d23] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {resource.phone}
                </a>
              )}
              {resource.email && (
                <a
                  href={`mailto:${resource.email}`}
                  className="flex items-center gap-2 text-sm text-stone-700 hover:text-[#4a5d23] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  {resource.email}
                </a>
              )}
              {resource.website && (
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-stone-700 hover:text-[#4a5d23] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Globe className="w-3.5 h-3.5 text-stone-400" />
                  <span className="truncate max-w-[200px]">{resource.website}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400 flex-shrink-0" />
                </a>
              )}
            </div>

            {resource.hours_of_operation && (
              <div>
                <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Hours</h4>
                <p className="text-xs text-stone-600">
                  {typeof resource.hours_of_operation === 'string'
                    ? resource.hours_of_operation
                    : JSON.stringify(resource.hours_of_operation)}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSave(resource)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isSaved
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
                {isSaved ? 'Saved' : 'Save to My Plan'}
              </button>

              {hasForm ? (
                <button
                  data-testid={`program-start-application-${resource.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartApplication(resource)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Start Application
                </button>
              ) : (resource.phone || resource.website) ? (
                <a
                  href={resource.phone ? `tel:${resource.phone}` : resource.website!}
                  target={resource.website && !resource.phone ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {resource.phone ? <Phone className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                  Contact Directly
                </a>
              ) : null}

              {(resource as Resource & { application_url?: string | null }).application_url && (
                <a
                  href={(resource as Resource & { application_url?: string | null }).application_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Apply Online
                </a>
              )}

              {(resource as Resource & { application_form_url?: string | null }).application_form_url && (
                <a
                  href={(resource as Resource & { application_form_url?: string | null }).application_form_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#4a5d23] text-[#4a5d23] hover:bg-[#4a5d23]/10 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Download Form
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProgramsPanel() {
  const { programs, categories, isLoading, error, filters, setFilters } = useProgramBrowser()
  const { saveResource, removeResource, isResourceSaved } = useSavedResources()
  const { setActivePanel, setPanelParams } = usePanelContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    logger.info('programs.panel.opened', {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // Functional update so the debounce only touches `search` and never
      // overwrites a `state`/`category` seeded by the hook between the effect
      // closing over `filters` and the timer firing (stale-closure bug: the
      // initial state:null was clobbering the profile-seeded state → 0 results).
      setFilters((prev) => ({ ...prev, search: searchInput }))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput, setFilters])

  useEffect(() => {
    if (!isLoading) {
      logger.info('programs.filter', {
        category: filters.category ?? null,
        search: filters.search ?? null,
        result_count: programs.length,
      })
    }
  }, [filters, programs.length, isLoading])

  const handleCategoryFilter = useCallback((category: string | null) => {
    setFilters({ ...filters, category })
  }, [filters, setFilters])

  const handleToggle = useCallback((id: string, resource: Resource) => {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) {
      logger.info('programs.program.expanded', {
        programId: resource.id,
        category: resource.category,
      })
    }
  }, [expandedId])

  const handleSave = useCallback(async (resource: Resource) => {
    const saved = isResourceSaved(resource.id)
    if (saved) {
      return
    }
    const ok = await saveResource({
      resource_id: resource.id,
      resource_name: resource.name,
      resource_category: resource.category as string,
      resource_address: [resource.address_line1, resource.city, resource.state].filter(Boolean).join(', ') || null,
      resource_phone: resource.phone,
      resource_website: resource.website,
    })
    if (ok) {
      logger.info('programs.program.saved', { programId: resource.id })
    }
  }, [saveResource, isResourceSaved])

  const handleStartApplication = useCallback((resource: Resource) => {
    const formTypes = getFormTypesForCategory(resource.category as string)
    const formType = formTypes[0] as string | undefined
    logger.info('programs.application.start', {
      programId: resource.id,
      category: resource.category,
      formTypes: formTypes.join(','),
    })
    setPanelParams((prev) => ({
      ...prev,
      formsTarget: {
        programId: resource.id,
        programName: resource.name,
        formType,
        applicationUrl: resource.application_url ?? null,
      },
    }))
    setActivePanel('forms')
  }, [setActivePanel, setPanelParams])

  return (
    <div className="h-full flex flex-col bg-[#faf9f6]">
      <div className="flex-shrink-0 px-1 pt-1 pb-3 space-y-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Browse Programs</h1>
          <p className="text-xs text-stone-500 mt-0.5">Find benefits and services available near you</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search programs..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4a5d23]/30 focus:border-[#4a5d23]"
          />
        </div>

        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
          <select
            value={filters.state ?? ''}
            onChange={(e) => setFilters({ ...filters, state: e.target.value || null })}
            className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#4a5d23]/30 focus:border-[#4a5d23]"
          >
            <option value="" disabled>Select your state</option>
            {US_STATES.map((s) => (
              <option key={s} value={STATE_TO_ABBR[s]}>{s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => handleCategoryFilter(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filters.category === null
                ? 'bg-[#4a5d23] text-white'
                : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const display = CATEGORY_DISPLAY[cat.name]
            return (
              <button
                key={cat.name}
                onClick={() => handleCategoryFilter(cat.name)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.category === cat.name
                    ? 'bg-[#4a5d23] text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {display?.label ?? cat.name}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  filters.category === cat.name
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {cat.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#4a5d23]" />
            <p className="text-sm text-stone-500">Loading programs...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-stone-700">{error}</p>
            <button
              onClick={() => setFilters({ ...filters })}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#4a5d23] text-white rounded-lg text-sm hover:bg-[#3d4d1c] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : !filters.state ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-semibold text-stone-900">Select your state</h3>
            <p className="text-sm text-stone-500">
              Programs are state-specific. Choose your state above to see available benefits.
            </p>
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
              <Search className="w-8 h-8 text-stone-400" />
            </div>
            <h3 className="font-semibold text-stone-900">No programs found</h3>
            <p className="text-sm text-stone-500">
              Try adjusting your search or selecting a different category.
            </p>
          </div>
        ) : filters.category ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 pr-1">
            {programs.map((resource) => (
              <ProgramTile
                key={resource.id}
                resource={resource}
                isExpanded={expandedId === resource.id}
                onToggle={() => handleToggle(resource.id, resource)}
                onSave={handleSave}
                isSaved={isResourceSaved(resource.id)}
                onStartApplication={handleStartApplication}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6 pb-4 pr-1">
            {Object.entries(
              programs.reduce<Record<string, Resource[]>>((acc, r) => {
                const cat = r.category as string
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(r)
                return acc
              }, {})
            ).map(([cat, items]) => {
              const display = CATEGORY_DISPLAY[cat] ?? CATEGORY_DISPLAY['other']
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="text-base font-bold text-stone-900">{display.label}</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-500">
                      {items.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((resource) => (
                      <ProgramTile
                        key={resource.id}
                        resource={resource}
                        isExpanded={expandedId === resource.id}
                        onToggle={() => handleToggle(resource.id, resource)}
                        onSave={handleSave}
                        isSaved={isResourceSaved(resource.id)}
                        onStartApplication={handleStartApplication}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
