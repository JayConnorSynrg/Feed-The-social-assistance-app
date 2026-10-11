// apps/web/src/app/api/og/organization/[id]/route.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Share-preview image for a local organization: the pre-rendered "Local organization" card
// (lib/og-card.ts). The organization's name, description and place are never drawn: they reach a
// preview as og:title / og:description on /s/organization/[id] (docs/share-previews.md).
//
// 200 image/png — an active organization. 404 "Organization not found" — anything else. The
// visibility rule is fetchOrganizationById's, the same reader the public page uses.

import { createClient } from '@/lib/supabase/server'
import { fetchOrganizationById } from '@/lib/org-data'
import { serveOgCard } from '@/lib/og-card'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return serveOgCard('organization', 'Organization not found', async () => {
    const supabase = await createClient()
    const org = await fetchOrganizationById(supabase, id)
    return org ? 'organization' : null
  })
}
