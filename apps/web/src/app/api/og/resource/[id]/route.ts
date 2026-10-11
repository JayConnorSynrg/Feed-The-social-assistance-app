// apps/web/src/app/api/og/resource/[id]/route.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Share-preview image for a community resource: the pre-rendered "Community resource" card
// (lib/og-card.ts). The resource's name, description and place are never read here: they reach a
// preview as og:title / og:description on /s/resource/[id] (docs/share-previews.md).
//
// 200 image/png — an approved resource. 404 "Resource not found" — pending, rejected or unknown.

import { createClient } from '@/lib/supabase/server'
import { serveOgCard } from '@/lib/og-card'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return serveOgCard('resource', 'Resource not found', async () => {
    const supabase = await createClient()
    const { data: resource } = await supabase
      .from('resources')
      .select('id')
      .eq('id', id)
      .eq('status', 'approved')
      .single()
    return resource ? 'resource' : null
  })
}
