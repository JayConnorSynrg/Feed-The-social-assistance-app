'use client'

import React, { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SignatureData {
  submissionId: string
  signatureData: string // Base64 encoded image or typed text
  signatureMode: 'draw' | 'type'
  ipAddress?: string
  userAgent?: string
  signedAt: string
}

interface UseFormSignatureState {
  saving: boolean
  error: string | null
}

interface UseFormSignatureReturn extends UseFormSignatureState {
  saveSignature: (
    submissionId: string,
    signatureData: string,
    mode: 'draw' | 'type'
  ) => Promise<boolean>
  getSignature: (submissionId: string) => Promise<SignatureData | null>
  verifySignature: (submissionId: string) => Promise<boolean>
}

/**
 * Hook for managing form signatures
 */
export function useFormSignature(): UseFormSignatureReturn {
  const [state, setState] = useState<UseFormSignatureState>({
    saving: false,
    error: null,
  })

  const supabase = createClient()

  /**
   * Save a signature for a form submission
   */
  const saveSignature = useCallback(
    async (
      submissionId: string,
      signatureData: string,
      mode: 'draw' | 'type'
    ): Promise<boolean> => {
      setState({ saving: true, error: null })

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('Not authenticated')
        }

        // Get client info for audit trail
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('form_signatures').upsert(
          {
            submission_id: submissionId,
            user_id: user.id,
            signature_data: signatureData,
            signature_mode: mode,
            user_agent: userAgent,
            signed_at: new Date().toISOString(),
          },
          {
            onConflict: 'submission_id,user_id',
          }
        )

        if (error) throw error

        setState({ saving: false, error: null })
        return true
      } catch (error) {
        setState({
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to save signature',
        })
        return false
      }
    },
    [supabase]
  )

  /**
   * Get signature for a submission
   */
  const getSignature = useCallback(
    async (submissionId: string): Promise<SignatureData | null> => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          return null
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('form_signatures')
          .select('*')
          .eq('submission_id', submissionId)
          .eq('user_id', user.id)
          .single()

        if (error || !data) {
          return null
        }

        return {
          submissionId: data.submission_id,
          signatureData: data.signature_data,
          signatureMode: data.signature_mode,
          ipAddress: data.ip_address,
          userAgent: data.user_agent,
          signedAt: data.signed_at,
        }
      } catch {
        return null
      }
    },
    [supabase]
  )

  /**
   * Verify a signature exists and is valid
   */
  const verifySignature = useCallback(
    async (submissionId: string): Promise<boolean> => {
      const signature = await getSignature(submissionId)
      return signature !== null && signature.signatureData.length > 0
    },
    [getSignature]
  )

  return {
    ...state,
    saveSignature,
    getSignature,
    verifySignature,
  }
}

// ============================================
// Signature Display Component
// ============================================

interface SignatureDisplayProps {
  signatureData: string
  mode: 'draw' | 'type'
  signedAt: string
  className?: string
}

/**
 * Display a saved signature
 */
export function SignatureDisplay({
  signatureData,
  mode,
  signedAt,
  className,
}: SignatureDisplayProps) {
  const formattedDate = new Date(signedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (mode === 'draw') {
    return (
      <div className={className}>
        <div className="border rounded-lg p-4 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureData}
            alt="Signature"
            className="max-h-24 w-auto"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Electronically signed on {formattedDate}
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="border rounded-lg p-4 bg-muted/30">
        <p
          className="text-2xl italic"
          style={{ fontFamily: "'Brush Script MT', cursive, serif" }}
        >
          {signatureData}
        </p>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Electronically signed on {formattedDate}
      </p>
    </div>
  )
}

// ============================================
// Signature Verification Badge
// ============================================

interface SignatureVerificationProps {
  verified: boolean
  signedAt?: string
  className?: string
}

/**
 * Badge showing signature verification status
 */
export function SignatureVerificationBadge({
  verified,
  signedAt,
  className,
}: SignatureVerificationProps) {
  if (!verified) {
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 ${className}`}
      >
        Signature Required
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 ${className}`}
      title={signedAt ? `Signed on ${new Date(signedAt).toLocaleDateString()}` : undefined}
    >
      Signed
    </span>
  )
}
