// apps/web/src/app/api/og/business/[id]/route.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Share-preview image for a local business: the pre-rendered "Local business" card (lib/og-card.ts).
// The business's name, description and place are never drawn: they reach a preview as og:title /
// og:description on /s/business/[id] (docs/share-previews.md).
//
// 200 image/png — an approved, active business. 404 "Business not found" — anything else. The
// visibility rule is fetchApprovedBusinessById's, the same reader the public page uses.

import { createClient } from '@/lib/supabase/server'
import { fetchApprovedBusinessById } from '@/lib/business-data'
import { serveOgCard } from '@/lib/og-card'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return serveOgCard('business', 'Business not found', async () => {
    const supabase = await createClient()
    const business = await fetchApprovedBusinessById(supabase, id)
    return business ? 'business' : null
  })
}
