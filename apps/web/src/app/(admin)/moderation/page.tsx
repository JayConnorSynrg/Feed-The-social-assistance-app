import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ModerationQueue } from './moderation-queue'
import { SafetyAlertsReview } from './safety-alerts-review'
import { ReportsQueue } from './reports-queue'
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

interface ReportRow {
  id: string
  reporter_id: string
  content_type: string
  content_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
}

interface ContentGroup {
  content_id: string
  post_content: string | null
  post_author: string | null
  reports: ReportRow[]
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
  void profile

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

async function ReportsContent() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch open content_reports with post content + author name
  const { data: reports } = await supabase
    .from('content_reports')
    .select(`
      id,
      reporter_id,
      content_type,
      content_id,
      reason,
      details,
      status,
      created_at
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  if (!reports || reports.length === 0) {
    return <ReportsQueue initialGroups={[]} />
  }

  // Fetch post content + author names for each distinct content_id
  const postIds = [...new Set(reports.map((r) => r.content_id))]

  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, user:profiles!posts_user_id_fkey(first_name)')
    .in('id', postIds)

  const postMap = new Map(
    (posts || []).map((p) => [
      p.id,
      {
        content: p.content as string,
        author: (p.user as { first_name: string | null } | null)?.first_name ?? null,
      },
    ])
  )

  // Group reports by content_id
  const groupMap = new Map<string, ContentGroup>()
  for (const report of reports) {
    if (!groupMap.has(report.content_id)) {
      const post = postMap.get(report.content_id)
      groupMap.set(report.content_id, {
        content_id: report.content_id,
        post_content: post?.content ?? null,
        post_author: post?.author ?? null,
        reports: [],
      })
    }
    groupMap.get(report.content_id)!.reports.push(report as ReportRow)
  }

  // Sort groups by descending report count
  const groups = [...groupMap.values()].sort(
    (a, b) => b.reports.length - a.reports.length
  )

  return <ReportsQueue initialGroups={groups} />
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

      {/* Content reports — community flags awaiting staff review */}
      <div className="mt-10">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Content Reports</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Posts flagged by community members. Dismiss to restore visibility; uphold to keep hidden.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ReportsContent />
        </Suspense>
      </div>

      {/* Safety alerts post-hoc review — pins go live instantly, admins review here */}
      <div className="mt-10">
        <SafetyAlertsReview />
      </div>
    </div>
  )
}
