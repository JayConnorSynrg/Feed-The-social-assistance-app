import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { fetchOrganizationById } from '@/lib/org-data'

export const runtime = 'edge'

const ORG_TEAL = '#0f766e'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const org = await fetchOrganizationById(supabase, id)
  if (!org) {
    return new Response('Organization not found', { status: 404 })
  }

  const description = org.description
    ? org.description.length > 150
      ? org.description.slice(0, 147) + '...'
      : org.description
    : ''
  const location = [org.city, org.state].filter(Boolean).join(', ')

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
          background: 'linear-gradient(135deg, #fafaf9 0%, #f0fdfa 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Badge + name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                background: ORG_TEAL,
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              Local organization
            </div>
          </div>
          <span style={{ fontSize: '40px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>
            {org.name}
          </span>
        </div>

        {/* Description + Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, paddingTop: '24px' }}>
          {description && (
            <span style={{ fontSize: '24px', color: '#44403c', lineHeight: 1.4 }}>{description}</span>
          )}
          {location && <span style={{ fontSize: '20px', color: '#78716c' }}>{location}</span>}
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
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#65a30d' }}>FEED</span>
          </div>
          <span style={{ fontSize: '18px', color: '#a8a29e' }}>Local Organization</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
