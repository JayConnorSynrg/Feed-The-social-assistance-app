'use client'

// apps/web/src/components/map/hazard-bubble-menu.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The map's "Report a hazard" menu: pick a hazard type, place its pin (drag it, or search for an
// address), choose a severity, describe it, confirm — plus the "Suggest a resource" form and, for
// providers, "Add yourself as a resource". Every string is in the viewer's language
// (lib/i18n-feed-alerts.ts); the panel and the dialog carry their own lang / dir. A refused report
// shows a translated sentence chosen by the refusal's kind, never the server's text.
// A guest (anonymous session) cannot report: instead of the four report entries they get the
// create-account prompt (the same as the feed's composer), so nobody fills in a form the server
// will refuse at the last step.
//
// Address search: the typed address is sent to Mapbox's geocoding API (lib/mapbox-geocode-v6.ts) when
// the member presses Find or Enter. It is never written to a log.

import { useState, useEffect } from 'react'
import {
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
import type { Database } from '@feed/database'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { dir, type Locale } from '@/lib/i18n'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { formatMessage } from '@/lib/format-message'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { ALERT_SEVERITIES, alertFailureText, alertSeverityHint, alertsT, type AlertMessages } from '@/lib/i18n-feed-alerts'
import type { AlertOutcome, AlertType, PlaceAlertInput, SafetyAlert } from '@/lib/safety-alert-rpc'
import { resolveGeoPointV6 } from '@/lib/mapbox-geocode-v6'
import { ALERT_ICONS } from '@/components/alerts/alert-parts'
import { planHazardGeocode } from './hazard-geocode'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ResourceCategory = Database['public']['Enums']['resource_category']

interface HazardEntry {
  type: AlertType
  label: keyof AlertMessages
  body: keyof AlertMessages
  testId: string
}

const HAZARD_ENTRIES: HazardEntry[] = [
  { type: 'weather', label: 'entryWeather', body: 'entryWeatherBody', testId: 'hazard-weather' },
  { type: 'road_closure', label: 'entryRoad', body: 'entryRoadBody', testId: 'hazard-road-closure' },
  { type: 'speeding', label: 'entrySpeeding', body: 'entrySpeedingBody', testId: 'hazard-speeding' },
  { type: 'general', label: 'entryGeneral', body: 'entryGeneralBody', testId: 'hazard-general' },
]

const SUGGEST_CATEGORIES = Object.keys(CATEGORY_META) as ResourceCategory[]

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface HazardBubbleMenuProps {
  viewCenter: { lng: number; lat: number }
  /** The viewer's language (the panel sets its own lang / dir). */
  locale?: Locale
  /** Place the alert; a refusal comes back as a typed failure. */
  onPlaceAlert: (input: PlaceAlertInput) => Promise<AlertOutcome<SafetyAlert>>
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
  locale: Locale
}

export function SuggestResourceDialog({
  open,
  onClose,
  prefillCity,
  prefillState,
  locale,
}: SuggestResourceDialogProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const t = (key: keyof AlertMessages) => alertsT(locale, key)
  const example = (value: string) => formatMessage(t('exampleValue'), { example: value })

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
    } catch {
      // A translated sentence; the server's text is not shown.
      setError(alertsT(locale, 'suggestFailed'))
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
      <DialogContent hideDefaultClose lang={locale} dir={dir(locale)} aria-describedby={undefined} className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-start">
            <Lightbulb className="w-4 h-4 text-lime-700" aria-hidden="true" />
            {t('suggestEntry')}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center text-sm text-stone-700" data-testid="suggest-resource-success">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-lime-600" aria-hidden="true" />
            <p className="font-medium text-stone-900">{t('suggestThanks')}</p>
            <p className="text-stone-700 text-xs mt-1">{t('suggestThanksBody')}</p>
            <Button type="button" variant="outline" className="mt-4 w-full" onClick={handleClose}>
              {t('close')}
            </Button>
          </div>
        ) : (
          <form
            // noValidate: the button is disabled until the form can be sent, and the website field
            // (type="url", for the URL keyboard) keeps taking an address typed without "https://".
            noValidate
            onSubmit={handleSubmit}
            className="space-y-3"
            data-testid="suggest-resource-form"
          >
            <p className="text-xs text-stone-700">{t('suggestIntro')}</p>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-category" className="text-sm text-stone-800">{t('suggestCategory')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ResourceCategory)}>
                <SelectTrigger id="suggest-category" className="text-stone-900" data-testid="suggest-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUGGEST_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{resourceCategoryLabel(c, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-name" className="text-sm text-stone-800">
                {t('suggestName')} <span className="text-red-700" aria-hidden="true">*</span>
              </Label>
              <Input
                id="suggest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={example('Rutland Community Pantry')}
                className="text-stone-900 placeholder:text-stone-500"
                data-testid="suggest-name-input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-description" className="text-sm text-stone-800">
                {t('suggestDescription')} <span className="text-red-700" aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="suggest-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                dir="auto"
                placeholder={t('suggestDescriptionPlaceholder')}
                className="text-stone-900 placeholder:text-stone-500 resize-none"
                rows={3}
                data-testid="suggest-description-input"
                required
                aria-describedby="suggest-description-count"
                aria-invalid={descriptionLength > 0 && !descriptionValid ? true : undefined}
              />
              {/* The count belongs to the field; an out-of-range text is said in words, not by colour. */}
              <p id="suggest-description-count" className="text-xs text-stone-700" data-testid="suggest-description-count">
                {formatMessage(t('suggestCount'), { n: descriptionLength })}
                {descriptionLength > 0 && !descriptionValid && (
                  <span className="block font-medium text-red-800" data-testid="suggest-description-invalid">
                    {t('suggestCountInvalid')}
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="suggest-city" className="text-sm text-stone-800">{t('suggestCity')}</Label>
                <Input
                  id="suggest-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={example('Rutland')}
                  className="text-stone-900 placeholder:text-stone-500"
                  data-testid="suggest-city-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="suggest-state" className="text-sm text-stone-800">{t('suggestState')}</Label>
                <Input
                  id="suggest-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder={example('VT')}
                  className="text-stone-900 placeholder:text-stone-500"
                  data-testid="suggest-state-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-phone" className="text-sm text-stone-800">
                {t('suggestPhone')} <span className="text-stone-600">{t('optional')}</span>
              </Label>
              <Input
                id="suggest-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(802) 555-0100"
                className="text-stone-900 placeholder:text-stone-500"
                data-testid="suggest-phone-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="suggest-website" className="text-sm text-stone-800">
                {t('suggestWebsite')} <span className="text-stone-600">{t('optional')}</span>
              </Label>
              <Input
                id="suggest-website"
                type="url"
                dir="ltr"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="text-stone-900 placeholder:text-stone-500"
                data-testid="suggest-website-input"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-800" data-testid="suggest-resource-error">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-lime-700 hover:bg-lime-800 text-white"
                disabled={!canSubmit}
                data-testid="suggest-resource-submit"
              >
                {isSubmitting ? t('suggestSubmitting') : t('suggestSubmit')}
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
  locale = 'en',
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
  const t = (key: keyof AlertMessages) => alertsT(locale, key)
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
      const res = await onPlaceAlert({
        type: activeEntry.type,
        severity: parseInt(severity, 10),
        description,
        lng: stagingCoords.lng,
        lat: stagingCoords.lat,
      })
      if (!res.ok) {
        // A guest, a lost connection: say which. Anything else: the general sentence.
        setPlaceError(res.failure.kind === 'guest' || res.failure.kind === 'network' ? alertFailureText(locale, res.failure) : alertsT(locale, 'placeFailed'))
        return
      }
      setView('menu')
      setActiveEntry(null)
      setPanelOpen(false)
      onWizardClose()
    } catch {
      setPlaceError(alertsT(locale, 'placeFailed'))
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
    try {
      // Move-only-on-strong-match gate: the staging pin already holds a valid
      // coordinate (center-seeded or dragged). A weak/approximate address must
      // never overwrite it, so classify the v6 result and branch on the pure
      // decision. resolveGeoPointV6 returns null on any failure (never throws).
      // The typed address goes to Mapbox for this lookup and nowhere else: it is not logged.
      const match = await resolveGeoPointV6(address, token)
      const decision = planHazardGeocode(match)
      if (decision.move && decision.coords) {
        onAddressGeocoded(decision.coords)
        setGeocodeSuccess(true)
      } else {
        setGeocodeError(alertsT(locale, 'addressNotFound'))
      }
    } catch {
      setGeocodeError(alertsT(locale, 'addressFailed'))
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
        type="button"
        lang={locale}
        className={cn(
          'absolute bottom-4 right-4 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-colors z-10',
          panelOpen ? 'bg-stone-700 hover:bg-stone-800' : 'bg-amber-700 hover:bg-amber-800'
        )}
        aria-label={panelOpen ? t('hazardClose') : t('hazardOpen')}
        aria-expanded={panelOpen}
        aria-controls="hazard-panel"
        data-testid="hazard-menu-trigger"
        onClick={() => (panelOpen ? handlePanelClose() : setPanelOpen(true))}
      >
        {panelOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <ShieldAlert className="w-5 h-5" aria-hidden="true" />}
      </button>

      {/* Non-modal side panel — no overlay, no portal, absolute within map container */}
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-sm shadow-xl z-20',
          'transition-transform duration-300 ease-in-out flex flex-col',
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        lang={locale}
        dir={dir(locale)}
        id="hazard-panel"
        data-testid="hazard-panel"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-shrink-0">
          <h2 className="font-semibold text-stone-900 text-sm">
            {view === 'wizard' && activeEntry ? t(activeEntry.label) : t('panelTitle')}
          </h2>
          <button
            type="button"
            onClick={handlePanelClose}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-700 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            aria-label={t('close')}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Menu view */}
        {view === 'menu' && (
          <div className="flex flex-col gap-2 p-4 overflow-y-auto flex-1">
            {/* A guest cannot report a hazard: the prompt replaces the entries. */}
            {isAnonymous && (
              <div data-testid="hazard-guest-prompt">
                <CreateAccountPrompt message={t('failGuest')} linkLabel={feedChromeT(locale, 'createAccount')} />
              </div>
            )}
            {!isAnonymous && HAZARD_ENTRIES.map((entry) => {
              const EntryIcon = ALERT_ICONS[entry.type]
              return (
                <button
                  key={entry.type}
                  type="button"
                  className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-start transition-colors"
                  onClick={() => handleHazardEntryClick(entry)}
                  data-testid={entry.testId}
                >
                  <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <EntryIcon className="w-4 h-4 text-amber-800" aria-hidden="true" />
                  </span>
                  <span className="block">
                    <span className="block text-sm font-medium text-stone-900">{t(entry.label)}</span>
                    <span className="block text-xs text-stone-700">{t(entry.body)}</span>
                  </span>
                </button>
              )
            })}

            {!isAnonymous && <hr className="my-2 border-stone-200" />}

            {!isAnonymous && (
              <button
                type="button"
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-start transition-colors"
                onClick={() => { setSuggestOpen(true); setPanelOpen(false) }}
                data-testid="suggest-resource-entry"
              >
                <span className="w-8 h-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-4 h-4 text-lime-800" aria-hidden="true" />
                </span>
                <span className="block">
                  <span className="block text-sm font-medium text-stone-900">{t('suggestEntry')}</span>
                  <span className="block text-xs text-stone-700">{t('suggestEntryBody')}</span>
                </span>
              </button>
            )}

            {isProvider && (
              <button
                type="button"
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-start transition-colors"
                onClick={() => { setPanelOpen(false); onAddResource() }}
                data-testid="add-resource-entry"
              >
                <span className="w-8 h-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-lime-800" aria-hidden="true" />
                </span>
                <span className="block">
                  <span className="block text-sm font-medium text-stone-900">{t('addSelfEntry')}</span>
                  <span className="block text-xs text-stone-700">{t('addSelfEntryBody')}</span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Wizard view */}
        {view === 'wizard' && activeEntry && (
          <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
            <p className="text-xs text-stone-700">{t(activeEntry.body)}</p>

            {/* Staging pin location indicator */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <MapPin className="w-4 h-4 text-amber-800 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-900">{t('pinLocation')}</p>
                <p className="text-xs text-amber-900 font-mono" dir="ltr">
                  {stagingCoords
                    ? `${stagingCoords.lat.toFixed(5)}°, ${stagingCoords.lng.toFixed(5)}°`
                    : t('pinSetting')}
                </p>
                <p className="text-xs text-amber-900 mt-0.5">{t('pinHint')}</p>
              </div>
            </div>

            {/* Address search */}
            <div className="space-y-1.5">
              <label htmlFor="wizard-address" className="text-sm font-medium text-stone-800">{t('addressLabel')}</label>
              <div className="flex gap-2">
                <input
                  id="wizard-address"
                  type="text"
                  dir="auto"
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setGeocodeSuccess(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGeocode() } }}
                  placeholder={t('addressPlaceholder')}
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-stone-500! bg-white text-stone-900 placeholder:text-stone-500 focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !address.trim()}
                  className="px-3 py-2 text-sm bg-[#4a5d23] text-white rounded-lg hover:bg-[#3d4d1e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {geocoding ? t('addressFinding') : t('addressFind')}
                </button>
              </div>
              {/* The search's outcome is announced where it appears (the region exists beforehand). */}
              <p role="status" className="text-xs text-stone-800" data-testid="hazard-geocode-status">
                {geocodeSuccess && (
                  <>
                    <span aria-hidden="true">✓ </span>
                    {t('addressMoved')}
                  </>
                )}
                {geocodeError}
              </p>
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <Label htmlFor="wizard-severity" className="text-sm text-stone-800">{t('fieldSeverity')}</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="wizard-severity" className="text-stone-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_SEVERITIES.map((level) => (
                    <SelectItem key={level} value={String(level)}>{alertSeverityHint(level, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="wizard-description" className="text-sm text-stone-800">
                {t('fieldDescription')}
              </Label>
              <Textarea
                id="wizard-description"
                dir="auto"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="text-stone-900 placeholder:text-stone-500 resize-none"
                rows={3}
              />
            </div>

            {placeError && <p role="alert" className="text-xs text-red-800" data-testid="hazard-place-error">{placeError}</p>}

            {/* Actions */}
            <div className="flex gap-2 mt-auto pt-2 border-t border-stone-100">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleWizardCancel}
                disabled={placing}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-amber-700 hover:bg-amber-800 text-white"
                disabled={placing || !stagingCoords}
                onClick={handleWizardConfirm}
              >
                {placing ? t('placing') : t('placeConfirm')}
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
        locale={locale}
      />
    </>
  )
}
