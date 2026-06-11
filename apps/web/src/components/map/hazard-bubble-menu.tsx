'use client'

/**
 * HazardBubbleMenu — right-slide-out Sheet with all hazard report actions
 * plus the role-gated "Add yourself as a resource" entry and the
 * all-roles "Suggest a Resource" entry.
 *
 * ALL roles see the 4 hazard types + "Suggest a Resource".
 * "Add yourself as a resource" is ONLY rendered when user_role is sourcer/provider
 * (same gate as VolunteerResourceFAB: ['providing', 'facilitator', 'both']).
 *
 * The place flow works on the current map center (viewCenter prop).
 * The dialog for each type is a minimal form: severity select + description textarea.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  Cloud,
  Construction,
  Gauge,
  Lightbulb,
  ShieldAlert,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_META } from '@/lib/resource-categories'
import type { PlaceAlertInput } from '@/hooks/use-safety-alerts'
import type { Database } from '@feed/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AlertType = 'weather' | 'road_closure' | 'speeding' | 'general'
type ResourceCategory = Database['public']['Enums']['resource_category']

interface HazardEntry {
  type: AlertType
  label: string
  icon: React.FC<{ className?: string }>
  testId: string
  description: string
}

const HAZARD_ENTRIES: HazardEntry[] = [
  {
    type: 'weather',
    label: 'Report weather hazard',
    icon: Cloud,
    testId: 'hazard-weather',
    description: 'Ice, flooding, high winds, downed branches, etc.',
  },
  {
    type: 'road_closure',
    label: 'Report road closure',
    icon: Construction,
    testId: 'hazard-road-closure',
    description: 'Blocked road, bridge out, construction, accident.',
  },
  {
    type: 'speeding',
    label: 'Report speeding area',
    icon: Gauge,
    testId: 'hazard-speeding',
    description: 'Vehicles exceeding safe speed near pedestrians.',
  },
  {
    type: 'general',
    label: 'Report general safety issue',
    icon: AlertTriangle,
    testId: 'hazard-general',
    description: 'Other safety concern in this area.',
  },
]

const SEVERITY_OPTIONS = [
  { value: '1', label: 'Low — heads-up' },
  { value: '2', label: 'Moderate — use caution' },
  { value: '3', label: 'High — significant risk' },
  { value: '4', label: 'Critical — avoid area' },
]

/** All resource_category enum values keyed from the SSOT + database enum. */
const SUGGEST_CATEGORIES: Array<{ value: ResourceCategory; label: string }> =
  Object.entries(CATEGORY_META).map(([value, meta]) => ({
    value: value as ResourceCategory,
    label: meta.label,
  }))

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface HazardBubbleMenuProps {
  /** Current map center — used as the pin location */
  viewCenter: { lng: number; lat: number }
  onPlaceAlert: (input: PlaceAlertInput) => Promise<unknown>
  /** Called when user taps "Add yourself as a resource" (reuses existing FAB handler) */
  onAddResource: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner place-hazard dialog
// ─────────────────────────────────────────────────────────────────────────────

interface PlaceDialogProps {
  entry: HazardEntry | null
  viewCenter: { lng: number; lat: number }
  onPlace: (input: PlaceAlertInput) => Promise<unknown>
  onClose: () => void
}

function PlaceHazardDialog({ entry, viewCenter, onPlace, onClose }: PlaceDialogProps) {
  const [severity, setSeverity] = useState<string>('2')
  const [description, setDescription] = useState('')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry) return
    setPlacing(true)
    setError(null)
    try {
      await onPlace({
        type: entry.type,
        severity: parseInt(severity, 10),
        description,
        lng: viewCenter.lng,
        lat: viewCenter.lat,
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setDescription('')
        setSeverity('2')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place alert')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry && <entry.icon className="w-4 h-4 text-amber-600" />}
            {entry?.label}
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="py-6 text-center text-sm text-stone-700">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="font-medium">Alert placed at map center.</p>
            <p className="text-stone-500 text-xs mt-1">Visible to neighbors immediately.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-stone-500">{entry?.description}</p>
            <p className="text-xs text-stone-400">
              Pin will be placed at the current map center.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="hazard-severity" className="text-sm text-stone-800">
                Severity
              </Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="hazard-severity" className="text-stone-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hazard-description" className="text-sm text-stone-800">
                Description <span className="text-stone-400">(optional)</span>
              </Label>
              <Textarea
                id="hazard-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details neighbors should know..."
                className="text-stone-900 placeholder:text-stone-400 resize-none"
                rows={3}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={placing}
              >
                {placing ? 'Placing...' : 'Report hazard'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggest-Resource dialog
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestResourceDialogProps {
  open: boolean
  onClose: () => void
  /** Prefill locality from user profile when available. */
  prefillCity?: string | null
  prefillState?: string | null
}

function SuggestResourceDialog({
  open,
  onClose,
  prefillCity,
  prefillState,
}: SuggestResourceDialogProps) {
  const { user } = useAuth()
  const supabase = createClient()

  const [category, setCategory] = useState<ResourceCategory>('other')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [city, setCity] = useState(prefillCity ?? '')
  const [state, setState] = useState(prefillState ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const descriptionLength = description.length
  const descriptionValid = descriptionLength >= 10 && descriptionLength <= 500
  const nameValid = name.trim().length > 0
  const canSubmit = nameValid && descriptionValid && !isSubmitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !user) return

    setIsSubmitting(true)
    setError(null)
    try {
      const { error: insertError } = await supabase
        .from('resources')
        .insert({
          name: name.trim(),
          description: description.trim(),
          category,
          phone: phone.trim() || null,
          website: website.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          status: 'pending',
          is_volunteer_resource: false,
          source: 'user_submitted',
          submitted_by: user.id,
          is_verified: false,
        })

      if (insertError) throw insertError
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // Reset on close so a re-open starts fresh
    setCategory('other')
    setName('')
    setDescription('')
    setPhone('')
    setWebsite('')
    setCity(prefillCity ?? '')
    setState(prefillState ?? '')
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-lime-600" />
            Suggest a Resource
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center text-sm text-stone-700" data-testid="suggest-resource-success">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-lime-500" />
            <p className="font-medium text-stone-900">Thanks — your suggestion is pending review.</p>
            <p className="text-stone-500 text-xs mt-1">
              Our team will verify and publish it if it meets community guidelines.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="suggest-resource-form">
            <p className="text-xs text-stone-500">
              Know of a resource that&apos;s not on the map? Suggest it and our community team will review it.
            </p>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="suggest-category" className="text-sm text-stone-800">
                Category
              </Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as ResourceCategory)}
              >
                <SelectTrigger
                  id="suggest-category"
                  className="text-stone-900"
                  data-testid="suggest-category-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUGGEST_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="suggest-name" className="text-sm text-stone-800">
                Resource name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="suggest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rutland Community Pantry"
                className="text-stone-900 placeholder:text-stone-400"
                data-testid="suggest-name-input"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="suggest-description" className="text-sm text-stone-800">
                Description <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="suggest-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who does it serve? What do they offer? Hours?"
                className="text-stone-900 placeholder:text-stone-400 resize-none"
                rows={3}
                data-testid="suggest-description-input"
                required
              />
              <p className={`text-xs ${descriptionLength > 0 && !descriptionValid ? 'text-red-500' : 'text-stone-400'}`}>
                {descriptionLength}/500 chars (min 10)
              </p>
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="suggest-city" className="text-sm text-stone-800">
                  City
                </Label>
                <Input
                  id="suggest-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Rutland"
                  className="text-stone-900 placeholder:text-stone-400"
                  data-testid="suggest-city-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suggest-state" className="text-sm text-stone-800">
                  State
                </Label>
                <Input
                  id="suggest-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. VT"
                  className="text-stone-900 placeholder:text-stone-400"
                  data-testid="suggest-state-input"
                />
              </div>
            </div>

            {/* Phone (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="suggest-phone" className="text-sm text-stone-800">
                Phone <span className="text-stone-400">(optional)</span>
              </Label>
              <Input
                id="suggest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(802) 555-0100"
                className="text-stone-900 placeholder:text-stone-400"
                data-testid="suggest-phone-input"
              />
            </div>

            {/* Website (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="suggest-website" className="text-sm text-stone-800">
                Website <span className="text-stone-400">(optional)</span>
              </Label>
              <Input
                id="suggest-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="text-stone-900 placeholder:text-stone-400"
                data-testid="suggest-website-input"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600" data-testid="suggest-resource-error">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-lime-600 hover:bg-lime-700 text-white"
                disabled={!canSubmit}
                data-testid="suggest-resource-submit"
              >
                {isSubmitting ? 'Submitting…' : 'Submit suggestion'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function HazardBubbleMenu({ viewCenter, onPlaceAlert, onAddResource }: HazardBubbleMenuProps) {
  const { profile } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState<HazardEntry | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)

  // Role gate for "add yourself as a resource" — mirrors VolunteerResourceFAB
  const isProvider = ['providing', 'facilitator', 'both'].includes(profile?.user_role ?? '')

  const handleHazardEntryClick = (entry: HazardEntry) => {
    setSheetOpen(false)
    setActiveEntry(entry)
  }

  const handlePlaceAndClose = async (input: PlaceAlertInput) => {
    await onPlaceAlert(input)
  }

  const handleSuggestClick = () => {
    setSheetOpen(false)
    setSuggestOpen(true)
  }

  return (
    <>
      {/* FAB trigger */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-colors z-10"
            aria-label="Report a hazard or add a resource"
            data-testid="hazard-menu-trigger"
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
        </SheetTrigger>

        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Safety &amp; Resources</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-6 pb-6">
            {/* Hazard entries — ALL roles */}
            {HAZARD_ENTRIES.map((entry) => (
              <button
                key={entry.type}
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-left transition-colors"
                onClick={() => handleHazardEntryClick(entry)}
                data-testid={entry.testId}
              >
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <entry.icon className="w-4 h-4 text-amber-700" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">{entry.label}</p>
                  <p className="text-xs text-stone-500">{entry.description}</p>
                </div>
              </button>
            ))}

            {/* Divider */}
            <hr className="my-2 border-stone-200" />

            {/* Suggest a Resource — ALL authenticated roles */}
            <button
              className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-left transition-colors"
              onClick={handleSuggestClick}
              data-testid="suggest-resource-entry"
            >
              <span className="w-8 h-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-lime-700" />
              </span>
              <div>
                <p className="text-sm font-medium text-stone-900">Suggest a Resource</p>
                <p className="text-xs text-stone-500">Know a resource that&apos;s missing? Let us know.</p>
              </div>
            </button>

            {/* Add resource — providers/sourcers only */}
            {isProvider && (
              <button
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-left transition-colors"
                onClick={() => {
                  setSheetOpen(false)
                  onAddResource()
                }}
                data-testid="add-resource-entry"
              >
                <span className="w-8 h-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-lime-700" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">Add yourself as a resource</p>
                  <p className="text-xs text-stone-500">Share what you can offer with neighbors.</p>
                </div>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Place-hazard dialog — shown when an entry is selected */}
      <PlaceHazardDialog
        entry={activeEntry}
        viewCenter={viewCenter}
        onPlace={handlePlaceAndClose}
        onClose={() => setActiveEntry(null)}
      />

      {/* Suggest-resource dialog — all authenticated roles */}
      <SuggestResourceDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        prefillCity={profile?.location_city}
        prefillState={profile?.location_state}
      />
    </>
  )
}
