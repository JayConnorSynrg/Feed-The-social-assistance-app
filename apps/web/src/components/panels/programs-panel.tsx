'use client'

// apps/web/src/components/panels/programs-panel.tsx
// Browse Programs, in the member's language (lib/i18n-programs.ts; category names through
// resourceCategoryLabel, state names through usStateName), marked lang/dir on the panel's root and
// on the Share to Feed dialog. Program text (names, descriptions, eligibility, services, hours,
// addresses) is the program's own and is marked lang="" dir="auto"; phones, emails and links
// dir="ltr". The hooks and their queries are unchanged; their English messages are read as codes.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Heart,
  Phone,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  ExternalLink,
  FileDown,
  Bookmark,
  BookmarkX,
  Share2,
  X,
} from 'lucide-react'
import { useProgramBrowser, type Resource } from '@/hooks/use-program-browser'
import { useResourceSearch, searchRowToResourceRow } from '@/hooks/use-resource-search'
import { useSavedResources, type SavedResource } from '@/hooks/use-saved-resources'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_DISPLAY, hasApplicationForm, getFormTypesForCategory } from '@/lib/category-form-map'
import { logger } from '@/lib/logger'
import { createPost } from '@/lib/post-rpc'
import { failureText } from '@/lib/i18n-feed-edit'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { buildSafeErrorContext } from '@/lib/ai/error-explainer'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { programsT, programsErrorText, savedErrorText, searchErrorText } from '@/lib/i18n-programs'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { usStateOptions } from '@/lib/i18n-us-states'
import { cn } from '@/lib/utils'
import { afterLayout, announce, AnnouncementText, focusAfterRowRemoval, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

function CategoryBadge({ category, locale }: { category: string; locale: Locale }) {
  const display = CATEGORY_DISPLAY[category] ?? CATEGORY_DISPLAY['other']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${display.color}`}>
      {resourceCategoryLabel(CATEGORY_DISPLAY[category] ? category : 'other', locale)}
    </span>
  )
}

// ============================================================
// SHARE TO FEED DIALOG
// ============================================================

interface ShareToFeedDialogProps {
  resource: Resource
  onClose: () => void
  onShared: () => void
}

/** "Share to Feed" for a program (exported for its behaviour tests). */
export function ShareToFeedDialog({ resource, onClose, onShared }: ShareToFeedDialogProps) {
  const { user } = useAuth()
  const locale = useProfileLocale()
  // The suggested post is in the member's language (the post is stored with that language).
  const [content, setContent] = useState(() =>
    resource.description
      ? formatMessage(programsT(locale, 'shareDefaultWithDescription'), {
          name: resource.name,
          description: `${resource.description.slice(0, 120)}${resource.description.length > 120 ? '…' : ''}`,
        })
      : formatMessage(programsT(locale, 'shareDefault'), { name: resource.name })
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<Announcement>(NO_ANNOUNCEMENT)
  // Single flight: a second press while the first share is in flight sends nothing.
  const inFlight = useRef(false)
  const shareInvalid = !content.trim()

  const handleShare = async () => {
    if (inFlight.current || !user || !content.trim()) return
    inFlight.current = true
    setIsSubmitting(true)
    setErrorMsg((prev) => (prev.text ? { text: '', seq: prev.seq } : prev))
    try {
      // The one checked server write for posts (create_post): raw text, linked to this resource,
      // stored with the member's language.
      const res = await createPost(createClient(), {
        postType: 'feed',
        fields: { content: content.trim() },
        resourceId: resource.id,
        lang: locale,
      })
      if (!res.ok) {
        announce(setErrorMsg, failureText(locale, res.failure))
        logger.error('programs.share.error', { programId: resource.id, error: res.failure.kind })
        return
      }
      logger.info('programs.share.success', { programId: resource.id })
      onShared()
    } finally {
      inFlight.current = false
      setIsSubmitting(false)
    }
  }

  return (
    /* Overlay — stop propagation so clicks inside don't toggle the parent tile */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-to-feed-title"
      lang={locale}
      dir={dir(locale)}
      data-testid="share-to-feed-dialog"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md bg-[#faf9f6] rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Dialog header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-100">
          <h2 id="share-to-feed-title" className="font-semibold text-stone-900 text-base">{programsT(locale, 'shareToFeed')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={programsT(locale, 'close')}
            className="p-1 rounded-lg text-stone-600 hover:text-stone-800 hover:bg-stone-100 transition-colors"
          >
            <X aria-hidden="true" className="w-4 h-4" />
          </button>
        </div>

        {/* Resource chip */}
        <div className="px-4 pt-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime-50 border border-lime-200 text-xs font-medium text-lime-700">
            <FileText aria-hidden="true" className="w-3 h-3 flex-shrink-0" />
            <span lang="" dir="auto" className="truncate max-w-[220px]">{resource.name}</span>
          </div>
        </div>

        {/* Editable post content */}
        <div className="px-4 pt-3 pb-4">
          <label htmlFor="share-content-input" className="block mb-1 text-sm font-medium text-stone-800">
            {programsT(locale, 'shareLabel')}
          </label>
          <textarea
            id="share-content-input"
            data-testid="share-content-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
            dir="auto"
            readOnly={isSubmitting}
            placeholder={programsT(locale, 'sharePlaceholder')}
            className="w-full resize-none rounded-xl border border-stone-500 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#4a5d23]/30 focus:border-[#4a5d23]"
          />
          {/* One alert region, always mounted; each failure is a new node (AnnouncementText). */}
          <p role="alert" lang={locale} dir="auto" className="mt-2 text-xs text-red-700">
            <AnnouncementText announcement={errorMsg} />
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-stone-500 bg-white text-sm font-medium text-stone-800 hover:bg-stone-50 transition-colors"
          >
            {programsT(locale, 'cancel')}
          </button>
          <button
            data-testid="share-to-feed-submit"
            type="button"
            onClick={handleShare}
            aria-disabled={isSubmitting || shareInvalid}
            className={cn(
              'flex-1 py-2 rounded-xl bg-[#4a5d23] text-sm font-medium text-white hover:bg-[#3d4d1c] transition-colors flex items-center justify-center gap-1.5',
              shareInvalid && 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 aria-hidden="true" className="w-4 h-4" />
            )}
            {programsT(locale, 'share')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProgramTileProps {
  resource: Resource
  isExpanded: boolean
  onToggle: () => void
  onSave: (resource: Resource) => void
  isSaved: boolean
  onStartApplication: (resource: Resource) => void
  onShare: (resource: Resource) => void
  locale: Locale
}

function ProgramTile({ resource, isExpanded, onToggle, onSave, isSaved, onStartApplication, onShare, locale }: ProgramTileProps) {
  const m = (key: Parameters<typeof programsT>[1]) => programsT(locale, key)
  const detailsId = `program-details-${resource.id}`
  const locationParts = [resource.city, resource.state].filter(Boolean)
  const hasForm = hasApplicationForm(resource.category as string)

  return (
    <div data-testid={`program-card-${resource.id}`} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full text-start p-4 hover:bg-stone-50 transition-colors"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span lang="" dir="auto" className="font-semibold text-stone-900 text-sm leading-snug break-words min-w-0">{resource.name}</span>
              {resource.is_verified && (
                <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-green-600 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <CategoryBadge category={resource.category as string} locale={locale} />
              {locationParts.length > 0 && (
                <span lang="" dir="auto" className="text-xs text-stone-600">{locationParts.join(', ')}</span>
              )}
            </div>
            {resource.description && (
              <p lang="" dir="auto" className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                {resource.description}
              </p>
            )}
          </div>
          <div aria-hidden="true" className="flex-shrink-0 text-stone-600 mt-0.5">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div id={detailsId} className="px-4 pb-4 border-t border-stone-100">
          <div className="pt-3 space-y-3">
            {resource.description && (
              <p lang="" dir="auto" className="text-sm text-stone-700 leading-relaxed">{resource.description}</p>
            )}

            {resource.eligibility_requirements && (
              <div>
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1">{m('eligibility')}</h4>
                <p lang="" dir="auto" className="text-sm text-stone-700 leading-relaxed">{resource.eligibility_requirements}</p>
              </div>
            )}

            {resource.services_offered && resource.services_offered.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1.5">{m('servicesOffered')}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {resource.services_offered.map((service, i) => (
                    <span key={i} lang="" dir="auto" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-700">
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
                  <Phone aria-hidden="true" className="w-3.5 h-3.5 text-stone-600" />
                  <span dir="ltr">{resource.phone}</span>
                </a>
              )}
              {resource.email && (
                <a
                  href={`mailto:${resource.email}`}
                  className="flex items-center gap-2 text-sm text-stone-700 hover:text-[#4a5d23] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail aria-hidden="true" className="w-3.5 h-3.5 text-stone-600" />
                  <span dir="ltr" className="break-all">{resource.email}</span>
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
                  <Globe aria-hidden="true" className="w-3.5 h-3.5 text-stone-600" />
                  <span dir="ltr" className="truncate max-w-[200px]">{resource.website}</span>
                  <ExternalLink aria-hidden="true" className="w-3 h-3 text-stone-600 flex-shrink-0" />
                </a>
              )}
            </div>

            {resource.hours_of_operation && (
              <div>
                <h4 className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-1">{m('hours')}</h4>
                <p lang="" dir="auto" className="text-xs text-stone-600">
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
                    : 'bg-white border-stone-500 text-stone-800 hover:bg-stone-50'
                }`}
              >
                <Heart aria-hidden="true" className={`w-3.5 h-3.5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
                {isSaved ? m('saved') : m('saveToPlan')}
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
                  <FileText aria-hidden="true" className="w-3.5 h-3.5" />
                  {m('startApplication')}
                </button>
              ) : (resource.phone || resource.website) ? (
                <a
                  href={resource.phone ? `tel:${resource.phone}` : resource.website!}
                  target={resource.website && !resource.phone ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#4a5d23] text-white hover:bg-[#3d4d1c] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {resource.phone ? <Phone aria-hidden="true" className="w-3.5 h-3.5" /> : <Globe aria-hidden="true" className="w-3.5 h-3.5" />}
                  {m('contactDirectly')}
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
                  <ExternalLink aria-hidden="true" className="w-3.5 h-3.5" />
                  {m('applyOnline')}
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
                  <FileDown aria-hidden="true" className="w-3.5 h-3.5" />
                  {m('downloadForm')}
                </a>
              )}

              {/* Share to Feed — lets users post this program to the community feed */}
              <button
                data-testid={`share-to-feed-btn-${resource.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onShare(resource)
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-500 text-stone-800 bg-white hover:bg-stone-50 transition-colors"
              >
                <Share2 aria-hidden="true" className="w-3.5 h-3.5" />
                {m('shareToFeed')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SAVED PROGRAMS TAB
// ============================================================
function SavedProgramTile({
  saved,
  onUnsave,
  isRemoving,
  locale,
}: {
  saved: SavedResource
  onUnsave: (id: string) => void
  isRemoving: boolean
  locale: Locale
}) {
  const display = saved.resource_category ? (CATEGORY_DISPLAY[saved.resource_category] ?? CATEGORY_DISPLAY['other']) : null
  const categoryKey = saved.resource_category && CATEGORY_DISPLAY[saved.resource_category] ? saved.resource_category : 'other'

  return (
    <div
      data-testid={`saved-program-card-${saved.id}`}
      className="bg-white border border-stone-200 rounded-xl shadow-sm p-4 flex items-start gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span lang="" dir="auto" className="font-semibold text-stone-900 text-sm leading-snug break-words min-w-0">{saved.resource_name}</span>
        </div>
        {display && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-1 ${display.color}`}>
            {resourceCategoryLabel(categoryKey, locale)}
          </span>
        )}
        {saved.resource_address && (
          <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
            <MapPin aria-hidden="true" className="w-3 h-3" />
            <span lang="" dir="auto">{saved.resource_address}</span>
          </p>
        )}
        {saved.resource_phone && (
          <a
            href={`tel:${saved.resource_phone}`}
            className="text-xs text-[#4a5d23] hover:underline flex items-center gap-1 mt-0.5"
          >
            <Phone aria-hidden="true" className="w-3 h-3" />
            <span dir="ltr">{saved.resource_phone}</span>
          </a>
        )}
        {saved.resource_website && (
          <a
            href={saved.resource_website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#4a5d23] hover:underline flex items-center gap-1 mt-0.5"
          >
            <Globe aria-hidden="true" className="w-3 h-3" />
            <span dir="ltr" className="truncate max-w-[180px]">{saved.resource_website}</span>
          </a>
        )}
      </div>
      <button
        data-testid={`unsave-btn-${saved.id}`}
        onClick={() => {
          if (!isRemoving) onUnsave(saved.id)
        }}
        aria-disabled={isRemoving}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-red-700 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
      >
        <BookmarkX aria-hidden="true" className="w-3.5 h-3.5" />
        {programsT(locale, 'unsave')}
      </button>
    </div>
  )
}

function SavedProgramsTab({ locale, onRemoved }: { locale: Locale; onRemoved: () => void }) {
  const { savedResources, isLoading, error, removeResource } = useSavedResources()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const m = (key: Parameters<typeof programsT>[1]) => programsT(locale, key)

  const handleUnsave = useCallback(async (id: string) => {
    // Where focus goes once the row has left, chosen before it leaves: the next row's Unsave, else
    // the previous one's, else the empty state's heading.
    const next = focusAfterRowRemoval(savedResources.map((r) => r.id), id)
    setRemovingId(id)
    const ok = await removeResource(id)
    setRemovingId(null)
    if (ok) {
      onRemoved()
      afterLayout(() => {
        const target = next ? document.querySelector<HTMLElement>(`[data-testid="unsave-btn-${next}"]`) : document.getElementById('saved-programs-empty')
        target?.focus()
      })
    }
  }, [removeResource, onRemoved, savedResources])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-stone-600">{m('loadingSaved')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
        <AlertCircle aria-hidden="true" className="w-8 h-8 text-red-700" />
        <p className="text-sm text-stone-700">{savedErrorText(error, locale)}</p>
      </div>
    )
  }

  if (savedResources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
        <div aria-hidden="true" className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <Bookmark className="w-8 h-8 text-stone-600" />
        </div>
        <h3 id="saved-programs-empty" tabIndex={-1} className="font-semibold text-stone-900 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-700">{m('savedEmptyTitle')}</h3>
        <p className="text-sm text-stone-600 max-w-xs leading-relaxed">
          {formatMessage(m('savedEmptyBody'), { action: m('saveToPlan') })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-4 pe-1">
      {savedResources.map((saved) => (
        <SavedProgramTile
          key={saved.id}
          saved={saved}
          onUnsave={handleUnsave}
          isRemoving={removingId === saved.id}
          locale={locale}
        />
      ))}
    </div>
  )
}

// ============================================================
// MAIN PROGRAMS PANEL
// ============================================================
type ProgramsTab = 'browse' | 'saved'

export function ProgramsPanel() {
  const { programs, categories, isLoading, error, filters, setFilters } = useProgramBrowser()
  const { saveResource, isResourceSaved } = useSavedResources()
  const { setActivePanel, setPanelParams } = usePanelContext()
  const locale = useProfileLocale()
  const m = (key: Parameters<typeof programsT>[1]) => programsT(locale, key)
  const stateOptions = useMemo(() => usStateOptions(locale), [locale])
  // One always-mounted status line for save / remove results (announce(): one node per result).
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const announceRemoved = useCallback(() => announce(setStatus, programsT(locale, 'removedFromPlan')), [locale])
  const [activeTab, setActiveTab] = useState<ProgramsTab>('browse')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  /** Resource being shared — drives the ShareToFeedDialog open/closed state */
  const [sharingResource, setSharingResource] = useState<Resource | null>(null)

  // Exhaustive server-side search — bypasses the curated admin_added/hud +
  // state-filtered browse query entirely. Fires only on a non-empty query;
  // useResourceSearch debounces (~300ms) internally.
  const trimmedProgramSearch = searchInput.trim()
  const isProgramSearchActive = trimmedProgramSearch.length > 0
  const {
    results: programSearchResults,
    loading: programSearchLoading,
    error: programSearchError,
  } = useResourceSearch({ query: searchInput, surface: 'programs' })

  const searchResources: Resource[] = useMemo(
    () => programSearchResults.map(searchRowToResourceRow),
    [programSearchResults]
  )

  // Category chips still apply on top of search results, same as browse.
  const displayItems: Resource[] = useMemo(() => {
    if (!isProgramSearchActive) return programs
    return filters.category
      ? searchResources.filter((r) => r.category === filters.category)
      : searchResources
  }, [isProgramSearchActive, searchResources, programs, filters.category])

  useEffect(() => {
    logger.info('programs.panel.opened', {})
  }, [])

  // Route a programs-fetch error to the AI chat as a safe explain-request.
  // The user must click the affordance — we never auto-hijack to chat.
  const handleAskAssistantAboutProgramsError = useCallback(() => {
    // The programs error surface is a friendly-error string (from getFriendlyErrorMessage),
    // not a raw Error object. We classify it by inspecting the safe string only.
    let kind: 'network' | 'timeout' | 'server' | 'unknown' = 'unknown'
    if (error) {
      const lower = error.toLowerCase()
      if (lower.includes('connection') || lower.includes('network')) kind = 'network'
      else if (lower.includes('too long') || lower.includes('slow')) kind = 'timeout'
      else if (lower.includes('our end') || lower.includes('server')) kind = 'server'
    }
    // Build a SAFE error context — no raw internals reach the LLM.
    const ctx = buildSafeErrorContext({ source: 'programs', kind })
    // Switch to chat and inject errorContext via panelParams (mirrors wizardContext pattern).
    setActivePanel('chat')
    setPanelParams((prev) => ({ ...prev, errorContext: ctx }))
  }, [error, setActivePanel, setPanelParams])

  useEffect(() => {
    if (!isProgramSearchActive && !isLoading) {
      logger.info('programs.filter', {
        category: filters.category ?? null,
        search: filters.search ?? null,
        result_count: programs.length,
      })
    }
  }, [filters, programs.length, isLoading, isProgramSearchActive])

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
      announce(setStatus, programsT(locale, 'savedToPlan'))
    }
  }, [saveResource, isResourceSaved, locale])

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

  const handleShare = useCallback((resource: Resource) => {
    setSharingResource(resource)
  }, [])

  // Closing the dialog returns focus to the Share to Feed button that opened it.
  const handleShareDialogClose = useCallback(() => {
    const openerId = sharingResource?.id
    setSharingResource(null)
    if (openerId) afterLayout(() => document.querySelector<HTMLElement>(`[data-testid="share-to-feed-btn-${openerId}"]`)?.focus())
  }, [sharingResource])

  const handleShared = useCallback(() => {
    setSharingResource(null)
    // Navigate to feed so user sees the post they just shared
    setActivePanel('feed')
  }, [setActivePanel])

  return (
    <div lang={locale} dir={dir(locale)} className="h-full flex flex-col bg-[#faf9f6]">
      <p role="status" className="sr-only">
        <AnnouncementText announcement={status} />
      </p>
      {/* Share to Feed dialog — portal-style fixed overlay */}
      {sharingResource && (
        <ShareToFeedDialog
          resource={sharingResource}
          onClose={handleShareDialogClose}
          onShared={handleShared}
        />
      )}

      <div className="flex-shrink-0 px-1 pt-1 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">{m('title')}</h1>
            <p className="text-xs text-stone-600 mt-0.5">{m('subtitle')}</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div role="group" aria-label={m('title')} className="flex rounded-lg border border-stone-500 bg-white p-0.5 gap-0.5">
          <button
            data-testid="tab-browse"
            aria-pressed={activeTab === 'browse'}
            onClick={() => setActiveTab('browse')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-[#4a5d23] text-white'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            {m('tabBrowse')}
          </button>
          <button
            data-testid="tab-saved"
            aria-pressed={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-[#4a5d23] text-white'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            {m('tabSaved')}
          </button>
        </div>
      </div>

      {activeTab === 'saved' ? (
        <div className="flex-1 overflow-y-auto min-h-0 px-1">
          <SavedProgramsTab locale={locale} onRemoved={announceRemoved} />
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 px-1 space-y-3 pb-3">
            <div>
              <label htmlFor="programs-search" className="block mb-1 text-xs font-medium text-stone-800">{m('searchLabel')}</label>
              <div className="relative">
                <Search aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                <input
                  id="programs-search"
                  type="search"
                  dir="auto"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={m('searchPlaceholder')}
                  className="w-full ps-9 pe-4 py-2 text-sm bg-white border border-stone-500 rounded-lg text-stone-900 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-[#4a5d23]/30 focus:border-[#4a5d23]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="programs-state" className="block mb-1 text-xs font-medium text-stone-800">{m('stateLabel')}</label>
              <div className="relative">
                <MapPin aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
                <select
                  id="programs-state"
                  value={filters.state ?? ''}
                  onChange={(e) => setFilters({ ...filters, state: e.target.value || null })}
                  className="w-full ps-9 pe-8 py-2 text-sm bg-white border border-stone-500 rounded-lg text-stone-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#4a5d23]/30 focus:border-[#4a5d23]"
                >
                  <option value="" disabled>{m('selectState')}</option>
                  {stateOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.name}</option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
              </div>
            </div>

            <div role="group" aria-label={m('categoriesLabel')} className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                aria-pressed={filters.category === null}
                onClick={() => handleCategoryFilter(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filters.category === null
                    ? 'bg-[#4a5d23] text-white'
                    : 'bg-white border border-stone-500 text-stone-800 hover:bg-stone-50'
                }`}
              >
                {m('allCategories')}
              </button>
              {categories.map((cat) => {
                const display = CATEGORY_DISPLAY[cat.name]
                return (
                  <button
                    key={cat.name}
                    aria-pressed={filters.category === cat.name}
                    onClick={() => handleCategoryFilter(cat.name)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.category === cat.name
                        ? 'bg-[#4a5d23] text-white'
                        : 'bg-white border border-stone-500 text-stone-800 hover:bg-stone-50'
                    }`}
                  >
                    {display ? resourceCategoryLabel(cat.name, locale) : <span lang="" dir="auto">{cat.name}</span>}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      filters.category === cat.name
                        ? 'bg-white/20 text-white'
                        : 'bg-stone-100 text-stone-700'
                    }`}>
                      {formatCount(cat.count, locale)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {(isProgramSearchActive ? programSearchLoading : isLoading) ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 aria-hidden="true" className="w-6 h-6 animate-spin text-[#4a5d23]" />
                <p className="text-sm text-stone-600">
                  {isProgramSearchActive ? m('searching') : m('loadingPrograms')}
                </p>
              </div>
            ) : isProgramSearchActive && programSearchError ? (
              <div data-testid="programs-search-error" className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                <AlertCircle aria-hidden="true" className="w-8 h-8 text-red-700" />
                <p role="alert" className="text-sm text-stone-700">{searchErrorText(programSearchError, locale)}</p>
              </div>
            ) : !isProgramSearchActive && error ? (
              <div data-testid="programs-fetch-error" className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                <AlertCircle aria-hidden="true" className="w-8 h-8 text-red-700" />
                <p role="alert" className="text-sm text-stone-700">{programsErrorText(error, locale)}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setFilters({ ...filters })}
                    className="flex items-center gap-1.5 px-4 py-2 bg-stone-200 text-stone-800 rounded-lg text-sm hover:bg-stone-300 transition-colors"
                  >
                    <RefreshCw aria-hidden="true" className="w-4 h-4" />
                    {m('retry')}
                  </button>
                  <button
                    data-testid="programs-ask-assistant-btn"
                    onClick={handleAskAssistantAboutProgramsError}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#4a5d23] text-white rounded-lg text-sm hover:bg-[#3d4d1c] transition-colors"
                  >
                    <MessageCircle aria-hidden="true" className="w-4 h-4" />
                    {m('askAssistant')}
                  </button>
                </div>
              </div>
            ) : !isProgramSearchActive && !filters.state ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                <div aria-hidden="true" className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-stone-600" />
                </div>
                <h3 className="font-semibold text-stone-900">{m('selectState')}</h3>
                <p className="text-sm text-stone-600">{m('stateBody')}</p>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
                <div aria-hidden="true" className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
                  <Search className="w-8 h-8 text-stone-600" />
                </div>
                <h3 className="font-semibold text-stone-900 break-words">
                  {isProgramSearchActive ? <NoResults locale={locale} query={trimmedProgramSearch} /> : m('noPrograms')}
                </h3>
                <p className="text-sm text-stone-600">
                  {isProgramSearchActive ? m('tryDifferentSearch') : m('tryAdjusting')}
                </p>
              </div>
            ) : filters.category ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 pe-1">
                {displayItems.map((resource) => (
                  <ProgramTile
                    key={resource.id}
                    resource={resource}
                    isExpanded={expandedId === resource.id}
                    onToggle={() => handleToggle(resource.id, resource)}
                    onSave={handleSave}
                    isSaved={isResourceSaved(resource.id)}
                    onStartApplication={handleStartApplication}
                    onShare={handleShare}
                    locale={locale}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-6 pb-4 pe-1">
                {Object.entries(
                  displayItems.reduce<Record<string, Resource[]>>((acc, r) => {
                    const cat = r.category as string
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(r)
                    return acc
                  }, {})
                ).map(([cat, items]) => {
                  return (
                    <div key={cat}>
                      <div className="flex items-center gap-2 mb-3">
                        <h2 className="text-base font-bold text-stone-900">{resourceCategoryLabel(CATEGORY_DISPLAY[cat] ? cat : 'other', locale)}</h2>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
                          {formatCount(items.length, locale)}
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
                            onShare={handleShare}
                            locale={locale}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** "No results for “{query}”": the member's query kept whole and in its own direction. */
function NoResults({ locale, query }: { locale: Locale; query: string }) {
  const [before, after] = splitMessage(programsT(locale, 'noResults'), 'query')
  return (
    <>
      {before}
      <bdi lang="" dir="auto">{query}</bdi>
      {after}
    </>
  )
}
