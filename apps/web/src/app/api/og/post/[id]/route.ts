// apps/web/src/app/api/og/post/[id]/route.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Share-preview image for a post. Answers with the pre-rendered card for the post's type
// (lib/og-card.ts). The post's text and its author are never read here: they reach a preview as
// og:title / og:description on /s/post/[id], never as pixels (docs/share-previews.md).
//
// 200 image/png — a visible post. 404 "Post not found" — a hidden or deleted post, or an unknown id.

import { createClient } from '@/lib/supabase/server'
import { postCardKind, serveOgCard } from '@/lib/og-card'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return serveOgCard('post', 'Post not found', async () => {
    const supabase = await createClient()
    // Explicit column list: the type picks the card; nothing else about the post is needed.
    const { data: post } = await supabase
      .from('posts')
      .select('id, post_type')
      .eq('id', id)
      .eq('is_hidden', false)
      .single()
    return post ? postCardKind(post.post_type) : null
  })
}
