'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@feed/database'

const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional()
    .or(z.literal('')),
  full_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .optional()
    .or(z.literal('')),
  location_city: z
    .string()
    .max(100, 'City must be at most 100 characters')
    .optional()
    .or(z.literal('')),
  location_state: z
    .string()
    .max(50, 'State must be at most 50 characters')
    .optional()
    .or(z.literal('')),
  venmo_username: z
    .string()
    .max(50, 'Venmo username must be at most 50 characters')
    .optional()
    .or(z.literal('')),
  paypal_email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileFormProps {
  profile: Profile | null
  onSuccess?: () => void
}

export function ProfileForm({ profile, onSuccess }: ProfileFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: profile?.username || '',
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      location_city: profile?.location_city || '',
      location_state: profile?.location_state || '',
      venmo_username: profile?.venmo_username || '',
      paypal_email: profile?.paypal_email || '',
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile?.id) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const updates: Partial<Profile> = {}

      if (data.username) updates.username = data.username
      if (data.full_name) updates.full_name = data.full_name
      if (data.bio !== undefined) updates.bio = data.bio || null
      if (data.location_city !== undefined) updates.location_city = data.location_city || null
      if (data.location_state !== undefined) updates.location_state = data.location_state || null
      if (data.venmo_username !== undefined) updates.venmo_username = data.venmo_username || null
      if (data.paypal_email !== undefined) updates.paypal_email = data.paypal_email || null

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates as never)
        .eq('id', profile.id)

      if (updateError) throw updateError

      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Update your profile information visible to others
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="johndoe"
                {...register('username')}
                disabled={loading}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                {...register('full_name')}
                disabled={loading}
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">{errors.full_name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              rows={3}
              {...register('bio')}
              disabled={loading}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location_city">City</Label>
              <Input
                id="location_city"
                placeholder="San Francisco"
                {...register('location_city')}
                disabled={loading}
              />
              {errors.location_city && (
                <p className="text-sm text-destructive">{errors.location_city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_state">State</Label>
              <Input
                id="location_state"
                placeholder="California"
                {...register('location_state')}
                disabled={loading}
              />
              {errors.location_state && (
                <p className="text-sm text-destructive">{errors.location_state.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Links</CardTitle>
          <CardDescription>
            Add payment links so supporters can help you directly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venmo_username">Venmo Username</Label>
              <Input
                id="venmo_username"
                placeholder="@johndoe"
                {...register('venmo_username')}
                disabled={loading}
              />
              {errors.venmo_username && (
                <p className="text-sm text-destructive">{errors.venmo_username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paypal_email">PayPal Email</Label>
              <Input
                id="paypal_email"
                type="email"
                placeholder="john@example.com"
                {...register('paypal_email')}
                disabled={loading}
              />
              {errors.paypal_email && (
                <p className="text-sm text-destructive">{errors.paypal_email.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
          Profile updated successfully!
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={loading || !isDirty}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  )
}
