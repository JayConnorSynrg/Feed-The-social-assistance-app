import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PostCard } from '@/components/feed/post-card'
import { MapPin, Calendar, ExternalLink } from 'lucide-react'
import type { Profile } from '@feed/database'

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

interface PostWithUser {
  id: string
  user_id: string
  content: string
  image_url: string | null
  is_pinned: boolean
  is_hidden: boolean
  created_at: string
  updated_at: string
  user: {
    id: string
    username: string | null
    full_name: string | null
    avatar_url: string | null
  }
}

export async function generateMetadata({ params }: ProfilePageProps) {
  const { username } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('username', username)
    .single()

  const profile = data as { full_name: string | null; username: string | null } | null

  if (!profile) {
    return {
      title: 'User Not Found | FEED',
    }
  }

  return {
    title: `${profile.full_name || profile.username} | FEED`,
    description: `View ${profile.full_name || profile.username}'s profile on FEED`,
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get profile by username — safe columns only (PII hardening: no phone/paypal/venmo/is_admin)
  const { data: profileData, error } = await supabase
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, bio, location_city, location_state, ' +
      'is_verified, created_at, is_staff'
    )
    .eq('username', username)
    .single()

  if (error || !profileData) {
    notFound()
  }

  const profile = profileData as unknown as Pick<Profile,
    'id' | 'username' | 'full_name' | 'avatar_url' | 'bio' |
    'location_city' | 'location_state' | 'is_verified' | 'created_at'
  > & { is_staff: boolean }

  // Fetch payment handles via SECURITY DEFINER RPC — isolated column access
  const { data: donationHandles } = await supabase
    .rpc('get_donation_handles', { target_id: profile.id })
  const handles = Array.isArray(donationHandles) && donationHandles.length > 0
    ? donationHandles[0] as { paypal_email: string | null; venmo_username: string | null }
    : { paypal_email: null, venmo_username: null }

  // Get user's posts
  const { data: postsData } = await supabase
    .from('posts')
    .select('*, user:profiles(id, username, full_name, avatar_url)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const posts = (postsData || []) as PostWithUser[]

  const isOwnProfile = user?.id === profile.id

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src={profile.avatar_url || undefined}
                alt={profile.full_name || profile.username || 'User'}
              />
              <AvatarFallback className="text-2xl">
                {getInitials(profile.full_name || profile.username)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">
                {profile.full_name || profile.username || 'Anonymous'}
              </h1>
              {profile.username && (
                <p className="text-muted-foreground">@{profile.username}</p>
              )}

              {profile.bio && (
                <p className="mt-2 text-sm">{profile.bio}</p>
              )}

              <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
                {(profile.location_city || profile.location_state) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {[profile.location_city, profile.location_state].filter(Boolean).join(', ')}
                  </span>
                )}
                {profile.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDate(profile.created_at)}
                  </span>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Edit Profile</Link>
              </Button>
            )}
          </div>
        </CardHeader>

        {(handles.venmo_username || handles.paypal_email) && (
          <CardContent className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Support This User
            </h2>
            <div className="flex flex-wrap gap-2">
              {handles.venmo_username && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://venmo.com/${handles.venmo_username.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Venmo
                  </a>
                </Button>
              )}
              {handles.paypal_email && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://paypal.me/${handles.paypal_email}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    PayPal
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Posts</h2>
      </div>

      {posts && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post as unknown as Parameters<typeof PostCard>[0]['post']}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No posts yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
