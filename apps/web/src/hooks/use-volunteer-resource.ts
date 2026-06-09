'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'

// All volunteer-offerable categories (expanded to include Phase 8 additions).
// Sourced from lib/resource-categories.ts VOLUNTEER_CATEGORIES — kept as string here
// so the hook remains decoupled from the UI layer import.
type ResourceCategory = string

interface VolunteerResourceFormData {
  category: ResourceCategory
  description: string
  contact?: string
  directions?: string
  availability?: string
}

interface VolunteerResource {
  id: string
  name: string
  category: string
  description: string | null
  status: string | null
  created_at: string | null
}

export function useVolunteerResource() {
  const supabase = createClient()
  const { user, profile } = useAuth()
  const [myResources, setMyResources] = useState<VolunteerResource[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMyResources = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('resources')
        .select('id, name, category, description, status, created_at')
        .eq('submitted_by', user.id)
        .eq('is_volunteer_resource', true)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })

      if (fetchError) throw new Error(fetchError.message)
      setMyResources(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resources')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id])

  useEffect(() => {
    fetchMyResources()
  }, [fetchMyResources])

  const registerResource = useCallback(async (formData: VolunteerResourceFormData) => {
    if (!user?.id) {
      setError('Please sign in to register as a volunteer resource')
      return null
    }

    setIsRegistering(true)
    setError(null)

    try {
      const resourceName = profile?.full_name || 'Volunteer'

      const { data, error: insertError } = await supabase
        .from('resources')
        .insert({
          name: resourceName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          category: formData.category as any,
          description: formData.description,
          phone: formData.contact || null,
          address_line1: formData.directions || null,
          eligibility_requirements: formData.availability || null,
          status: 'approved',
          source: 'user_submitted',
          is_volunteer_resource: true,
          submitted_by: user.id,
        })
        .select('id')
        .single()

      if (insertError) throw new Error(insertError.message)

      // Set PostGIS location from profile coordinates
      if (profile?.latitude && profile?.longitude && data?.id) {
        await supabase.rpc('set_resource_location_by_id', {
          p_id: data.id,
          p_lat: profile.latitude,
          p_lng: profile.longitude,
        })
      }

      await fetchMyResources()
      return data as { id: string }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register resource')
      return null
    } finally {
      setIsRegistering(false)
    }
  }, [supabase, user?.id, profile, fetchMyResources])

  const withdrawResource = useCallback(async (resourceId: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('resources')
        .update({ status: 'archived' })
        .eq('id', resourceId)
        .eq('submitted_by', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchMyResources()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw resource')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchMyResources])

  return {
    myResources,
    isLoading,
    isRegistering,
    error,
    registerResource,
    withdrawResource,
    hasLocation: !!(profile?.latitude && profile?.longitude),
  }
}
