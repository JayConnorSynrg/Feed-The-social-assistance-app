import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ResourcesContent } from './resources-content'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Resources | FEED',
  description: 'Find community resources and support services near you',
}

// Type for resource row from database
interface ResourceRow {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  hours_of_operation: Record<string, string> | null
  location: { coordinates?: [number, number] } | null
}

export default async function ResourcesPage() {
  const supabase = await createClient()

  // Get initial resources for SSR
  const { data: initialResources } = await supabase
    .from('resources')
    .select(`
      id,
      name,
      description,
      category,
      address_line1,
      city,
      state,
      phone,
      website,
      hours_of_operation,
      location
    `)
    .eq('status', 'approved')
    .limit(100)

  // Transform resources with location data
  const resources = ((initialResources || []) as ResourceRow[]).map((row) => {
    let latitude = 0
    let longitude = 0

    if (row.location && row.location.coordinates) {
      ;[longitude, latitude] = row.location.coordinates
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      address_line1: row.address_line1,
      city: row.city,
      state: row.state,
      phone: row.phone,
      website: row.website,
      hours_of_operation: row.hours_of_operation,
      latitude,
      longitude,
    }
  }).filter((r) => r.latitude !== 0 && r.longitude !== 0)

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResourcesContent initialResources={resources} />
    </Suspense>
  )
}
