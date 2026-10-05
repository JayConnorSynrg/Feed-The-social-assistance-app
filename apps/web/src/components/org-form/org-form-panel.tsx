// apps/web/src/components/org-form/org-form-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Right-side panel holding the full organization setup form, opened from "Create organization"
// (create) or a row's Edit (edit, prefilled). Below 640px it is full-screen; above, 640px wide over
// a light overlay so the list stays visible. Header (title + close) / scrolling body / footer
// (Cancel, Save).
//
// Save runs exactly once per click (single-flight gate): new photos upload into
// org-photos/<orgId>/, then ONE admin_save_organization call writes the org, hours, photos and
// links atomically. Success -> removed photos are deleted, onSaved fires (the parent closes the
// panel and refreshes the list). Failure -> this attempt's uploads are deleted, a translated error
// shows inline, and the panel stays open with everything entered. onSaved and onOpenChange(false)
// are separate callbacks, so a save never runs the cancel path.
//
// Discard guard: while the form is dirty, Escape / close / Cancel open "Discard changes?" and an
// outside click does nothing.

'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { useForm, Controller, type FieldErrors, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ImagePlus, Loader2, MapPin, X } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { logEvent } from '@/lib/logger'
import { dir, type Locale } from '@/lib/i18n'
import { orgFormT, formatMessage, type OrgFormMessages } from '@/lib/i18n-org-forms'
import { NON_BUSINESS_ORG_TYPES } from '@/lib/org-vocab'
import { fetchAdminOrgDetail, fetchOrgNameIndex, type AdminOrgDetail, type OrgNameIndexRow } from '@/lib/org-data'
import { adminSaveOrganization } from '@/lib/org-admin-rpc'
import { ORG_PHOTO_ACCEPT, deleteOrgPhotos, isAcceptablePhoto, uploadOrgPhoto } from '@/lib/org-photo-upload'
import { createSingleFlight } from '@/components/feed/composer-guards'
import { ResourceDirectory } from './resource-directory'
import type { SelectedResource } from './resource-directory-model'
import { HoursEditor } from './hours-editor'
import { orgTypeKey } from './org-labels'
import {
  emptyFormValues,
  isLinkable,
  findSimilarOrgs,
  formValuesFromDetail,
  orgFormSchema,
  runOrgSave,
  type OrgFormKind,
  type OrgFormMode,
  type OrgFormValues,
  type PhotoItem,
  type PinState,
} from './org-form-model'

const OrgPinMap = dynamic(() => import('./org-pin-map'), { ssr: false })

export interface OrgFormPanelProps {
  open: boolean
  mode: OrgFormMode
  kind: OrgFormKind
  /** The org being edited (edit mode). */
  orgId: string | null
  locale: Locale
  /** Close WITHOUT saving (clean close or confirmed discard). Never called after a save. */
  onOpenChange: (open: boolean) => void
  /** A save succeeded. The parent closes the panel and refreshes its list. */
  onSaved: (result: { id: string; created: boolean; name: string }) => void
  /** "Edit existing" from the duplicate-name warning. */
  onEditExisting?: (id: string) => void
  /** A guarded close requested through the handle was declined ("Keep editing"). */
  onCloseRequestDeclined?: () => void
  /** Where focus goes when the panel closes (Save, Cancel, Escape, Back). */
  onCloseAutoFocus?: (event: Event) => void
  ref?: Ref<OrgFormPanelHandle>
}

/** Imperative handle: the parent asks for a guarded close (e.g. the phone Back button). */
export interface OrgFormPanelHandle {
  requestClose: () => void
}

type PendingAction = { type: 'close'; fromRequest: boolean } | { type: 'switch'; id: string }
type CloseResult = 'saved' | 'discarded' | 'abandoned'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const FIELD =
  'w-full rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500 aria-[invalid=true]:border-red-600 ' +
  FOCUS_RING
const INPUT = `h-10 ${FIELD}`
const LABEL = 'mb-1 block text-sm font-medium text-stone-800'
const PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ' +
  FOCUS_RING
const SECONDARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-500 bg-white px-4 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ' +
  FOCUS_RING
// Full-screen below 640px: keep header/footer clear of the notch and the home indicator.
const SAFE_TOP = 'pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3'
const SAFE_BOTTOM = 'pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3'
const ICON_BUTTON =
  'inline-flex h-10 w-10 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 ' + FOCUS_RING

