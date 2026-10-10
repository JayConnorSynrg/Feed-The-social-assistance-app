'use client'

// apps/web/src/components/events/event-location-field.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Where an event happens. Choices: keep the saved location (edit only), use the organization's
// own map pin (default when it has one; disabled with an explanation when it has none), or enter
// an address. An address is looked up through FEED's own /api/geocode (US Census, server side);
// the answer is a DRAFT pin on the map that the admin confirms (or drags / clicks, then
// confirms) — only a confirmed pin is ever saved. The map draws Mapbox tiles only; there is no
// Mapbox geocoding here. Editing the address after confirming drops the pin.

import dynamic from 'next/dynamic'
import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { orgFormT } from '@/lib/i18n-org-forms'
import { eventFormT } from '@/lib/i18n-event-forms'
import { emptyAddress, type DraftPin, type FieldError, type LocationDraft } from '@/lib/event-form-model'
import { FieldErrorText, INPUT, LABEL, PRIMARY, SECONDARY } from './event-form-ui'

const OrgPinMap = dynamic(() => import('@/components/org-form/org-pin-map'), { ssr: false })

type GeoState = 'idle' | 'finding' | 'need_street' | 'none' | 'unavailable'

export function EventLocationField({
  locale,
  value,
  onChange,
  orgHasPin,
  noOrgChosen = false,
  allowKeep,
  error,
  firstRef,
}: {
  locale: Locale
  value: LocationDraft
  onChange: (next: LocationDraft) => void
  /** null while the organization's pin is loading (or before an organization is chosen). */
  orgHasPin: boolean | null
  /** Create in "all organizations" mode with no organization chosen yet. */
  noOrgChosen?: boolean
  /** Edit form: offer "Keep the current location". */
  allowKeep: boolean
  error?: FieldError | null
  /** Receives the CHECKED radio — the focus target when the location has an error. */
  firstRef?: Ref<HTMLInputElement>
}) {
  const uid = useId()
  const errId = `${uid}-err`
  const noPinId = `${uid}-nopin`
  const [geo, setGeo] = useState<GeoState>('idle')
  const [recenterKey, setRecenterKey] = useState(0)
  const confirmPinRef = useRef<HTMLButtonElement>(null)
  // After "Place pin at map center", focus moves to "Confirm pin" once it renders.
  const focusConfirmAfterPlace = useRef(false)

  const address = value.source === 'address' ? value : null
  const setAddress = (patch: Partial<Extract<LocationDraft, { source: 'address' }>>) => {
    const base = address ?? (emptyAddress() as Extract<LocationDraft, { source: 'address' }>)
    onChange({ ...base, ...patch })
  }
  // Any change to the address text drops the pin: a saved pin always matches its address.
  const setAddressText = (patch: Partial<Record<'street' | 'city' | 'state' | 'zip', string>>) => {
    setAddress({ ...patch, pin: null })
    setGeo('idle')
  }
  const setPin = (pin: DraftPin | null) => setAddress({ pin })

  const findOnMap = async () => {
    if (!address) return
    const street = address.street.trim()
    if (!street) {
      setGeo('need_street')
      return
    }
    setGeo('finding')
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street, city: address.city, state: address.state, zip: address.zip }),
      })
      if (!res.ok) {
        setGeo('unavailable')
        return
      }
      const r = (await res.json()) as { match: 'exact' | 'non_exact' | 'none'; lat: number | null; lng: number | null }
      if (r.match === 'none' || r.lat === null || r.lng === null) {
        setGeo('none')
        return
      }
      setPin({ lng: r.lng, lat: r.lat, status: 'draft', source: r.match === 'exact' ? 'exact' : 'approximate' })
      setGeo('idle')
      setRecenterKey((k) => k + 1)
    } catch {
      setGeo('unavailable')
    }
  }

  const pin = address?.pin ?? null
  useEffect(() => {
    if (!focusConfirmAfterPlace.current || pin?.status !== 'draft') return
    focusConfirmAfterPlace.current = false
    confirmPinRef.current?.focus()
  }, [pin])
  const pinMessage = (() => {
    if (geo === 'finding') return orgFormT(locale, 'locFinding')
    if (pin?.status === 'draft') {
      if (pin.source === 'approximate') return orgFormT(locale, 'locApprox')
      if (pin.source === 'exact') return orgFormT(locale, 'locExact')
      return orgFormT(locale, 'locDraftManual')
    }
    if (pin?.status === 'confirmed') return orgFormT(locale, 'locConfirmed')
    if (geo === 'need_street') return orgFormT(locale, 'locNeedStreet')
    if (geo === 'none') return orgFormT(locale, 'locNone')
    if (geo === 'unavailable') return orgFormT(locale, 'locUnavailable')
    return orgFormT(locale, 'locNoPin')
  })()

  const orgNote = orgHasPin === false ? 'locOrgNoPin' : noOrgChosen ? 'locOrgPickFirst' : orgHasPin === null ? 'locOrgChecking' : null
  const radio = (source: LocationDraft['source'], label: string, opts: { disabled?: boolean; note?: string }) => {
    const describedBy = [opts.note, error ? errId : null].filter(Boolean).join(' ') || undefined
    return (
      <label className={`flex min-h-10 items-center gap-2 text-sm ${opts.disabled ? 'text-stone-600' : 'text-stone-800'}`}>
        <input
          ref={value.source === source ? firstRef : undefined}
          type="radio"
          name={`${uid}-source`}
          className="h-5 w-5 accent-[#4a5d23]"
          checked={value.source === source}
          disabled={opts.disabled}
          aria-describedby={describedBy}
          onChange={() => {
            setGeo('idle')
            onChange(source === 'address' ? emptyAddress() : { source })
          }}
        />
        {label}
      </label>
    )
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-sm font-semibold text-stone-800">{eventFormT(locale, 'locLegend')}</legend>
      {allowKeep && radio('keep', eventFormT(locale, 'locKeep'), {})}
      {radio('org', eventFormT(locale, 'locUseOrg'), {
        disabled: orgHasPin !== true,
        note: orgNote ? noPinId : undefined,
      })}
      {orgNote && (
        <p id={noPinId} className="pl-7 text-xs text-stone-600">
          {eventFormT(locale, orgNote)}
        </p>
      )}
      {radio('address', eventFormT(locale, 'locEnterAddress'), {})}

      {address && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <label htmlFor={`${uid}-street`} className={LABEL}>
              {orgFormT(locale, 'fieldStreet')}
            </label>
            <input
              id={`${uid}-street`}
              className={INPUT}
              autoComplete="off"
              value={address.street}
              onChange={(e) => setAddressText({ street: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3 space-y-1">
              <label htmlFor={`${uid}-city`} className={LABEL}>
                {orgFormT(locale, 'fieldCity')}
              </label>
              <input id={`${uid}-city`} className={INPUT} value={address.city} onChange={(e) => setAddressText({ city: e.target.value })} />
            </div>
            <div className="col-span-1 space-y-1">
              <label htmlFor={`${uid}-state`} className={LABEL}>
                {orgFormT(locale, 'fieldState')}
              </label>
              <input
                id={`${uid}-state`}
                className={INPUT}
                maxLength={2}
                value={address.state}
                onChange={(e) => setAddressText({ state: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label htmlFor={`${uid}-zip`} className={LABEL}>
                {orgFormT(locale, 'fieldZip')}
              </label>
              <input id={`${uid}-zip`} className={INPUT} inputMode="numeric" value={address.zip} onChange={(e) => setAddressText({ zip: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY}
              aria-disabled={geo === 'finding' || undefined}
              onClick={() => {
                if (geo !== 'finding') void findOnMap()
              }}
            >
              {geo === 'finding' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
              {orgFormT(locale, 'locFind')}
            </button>
            {pin?.status === 'draft' && (
              <button ref={confirmPinRef} type="button" className={PRIMARY} onClick={() => setPin({ ...pin, status: 'confirmed' })}>
                {orgFormT(locale, 'locConfirm')}
              </button>
            )}
          </div>
          <p role="status" className={`text-sm ${pin?.status === 'draft' && pin.source === 'approximate' ? 'font-medium text-amber-800' : 'text-stone-700'}`}>
            {pinMessage}
          </p>
          <OrgPinMap
            pin={pin ? { lng: pin.lng, lat: pin.lat } : null}
            recenterKey={recenterKey}
            onPlace={(coords) =>
              setPin({ ...coords, status: 'draft', source: pin?.status === 'draft' && pin.source === 'exact' ? 'exact' : 'manual' })
            }
            label={orgFormT(locale, 'mapTitle')}
            instructions={orgFormT(locale, 'locMapLabel')}
            placeCenterLabel={orgFormT(locale, 'locPlaceCenter')}
            mapLocale={{
              title: orgFormT(locale, 'mapTitle'),
              zoomIn: orgFormT(locale, 'mapZoomIn'),
              zoomOut: orgFormT(locale, 'mapZoomOut'),
              attribution: orgFormT(locale, 'mapAttribution'),
              logo: orgFormT(locale, 'mapLogo'),
            }}
            onPlacedAtCenter={() => {
              focusConfirmAfterPlace.current = true
            }}
            approximate={pin?.status === 'draft' && pin.source === 'approximate'}
          />
        </div>
      )}
      <FieldErrorText id={errId} locale={locale} error={error} />
    </fieldset>
  )
}
