'use client'

import { useMemo, useState, useCallback } from 'react'
import { Zap, Lock, Unlock, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { FormTemplateSchema, FormFieldSchema } from '@/lib/form-schemas'
import type { SecureProfileData } from '@/lib/secure-profile'
import { getAutofillStats, getAutofillableFields } from '@/lib/form-field-mapper'

interface AutofillBannerProps {
  template: FormTemplateSchema
  profile: SecureProfileData | null
  isUnlocked: boolean
  onUnlock: () => void
  onAutofill: () => void
  className?: string
}

/**
 * Banner showing autofill capabilities and prompting to unlock profile
 */
export function AutofillBanner({
  template,
  profile,
  isUnlocked,
  onUnlock,
  onAutofill,
  className,
}: AutofillBannerProps) {
  const [expanded, setExpanded] = useState(false)

  const stats = useMemo(() => {
    if (!profile) {
      return null
    }
    return getAutofillStats(template, profile)
  }, [template, profile])

  const autofillableFields = useMemo(() => {
    if (!profile) {
      return []
    }
    return getAutofillableFields(template.fields, profile)
  }, [template.fields, profile])

  // No profile data or no autofillable fields
  if (!profile || !stats || stats.autofillableFields === 0) {
    return null
  }

  // Profile locked
  if (!isUnlocked) {
    return (
      <Card className={`border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 ${className}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Unlock Your Profile to Autofill
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {stats.autofillableFields} fields can be filled automatically
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={onUnlock}
              className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
            >
              <Unlock className="h-4 w-4 mr-2" />
              Unlock
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Profile unlocked - show autofill option
  return (
    <Card className={`border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 ${className}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Autofill Available
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {stats.autofillableFields} of {stats.totalFields} fields from your profile
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={onAutofill}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Zap className="h-4 w-4 mr-2" />
              Autofill Now
            </Button>
          </div>
        </div>

        {/* Expanded field list */}
        {expanded && autofillableFields.length > 0 && (
          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              Fields that will be filled:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {autofillableFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300"
                >
                  <Check className="h-3 w-3" />
                  <span>{field.label}</span>
                  {field.sensitive && (
                    <Lock className="h-3 w-3 opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================
// Autofill Field Indicator
// ============================================

interface AutofillIndicatorProps {
  field: FormFieldSchema
  isAutofilled: boolean
  className?: string
}

/**
 * Small indicator showing a field was autofilled
 */
export function AutofillIndicator({
  field,
  isAutofilled,
  className,
}: AutofillIndicatorProps) {
  if (!isAutofilled) {
    return null
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 ${className}`}
      title="Filled from your secure profile"
    >
      <Zap className="h-3 w-3" />
      Autofilled
    </span>
  )
}

// ============================================
// Autofill Summary Card
// ============================================

interface AutofillSummaryProps {
  template: FormTemplateSchema
  filledFields: string[]
  onClearAutofill?: () => void
  className?: string
}

/**
 * Summary card showing what was autofilled
 */
export function AutofillSummary({
  template,
  filledFields,
  onClearAutofill,
  className,
}: AutofillSummaryProps) {
  const [showAll, setShowAll] = useState(false)

  const filledFieldDetails = useMemo(() => {
    return template.fields.filter((f) => filledFields.includes(f.name))
  }, [template.fields, filledFields])

  if (filledFieldDetails.length === 0) {
    return null
  }

  const displayFields = showAll ? filledFieldDetails : filledFieldDetails.slice(0, 5)
  const remainingCount = filledFieldDetails.length - 5

  return (
    <div className={`text-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-muted-foreground">
          {filledFieldDetails.length} field{filledFieldDetails.length !== 1 ? 's' : ''} autofilled
        </p>
        {onClearAutofill && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAutofill}
            className="text-xs h-6"
          >
            Clear
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {displayFields.map((field) => (
          <span
            key={field.id}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          >
            {field.label}
          </span>
        ))}
        {!showAll && remainingCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground hover:bg-muted/80"
          >
            +{remainingCount} more
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================
// Profile Setup Prompt
// ============================================

interface ProfileSetupPromptProps {
  onSetupProfile: () => void
  className?: string
}

/**
 * Prompt to set up secure profile if user doesn't have one
 */
export function ProfileSetupPrompt({
  onSetupProfile,
  className,
}: ProfileSetupPromptProps) {
  return (
    <Card className={`border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 ${className}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Save Time with Autofill
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Set up your secure profile to automatically fill forms
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onSetupProfile}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            Set Up Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
