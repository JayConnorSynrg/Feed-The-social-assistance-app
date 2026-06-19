'use client'

import { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Cloud,
  Construction,
  Gauge,
  Lightbulb,
  MapPin,
  ShieldAlert,
  UserPlus,
  X,
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
import { logger } from '@/lib/logger'
import { track } from '@vercel/analytics'
import { cn } from '@/lib/utils'

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

const SUGGEST_CATEGORIES: Array<{ value: ResourceCategory; label: string }> =
  Object.entries(CATEGORY_META).map(([value, meta]) => ({
    value: value as ResourceCategory,
    label: meta.label,
  }))

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface HazardBubbleMenuProps {
  viewCenter: { lng: number; lat: number }
  onPlaceAlert: (input: PlaceAlertInput) => Promise<unknown>
  onAddResource: () => void
  /** Called when user selects a hazard type — parent renders staging pin at coords */
  onWizardOpen: (type: AlertType, coords: { lng: number; lat: number }) => void
  /** Called when wizard is dismissed — parent removes staging pin */
  onWizardClose: () => void
  /** Called when address geocodes successfully — parent moves staging pin */
  onAddressGeocoded: (coords: { lng: number; lat: number }) => void
  /** Current staging pin coords — updated by parent when pin is dragged or geocoded */
  stagingCoords: { lng: number; lat: number } | null
  /** When true, opens the panel from outside (e.g. cross-panel navigation) */
  externalOpen?: boolean
  /** Called when open state changes so parent can clear the external trigger */
  onExternalOpenChange?: (open: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggest-Resource dialog (unchanged — secondary flow, Dialog is appropriate)
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestResourceDialogProps {
  open: boolean
  onClose: () => void
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
            <Button type="button" variant="outline" className="mt-4 w-full" onClick={handleClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" data-testid="suggest-resource-form">
            <p className="text-xs text-stone-500">
              Know of a resource that&apos;s not on the map? Suggest it and our community team will review it.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-category" className="text-sm text-stone-800">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ResourceCategory)}>
                <SelectTrigger id="suggest-category" className="text-stone-900" data-testid="suggest-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUGGEST_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="suggest-city" className="text-sm text-stone-800">City</Label>
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
                <Label htmlFor="suggest-state" className="text-sm text-stone-800">State</Label>
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
// Main component — non-modal side panel (no Sheet, no overlay)
// ─────────────────────────────────────────────────────────────────────────────

export function HazardBubbleMenu({
  viewCenter,
  onPlaceAlert,
  onAddResource,
  onWizardOpen,
  onWizardClose,
  onAddressGeocoded,
  stagingCoords,
  externalOpen,
  onExternalOpenChange,
}: HazardBubbleMenuProps) {
  const { profile, isAnonymous } = useAuth()
  const [panelOpenInternal, setPanelOpenInternal] = useState(false)
  const panelOpen = externalOpen ?? panelOpenInternal
  const setPanelOpen = (v: boolean) => {
    setPanelOpenInternal(v)
    onExternalOpenChange?.(v)
  }
  const [view, setView] = useState<'menu' | 'wizard'>('menu')

  // Reset to menu view when the panel opens (including external open)
  useEffect(() => {
    if (panelOpen) setView('menu')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen])
  const [activeEntry, setActiveEntry] = useState<HazardEntry | null>(null)
  const [suggestOpen, setSuggestOpen] = useState(false)

  // Wizard form state
  const [severity, setSeverity] = useState('2')
  const [description, setDescription] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  // Address geocoding state (inline in wizard)
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [geocodeSuccess, setGeocodeSuccess] = useState(false)

  const isProvider = ['providing', 'facilitator', 'both'].includes(profile?.user_role ?? '')

  const handleHazardEntryClick = (entry: HazardEntry) => {
    setView('wizard')
    setActiveEntry(entry)
    setSeverity('2')
    setDescription('')
    setAddress('')
    setGeocodeError(null)
    setGeocodeSuccess(false)
    setPlaceError(null)
    track('safety_alert_menu_open', { type: entry.type })
    logger.info('hazard.menu.open', { type: entry.type })
    onWizardOpen(entry.type, viewCenter)
  }

  const handleWizardCancel = () => {
    setView('menu')
    setActiveEntry(null)
    onWizardClose()
  }

  const handleWizardConfirm = async () => {
    if (!activeEntry || !stagingCoords) return
    setPlacing(true)
    setPlaceError(null)
    try {
      await onPlaceAlert({
        type: activeEntry.type,
        severity: parseInt(severity, 10),
        description,
        lng: stagingCoords.lng,
        lat: stagingCoords.lat,
      })
      logger.info('hazard.pin.placed', { type: activeEntry.type, severity: parseInt(severity, 10) })
      track('safety_alert_placed', {
        type: activeEntry.type,
        severity: String(parseInt(severity, 10)),
      })
      setView('menu')
      setActiveEntry(null)
      setPanelOpen(false)
      onWizardClose()
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Failed to place alert')
    } finally {
      setPlacing(false)
    }
  }

  const handleGeocode = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || !address.trim()) return
    setGeocoding(true)
    setGeocodeError(null)
    setGeocodeSuccess(false)
    const t0 = Date.now()
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
      )
      const json = await res.json()
      const feature = json.features?.[0]
      if (feature) {
        const [lng, lat] = feature.center as [number, number]
        onAddressGeocoded({ lng, lat })
        setGeocodeSuccess(true)
        logger.info('hazard.geocode', { address, ms: Date.now() - t0, success: true })
        track('safety_alert_geocode', { success: 'true', ms: String(Date.now() - t0) })
      } else {
        setGeocodeError('Address not found — drag the pin to set location')
        logger.info('hazard.geocode', { address, ms: Date.now() - t0, success: false })
        track('safety_alert_geocode', { success: 'false' })
      }
    } catch {
      setGeocodeError('Could not geocode — drag the pin to set location')
    } finally {
      setGeocoding(false)
    }
  }

  const handlePanelClose = () => {
    if (view === 'wizard') handleWizardCancel()
    setPanelOpen(false)
  }

  return (
    <>
      {/* FAB — amber when panel closed, stone when open */}
      <button
        className={cn(
          'absolute bottom-4 right-4 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-colors z-10',
          panelOpen ? 'bg-stone-600 hover:bg-stone-700' : 'bg-amber-500 hover:bg-amber-600'
        )}
        aria-label={panelOpen ? 'Close safety menu' : 'Report a hazard or add a resource'}
        data-testid="hazard-menu-trigger"
        onClick={() => (panelOpen ? handlePanelClose() : setPanelOpen(true))}
      >
        {panelOpen ? <X className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
      </button>

      {/* Non-modal side panel — no overlay, no portal, absolute within map container */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-sm shadow-xl z-20',
          'transition-transform duration-300 ease-in-out flex flex-col',
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!panelOpen}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-shrink-0">
          <h2 className="font-semibold text-stone-900 text-sm">
            {view === 'wizard' && activeEntry ? activeEntry.label : 'Safety & Resources'}
          </h2>
          <button
            onClick={handlePanelClose}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu view */}
        {view === 'menu' && (
          <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
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

            <hr className="my-2 border-stone-200" />

            {!isAnonymous && (
              <button
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-left transition-colors"
                onClick={() => { setSuggestOpen(true); setPanelOpen(false) }}
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
            )}

            {isProvider && (
              <button
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-left transition-colors"
                onClick={() => { setPanelOpen(false); onAddResource() }}
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
        )}

        {/* Wizard view */}
        {view === 'wizard' && activeEntry && (
          <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
            <p className="text-xs text-stone-500">{activeEntry.description}</p>

            {/* Staging pin location indicator */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-800">Pin location</p>
                <p className="text-xs text-amber-700 font-mono">
                  {stagingCoords
                    ? `${stagingCoords.lat.toFixed(5)}°, ${stagingCoords.lng.toFixed(5)}°`
                    : 'Setting location…'}
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Drag the orange pin on the map or search below</p>
              </div>
            </div>

            {/* Address search */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-stone-700">Search for an address</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setGeocodeSuccess(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode() } }}
                  placeholder="Enter address..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !address.trim()}
                  className="px-3 py-2 text-sm bg-[#4a5d23] text-white rounded-lg hover:bg-[#3d4d1e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {geocoding ? '…' : 'Find'}
                </button>
              </div>
              {geocodeSuccess && <p className="text-xs text-[#4a5d23]">✓ Pin moved to address</p>}
              {geocodeError && <p className="text-xs text-amber-600">{geocodeError}</p>}
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <Label htmlFor="wizard-severity" className="text-sm text-stone-800">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="wizard-severity" className="text-stone-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="wizard-description" className="text-sm text-stone-800">
                Description <span className="text-stone-400">(optional)</span>
              </Label>
              <Textarea
                id="wizard-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details neighbors should know..."
                className="text-stone-900 placeholder:text-stone-400 resize-none"
                rows={3}
              />
            </div>

            {placeError && <p className="text-xs text-red-600">{placeError}</p>}

            {/* Actions */}
            <div className="flex gap-2 mt-auto pt-2 border-t border-stone-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleWizardCancel}
                disabled={placing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={placing || !stagingCoords}
                onClick={handleWizardConfirm}
              >
                {placing ? 'Placing…' : 'Confirm & Report'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Suggest-resource dialog — kept as Dialog (secondary flow, map doesn't need to stay visible) */}
      <SuggestResourceDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        prefillCity={profile?.location_city}
        prefillState={profile?.location_state}
      />
    </>
  )
}
