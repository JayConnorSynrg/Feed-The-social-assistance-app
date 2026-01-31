'use client'

import React, { useCallback, useMemo, useEffect } from 'react'
import { useForm, Controller, FieldValues, Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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
import {
  FormTemplateSchema,
  FormFieldSchema,
  FieldType,
  generateFormSchema,
  getVisibleFields,
} from '@/lib/form-schemas'
import type { SecureProfileData } from '@/lib/secure-profile'

// ============================================
// Field Renderer Components
// ============================================

interface FieldRendererProps<T extends FieldValues> {
  field: FormFieldSchema
  control: ReturnType<typeof useForm<T>>['control']
  register: ReturnType<typeof useForm<T>>['register']
  errors: ReturnType<typeof useForm<T>>['formState']['errors']
  disabled?: boolean
}

function TextField<T extends FieldValues>({
  field,
  register,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={field.id}
        type={getInputType(field.type)}
        placeholder={field.placeholder}
        disabled={disabled}
        {...register(field.name as Path<T>)}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function TextareaField<T extends FieldValues>({
  field,
  register,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <textarea
        id={field.id}
        placeholder={field.placeholder}
        disabled={disabled}
        className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        {...register(field.name as Path<T>)}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function SelectField<T extends FieldValues>({
  field,
  control,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Controller
        name={field.name as Path<T>}
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
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function CheckboxField<T extends FieldValues>({
  field,
  control,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Controller
          name={field.name as Path<T>}
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
      {field.helpText && (
        <p className="text-xs text-muted-foreground pl-6">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function RadioField<T extends FieldValues>({
  field,
  control,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-3">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Controller
        name={field.name as Path<T>}
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
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        )}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function AddressField<T extends FieldValues>({
  field,
  register,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const addressErrors = errors[field.name] as Record<string, { message?: string }> | undefined

  return (
    <div className="space-y-4">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="space-y-3">
        <div>
          <Input
            placeholder="Street Address"
            disabled={disabled}
            {...register(`${field.name}.line1` as Path<T>)}
          />
          {addressErrors?.line1?.message && (
            <p className="text-sm text-destructive mt-1">{addressErrors.line1.message}</p>
          )}
        </div>
        <Input
          placeholder="Apt, Suite, Unit (optional)"
          disabled={disabled}
          {...register(`${field.name}.line2` as Path<T>)}
        />
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <Input
              placeholder="City"
              disabled={disabled}
              {...register(`${field.name}.city` as Path<T>)}
            />
            {addressErrors?.city?.message && (
              <p className="text-sm text-destructive mt-1">{addressErrors.city.message}</p>
            )}
          </div>
          <div className="col-span-1">
            <Input
              placeholder="State"
              maxLength={2}
              disabled={disabled}
              {...register(`${field.name}.state` as Path<T>)}
            />
            {addressErrors?.state?.message && (
              <p className="text-sm text-destructive mt-1">{addressErrors.state.message}</p>
            )}
          </div>
          <div className="col-span-2">
            <Input
              placeholder="ZIP Code"
              disabled={disabled}
              {...register(`${field.name}.zip` as Path<T>)}
            />
            {addressErrors?.zip?.message && (
              <p className="text-sm text-destructive mt-1">{addressErrors.zip.message}</p>
            )}
          </div>
        </div>
      </div>
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  )
}

function SignatureField<T extends FieldValues>({
  field,
  control,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Controller
        name={field.name as Path<T>}
        control={control}
        render={({ field: formField }) => (
          <div className="border rounded-md p-4 bg-muted/30">
            <Input
              id={field.id}
              type="text"
              placeholder="Type your full legal name"
              className="font-signature text-xl italic"
              disabled={disabled}
              value={formField.value as string || ''}
              onChange={formField.onChange}
            />
            <p className="text-xs text-muted-foreground mt-2">
              By typing your name above, you are signing this document electronically.
            </p>
          </div>
        )}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function FileField<T extends FieldValues>({
  field,
  control,
  errors,
  disabled,
}: FieldRendererProps<T>) {
  const error = errors[field.name]?.message as string | undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Controller
        name={field.name as Path<T>}
        control={control}
        render={({ field: formField }) => (
          <Input
            id={field.id}
            type="file"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0]
              formField.onChange(file)
            }}
            className="cursor-pointer"
          />
        )}
      />
      {field.helpText && (
        <p className="text-xs text-muted-foreground">{field.helpText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// ============================================
// Helper Functions
// ============================================

function getInputType(fieldType: FieldType): string {
  switch (fieldType) {
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'number':
    case 'currency':
      return 'number'
    case 'date':
      return 'date'
    case 'ssn':
      return 'password' // Hide by default
    default:
      return 'text'
  }
}

function renderField<T extends FieldValues>(
  field: FormFieldSchema,
  props: Omit<FieldRendererProps<T>, 'field'>
): React.ReactElement {
  const fieldProps = { field, ...props }

  switch (field.type) {
    case 'textarea':
      return <TextareaField {...fieldProps} />
    case 'select':
      return <SelectField {...fieldProps} />
    case 'multiselect':
      return <SelectField {...fieldProps} /> // TODO: implement multiselect
    case 'checkbox':
      return <CheckboxField {...fieldProps} />
    case 'radio':
      return <RadioField {...fieldProps} />
    case 'address':
      return <AddressField {...fieldProps} />
    case 'signature':
      return <SignatureField {...fieldProps} />
    case 'file':
      return <FileField {...fieldProps} />
    default:
      return <TextField {...fieldProps} />
  }
}

// ============================================
// Main Component
// ============================================

export interface DynamicFormRendererProps {
  template: FormTemplateSchema
  defaultValues?: Record<string, unknown>
  autofillData?: SecureProfileData | null
  onSubmit: (data: Record<string, unknown>) => Promise<void> | void
  onCancel?: () => void
  submitLabel?: string
  cancelLabel?: string
  disabled?: boolean
  className?: string
}

export function DynamicFormRenderer({
  template,
  defaultValues,
  autofillData,
  onSubmit,
  onCancel,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  disabled = false,
  className,
}: DynamicFormRendererProps) {
  // Generate Zod schema from template
  const schema = useMemo(() => generateFormSchema(template), [template])

  // Merge default values with autofill data
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = { ...defaultValues }

    // Apply autofill from secure profile
    if (autofillData) {
      for (const field of template.fields) {
        if (field.autofillKey && autofillData[field.autofillKey] !== undefined) {
          values[field.name] = autofillData[field.autofillKey]
        }
      }
    }

    // Apply field default values
    for (const field of template.fields) {
      if (values[field.name] === undefined && field.defaultValue !== undefined) {
        values[field.name] = field.defaultValue
      }
    }

    return values
  }, [defaultValues, autofillData, template.fields])

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  })

  // Watch all form values for conditional fields
  const formValues = watch()

  // Get visible fields based on conditions
  const visibleFields = useMemo(
    () => getVisibleFields(template.fields, formValues),
    [template.fields, formValues]
  )

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, FormFieldSchema[]> = {}

    for (const section of template.sections) {
      grouped[section.id] = []
    }

    // Add ungrouped section
    grouped['_ungrouped'] = []

    for (const field of visibleFields) {
      if (field.section && grouped[field.section]) {
        grouped[field.section].push(field)
      } else {
        grouped['_ungrouped'].push(field)
      }
    }

    return grouped
  }, [template.sections, visibleFields])

  const handleFormSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      await onSubmit(data)
    },
    [onSubmit]
  )

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={className}>
      <div className="space-y-8">
        {/* Render ungrouped fields first */}
        {fieldsBySection['_ungrouped']?.length > 0 && (
          <div className="space-y-4">
            {fieldsBySection['_ungrouped'].map((field) => (
              <div key={field.id}>
                {renderField(field, {
                  control,
                  register,
                  errors,
                  disabled: disabled || isSubmitting,
                })}
              </div>
            ))}
          </div>
        )}

        {/* Render sections */}
        {template.sections.map((section) => {
          const sectionFields = fieldsBySection[section.id] || []
          if (sectionFields.length === 0) return null

          return (
            <div key={section.id} className="space-y-4">
              <div className="border-b pb-2">
                <h3 className="font-semibold text-lg">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                )}
              </div>
              <div className="space-y-4">
                {sectionFields.map((field) => (
                  <div key={field.id}>
                    {renderField(field, {
                      control,
                      register,
                      errors,
                      disabled: disabled || isSubmitting,
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Form metadata */}
      {template.metadata && (
        <div className="mt-6 p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          {template.metadata.estimatedTime && (
            <p>Estimated time: {template.metadata.estimatedTime} minutes</p>
          )}
          {template.metadata.requiredDocuments && template.metadata.requiredDocuments.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">Required documents:</p>
              <ul className="list-disc list-inside mt-1">
                {template.metadata.requiredDocuments.map((doc, idx) => (
                  <li key={idx}>{doc}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Form actions */}
      <div className="mt-8 flex gap-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
        )}
        <Button
          type="submit"
          disabled={disabled || isSubmitting}
          className={onCancel ? 'flex-1' : 'w-full'}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

// ============================================
// Form Preview Component (for template editing)
// ============================================

export interface FormPreviewProps {
  template: FormTemplateSchema
  className?: string
}

export function FormPreview({ template, className }: FormPreviewProps) {
  return (
    <div className={className}>
      <DynamicFormRenderer
        template={template}
        onSubmit={() => {
          // Preview only - no actual submission
          alert('Form preview - submission disabled')
        }}
        disabled={false}
        submitLabel="Preview Submit"
      />
    </div>
  )
}