export function OrgFormPanel(props: OrgFormPanelProps) {
  const { open, mode, kind, orgId, locale, onOpenChange, onSaved, onEditExisting, onCloseRequestDeclined, onCloseAutoFocus, ref } = props
  const tr = useCallback((key: keyof OrgFormMessages) => orgFormT(locale, key), [locale])

  // Guard state shared with the form inside (dirty flag + saving flag + view), held in refs so the
  // Sheet's onOpenChange always sees the latest values.
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const backToFormRef = useRef<(() => boolean) | null>(null)
  const metricsRef = useRef({ openedAt: 0, saveAttempts: 0, dirtyFields: '' })
  const [dirty, setDirty] = useState(false)
  const [pending, setPendingState] = useState<PendingAction | null>(null)
  // Radix calls onOpenChange(false) after an Action/Cancel click too, so the resolution is read from
  // a ref: each pending action resolves exactly once.
  const pendingRef = useRef<PendingAction | null>(null)
  // Where focus was when "Discard changes?" opened, restored on "Keep editing".
  const discardReturnRef = useRef<HTMLElement | null>(null)
  // After "Edit existing", the newly loaded form puts focus on its Name field.
  const focusNameAfterSwitch = useRef(false)
  const consumeFocusName = useCallback(() => {
    const v = focusNameAfterSwitch.current
    focusNameAfterSwitch.current = false
    return v
  }, [])
  const keptEditingRef = useRef(false)
  const setPending = useCallback((action: PendingAction | null) => {
    if (action && !pendingRef.current) {
      discardReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      keptEditingRef.current = false
    }
    pendingRef.current = action
    setPendingState(action)
  }, [])

  // A new panel session starts whenever it opens or switches target.
  useEffect(() => {
    if (!open) return
    metricsRef.current = { openedAt: Date.now(), saveAttempts: 0, dirtyFields: '' }
    dirtyRef.current = false
  }, [open, mode, orgId])

  const handleDirtyChange = useCallback((isDirty: boolean, fields: string) => {
    dirtyRef.current = isDirty
    metricsRef.current.dirtyFields = fields
    setDirty(isDirty)
  }, [])
  const handleSavingChange = useCallback((saving: boolean) => {
    savingRef.current = saving
  }, [])
  const handleSaveAttempt = useCallback(() => {
    metricsRef.current.saveAttempts += 1
  }, [])
  const registerBackToForm = useCallback((fn: (() => boolean) | null) => {
    backToFormRef.current = fn
  }, [])

  const logClose = useCallback(
    (result: CloseResult) => {
      const m = metricsRef.current
      logEvent('admin.org.panel.close', {
        mode,
        kind,
        result,
        duration_ms: m.openedAt ? Date.now() - m.openedAt : 0,
        save_attempts: m.saveAttempts,
        dirty_fields: m.dirtyFields,
      })
    },
    [mode, kind]
  )

  const requestClose = useCallback(
    (fromRequest = false) => {
      if (savingRef.current) return
      // In the directory sub-view, Escape / close returns to the form first.
      if (!fromRequest && backToFormRef.current?.()) return
      if (dirtyRef.current) {
        setPending({ type: 'close', fromRequest })
        return
      }
      logClose('abandoned')
      onOpenChange(false)
    },
    [logClose, onOpenChange, setPending]
  )
  const closeFromBody = useCallback(() => requestClose(), [requestClose])

  const requestSwitch = useCallback(
    (id: string) => {
      if (savingRef.current || !onEditExisting) return
      if (dirtyRef.current) {
        setPending({ type: 'switch', id })
        return
      }
      logClose('abandoned')
      focusNameAfterSwitch.current = true
      onEditExisting(id)
    },
    [logClose, onEditExisting, setPending]
  )

  // Parent-requested guarded close (phone Back).
  useImperativeHandle(ref, () => ({ requestClose: () => requestClose(true) }), [requestClose])

  const confirmDiscard = () => {
    const action = pendingRef.current
    setPending(null)
    if (!action) return
    logClose('discarded')
    if (action.type === 'switch') {
      focusNameAfterSwitch.current = true
      onEditExisting?.(action.id)
    }
    else onOpenChange(false)
  }
  const keepEditing = () => {
    const action = pendingRef.current
    if (!action) return
    keptEditingRef.current = true
    setPending(null)
    if (action.type === 'close' && action.fromRequest) onCloseRequestDeclined?.()
  }

  const handleSaved = useCallback(
    (result: { id: string; created: boolean; name: string }) => {
      dirtyRef.current = false
      logClose('saved')
      onSaved(result)
    },
    [logClose, onSaved]
  )

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? undefined : requestClose())}>
        <SheetContent
          dir={dir(locale)}
          lang={locale}
          onCloseAutoFocus={onCloseAutoFocus}
          side="right"
          hideDefaultClose
          disableOutsideClose={dirty}
          overlayClassName="bg-stone-900/20"
          aria-describedby={undefined}
          className="w-full max-w-none gap-0 bg-stone-50 p-0 sm:w-[640px] sm:max-w-[640px]"
        >
          {open && (
            <OrgFormBody
              key={`${mode}:${orgId ?? 'new'}`}
              mode={mode}
              kind={kind}
              orgId={orgId}
              locale={locale}
              tr={tr}
              requestClose={closeFromBody}
              requestSwitch={onEditExisting ? requestSwitch : undefined}
              onDirtyChange={handleDirtyChange}
              onSavingChange={handleSavingChange}
              onSaveAttempt={handleSaveAttempt}
              registerBackToForm={registerBackToForm}
              consumeFocusName={consumeFocusName}
              onSaved={handleSaved}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={pending !== null} onOpenChange={(o) => (o ? undefined : keepEditing())}>
        <AlertDialogContent
          dir={dir(locale)}
          lang={locale}
          onCloseAutoFocus={(e) => {
            // "Keep editing": back to where the admin was. "Discard": the panel's own close handles focus.
            e.preventDefault()
            const target = discardReturnRef.current
            if (keptEditingRef.current && target?.isConnected) target.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tr('discardBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('discardKeep')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} className="bg-red-700 hover:bg-red-800">
              {tr('discardConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Body: loads the edit target, then renders the form.
// ---------------------------------------------------------------------------------------------

interface BodyProps {
  mode: OrgFormMode
  kind: OrgFormKind
  orgId: string | null
  locale: Locale
  tr: (key: keyof OrgFormMessages) => string
  requestClose: () => void
  requestSwitch?: (id: string) => void
  onDirtyChange: (dirty: boolean, fields: string) => void
  onSavingChange: (saving: boolean) => void
  onSaveAttempt: () => void
  registerBackToForm: (fn: (() => boolean) | null) => void
  /** True once, right after "Edit existing" switched to this org. */
  consumeFocusName: () => boolean
  onSaved: (result: { id: string; created: boolean; name: string }) => void
}

function OrgFormBody(props: BodyProps) {
  const { mode, orgId, tr } = props
  const supabase = useMemo(() => createClient(), [])
  const [detail, setDetail] = useState<AdminOrgDetail | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(mode === 'edit' ? 'loading' : 'ready')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (mode !== 'edit' || !orgId) return
    let cancelled = false
    fetchAdminOrgDetail(supabase, orgId).then(
      (d) => {
        if (cancelled) return
        setDetail(d)
        setLoadState(d ? 'ready' : 'error')
      },
      () => {
        if (!cancelled) setLoadState('error')
      }
    )
    return () => {
      cancelled = true
    }
  }, [supabase, mode, orgId, retry])

  if (loadState !== 'ready') {
    return (
      <>
        <PanelHeader title={tr(mode === 'create' ? 'panelCreateTitle' : 'panelLoading')} tr={tr} onClose={props.requestClose} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-stone-700" aria-live="polite">
          {loadState === 'loading' ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-stone-500" aria-hidden="true" />
              {tr('panelLoading')}
            </>
          ) : (
            <>
              <p role="alert" className="text-red-700">{tr('panelLoadError')}</p>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => {
                  setLoadState('loading')
                  setRetry((n) => n + 1)
                }}
              >
                {tr('listRetry')}
              </button>
            </>
          )}
        </div>
      </>
    )
  }
  return <OrgForm {...props} detail={detail} supabase={supabase} />
}

function PanelHeader({
  title,
  tr,
  onClose,
  leading,
}: {
  title: string
  tr: (key: keyof OrgFormMessages) => string
  /** Omitted in the directory sub-view, where Back is the way out. */
  onClose?: () => void
  leading?: ReactNode
}) {
  return (
    <div className={`flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 ${SAFE_TOP}`}>
      {leading}
      <SheetTitle className="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900">{title}</SheetTitle>
      {onClose && (
        <button type="button" className={ICON_BUTTON} aria-label={tr('panelClose')} onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 id={id} className="mb-3 text-base font-semibold text-stone-900">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// The form.
// ---------------------------------------------------------------------------------------------

type GeoState = 'idle' | 'finding' | 'none' | 'need_street' | 'unavailable'

function OrgForm(props: BodyProps & { detail: AdminOrgDetail | null; supabase: ReturnType<typeof createClient> }) {
  const { mode, locale, tr, detail, supabase, requestClose, requestSwitch, onDirtyChange, onSavingChange, onSaveAttempt, registerBackToForm, onSaved } = props
  const uid = useId()
  const formId = `${uid}-form`

  const initial = useMemo(() => (detail ? formValuesFromDetail(detail) : { values: emptyFormValues(), droppedZeroLength: 0 }), [detail])
  // The org id is fixed for the life of this panel: an existing org's id, or one generated up front
  // so photos can upload into its folder before the first save.
  const [orgId] = useState(() => detail?.id ?? crypto.randomUUID())
  const hadLocation = Boolean(detail?.location)

  const form = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema) as unknown as Resolver<OrgFormValues>,
    defaultValues: initial.values,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })
  const { register, control, handleSubmit, watch, setValue, getValues, setError, setFocus, formState } = form
  useEffect(() => {
    if (props.consumeFocusName()) setFocus('name')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when this org's form mounts
  }, [])
  const { errors, isDirty, dirtyFields } = formState

  // Report dirty state + the dirty field names (closed vocabulary) to the guard.
  const dirtyKeys = Object.keys(dirtyFields).sort().join(',')
  useEffect(() => {
    onDirtyChange(isDirty, dirtyKeys)
  }, [isDirty, dirtyKeys, onDirtyChange])

  // ---- sub-view: resource directory ----------------------------------------------------------
  const [view, setView] = useState<'form' | 'directory'>('form')
  const [draftResources, setDraftResources] = useState<SelectedResource[]>([])
  // Leaving the directory returns focus to "Browse directory" (the directory focuses its own search).
  const browseRef = useRef<HTMLButtonElement>(null)
  const cameFromDirectory = useRef(false)
  useEffect(() => {
    if (view === 'directory') {
      cameFromDirectory.current = true
      return
    }
    if (cameFromDirectory.current) {
      cameFromDirectory.current = false
      browseRef.current?.focus()
    }
  }, [view])
  useEffect(() => {
    registerBackToForm(() => {
      if (view !== 'directory') return false
      setView('form')
      return true
    })
    return () => registerBackToForm(null)
  }, [view, registerBackToForm])

  // ---- blob previews: revoke everything this panel created when it unmounts ------------------
  const blobUrls = useRef<string[]>([])
  useEffect(() => {
    const urls = blobUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // ---- duplicate-name warning ----------------------------------------------------------------
  const [nameIndex, setNameIndex] = useState<OrgNameIndexRow[]>([])
  const [dupes, setDupes] = useState<OrgNameIndexRow[]>([])
  useEffect(() => {
    let cancelled = false
    fetchOrgNameIndex(supabase).then(
      (rows) => !cancelled && setNameIndex(rows),
      () => undefined
    )
    return () => {
      cancelled = true
    }
  }, [supabase])
  const checkDuplicates = () => {
    const matches = findSimilarOrgs(getValues('name'), nameIndex, detail?.id ?? orgId)
    if (matches.length > 0 && dupes.length === 0) logEvent('admin.org.duplicate_warning', { action: 'shown' })
    setDupes(matches)
  }

  // ---- location / pin -------------------------------------------------------------------------
  const pin = watch('pin')
  const [geo, setGeo] = useState<GeoState>('idle')
  const [recenterKey, setRecenterKey] = useState(0)
  const setPin = (next: PinState) => setValue('pin', next, { shouldDirty: true, shouldValidate: formState.isSubmitted })
  const findOnMap = async () => {
    const street = getValues('address').trim()
    if (!street) {
      setGeo('need_street')
      return
    }
    setGeo('finding')
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street, city: getValues('city'), state: getValues('state'), zip: getValues('zip_code') }),
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
      setPin({ status: 'draft', lng: r.lng, lat: r.lat, source: r.match === 'exact' ? 'exact' : 'approximate' })
      setGeo('idle')
      setRecenterKey((k) => k + 1)
    } catch {
      setGeo('unavailable')
    }
  }
  // A click or drag always yields a draft the person must confirm; an exact match stays 'exact'
  // after a nudge, an approximate one becomes a manual placement.
  const placePin = (coords: { lng: number; lat: number }) => {
    setPin({ status: 'draft', ...coords, source: pin.status === 'draft' && pin.source === 'exact' ? 'exact' : 'manual' })
    setGeo('idle')
  }
  // After "Place pin at map center", focus moves to "Confirm pin" once it renders.
  const focusConfirmAfterPlace = useRef(false)
  useEffect(() => {
    if (!focusConfirmAfterPlace.current || pin.status !== 'draft') return
    focusConfirmAfterPlace.current = false
    confirmPinRef.current?.focus()
  }, [pin])
  const pinCoords = pin.status === 'none' || pin.status === 'removed' ? null : { lng: pin.lng, lat: pin.lat }
  const pinMessage = (() => {
    if (geo === 'finding') return tr('locFinding')
    if (pin.status === 'draft') {
      if (pin.source === 'approximate') return tr('locApprox')
      if (pin.source === 'exact') return tr('locExact')
      return tr('locDraftManual')
    }
    if (pin.status === 'confirmed') return tr('locConfirmed')
    if (pin.status === 'saved') return tr('locSaved')
    if (pin.status === 'removed') return tr('locRemoved')
    if (geo === 'need_street') return tr('locNeedStreet')
    if (geo === 'none') return tr('locNone')
    if (geo === 'unavailable') return tr('locUnavailable')
    return tr('locNoPin')
  })()

  // ---- photos -------------------------------------------------------------------------------
  const [photoError, setPhotoError] = useState<string | null>(null)
  const makeItem = (file: File): PhotoItem | null => {
    if (!isAcceptablePhoto(file)) {
      setPhotoError(tr('photoInvalid'))
      return null
    }
    setPhotoError(null)
    const previewUrl = URL.createObjectURL(file)
    blobUrls.current.push(previewUrl)
    return { key: `new:${crypto.randomUUID()}`, source: 'new', file, previewUrl }
  }

  // ---- save ----------------------------------------------------------------------------------
  const flight = useRef(createSingleFlight())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Server-side 22023 field errors show on the field itself (and take focus) when one matches.
  const FIELD_ERRORS: Partial<Record<keyof OrgFormMessages, { field: 'name' | 'email' | 'website'; message: keyof OrgFormMessages }>> = {
    saveErrName: { field: 'name', message: 'errNameRequired' },
    saveErrEmail: { field: 'email', message: 'errEmailInvalid' },
    saveErrWebsite: { field: 'website', message: 'errWebsiteInvalid' },
  }
  const showSaveError = (key: keyof OrgFormMessages) => {
    setSaveError(tr(key))
    const fieldError = FIELD_ERRORS[key]
    if (fieldError) setError(fieldError.field, { type: 'server', message: fieldError.message }, { shouldFocus: true })
  }

  const save = async (values: OrgFormValues) => {
    let ran = false
    try {
      const outcome = await runOrgSave({
        orgId,
        values,
        hadLocation,
        flight: flight.current,
        onStart: () => {
          ran = true
          onSaveAttempt()
          setSaving(true)
          onSavingChange(true)
          setSaveError(null)
        },
        deps: {
          upload: (file) => uploadOrgPhoto(supabase, orgId, file),
          save: (payload) => adminSaveOrganization(supabase, orgId, payload, mode),
          remove: (paths) => deleteOrgPhotos(supabase, orgId, paths),
        },
      })
      if (!outcome) return
      if (!outcome.ok) {
        showSaveError(outcome.errorKey)
        return
      }
      if (dupes.length > 0) logEvent('admin.org.duplicate_warning', { action: 'ignored' })
      onSaved({ id: outcome.result.id, created: outcome.result.created, name: outcome.payload.name })
    } finally {
      if (ran) {
        setSaving(false)
        onSavingChange(false)
      }
    }
  }

  // Client-side errors: name/email/website are focused by react-hook-form; hours focus their first
  // invalid control (through the Controller ref); an unconfirmed pin focuses "Confirm pin".
  const hoursSectionRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)
  const confirmPinRef = useRef<HTMLButtonElement>(null)
  const focusFirstInvalidHours = () => {
    hoursSectionRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }
  const onInvalid = (errs: FieldErrors<OrgFormValues>) => {
    const firstKey = (errs.resources?.root?.message ?? errs.resources?.message ?? errs.hours?.root?.message ?? errs.hours?.message ?? errs.pin?.message) as keyof OrgFormMessages | undefined
    setSaveError(firstKey ? tr(firstKey) : null)
    if (errs.name || errs.email || errs.website) return
    if (errs.hours) focusFirstInvalidHours()
    else if (errs.pin) confirmPinRef.current?.focus()
    else if (errs.resources) resourcesRef.current?.querySelector<HTMLElement>('button')?.focus()
  }
  const submit = handleSubmit((values) => void save(values), onInvalid)

  const errText = (key: unknown): string | null => (typeof key === 'string' && key ? tr(key as keyof OrgFormMessages) : null)
  const resources = watch('resources')
  const title =
    view === 'directory'
      ? tr('resDirectoryTitle')
      : mode === 'create'
        ? tr('panelCreateTitle')
        : formatMessage(tr('panelEditTitle'), { name: detail?.name ?? '' })

  // ---- render --------------------------------------------------------------------------------
  if (view === 'directory') {
    const back = () => setView('form')
    const done = () => {
      setValue('resources', draftResources, { shouldDirty: true })
      setView('form')
    }
    return (
      <>
        <PanelHeader
          title={title}
          tr={tr}
          leading={
            <button type="button" className={ICON_BUTTON} aria-label={tr('resBack')} onClick={back}>
              <ArrowLeft className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </button>
          }
        />
        <div className="flex-1 overflow-y-auto p-4">
          <ResourceDirectory
            key={orgId}
            autoFocusSearch
            value={draftResources}
            onChange={setDraftResources}
            defaultState={getValues('state')}
            defaultCity={getValues('city')}
            locale={locale}
          />
        </div>
        <div className={`flex justify-end gap-2 border-t border-stone-200 bg-white px-4 py-3 ${SAFE_BOTTOM}`}>
          <button type="button" className={SECONDARY} onClick={back}>
            {tr('resBack')}
          </button>
          <button type="button" className={PRIMARY} onClick={done}>
            {tr('resDone')}
          </button>
        </div>
      </>
    )
  }

  const nameErr = errText(errors.name?.message)
  const emailErr = errText(errors.email?.message)
  const websiteErr = errText(errors.website?.message)
  const hoursErr = errText(errors.hours?.root?.message ?? errors.hours?.message)
  const pinErr = errText(errors.pin?.message)
  const resourcesErr = errText(errors.resources?.root?.message ?? errors.resources?.message)

  return (
    <>
      <PanelHeader title={title} tr={tr} onClose={requestClose} />
      <form id={formId} noValidate onSubmit={submit} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <Section title={tr('secBasics')}>
            <div>
              <label htmlFor={`${uid}-name`} className={LABEL}>
                {tr('fieldName')} <span className="font-normal text-stone-600">({tr('fieldRequired')})</span>
              </label>
              <input
                id={`${uid}-name`}
                className={INPUT}
                autoComplete="off"
                aria-required="true"
                aria-invalid={nameErr ? true : undefined}
                aria-describedby={nameErr ? `${uid}-name-err` : dupes.length ? `${uid}-dupe` : undefined}
                {...register('name', { onBlur: checkDuplicates })}
              />
              {nameErr && (
                <p id={`${uid}-name-err`} className="mt-1 text-sm text-red-700">
                  {nameErr}
                </p>
              )}
              {/* Always mounted so the polite status announces when its text appears. */}
              <div
                id={`${uid}-dupe`}
                role="status"
                className={dupes.length > 0 ? 'mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900' : 'sr-only'}
              >
                {dupes.length > 0 && <p>{formatMessage(tr('dupWarning'), { name: dupes[0].name })}</p>}
                {dupes.length > 0 && requestSwitch && dupes[0].org_type !== 'business' && (
                    <button
                      type="button"
                      className={`mt-2 ${SECONDARY}`}
                      onClick={() => {
                        logEvent('admin.org.duplicate_warning', { action: 'used_existing' })
                        requestSwitch(dupes[0].id)
                      }}
                    >
                      {tr('dupEditExisting')}
                    </button>
                  )}
              </div>
            </div>
            <div>
              <label htmlFor={`${uid}-type`} className={LABEL}>
                {tr('fieldType')}
              </label>
              <select id={`${uid}-type`} className={INPUT} {...register('org_type')}>
                {NON_BUSINESS_ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {tr(orgTypeKey(t))}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-desc`} className={LABEL}>
                {tr('fieldDescription')} <span className="font-normal text-stone-600">({tr('fieldOptional')})</span>
              </label>
              <textarea id={`${uid}-desc`} rows={3} className={`${FIELD} py-2`} {...register('description')} />
            </div>
          </Section>

          <Section title={tr('secContact')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-phone`} className={LABEL}>
                  {tr('fieldPhone')}
                </label>
                <input id={`${uid}-phone`} type="tel" autoComplete="off" className={INPUT} {...register('phone')} />
              </div>
              <div>
                <label htmlFor={`${uid}-email`} className={LABEL}>
                  {tr('fieldEmail')}
                </label>
                <input
                  id={`${uid}-email`}
                  type="email"
                  autoComplete="off"
                  className={INPUT}
                  aria-invalid={emailErr ? true : undefined}
                  aria-describedby={emailErr ? `${uid}-email-err` : undefined}
                  {...register('email')}
                />
                {emailErr && (
                  <p id={`${uid}-email-err`} className="mt-1 text-sm text-red-700">
                    {emailErr}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label htmlFor={`${uid}-web`} className={LABEL}>
                {tr('fieldWebsite')}
              </label>
              <input
                id={`${uid}-web`}
                type="url"
                inputMode="url"
                placeholder="https://"
                className={INPUT}
                aria-invalid={websiteErr ? true : undefined}
                aria-describedby={websiteErr ? `${uid}-web-err` : undefined}
                {...register('website')}
              />
              {websiteErr && (
                <p id={`${uid}-web-err`} className="mt-1 text-sm text-red-700">
                  {websiteErr}
                </p>
              )}
            </div>
          </Section>

          <Section title={tr('secLocation')}>
            <div>
              <label htmlFor={`${uid}-street`} className={LABEL}>
                {tr('fieldStreet')}
              </label>
              <input id={`${uid}-street`} autoComplete="off" className={INPUT} {...register('address')} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <div>
                <label htmlFor={`${uid}-city`} className={LABEL}>
                  {tr('fieldCity')}
                </label>
                <input id={`${uid}-city`} autoComplete="off" className={INPUT} {...register('city')} />
              </div>
              <div>
                <label htmlFor={`${uid}-state`} className={LABEL}>
                  {tr('fieldState')}
                </label>
                <input id={`${uid}-state`} autoComplete="off" className={INPUT} {...register('state')} />
              </div>
              <div>
                <label htmlFor={`${uid}-zip`} className={LABEL}>
                  {tr('fieldZip')}
                </label>
                <input id={`${uid}-zip`} autoComplete="off" inputMode="numeric" className={INPUT} {...register('zip_code')} />
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
                {tr('locFind')}
              </button>
              {pin.status === 'draft' && (
                <button
                  ref={confirmPinRef}
                  type="button"
                  className={PRIMARY}
                  aria-describedby={pinErr ? `${uid}-pin-err` : undefined}
                  onClick={() => {
                    setPin({ status: 'confirmed', lng: pin.lng, lat: pin.lat })
                  }}
                >
                  {tr('locConfirm')}
                </button>
              )}
              {pinCoords && (
                <button
                  type="button"
                  className={SECONDARY}
                  onClick={() => {
                    setPin(hadLocation ? { status: 'removed' } : { status: 'none' })
                    setGeo('idle')
                  }}
                >
                  {tr('locRemove')}
                </button>
              )}
            </div>
            <p
              role="status"
              className={`text-sm ${pin.status === 'draft' && pin.source === 'approximate' ? 'font-medium text-amber-800' : 'text-stone-700'}`}
            >
              {pinMessage}
            </p>
            <OrgPinMap
              pin={pinCoords}
              recenterKey={recenterKey}
              onPlace={placePin}
              label={tr('mapTitle')}
              instructions={tr('locMapLabel')}
              placeCenterLabel={tr('locPlaceCenter')}
              mapLocale={{ title: tr('mapTitle'), zoomIn: tr('mapZoomIn'), zoomOut: tr('mapZoomOut') }}
              onPlacedAtCenter={() => {
                focusConfirmAfterPlace.current = true
              }}
              approximate={pin.status === 'draft' && pin.source === 'approximate'}
            />
            {pinErr && (
              <p id={`${uid}-pin-err`} className="text-sm text-red-700">
                {pinErr}
              </p>
            )}
          </Section>

          <Section title={tr('secHours')}>
            <div ref={hoursSectionRef}>
            <Controller
              control={control}
              name="hours"
              render={({ field }) => {
                // react-hook-form focuses an errored field through its ref: point it at the first
                // invalid hours control.
                field.ref({ focus: focusFirstInvalidHours })
                return (
                <HoursEditor
                  value={field.value}
                  onChange={field.onChange}
                  locale={locale}
                  notice={initial.droppedZeroLength > 0 ? tr('hoursDroppedZero') : null}
                />
                )
              }}
            />
            </div>
            {hoursErr && <p className="text-sm text-red-700">{hoursErr}</p>}
          </Section>

          <Section title={tr('secPhotos')}>
            <p className="text-sm text-stone-600">{tr('photoHint')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(['logo', 'cover'] as const).map((slot) => (
                <Controller
                  key={slot}
                  control={control}
                  name={slot}
                  render={({ field }) => (
                    <SinglePhoto
                      label={tr(slot === 'logo' ? 'photoLogo' : 'photoCover')}
                      item={field.value}
                      tr={tr}
                      onPick={(file) => {
                        const item = makeItem(file)
                        if (item) field.onChange(item)
                      }}
                      onRemove={() => field.onChange(null)}
                    />
                  )}
                />
              ))}
            </div>
            <Controller
              control={control}
              name="gallery"
              render={({ field }) => (
                <GalleryPhotos
                  items={field.value}
                  tr={tr}
                  onAdd={(files) => {
                    const items = files.map(makeItem).filter((i): i is PhotoItem => i !== null)
                    if (items.length) field.onChange([...field.value, ...items])
                  }}
                  onRemove={(key) => field.onChange(field.value.filter((g) => g.key !== key))}
                />
              )}
            />
            {photoError && (
              <p role="alert" className="text-sm text-red-700">
                {photoError}
              </p>
            )}
          </Section>

          <Section title={tr('secResources')}>
            <div ref={resourcesRef} className="flex flex-col gap-3">
            {resources.length === 0 ? (
              <p className="text-sm text-stone-600">{tr('resNone')}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-stone-800">{formatMessage(tr('resCount'), { count: resources.length })}</p>
                <ol className="flex flex-col gap-1 text-sm text-stone-800">
                  {resources.map((r) => {
                    const stale = !isLinkable(r)
                    return (
                      <li
                        key={r.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${stale ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}
                      >
                        <span className="min-w-0 flex-1 truncate">{r.name}</span>
                        {stale && (
                          <>
                            <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                              {tr('resNotApproved')}
                            </span>
                            <button
                              type="button"
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-700 hover:bg-amber-100 ${FOCUS_RING}`}
                              aria-label={formatMessage(tr('dirRemove'), { name: r.name })}
                              onClick={() =>
                                setValue(
                                  'resources',
                                  getValues('resources').filter((x) => x.id !== r.id),
                                  { shouldDirty: true, shouldValidate: formState.isSubmitted }
                                )
                              }
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
            <div>
              <button
                ref={browseRef}
                type="button"
                className={SECONDARY}
                onClick={() => {
                  setDraftResources(getValues('resources'))
                  setView('directory')
                }}
              >
                {tr('resBrowse')}
              </button>
            </div>
            {resourcesErr && <p className="text-sm text-red-700">{resourcesErr}</p>}
            </div>
          </Section>
        </div>
      </form>
      <div className={`flex flex-col gap-2 border-t border-stone-200 bg-white px-4 py-3 ${SAFE_BOTTOM}`}>
        <p aria-live="assertive" className="text-sm text-red-700 empty:hidden">
          {saveError}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={SECONDARY}
            aria-disabled={saving || undefined}
            onClick={() => {
              if (!saving) requestClose()
            }}
          >
            {tr('panelCancel')}
          </button>
          <button
            type="submit"
            form={formId}
            className={PRIMARY}
            aria-disabled={saving || undefined}
            aria-busy={saving || undefined}
            onClick={(e) => {
              // Stays focusable while saving; a second press is ignored (and single-flighted anyway).
              if (saving) e.preventDefault()
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? tr('panelSaving') : tr('panelSave')}
          </button>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Photo pickers (files are kept locally with blob: previews; nothing uploads until Save).
// ---------------------------------------------------------------------------------------------

function previewOf(item: PhotoItem): string {
  return item.source === 'existing' ? item.url : item.previewUrl
}

function SinglePhoto({
  label,
  item,
  tr,
  onPick,
  onRemove,
}: {
  label: string
  item: PhotoItem | null
  tr: (key: keyof OrgFormMessages) => string
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <div className="flex items-center gap-3">
        {item ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: previews and storage URLs
          <img src={previewOf(item)} alt={formatMessage(tr('photoPreviewAlt'), { label })} className="h-16 w-16 rounded-lg border border-stone-200 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-stone-300 text-stone-500">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY} onClick={() => inputRef.current?.click()}>
            {item ? tr('photoReplace') : tr('photoChoose')}
            <span className="sr-only">{` ${label}`}</span>
          </button>
          {item && (
            <button type="button" className={SECONDARY} onClick={onRemove} aria-label={formatMessage(tr('photoRemoveNamed'), { label })}>
              {tr('photoRemove')}
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ORG_PHOTO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPick(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

function GalleryPhotos({
  items,
  tr,
  onAdd,
  onRemove,
}: {
  items: PhotoItem[]
  tr: (key: keyof OrgFormMessages) => string
  onAdd: (files: File[]) => void
  onRemove: (key: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = tr('photoGallery')
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const name = `${label} ${i + 1}`
          return (
            <li key={item.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: previews and storage URLs */}
              <img src={previewOf(item)} alt={formatMessage(tr('photoPreviewAlt'), { label: name })} className="h-20 w-20 rounded-lg border border-stone-200 object-cover" />
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                aria-label={formatMessage(tr('photoRemoveNamed'), { label: name })}
                className={`absolute -end-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-100 ${FOCUS_RING}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className={`mt-2 ${SECONDARY}`} onClick={() => inputRef.current?.click()}>
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
        {tr('photoAdd')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ORG_PHOTO_ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onAdd(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
