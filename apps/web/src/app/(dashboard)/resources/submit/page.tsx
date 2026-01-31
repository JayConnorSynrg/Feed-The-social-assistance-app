import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResourceForm } from '@/components/resources/resource-form'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Add Resource | FEED',
  description: 'Submit a community resource to help others in need',
}

async function ResourceFormWrapper() {
  // Check if user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/resources/submit')
  }

  return <ResourceForm />
}

export default function SubmitResourcePage() {
  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/resources">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Resources
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Submit a Resource</h1>
        <p className="text-muted-foreground mt-1">
          Help your community by sharing information about local resources and services.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ResourceFormWrapper />
      </Suspense>
    </div>
  )
}
