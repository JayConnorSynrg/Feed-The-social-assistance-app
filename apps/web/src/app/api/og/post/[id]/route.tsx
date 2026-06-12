import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('posts')
    .select('*, user:profiles(first_name, avatar_url, username)')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()

  if (!post) {
    return new Response('Post not found', { status: 404 })
  }

  const user = post.user as { first_name: string | null; avatar_url: string | null; username: string | null } | null
  const displayName = user?.first_name || 'Community Member'
  const handle = user?.username ? `@${user.username}` : ''
  const content = post.content.length > 200
    ? post.content.slice(0, 197) + '...'
    : post.content

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          background: 'linear-gradient(135deg, #fafaf9 0%, #f7fee7 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '28px',
              background: '#65a30d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '24px', fontWeight: 600, color: '#1c1917' }}>
              {displayName}
            </span>
            {handle && (
              <span style={{ fontSize: '18px', color: '#78716c' }}>
                {handle}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            fontSize: '32px',
            lineHeight: 1.4,
            color: '#292524',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            paddingTop: '24px',
            paddingBottom: '24px',
          }}
        >
          {content}
        </div>

        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#65a30d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: 800,
              }}
            >
              F
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#65a30d' }}>
              FEED
            </span>
          </div>
          <span style={{ fontSize: '18px', color: '#a8a29e' }}>
            Mutual Aid Resource Sharing
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
