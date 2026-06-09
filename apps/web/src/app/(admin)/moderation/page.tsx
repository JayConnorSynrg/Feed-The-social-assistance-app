import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ModerationQueue } from './moderation-queue'
import { SafetyAlertsReview } from './safety-alerts-review'
import { Loader2 } from 'lucide-react'

export const metadata = {
  title: 'Resource Moderation | FEED Admin',
  description: 'Review and moderate community resource submissions',
}

// Type for pending resource
interface PendingResource {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  created_at: string
  submitted_by: string | null
  submitter?: {
    id: string
    full_name: string | null
    email: string | null
  } | null
}

async function ModerationContent() {
  const supabase = await createClient()

  // Check if user is authenticated and is admin
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/moderation')
  }

  // Check admin role (you'd need to implement this based on your auth setup)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // For now, allow any authenticated user - in production, check for admin role
  // if (profile?.role !== 'admin') {
  //   redirect('/')
  // }

  // Get pending resources
  const { data: pendingResources } = await supabase
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
      created_at,
      submitted_by
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // Type the result
  const resources = (pendingResources || []) as PendingResource[]

  return <ModerationQueue initialResources={resources} />
}

export default function ModerationPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Resource Moderation</h1>
        <p className="text-muted-foreground mt-2">
          Review and approve or reject community-submitted resources.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ModerationContent />
      </Suspense>

      {/* Safety alerts post-hoc review — pins go live instantly, admins review here */}
      <div className="mt-10">
        <SafetyAlertsReview />
      </div>
    </div>
  )
}
