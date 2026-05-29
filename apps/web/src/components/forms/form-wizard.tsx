'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import type { FieldValues } from 'react-hook-form'
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

function ReviewStep({
  sections,
  allFields,
  values,
}: {
  sections: FormSection[]
  allFields: FormFieldSchema[]
  values: Record<string, unknown>
}) {
  const fieldMap = new Map(allFields.map((f) => [f.name, f]))

  function formatValue(field: FormFieldSchema, value: unknown): string {
    if (value === undefined || value === null || value === '') return '—'
    if (field.sensitive) return '••••••••'
    if (typeof value === 'object' && value !== null) {
      const addr = value as Record<string, string>
      return [addr.line1, addr.line2, addr.city, addr.state, addr.zip]
        .filter(Boolean)
        .join(', ')
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (field.options) {
      const opt = field.options.find((o) => o.value === String(value))
      return opt ? opt.label : String(value)
    }
    return String(value)
  }

  return (
    <div className="space-y-6">
      <div className="p-4 bg-[#f0ede6] rounded-xl border border-stone-200">
        <p className="text-sm text-stone-700">
          Review your answers before submitting. Use the Back button to make corrections.
        </p>
      </div>
      {sections.map((section) => {
        const sectionFields = section.fields
          .map((id) => allFields.find((f) => f.id === id))
          .filter((f): f is FormFieldSchema => f !== undefined)
          .filter((f) => values[f.name] !== undefined && values[f.name] !== '')

        if (sectionFields.length === 0) return null

        return (
          <div key={section.id} className="space-y-3">
            <h3 className="font-semibold text-sm text-stone-900 border-b border-stone-200 pb-1.5">
              {section.title}
            </h3>
            <dl className="space-y-2">
              {sectionFields.map((field) => {
                const f = fieldMap.get(field.name)
                if (!f) return null
                return (
                  <div key={field.id} className="flex flex-col gap-0.5">
                    <dt className="text-xs text-stone-500">{f.label}</dt>
                    <dd className="text-sm text-stone-900 font-medium">
                      {formatValue(f, values[f.name])}
                    </dd>
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
}: {
  section: FormSection
  allFields: FormFieldSchema[]
  register: FormMethods['register']
  control: FormMethods['control']
  errors: FormMethods['formState']['errors']
  disabled: boolean
}) {
  const sectionFieldDefs = section.fields
    .map((id) => allFields.find((f) => f.id === id))
    .filter((f): f is FormFieldSchema => f !== undefined)

  return (
    <div className="space-y-5">
      {sectionFieldDefs.map((field) => {
        const error = errors[field.name]?.message as string | undefined

        if (field.type === 'textarea') {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <textarea
                id={field.id}
                placeholder={field.placeholder}
                disabled={disabled}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register(field.name)}
              />
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )
        }

        if (field.type === 'select' || field.type === 'multiselect') {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  <Select
                    value={formField.value as string}
                    onValueChange={formField.onChange}
                    disabled={disabled}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder={field.placeholder || 'Select...'} />
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
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )
        }

        if (field.type === 'checkbox') {
          return (
            <div key={field.id} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Controller
                  name={field.name}
                  control={control}
                  render={({ field: formField }) => (
                    <Checkbox
                      id={field.id}
                      checked={formField.value as boolean}
                      onCheckedChange={formField.onChange}
                      disabled={disabled}
                    />
                  )}
                />
                <Label htmlFor={field.id} className="font-normal cursor-pointer">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              </div>
              {field.helpText && <p className="text-xs text-muted-foreground pl-6">{field.helpText}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )
        }

        if (field.type === 'radio') {
          return (
            <div key={field.id} className="space-y-3">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  <div className="space-y-2">
                    {field.options?.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id={`${field.id}-${option.value}`}
                          name={field.name}
                          value={option.value}
                          checked={formField.value === option.value}
                          onChange={() => formField.onChange(option.value)}
                          disabled={disabled || option.disabled}
                          className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor={`${field.id}-${option.value}`} className="font-normal cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              />
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )
        }

        if (field.type === 'address') {
          const addressErrors = errors[field.name] as Record<string, { message?: string }> | undefined
          return (
            <div key={field.id} className="space-y-4">
              <Label>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <div className="space-y-3">
                <div>
                  <Input placeholder="Street Address" disabled={disabled} {...register(`${field.name}.line1` as Parameters<FormMethods['register']>[0])} />
                  {addressErrors?.line1?.message && <p className="text-sm text-destructive mt-1">{addressErrors.line1.message}</p>}
                </div>
                <Input placeholder="Apt, Suite, Unit (optional)" disabled={disabled} {...register(`${field.name}.line2` as Parameters<FormMethods['register']>[0])} />
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-3">
                    <Input placeholder="City" disabled={disabled} {...register(`${field.name}.city` as Parameters<FormMethods['register']>[0])} />
                    {addressErrors?.city?.message && <p className="text-sm text-destructive mt-1">{addressErrors.city.message}</p>}
                  </div>
                  <div className="col-span-1">
                    <Input placeholder="State" maxLength={2} disabled={disabled} {...register(`${field.name}.state` as Parameters<FormMethods['register']>[0])} />
                    {addressErrors?.state?.message && <p className="text-sm text-destructive mt-1">{addressErrors.state.message}</p>}
                  </div>
                  <div className="col-span-2">
                    <Input placeholder="ZIP Code" disabled={disabled} {...register(`${field.name}.zip` as Parameters<FormMethods['register']>[0])} />
                    {addressErrors?.zip?.message && <p className="text-sm text-destructive mt-1">{addressErrors.zip.message}</p>}
                  </div>
                </div>
              </div>
              {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            </div>
          )
        }

        if (field.type === 'signature') {
          return (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>
                {field.label}
                {field.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Controller
                name={field.name}
                control={control}
                render={({ field: formField }) => (
                  <div className="border rounded-md p-4 bg-muted/30">
                    <Input
                      id={field.id}
                      type="text"
                      placeholder="Type your full legal name"
                      className="font-signature text-xl italic"
                      disabled={disabled}
                      value={(formField.value as string) || ''}
                      onChange={formField.onChange}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      By typing your name above, you are signing this document electronically.
                    </p>
                  </div>
                )}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )
        }

        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.id}
              type={getInputType(field.type)}
              placeholder={field.placeholder}
              disabled={disabled}
              {...register(field.name)}
            />
            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
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

  const [currentStep, setCurrentStep] = useState(0)
  const [isReviewStep, setIsReviewStep] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const startTimeRef = useRef<number>(Date.now())
  const stepStartTimeRef = useRef<number>(Date.now())
  const draftInitialized = useRef(false)

  type WizardFormValues = Record<string, unknown>

  const { register, control, trigger, getValues, formState: { errors } } = useForm<WizardFormValues>({
    defaultValues: {},
    mode: 'onChange',
  })

  useEffect(() => {
    if (!template || draftInitialized.current) return
    draftInitialized.current = true

    if (existingSubmissionId) {
      submissionHook.loadSubmission(existingSubmissionId)
      return
    }

    submissionHook.createDraft(templateId).then((id) => {
      if (id) {
        console.log(JSON.stringify({
          action: 'form_wizard_opened',
          templateId,
          templateName: template.name,
          totalSteps: template.sections.length,
        }))
      }
    })
  }, [template])

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

  const handleNext = useCallback(async () => {
    if (!template || sections.length === 0) return

    const sectionFieldNames = getSectionFieldNames()
    const valid = await trigger(sectionFieldNames as (keyof WizardFormValues & string)[])
    if (!valid) return

    const stepDurationMs = Date.now() - stepStartTimeRef.current
    console.log(JSON.stringify({
      action: 'form_wizard_step',
      templateId,
      step: currentStep + 1,
      totalSteps,
      direction: 'next',
      durationOnStepMs: stepDurationMs,
    }))

    setIsSaving(true)
    const data = getValues() as Record<string, unknown>
    await submissionHook.saveDraft(data)
    setIsSaving(false)

    console.log(JSON.stringify({
      action: 'form_wizard_draft_saved',
      templateId,
      step: currentStep + 1,
    }))

    stepStartTimeRef.current = Date.now()

    if (isLastContentStep) {
      setIsReviewStep(true)
    } else {
      setCurrentStep((s) => s + 1)
    }
  }, [template, sections, currentStep, getSectionFieldNames, trigger, getValues, submissionHook, templateId, totalSteps, isLastContentStep])

  const handleBack = useCallback(() => {
    if (isReviewStep) {
      setIsReviewStep(false)
      return
    }
    if (currentStep > 0) {
      console.log(JSON.stringify({
        action: 'form_wizard_step',
        templateId,
        step: currentStep,
        totalSteps,
        direction: 'back',
        durationOnStepMs: Date.now() - stepStartTimeRef.current,
      }))
      setCurrentStep((s) => s - 1)
      stepStartTimeRef.current = Date.now()
    }
  }, [isReviewStep, currentStep, templateId, totalSteps])

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const data = getValues() as Record<string, unknown>
      const signatureField = allFields.find((f) => f.type === 'signature')
      const signatureData = signatureField ? (data[signatureField.name] as string | undefined) : undefined

      const ok = await submissionHook.submitForm(data, signatureData)
      if (!ok) {
        throw new Error(submissionHook.error ?? 'Submission failed')
      }

      console.log(JSON.stringify({
        action: 'form_wizard_submitted',
        templateId,
        totalDurationMs: Date.now() - startTimeRef.current,
      }))

      onComplete()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      setSubmitError(msg)
      console.log(JSON.stringify({
        action: 'form_wizard_error',
        templateId,
        step: isReviewStep ? 'review' : currentStep + 1,
        errorType: 'submit',
        errorMessage: msg,
      }))
    } finally {
      setIsSubmitting(false)
    }
  }, [getValues, allFields, submissionHook, templateId, onComplete, isReviewStep, currentStep])

  if (templateLoading || submissionHook.loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#4a5d23]" />
        <p className="text-sm text-muted-foreground">Loading form...</p>
      </div>
    )
  }

  if (templateError || !template) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-stone-700 font-medium">Failed to load form</p>
        <p className="text-xs text-muted-foreground">{templateError ?? 'Template not found'}</p>
        <Button variant="outline" size="sm" onClick={onCancel}>Go Back</Button>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-stone-700 font-medium">This form has no sections defined.</p>
        <Button variant="outline" size="sm" onClick={onCancel}>Go Back</Button>
      </div>
    )
  }

  const displayStep = isReviewStep ? totalSteps + 1 : currentStep + 1
  const displayTotal = totalSteps + 1
  const hasAutofillData = profileData !== null && allFields.some((f) => f.autofillKey)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-stone-900">{template.name}</h1>
              <p className="text-sm text-stone-500 mt-0.5">
                Step {displayStep} of {displayTotal}
                {isReviewStep ? ' — Review & Submit' : currentSection ? ` — ${currentSection.title}` : ''}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-stone-500">
              Cancel
            </Button>
          </div>

          <div className="flex gap-1">
            {Array.from({ length: displayTotal }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i < displayStep - 1
                    ? 'bg-[#4a5d23]'
                    : i === displayStep - 1
                    ? 'bg-[#4a5d23]/60'
                    : 'bg-stone-200'
                }`}
              />
            ))}
          </div>

          {currentStep === 0 && !isReviewStep && hasAutofillData && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Your profile data has been pre-filled where available. Review and update as needed.
              </p>
            </div>
          )}

          <div className="p-5 bg-[#faf9f6] border border-stone-200 rounded-xl">
            {!isReviewStep && currentSection && (
              <div className="mb-5">
                <h2 className="font-semibold text-stone-900">{currentSection.title}</h2>
                {currentSection.description && (
                  <p className="text-sm text-stone-600 mt-1">{currentSection.description}</p>
                )}
              </div>
            )}

            {isReviewStep ? (
              <ReviewStep
                sections={sections}
                allFields={allFields}
                values={getValues() as Record<string, unknown>}
              />
            ) : currentSection ? (
              <StepFields
                section={currentSection}
                allFields={allFields}
                register={register}
                control={control}
                errors={errors}
                disabled={isSubmitting || isSaving}
              />
            ) : null}
          </div>

          {submitError && (
            <p className="text-sm text-destructive text-center">{submitError}</p>
          )}
        </div>
      </div>

      <div className="border-t border-stone-200 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0 && !isReviewStep}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {isReviewStep ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Submit Application
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isSaving}
              className="flex-1 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLastContentStep ? 'Review' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
