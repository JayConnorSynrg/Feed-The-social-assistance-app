'use client'

// apps/web/src/components/forms/form-wizard.tsx
//
// P6 W9: the wizard's own words — the step line, Back / Next / Review / Submit Application / Cancel,
// the autofill banner, the review note, Yes / No, the select prompt, the address part labels and
// the e-signature prompt and consent line — are in the member's language (lib/i18n-forms.ts), with
// lang/dir on the root. A template's own text (its name, section headings and descriptions, field
// labels, hints, placeholders and option labels) mirrors official English forms and stays as
// written, marked lang="en" (owner decision pending). What the member types is their own text.
// Field names, option values, autofill keys and the submitted data are the same in every language.
// Focus: the form's heading when it opens, each step's heading when the step changes; Back, Next
// and Submit stay focusable while busy (aria-disabled, a press does nothing).

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFormTemplate } from '@/hooks/use-form-templates'
import { useVaultFormSubmission } from '@/hooks/use-vault-form-submission'
import { getVisibleFields } from '@/lib/form-schemas'
import type { FormFieldSchema, FormSection } from '@/lib/form-schemas'
import { useVaultSecureProfile } from '@/hooks/use-vault-secure-profile'
import { useVault } from '@/contexts/vault-context'
import { useAuth } from '@/hooks/use-auth'
import { mapProfileToAutofill } from '@/lib/form-field-mapper'
import { logger } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatCount } from '@/lib/i18n-intl'
import { formsT, type FormsKey } from '@/lib/i18n-forms'
import { cn } from '@/lib/utils'
import { OFFICIAL_ENGLISH } from '@/lib/official-english'
import { AnnouncementText, announce, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

/** The browser's autofill token for a personal field, by its (unchanged) field name. */
const AUTOCOMPLETE: Record<string, string> = {
  first_name: 'given-name',
  last_name: 'family-name',
  middle_name: 'additional-name',
  email: 'email',
  phone: 'tel',
  date_of_birth: 'bday',
}

/** A busy or unavailable button keeps focus (aria-disabled) and reads as unavailable in solid colours. */
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'
const INPUT = 'border-stone-500 text-stone-900 placeholder:text-stone-600'

export interface FormWizardProps {
  templateId: string
  existingSubmissionId?: string
  onComplete: () => void
  onCancel: () => void
}

function getInputType(type: FormFieldSchema['type']): string {
  switch (type) {
    case 'email': return 'email'
    case 'phone': return 'tel'
    case 'number':
    case 'currency': return 'number'
    case 'date': return 'date'
    case 'ssn': return 'password'
    default: return 'text'
  }
}

/** The label's "required" mark: a visible star, and the word in the member's language for a
 *  screen reader (the label around it is the template's English). */
function RequiredMark({ locale }: { locale: Locale }) {
  return (
    <>
      <span className="text-red-700 ms-1" aria-hidden="true">*</span>
      <span className="sr-only" lang={locale} dir={dir(locale)}> ({formsT(locale, 'requiredMark')})</span>
    </>
  )
}

/** A review value and its language: the template's option label is English, Yes / No are the
 *  member's language, anything typed is the member's own text. */
/** Nothing entered: empty, unset, or an address with no part filled in. */
function isUnanswered(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every((v) => v === undefined || v === null || v === '')
  return false
}

function reviewValue(field: FormFieldSchema, value: unknown, locale: Locale): { text: string; lang: string } {
  if (value === undefined || value === null || value === '') return { text: '—', lang: '' }
  if (field.sensitive) return { text: '••••••••', lang: '' }
  if (typeof value === 'object' && value !== null) {
    const addr = value as Record<string, string>
    return {
      text: [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
      lang: '',
    }
  }
  if (typeof value === 'boolean') return { text: formsT(locale, value ? 'yes' : 'no'), lang: locale }
  if (field.options) {
    const opt = field.options.find((o) => o.value === String(value))
    return opt ? { text: opt.label, lang: OFFICIAL_ENGLISH.lang } : { text: String(value), lang: '' }
  }
  return { text: String(value), lang: '' }
}

function ReviewStep({
  sections,
  allFields,
  values,
  locale,
}: {
  sections: FormSection[]
  allFields: FormFieldSchema[]
  values: Record<string, unknown>
  locale: Locale
}) {
  const fieldMap = new Map(allFields.map((f) => [f.name, f]))
  const [before, after] = splitMessage(formsT(locale, 'reviewIntro'), 'back')

  return (
    <div className="space-y-6">
      <div className="p-4 bg-[#f0ede6] rounded-xl border border-stone-300">
        <p className="text-sm text-stone-800">
          {before}{formsT(locale, 'back')}{after}
        </p>
      </div>
      {sections.map((section) => {
        const sectionFields = section.fields
          .map((id) => allFields.find((f) => f.id === id))
          .filter((f): f is FormFieldSchema => f !== undefined)
          // Answered fields, and every required one (unanswered shows "—" and says so).
          .filter((f) => f.required || (values[f.name] !== undefined && values[f.name] !== ''))

        if (sectionFields.length === 0) return null

        return (
          <div key={section.id} className="space-y-3">
            <h3 className="font-semibold text-sm text-stone-900 border-b border-stone-300 pb-1.5" {...OFFICIAL_ENGLISH}>
              {section.title}
            </h3>
            <dl className="space-y-2">
              {sectionFields.map((field) => {
                const f = fieldMap.get(field.name)
                if (!f) return null
                const shown = reviewValue(f, values[f.name], locale)
                const unanswered = isUnanswered(values[f.name])
                return (
                  <div key={field.id} className="flex flex-col gap-0.5" data-unanswered={unanswered || undefined}>
                    <dt className="text-xs text-stone-700" {...OFFICIAL_ENGLISH}>{f.label}</dt>
                    {unanswered ? (
                      <dd className="text-sm text-stone-900 font-medium">
                        <span aria-hidden="true">—</span>{' '}
                        <span className="text-xs font-normal text-red-700">{formsT(locale, 'notAnswered')}</span>
                      </dd>
                    ) : (
                      <dd className="text-sm text-stone-900 font-medium" lang={shown.lang} dir={shown.lang === OFFICIAL_ENGLISH.lang ? OFFICIAL_ENGLISH.dir : shown.lang === locale ? dir(locale) : 'auto'}>
                        {shown.text}
                      </dd>
                    )}
                  </div>
                )
              })}
            </dl>
          </div>
        )
      })}
    </div>
  )
}

type FormMethods = ReturnType<typeof useForm>

function StepFields({
  section,
  allFields,
  register,
  control,
  errors,
  disabled,
  locale,
}: {
  section: FormSection
  allFields: FormFieldSchema[]
  register: FormMethods['register']
  control: FormMethods['control']
  errors: FormMethods['formState']['errors']
  disabled: boolean
  locale: Locale
}) {
  const t = (key: FormsKey) => formsT(locale, key)
  const sectionFieldDefs = section.fields
    .map((id) => allFields.find((f) => f.id === id))
    .filter((f): f is FormFieldSchema => f !== undefined)
  // Each field's label, hint and placeholder are the template's (official English) text.
  const req = (field: FormFieldSchema) => (field.required ? { required: true, 'aria-required': true as const } : {})
  const hintId = (field: FormFieldSchema) => (field.helpText ? `${field.id}-hint` : undefined)
  const hint = (field: FormFieldSchema, className = 'text-xs text-stone-700') =>
    field.helpText ? <p id={`${field.id}-hint`} className={className} {...OFFICIAL_ENGLISH}>{field.helpText}</p> : null
  const fieldLabel = (field: FormFieldSchema, { htmlFor, id, className }: { htmlFor?: string; id?: string; className?: string } = {}) => (
    <Label htmlFor={htmlFor} id={id} className={className}>
      <span {...OFFICIAL_ENGLISH}>{field.label}</span>
      {field.required && <RequiredMark locale={locale} />}
    </Label>
  )

  return (
    <div className="space-y-5">
      {sectionFieldDefs.map((field) => {
        const error = errors[field.name]?.message as string | undefined

        if (field.type === 'textarea') {
          return (
            <div key={field.id} className="space-y-2">
              {fieldLabel(field, { htmlFor: field.id })}
              <textarea
                id={field.id}
                placeholder={field.placeholder}
                readOnly={disabled}
                aria-disabled={disabled || undefined}
                lang=""
                dir="auto"
                aria-describedby={hintId(field)}
                {...req(field)}
                className="flex min-h-[100px] w-full rounded-md border border-stone-500 bg-background px-3 py-2 text-sm text-stone-900 ring-offset-background placeholder:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register(field.name)}
              />
              {hint(field)}
              {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
            </div>
          )
        }

        if (field.type === 'select' || field.type === 'multiselect') {
          return (
            <div key={field.id} className="space-y-2">
              {fieldLabel(field, { htmlFor: field.id })}
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  <Select
                    value={formField.value as string}
                    onValueChange={(v) => { if (!disabled) formField.onChange(v) }}
                  >
                    {/* The chosen option and the template's placeholder are English; FEED's own
                        "Select..." prompt is the member's language. */}
                    <SelectTrigger
                      id={field.id}
                      aria-disabled={disabled || undefined}
                      aria-describedby={hintId(field)}
                      aria-required={field.required || undefined}
                      {...(formField.value || field.placeholder ? OFFICIAL_ENGLISH : { lang: locale, dir: dir(locale) })}
                      className="border-stone-500"
                    >
                      <SelectValue placeholder={field.placeholder || t('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {hint(field)}
              {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
            </div>
          )
        }

        if (field.type === 'checkbox') {
          return (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: formField }) => (
                    <Checkbox
                      id={field.id}
                      checked={formField.value as boolean}
                      onCheckedChange={(v) => { if (!disabled) formField.onChange(v) }}
                      aria-disabled={disabled || undefined}
                      aria-describedby={hintId(field)}
                      aria-required={field.required || undefined}
                    />
                  )}
                />
                {fieldLabel(field, { htmlFor: field.id, className: 'font-normal cursor-pointer' })}
              </div>
              {hint(field, 'text-xs text-stone-700 ps-6')}
              {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
            </div>
          )
        }

        if (field.type === 'radio') {
          return (
            <div key={field.id} className="space-y-3">
              {fieldLabel(field, { id: `${field.id}-label` })}
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  // An APG radio group of native radios: one Tab stop, arrow keys move and choose.
                  <div
                    role="radiogroup"
                    aria-labelledby={`${field.id}-label`}
                    aria-describedby={hintId(field)}
                    aria-required={field.required || undefined}
                    className="space-y-2"
                  >
                    {field.options?.map((option) => (
                      <div key={option.value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          id={`${field.id}-${option.value}`}
                          name={field.name}
                          value={option.value}
                          checked={formField.value === option.value}
                          onChange={() => { if (!disabled) formField.onChange(option.value) }}
                          aria-disabled={disabled || undefined}
                          disabled={option.disabled}
                          className="h-5 w-5 border-stone-500 text-primary focus:ring-primary"
                        />
                        <Label htmlFor={`${field.id}-${option.value}`} className="font-normal cursor-pointer min-h-6 flex items-center" {...OFFICIAL_ENGLISH}>
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              />
              {hint(field)}
              {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
            </div>
          )
        }

        if (field.type === 'address') {
          const addressErrors = errors[field.name] as Record<string, { message?: string }> | undefined
          // The address parts' labels are FEED's (the member's language); each stays visible.
          const part = (key: 'line1' | 'line2' | 'city' | 'state' | 'zip', label: FormsKey, required: boolean, extra?: { maxLength?: number; autoComplete?: string }) => (
            <div className="space-y-1">
              <Label htmlFor={`${field.id}-${key}`} className="text-xs text-stone-800">
                {t(label)}
                {required && field.required && <RequiredMark locale={locale} />}
              </Label>
              <Input
                id={`${field.id}-${key}`}
                readOnly={disabled}
                aria-disabled={disabled || undefined}
                className={INPUT}
                lang=""
                dir="auto"
                {...(required && field.required ? { required: true, 'aria-required': true as const } : {})}
                {...extra}
                {...register(`${field.name}.${key}` as Parameters<FormMethods['register']>[0])}
              />
              {addressErrors?.[key]?.message && <p className="text-sm text-red-700 mt-1" {...OFFICIAL_ENGLISH}>{addressErrors[key]!.message}</p>}
            </div>
          )
          return (
            <fieldset key={field.id} className="space-y-4" aria-describedby={hintId(field)}>
              <legend className="text-sm font-medium leading-none">
                <span {...OFFICIAL_ENGLISH}>{field.label}</span>
                {field.required && <RequiredMark locale={locale} />}
              </legend>
              <div className="space-y-3">
                {part('line1', 'street', true, { autoComplete: 'address-line1' })}
                {part('line2', 'line2', false, { autoComplete: 'address-line2' })}
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                  <div className="sm:col-span-3">{part('city', 'city', true, { autoComplete: 'address-level2' })}</div>
                  <div className="sm:col-span-1">{part('state', 'state', true, { maxLength: 2, autoComplete: 'address-level1' })}</div>
                  <div className="sm:col-span-2">{part('zip', 'zip', true, { autoComplete: 'postal-code' })}</div>
                </div>
              </div>
              {hint(field)}
            </fieldset>
          )
        }

        if (field.type === 'signature') {
          return (
            <div key={field.id} className="space-y-2">
              {fieldLabel(field, { htmlFor: field.id })}
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  <div className="border border-stone-500 rounded-md p-4 bg-muted/30">
                    <Input
                      id={field.id}
                      type="text"
                      placeholder={t('signaturePlaceholder')}
                      className={cn('font-signature text-xl italic', INPUT)}
                      readOnly={disabled}
                      aria-disabled={disabled || undefined}
                      lang=""
                      dir="auto"
                      autoComplete="name"
                      aria-describedby={[hintId(field), `${field.id}-consent`].filter(Boolean).join(' ')}
                      {...req(field)}
                      value={(formField.value as string) || ''}
                      onChange={formField.onChange}
                    />
                    <p className="text-xs text-stone-700 mt-2" id={`${field.id}-consent`}>
                      {t('signatureConsent')}
                    </p>
                    {/* The template's own certification text (official English). */}
                    {hint(field, 'text-xs text-stone-700 mt-2')}
                  </div>
                )}
              />
              {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
            </div>
          )
        }

        return (
          <div key={field.id} className="space-y-2">
            {fieldLabel(field, { htmlFor: field.id })}
            <Input
              id={field.id}
              type={getInputType(field.type)}
              placeholder={field.placeholder}
              readOnly={disabled}
              aria-disabled={disabled || undefined}
              autoComplete={AUTOCOMPLETE[field.name]}
              lang=""
              dir="auto"
              className={INPUT}
              aria-describedby={hintId(field)}
              {...req(field)}
              {...register(field.name)}
            />
            {hint(field)}
            {error && <p className="text-sm text-red-700" {...OFFICIAL_ENGLISH}>{error}</p>}
          </div>
        )
      })}
    </div>
  )
}

export function FormWizard({
  templateId,
  existingSubmissionId,
  onComplete,
  onCancel,
}: FormWizardProps) {
  const { template, loading: templateLoading, error: templateError } = useFormTemplate(templateId)
  const submissionHook = useVaultFormSubmission()
  const { profile: profileData } = useVaultSecureProfile()
  const { isUnlocked, registerPreLockFlush } = useVault()
  const { user, profile: publicProfile } = useAuth()
  const locale = useProfileLocale()
  const t = (key: FormsKey) => formsT(locale, key)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const [submitAlert, setSubmitAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  const stepFocusReady = useRef(false)

  const [currentStep, setCurrentStep] = useState(0)
  const [isReviewStep, setIsReviewStep] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const startTimeRef = useRef<number>(Date.now())
  const stepStartTimeRef = useRef<number>(Date.now())
  const draftInitialized = useRef(false)
  // Two independent guards — public-sourced fields (name/email) lock separately
  // from vault-sourced fields (address.*) so each applies exactly once when its
  // data source resolves, regardless of which arrives first.
  const publicAutofillApplied = useRef(false)
  const vaultAutofillApplied = useRef(false)

  type WizardFormValues = Record<string, unknown>

  const { register, control, trigger, getValues, setValue, formState: { errors } } = useForm<WizardFormValues>({
    defaultValues: {},
    mode: 'onChange',
  })

  // Pre-lock flush: when the vault is about to auto-lock (15-min idle) or is
  // locked manually mid-flow, persist the current form values as a draft while
  // the DEK is still available. VaultGuard unmounts this wizard on lock, so this
  // is what prevents the in-progress answers from being lost. Reuses the
  // wizard's existing saveDraft path. Refs keep the registered callback stable
  // (registered once) while always reading the latest values + saveDraft.
  const saveDraftRef = useRef(submissionHook.saveDraft)
  saveDraftRef.current = submissionHook.saveDraft
  const getValuesRef = useRef(getValues)
  getValuesRef.current = getValues
  useEffect(() => {
    const unregister = registerPreLockFlush(async () => {
      // saveDraft no-ops safely if no draft row exists yet or the vault is locked.
      await saveDraftRef.current(getValuesRef.current() as Record<string, unknown>)
    })
    return unregister
  }, [registerPreLockFlush])

  // Draft init effect — waits for both the template and the vault to be unlocked
  // before creating the draft. createDraft calls encryptFormSubmission which
  // requires the vault DEK in IndexedDB. If the vault isn't unlocked yet (e.g.
  // VaultGuard modal just closed), the effect will re-fire when isUnlocked flips
  // to true. draftInitialized is only set after a successful call so a DEK-not-ready
  // failure on first render doesn't permanently prevent draft creation.
  useEffect(() => {
    if (!template || draftInitialized.current) return

    if (existingSubmissionId) {
      draftInitialized.current = true
      submissionHook.loadSubmission(existingSubmissionId)
      return
    }

    // Vault must be unlocked before createDraft (encryption requires DEK)
    if (!isUnlocked) return

    draftInitialized.current = true

    submissionHook.createDraft(templateId).then((id) => {
      if (id) {
        logger.info('forms.wizard.opened', {
          templateId,
          total_steps: template.sections.length,
        })
      } else {
        // createDraft returned null — reset guard so the effect can retry if
        // the vault state changes (e.g. DEK wasn't in IDB yet despite isUnlocked)
        draftInitialized.current = false
      }
    })
  }, [template, isUnlocked])

  // PUBLIC autofill effect — applies first_name / last_name / email exactly once
  // when public sources (publicProfile or user.email) are available. Locks immediately
  // so user edits are never overwritten by subsequent re-renders.
  useEffect(() => {
    if (!template || publicAutofillApplied.current) return
    if (!publicProfile && !user?.email) return

    publicAutofillApplied.current = true

    const autofillValues = mapProfileToAutofill({
      vaultProfile: null, // vault fields handled by the vault effect below
      publicProfile: publicProfile
        ? {
            full_name: publicProfile.full_name,
            location_city: publicProfile.location_city,
            location_state: publicProfile.location_state,
            zip_code: publicProfile.zip_code,
          }
        : null,
      email: user?.email,
    })

    const templateFieldNames = new Set(template.fields.map((f) => f.name))
    // Only public-sourced keys — address is intentionally excluded here
    const publicAutofillKeys: Record<string, string> = {
      first_name: 'first_name',
      last_name: 'last_name',
      email: 'email',
      // ssn, date_of_birth, income intentionally omitted — see form-field-mapper.ts
      // phone omitted — get_my_profile() never returns phone, so it is never autofillable
    }

    for (const field of template.fields) {
      const key = field.autofillKey
      if (!key) continue
      const fieldName = publicAutofillKeys[key]
      if (!fieldName || !templateFieldNames.has(fieldName)) continue

      const value = autofillValues[fieldName as keyof typeof autofillValues]
      if (value === undefined) continue

      setValue(fieldName as keyof WizardFormValues & string, value, {
        shouldValidate: false,
        shouldDirty: false,
      })
    }
  }, [template, publicProfile, user, setValue])

  // VAULT autofill effect — applies address.* exactly once when the vault secure
  // profile has resolved (profileData !== null). Fires independently so a delayed
  // vault unlock does not race against or re-clobber public-sourced fields.
  useEffect(() => {
    if (!template || vaultAutofillApplied.current) return
    if (profileData === null) return // still loading or vault locked — wait

    vaultAutofillApplied.current = true

    const autofillValues = mapProfileToAutofill({
      vaultProfile: profileData,
      publicProfile: null, // public fields already applied above
      email: undefined,
    })

    // Only vault-sourced key: address
    const vaultAutofillKeys: Record<string, string> = {
      address: 'address',
    }

    const templateFieldNames = new Set(template.fields.map((f) => f.name))

    for (const field of template.fields) {
      const key = field.autofillKey
      if (!key) continue
      const fieldName = vaultAutofillKeys[key]
      if (!fieldName || !templateFieldNames.has(fieldName)) continue

      const value = autofillValues[fieldName as keyof typeof autofillValues]
      if (value === undefined) continue

      setValue(fieldName as keyof WizardFormValues & string, value, {
        shouldValidate: false,
        shouldDirty: false,
      })
    }
  }, [template, profileData, setValue])

  const sections = template?.sections ?? []
  const allFields = template?.fields ?? []
  const totalSteps = sections.length
  const isLastContentStep = currentStep === totalSteps - 1

  const currentSection = sections[currentStep]

  const getSectionFieldNames = useCallback((): string[] => {
    if (!currentSection) return []
    const formValues = getValues() as Record<string, unknown>
    const sectionFieldDefs = currentSection.fields
      .map((id) => allFields.find((f) => f.id === id))
      .filter((f): f is FormFieldSchema => f !== undefined)
    return getVisibleFields(sectionFieldDefs, formValues).map((f) => f.name)
  }, [currentSection, allFields, getValues])

  // Focus: the form's heading when the wizard opens (the button that opened it has gone), the
  // step's heading each time the step changes.
  const ready = !templateLoading && !submissionHook.loading
  useEffect(() => {
    // Wait for the form itself: while the template or the draft loads, a spinner stands in.
    if (!template || !ready) return
    if (!stepFocusReady.current) {
      stepFocusReady.current = true
      titleRef.current?.focus()
      return
    }
    stepHeadingRef.current?.focus()
  }, [template, ready, currentStep, isReviewStep])

  const handleNext = useCallback(async () => {
    if (!template || sections.length === 0 || isSaving || isSubmitting) return

    const sectionFieldNames = getSectionFieldNames()
    const valid = await trigger(sectionFieldNames as (keyof WizardFormValues & string)[])
    if (!valid) return

    const stepDurationMs = Date.now() - stepStartTimeRef.current
    logger.info('forms.wizard.step', {
      templateId,
      step: currentStep + 1,
      total_steps: totalSteps,
      direction: 'next',
      duration_ms: stepDurationMs,
    })

    setIsSaving(true)
    announce(setStatus, formsT(locale, 'savingDraft'))
    const data = getValues() as Record<string, unknown>
    const saved = await submissionHook.saveDraft(data)
    setIsSaving(false)

    if (saved) {
      logger.info('forms.wizard.draft_saved', { templateId, step: currentStep + 1 })
    } else {
      // The answers stay in the form; the member hears that the save did not happen. The hook
      // writes no row for this: one code-only row.
      announce(setSubmitAlert, formsT(locale, 'draftSaveFailed'))
      logger.warn('error_surface.shown', { surface: 'form-wizard', kind: 'draft_save_failed', locale })
    }

    stepStartTimeRef.current = Date.now()

    if (isLastContentStep) {
      setIsReviewStep(true)
    } else {
      setCurrentStep((s) => s + 1)
    }
  }, [template, sections, currentStep, getSectionFieldNames, trigger, getValues, submissionHook, templateId, totalSteps, isLastContentStep, isSaving, isSubmitting, locale])

  const handleBack = useCallback(() => {
    if (isSaving || isSubmitting) return
    if (isReviewStep) {
      setIsReviewStep(false)
      return
    }
    if (currentStep > 0) {
      logger.info('forms.wizard.step', {
        templateId,
        step: currentStep,
        total_steps: totalSteps,
        direction: 'back',
        duration_ms: Date.now() - stepStartTimeRef.current,
      })
      setCurrentStep((s) => s - 1)
      stepStartTimeRef.current = Date.now()
    }
  }, [isReviewStep, currentStep, templateId, totalSteps, isSaving, isSubmitting])

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitAlert((prev) => (prev.text ? { text: '', seq: prev.seq } : prev))
    announce(setStatus, formsT(locale, 'submitting'))

    try {
      const data = getValues() as Record<string, unknown>
      const signatureField = allFields.find((f) => f.type === 'signature')
      const signatureData = signatureField ? (data[signatureField.name] as string | undefined) : undefined

      const ok = await submissionHook.submitForm(data, signatureData, templateId)
      if (!ok) {
        throw new Error(submissionHook.error ?? 'Submission failed')
      }

      logger.info('forms.wizard.submitted', {
        templateId,
        duration_ms: Date.now() - startTimeRef.current,
      })

      onComplete()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      setSubmitError(msg)
      // The member reads the translated line; the hook's or server's text is never shown.
      announce(setSubmitAlert, formsT(locale, 'submitFailed'))
      logger.error('forms.wizard.submit_error', new Error(msg), {
        templateId,
        step: isReviewStep ? 'review' : String(currentStep + 1),
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [getValues, allFields, submissionHook, templateId, onComplete, isReviewStep, currentStep, isSubmitting, locale])

  if (templateLoading || submissionHook.loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" lang={locale} dir={dir(locale)} role="status">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" aria-hidden="true" />
        <p className="text-sm text-stone-700">{t('loadingForm')}</p>
      </div>
    )
  }

  if (templateError || !template) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center" lang={locale} dir={dir(locale)}>
        <div role="alert">
          <p className="text-sm text-stone-800 font-medium">{t('loadFormFailed')}</p>
          <p className="text-xs text-stone-700">{t('templateNotFound')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} className="border-stone-500">{t('goBack')}</Button>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center" lang={locale} dir={dir(locale)}>
        <p className="text-sm text-stone-800 font-medium">{t('noSections')}</p>
        <Button variant="outline" size="sm" onClick={onCancel} className="border-stone-500">{t('goBack')}</Button>
      </div>
    )
  }

  const displayStep = isReviewStep ? totalSteps + 1 : currentStep + 1
  const displayTotal = totalSteps + 1
  const hasAutofillData = profileData !== null && allFields.some((f) => f.autofillKey)

  const busy = isSaving || isSubmitting
  const backUnavailable = (currentStep === 0 && !isReviewStep) || busy

  return (
    <div data-testid="form-wizard-container" className="h-full flex flex-col" lang={locale} dir={dir(locale)}>
      <p role="status" className="sr-only" data-testid="form-wizard-status">
        <AnnouncementText announcement={status} />
      </p>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 data-testid="form-wizard-title" ref={titleRef} tabIndex={-1} className="text-xl font-bold text-stone-900 focus:outline-hidden" {...OFFICIAL_ENGLISH}>{template.name}</h1>
              <p className="text-sm text-stone-700 mt-0.5" data-testid="form-wizard-step">
                {formatMessage(t('stepOf'), { step: formatCount(displayStep, locale), total: formatCount(displayTotal, locale) })}
                {isReviewStep ? <> — {t('reviewSubmit')}</> : currentSection ? <> — <span {...OFFICIAL_ENGLISH}>{currentSection.title}</span></> : null}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-stone-700">
              {t('cancel')}
            </Button>
          </div>

          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: displayTotal }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i < displayStep - 1
                    ? 'bg-[#4a5d23]'
                    : i === displayStep - 1
                    ? 'bg-[#4a5d23]/60'
                    : 'bg-stone-300'
                }`}
              />
            ))}
          </div>

          {currentStep === 0 && !isReviewStep && hasAutofillData && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-300 rounded-xl" data-testid="form-autofill-banner">
              <Info className="w-4 h-4 text-blue-800 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs text-blue-900">
                {t('autofillBanner')}
              </p>
            </div>
          )}

          <div className="p-5 bg-[#faf9f6] border border-stone-300 rounded-xl">
            {isReviewStep ? (
              <h2 ref={stepHeadingRef} tabIndex={-1} className="mb-5 font-semibold text-stone-900 focus:outline-hidden">{t('reviewSubmit')}</h2>
            ) : currentSection && (
              <div className="mb-5">
                <h2 ref={stepHeadingRef} tabIndex={-1} className="font-semibold text-stone-900 focus:outline-hidden" {...OFFICIAL_ENGLISH}>{currentSection.title}</h2>
                {currentSection.description && (
                  <p className="text-sm text-stone-700 mt-1" {...OFFICIAL_ENGLISH}>{currentSection.description}</p>
                )}
              </div>
            )}

            {isReviewStep ? (
              <ReviewStep
                sections={sections}
                allFields={allFields}
                values={getValues() as Record<string, unknown>}
                locale={locale}
              />
            ) : currentSection ? (
              <StepFields
                section={currentSection}
                allFields={allFields}
                register={register}
                control={control}
                errors={errors}
                disabled={isSubmitting || isSaving}
                locale={locale}
              />
            ) : null}
          </div>

          {/* Always mounted, so a failed submission is announced; never the server's text. */}
          <p role="alert" className="text-sm text-red-700 text-center" data-testid="form-submit-alert" data-failed={submitError ? 'true' : undefined}>
            <AnnouncementText announcement={submitAlert} />
          </p>
        </div>
      </div>

      <div className="border-t border-stone-300 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            aria-disabled={backUnavailable}
            className={cn('flex-1 border-stone-500', backUnavailable && UNAVAILABLE)}
            data-testid="form-back-button"
          >
            <ChevronLeft className="w-4 h-4 me-1 rtl:-scale-x-100" aria-hidden="true" />
            {t('back')}
          </Button>

          {isReviewStep ? (
            <Button
              data-testid="form-submit-button"
              type="button"
              onClick={handleSubmit}
              aria-disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              className={cn('flex-1 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white', isSubmitting && UNAVAILABLE)}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" />}
              <CheckCircle className="w-4 h-4 me-1.5" aria-hidden="true" />
              {t('submitApplication')}
            </Button>
          ) : (
            <Button
              data-testid="form-next-button"
              type="button"
              onClick={handleNext}
              aria-disabled={isSaving}
              aria-busy={isSaving || undefined}
              className={cn('flex-1 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white', isSaving && UNAVAILABLE)}
            >
              {isSaving && <Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" />}
              {isLastContentStep ? t('review') : t('next')}
              <ChevronRight className="w-4 h-4 ms-1 rtl:-scale-x-100" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
