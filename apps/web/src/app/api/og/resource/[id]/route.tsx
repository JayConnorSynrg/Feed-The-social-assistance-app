import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

const CATEGORY_COLORS: Record<string, string> = {
  food: '#16a34a',
  housing: '#2563eb',
  healthcare: '#dc2626',
  employment: '#ca8a04',
  education: '#7c3aed',
  legal: '#4f46e5',
  transportation: '#0891b2',
  utilities: '#ea580c',
  clothing: '#db2777',
  financial: '#059669',
  mental_health: '#7c3aed',
  substance_abuse: '#9333ea',
  domestic_violence: '#e11d48',
  childcare: '#f59e0b',
  senior_services: '#6366f1',
  disability_services: '#0d9488',
  veteran_services: '#1d4ed8',
  immigration: '#7c2d12',
  other: '#737373',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: resource } = await supabase
    .from('resources')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!resource) {
    return new Response('Resource not found', { status: 404 })
  }

  const categoryColor = CATEGORY_COLORS[resource.category] || '#737373'
  const categoryLabel = resource.category.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  const description = resource.description
    ? resource.description.length > 150
      ? resource.description.slice(0, 147) + '...'
      : resource.description
    : ''
  const location = [resource.city, resource.state].filter(Boolean).join(', ')

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
        {/* Category badge + name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                background: categoryColor,
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              {categoryLabel}
            </div>
          </div>
          <span style={{ fontSize: '40px', fontWeight: 700, color: '#1c1917', lineHeight: 1.2 }}>
            {resource.name}
          </span>
        </div>

        {/* Description + Location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, paddingTop: '24px' }}>
          {description && (
            <span style={{ fontSize: '24px', color: '#44403c', lineHeight: 1.4 }}>
              {description}
            </span>
          )}
          {location && (
            <span style={{ fontSize: '20px', color: '#78716c' }}>
              {location}
            </span>
          )}
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
            Community Resource
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
