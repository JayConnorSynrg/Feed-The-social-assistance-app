import { createClient } from '@/lib/supabase/server'
import { FeedContent } from './feed-content'
import type { Post, Profile } from '@feed/database'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const supabase = await createClient()

  // Fetch initial posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*, user:profiles(id, username, full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(20)

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <FeedContent
      initialPosts={(posts as (Post & { user?: Profile })[]) || []}
      userProfile={profile}
    />
  )
}
