'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

// Resource categories
const RESOURCE_CATEGORIES = [
  { value: 'food', label: 'Food & Nutrition' },
  { value: 'housing', label: 'Housing & Shelter' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'substance_abuse', label: 'Substance Abuse' },
  { value: 'employment', label: 'Employment' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities Assistance' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'financial', label: 'Financial Assistance' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'senior_services', label: 'Senior Services' },
  { value: 'disability_services', label: 'Disability Services' },
  { value: 'veteran_services', label: 'Veteran Services' },
  { value: 'domestic_violence', label: 'Domestic Violence' },
  { value: 'immigration', label: 'Immigration Services' },
  { value: 'other', label: 'Other' },
] as const

// Validation schema
const resourceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description too long'),
  category: z.string().min(1, 'Please select a category'),
  address_line1: z.string().min(3, 'Please enter an address'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'Please enter a city'),
  state: z.string().length(2, 'Please enter a 2-letter state code'),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code'),
  phone: z.string().optional().refine(
    (val) => !val || /^[\d\s\-().+]+$/.test(val),
    'Please enter a valid phone number'
  ),
  website: z.string().optional().refine(
    (val) => !val || /^https?:\/\//.test(val) || !val.includes('.'),
    'Please enter a valid URL starting with http:// or https://'
  ),
  email: z.string().optional().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Please enter a valid email'
  ),
  hours_monday: z.string().optional(),
  hours_tuesday: z.string().optional(),
  hours_wednesday: z.string().optional(),
  hours_thursday: z.string().optional(),
  hours_friday: z.string().optional(),
  hours_saturday: z.string().optional(),
  hours_sunday: z.string().optional(),
})

type ResourceFormData = z.infer<typeof resourceSchema>

interface ResourceFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function ResourceForm({ onSuccess, onCancel }: ResourceFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<ResourceFormData>({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      category: '',
      state: '',
    },
  })

  const category = watch('category')

  // Handle category selection
  const handleCategoryChange = useCallback(
    (value: string) => {
      setValue('category', value)
    },
    [setValue]
  )

  // Geocode address to get coordinates
  const geocodeAddress = async (
    address: string,
    city: string,
    state: string,
    zip: string
  ): Promise<{ lat: number; lng: number } | null> => {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!mapboxToken || mapboxToken.includes('placeholder')) {
      return null
    }

    const query = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&limit=1`
      )
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center
        return { lat, lng }
      }
    } catch (error) {
      console.error('Geocoding error:', error)
    }
    return null
  }

  // Handle form submission
  const onSubmit = async (data: ResourceFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Geocode the address
      const coordinates = await geocodeAddress(
        data.address_line1,
        data.city,
        data.state,
        data.zip_code
      )

      // Build hours of operation object
      const hoursOfOperation: Record<string, string> = {}
      if (data.hours_monday) hoursOfOperation.monday = data.hours_monday
      if (data.hours_tuesday) hoursOfOperation.tuesday = data.hours_tuesday
      if (data.hours_wednesday) hoursOfOperation.wednesday = data.hours_wednesday
      if (data.hours_thursday) hoursOfOperation.thursday = data.hours_thursday
      if (data.hours_friday) hoursOfOperation.friday = data.hours_friday
      if (data.hours_saturday) hoursOfOperation.saturday = data.hours_saturday
      if (data.hours_sunday) hoursOfOperation.sunday = data.hours_sunday

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Prepare resource data
      const resourceData = {
        name: data.name,
        description: data.description,
        category: data.category,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        phone: data.phone || null,
        website: data.website || null,
        email: data.email || null,
        hours_of_operation: Object.keys(hoursOfOperation).length > 0 ? hoursOfOperation : null,
        latitude: coordinates?.lat || null,
        longitude: coordinates?.lng || null,
        status: 'pending', // Requires moderation
        submitted_by: user?.id || null,
        external_source: 'user',
      }

      // Insert into database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('resources')
        .insert(resourceData)

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSubmitSuccess(true)
      reset()
      onSuccess?.()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit resource')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitSuccess) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Resource Submitted!</h3>
            <p className="text-muted-foreground">
              Thank you for contributing to the community. Your submission will be reviewed
              by a moderator and will appear on the map once approved.
            </p>
            <Button onClick={() => setSubmitSuccess(false)}>
              Submit Another Resource
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a Resource</CardTitle>
        <CardDescription>
          Help your community by sharing information about local resources and services.
          All submissions are reviewed before being published.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="name">Resource Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Downtown Food Pantry"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe the services offered, eligibility requirements, etc."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="font-medium">Location</h3>

            <div className="space-y-2">
              <Label htmlFor="address_line1">Street Address *</Label>
              <Input
                id="address_line1"
                placeholder="123 Main Street"
                {...register('address_line1')}
              />
              {errors.address_line1 && (
                <p className="text-sm text-destructive">{errors.address_line1.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Suite/Unit (Optional)</Label>
              <Input
                id="address_line2"
                placeholder="Suite 100"
                {...register('address_line2')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="city">City *</Label>
                <Input id="city" placeholder="City" {...register('city')} />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  placeholder="CA"
                  maxLength={2}
                  {...register('state')}
                />
                {errors.state && (
                  <p className="text-sm text-destructive">{errors.state.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code *</Label>
                <Input id="zip_code" placeholder="12345" {...register('zip_code')} />
                {errors.zip_code && (
                  <p className="text-sm text-destructive">{errors.zip_code.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-medium">Contact Information (Optional)</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@example.org"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.org"
                {...register('website')}
              />
              {errors.website && (
                <p className="text-sm text-destructive">{errors.website.message}</p>
              )}
            </div>
          </div>

          {/* Hours of Operation */}
          <div className="space-y-4">
            <h3 className="font-medium">Hours of Operation (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Enter hours in format like &quot;9:00 AM - 5:00 PM&quot; or &quot;Closed&quot;
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { day: 'monday', label: 'Monday' },
                { day: 'tuesday', label: 'Tuesday' },
                { day: 'wednesday', label: 'Wednesday' },
                { day: 'thursday', label: 'Thursday' },
                { day: 'friday', label: 'Friday' },
                { day: 'saturday', label: 'Saturday' },
                { day: 'sunday', label: 'Sunday' },
              ].map(({ day, label }) => (
                <div key={day} className="space-y-2">
                  <Label htmlFor={`hours_${day}`}>{label}</Label>
                  <Input
                    id={`hours_${day}`}
                    placeholder="9:00 AM - 5:00 PM"
                    {...register(`hours_${day}` as keyof ResourceFormData)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="rounded-md bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Resource
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
