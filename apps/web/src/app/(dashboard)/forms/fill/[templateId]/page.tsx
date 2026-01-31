'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DynamicFormRenderer } from '@/components/forms/dynamic-form-renderer'
import {
  AutofillBanner,
  ProfileSetupPrompt,
} from '@/components/forms/autofill-banner'
import { SignatureField } from '@/components/forms/signature-canvas'
import { useFormTemplate } from '@/hooks/use-form-templates'
import { useFormSubmission } from '@/hooks/use-form-submission'
import { useSecureProfile } from '@/hooks/use-secure-profile'
import { createFormPrefillData } from '@/lib/form-field-mapper'
import type { FormTemplateSchema } from '@/lib/form-schemas'

// ============================================
// Form Fill Page Component
// ============================================

export default function FormFillPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const templateId = params.templateId as string
  const submissionId = searchParams.get('submission')

  const [signatureData, setSignatureData] = useState<{
    mode: 'draw' | 'type'
    value: string
  } | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // Load template
  const { template, loading: templateLoading, error: templateError } = useFormTemplate(templateId)

  // Load/create submission
  const {
    submission,
    loading: submissionLoading,
    saving,
    error: submissionError,
    createDraft,
    saveDraft,
    submitForm,
    loadSubmission,
  } = useFormSubmission(template || undefined)

  // Secure profile for autofill
  const {
    data: profileData,
    hasEncryptionKey,
    isUnlocked,
    unlock,
  } = useSecureProfile()

  // Initialize submission
  useEffect(() => {
    const initSubmission = async () => {
      if (submissionId) {
        await loadSubmission(submissionId)
      } else if (template) {
        await createDraft(template.id)
      }
    }

    if (template && !submission) {
      initSubmission()
    }
  }, [template, submissionId, submission, createDraft, loadSubmission])

  // Compute initial values
  const initialValues = useMemo(() => {
    if (!template) return {}

    // Start with submission data if available
    const baseData = submission?.data || {}

    // Merge with profile data for autofill
    const prefillData = createFormPrefillData(
      template,
      isUnlocked ? profileData : null,
      baseData
    )

    return prefillData
  }, [template, submission, profileData, isUnlocked])

  // Auto-save handler
  const handleAutoSave = useCallback(
    async (data: Record<string, unknown>) => {
      if (!submission || submission.status !== 'draft') return

      setAutoSaveStatus('saving')
      setFormData(data)

      const success = await saveDraft(data)

      setAutoSaveStatus(success ? 'saved' : 'idle')

      // Reset saved status after 2 seconds
      if (success) {
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      }
    },
    [submission, saveDraft]
  )

  // Form submit handler
  const handleSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!submission) return

      // Check for required signature
      const hasSignatureField = template?.fields.some(
        (f) => f.type === 'signature' && f.required
      )

      if (hasSignatureField && !signatureData?.value) {
        alert('Please sign the form before submitting.')
        return
      }

      const success = await submitForm(data, signatureData?.value)

      if (success) {
        router.push(`/forms/submission/${submission.id}?success=true`)
      }
    },
    [submission, template, signatureData, submitForm, router]
  )

  // Handle autofill
  const handleAutofill = useCallback(() => {
    if (!template || !profileData) return

    const prefillData = createFormPrefillData(template, profileData, formData)
    setFormData(prefillData)

    // Trigger a re-render with new data
    // The form will pick up the new initialValues on next render
    window.location.reload()
  }, [template, profileData, formData])

  // Handle unlock profile
  const handleUnlock = useCallback(() => {
    const key = prompt('Enter your encryption key to unlock your profile:')
    if (key) {
      unlock(key)
    }
  }, [unlock])

  // Loading state
  if (templateLoading || submissionLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading form...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (templateError || submissionError || !template) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <Card className="border-destructive">
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive mb-4" />
            <p className="text-destructive font-medium">
              {templateError || submissionError || 'Form not found'}
            </p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/forms">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Forms
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/forms"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Forms
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            {template.description && (
              <p className="text-muted-foreground mt-1">{template.description}</p>
            )}
          </div>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-2 text-sm">
            {autoSaveStatus === 'saving' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Saving...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Saved</span>
              </>
            )}
          </div>
        </div>

        {/* Form metadata */}
        {template.metadata && (
          <div className="flex flex-wrap gap-3 mt-4 text-sm text-muted-foreground">
            {template.metadata.estimatedTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                ~{template.metadata.estimatedTime} min
              </span>
            )}
            {template.metadata.agency && (
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {template.metadata.agency}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Autofill Banner */}
      {hasEncryptionKey ? (
        <AutofillBanner
          template={template}
          profile={profileData}
          isUnlocked={isUnlocked}
          onUnlock={handleUnlock}
          onAutofill={handleAutofill}
          className="mb-6"
        />
      ) : (
        <ProfileSetupPrompt
          onSetupProfile={() => router.push('/settings/profile')}
          className="mb-6"
        />
      )}

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <DynamicFormRenderer
            template={template}
            defaultValues={initialValues}
            autofillData={isUnlocked ? profileData : null}
            onSubmit={handleSubmit}
            submitLabel={saving ? 'Submitting...' : 'Submit Application'}
            disabled={saving || submission?.status !== 'draft'}
          />

          {/* Signature Section (if template has signature field) */}
          {template.fields.some((f) => f.type === 'signature') && (
            <div className="mt-8 pt-8 border-t">
              <SignatureField
                onSignature={setSignatureData}
                label="Electronic Signature"
                required={template.fields.some(
                  (f) => f.type === 'signature' && f.required
                )}
                disabled={submission?.status !== 'draft'}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <Button
              variant="outline"
              onClick={() => handleAutoSave(formData)}
              disabled={saving || submission?.status !== 'draft'}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              type="submit"
              onClick={() => handleSubmit(formData)}
              disabled={saving || submission?.status !== 'draft'}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          </div>

          {/* Required Documents Note */}
          {template.metadata?.requiredDocuments &&
            template.metadata.requiredDocuments.length > 0 && (
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm mb-2">
                  Documents You May Need
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {template.metadata.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
