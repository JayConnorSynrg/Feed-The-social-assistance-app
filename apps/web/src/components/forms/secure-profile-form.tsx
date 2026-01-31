'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lock, Unlock, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useSecureProfile } from '@/hooks/use-secure-profile'
import type { SecureProfileData } from '@/lib/secure-profile'

// Validation schema for secure profile fields
const secureProfileSchema = z.object({
  ssn: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{3}-?\d{2}-?\d{4}$/.test(val), {
      message: 'SSN must be in format XXX-XX-XXXX',
    }),
  date_of_birth: z.string().optional(),
  income: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+(\.\d{2})?$/.test(val), {
      message: 'Enter income as a number (e.g., 50000.00)',
    }),
  bank_account: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4,17}$/.test(val), {
      message: 'Invalid bank account number',
    }),
  bank_routing: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{9}$/.test(val), {
      message: 'Routing number must be 9 digits',
    }),
  drivers_license: z.string().optional(),
  immigration_status: z.string().optional(),
  medical_conditions: z.string().optional(),
  medications: z.string().optional(),
})

type SecureProfileFormData = z.infer<typeof secureProfileSchema>

interface SecureProfileFormProps {
  onSave?: () => void
}

export function SecureProfileForm({ onSave }: SecureProfileFormProps) {
  const {
    data,
    loading,
    error,
    hasEncryptionKey,
    isUnlocked,
    unlock,
    lock,
    save,
    setupEncryption,
  } = useSecureProfile()

  const [showFields, setShowFields] = useState<Record<string, boolean>>({})
  const [unlockKey, setUnlockKey] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SecureProfileFormData>({
    resolver: zodResolver(secureProfileSchema),
    values: data || undefined,
  })

  const toggleFieldVisibility = useCallback((field: string) => {
    setShowFields((prev) => ({ ...prev, [field]: !prev[field] }))
  }, [])

  const handleSetupEncryption = useCallback(async () => {
    const result = await setupEncryption()
    if (result) {
      setNewKey(result.exportedKey)
    }
  }, [setupEncryption])

  const handleUnlock = useCallback(async () => {
    if (!unlockKey.trim()) return
    setUnlocking(true)
    const success = await unlock(unlockKey)
    setUnlocking(false)
    if (success) {
      setUnlockKey('')
    }
  }, [unlock, unlockKey])

  const handleLock = useCallback(() => {
    lock()
    setShowFields({})
  }, [lock])

  const onSubmit = useCallback(
    async (formData: SecureProfileFormData) => {
      setSaving(true)
      const success = await save(formData as SecureProfileData)
      setSaving(false)
      if (success) {
        reset(formData)
        onSave?.()
      }
    },
    [save, reset, onSave]
  )

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // First-time setup - no encryption key yet
  if (!hasEncryptionKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Set Up Secure Profile
          </CardTitle>
          <CardDescription>
            Your sensitive information will be encrypted and can only be accessed with your personal encryption key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newKey ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  Save Your Encryption Key
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  This key is required to access your encrypted data. Store it somewhere safe -
                  we cannot recover it if lost.
                </p>
                <code className="block p-3 bg-white dark:bg-gray-900 rounded border text-xs font-mono break-all">
                  {newKey}
                </code>
              </div>
              <Button onClick={() => setNewKey(null)} className="w-full">
                I&apos;ve Saved My Key - Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  How It Works
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>Your sensitive data is encrypted before storage</li>
                  <li>Only you can decrypt it with your personal key</li>
                  <li>Even we cannot access your encrypted information</li>
                </ul>
              </div>
              <Button onClick={handleSetupEncryption} className="w-full">
                <Shield className="h-4 w-4 mr-2" />
                Create Encryption Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Profile is locked - need to unlock
  if (!isUnlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Profile Locked
          </CardTitle>
          <CardDescription>
            Enter your encryption key to access your secure profile data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="unlock-key">Encryption Key</Label>
            <Input
              id="unlock-key"
              type="password"
              value={unlockKey}
              onChange={(e) => setUnlockKey(e.target.value)}
              placeholder="Paste your encryption key"
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
          </div>
          <Button onClick={handleUnlock} disabled={unlocking || !unlockKey.trim()} className="w-full">
            {unlocking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Unlock className="h-4 w-4 mr-2" />
            )}
            Unlock Profile
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Profile is unlocked - show form
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-green-600" />
              Secure Profile
            </CardTitle>
            <CardDescription>
              Your data is encrypted. Lock when done.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleLock}>
            <Lock className="h-4 w-4 mr-1" />
            Lock
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Identifiers */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Personal Identifiers
            </h3>

            <SensitiveField
              id="ssn"
              label="Social Security Number"
              placeholder="XXX-XX-XXXX"
              register={register}
              error={errors.ssn?.message}
              show={showFields.ssn}
              onToggle={() => toggleFieldVisibility('ssn')}
            />

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                {...register('date_of_birth')}
              />
            </div>

            <SensitiveField
              id="drivers_license"
              label="Driver's License Number"
              placeholder="License number"
              register={register}
              error={errors.drivers_license?.message}
              show={showFields.drivers_license}
              onToggle={() => toggleFieldVisibility('drivers_license')}
            />
          </div>

          {/* Financial Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Financial Information
            </h3>

            <SensitiveField
              id="income"
              label="Annual Income"
              placeholder="50000.00"
              register={register}
              error={errors.income?.message}
              show={showFields.income}
              onToggle={() => toggleFieldVisibility('income')}
            />

            <SensitiveField
              id="bank_account"
              label="Bank Account Number"
              placeholder="Account number"
              register={register}
              error={errors.bank_account?.message}
              show={showFields.bank_account}
              onToggle={() => toggleFieldVisibility('bank_account')}
            />

            <SensitiveField
              id="bank_routing"
              label="Bank Routing Number"
              placeholder="9-digit routing number"
              register={register}
              error={errors.bank_routing?.message}
              show={showFields.bank_routing}
              onToggle={() => toggleFieldVisibility('bank_routing')}
            />
          </div>

          {/* Other Information */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Additional Information
            </h3>

            <div className="space-y-2">
              <Label htmlFor="immigration_status">Immigration Status</Label>
              <Input
                id="immigration_status"
                placeholder="e.g., US Citizen, Permanent Resident"
                {...register('immigration_status')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medical_conditions">Medical Conditions</Label>
              <textarea
                id="medical_conditions"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="List any relevant medical conditions"
                {...register('medical_conditions')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">Current Medications</Label>
              <textarea
                id="medications"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="List current medications"
                {...register('medications')}
              />
            </div>
          </div>

          <Button type="submit" disabled={saving || !isDirty} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Encrypted Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Sensitive field component with show/hide toggle
interface SensitiveFieldProps {
  id: string
  label: string
  placeholder: string
  register: ReturnType<typeof useForm<SecureProfileFormData>>['register']
  error?: string
  show: boolean
  onToggle: () => void
}

function SensitiveField({
  id,
  label,
  placeholder,
  register,
  error,
  show,
  onToggle,
}: SensitiveFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          {...register(id as keyof SecureProfileFormData)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
