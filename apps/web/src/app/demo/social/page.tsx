'use client'

import { useState, useCallback } from 'react'
import { Heart, MessageCircle, Share2, Check, MapPin, Phone, Globe, Clock, ExternalLink, Copy, Image as ImageIcon } from 'lucide-react'
import { generateShareUrl, getAppUrl } from '@/lib/utils/url'

// ─── Mock Data (inline so this page is fully self-contained) ───

const MOCK_POSTS = [
  {
    id: 'post-001',
    content: "Just found out about FEED and I'm so grateful! Finally got help applying for SNAP benefits. The autofill feature saved me so much time. Thank you to this amazing community!",
    user: { full_name: 'Maria Garcia', username: 'maria_garcia', initials: 'MG' },
    likes: 24, comments: 5, created: '2 days ago',
  },
  {
    id: 'post-003',
    content: "Update on my job search journey: Thanks to the Chicago Job Center, I got help with my resume and had two interviews this week! Never give up. Resources are out there.",
    user: { full_name: 'James Wilson', username: 'james_wilson', initials: 'JW' },
    likes: 42, comments: 8, created: '4 days ago',
  },
  {
    id: 'post-005',
    content: "Food distribution tomorrow at LA Regional Food Bank! They're giving out fresh produce and dairy. Bring your own bags. No ID required. Spread the word!",
    user: { full_name: 'Maria Garcia', username: 'maria_garcia', initials: 'MG' },
    likes: 56, comments: 12, created: '6 days ago',
  },
]

const MOCK_RESOURCES = [
  {
    id: 'resource-001', name: 'LA Regional Food Bank', category: 'food', categoryColor: 'bg-green-100 text-green-800',
    description: 'Provides free groceries and food assistance to families in need.',
    address: '1734 E 41st Street, Los Angeles, CA', phone: '(323) 234-3030', website: 'lafoodbank.org',
  },
  {
    id: 'resource-002', name: 'PATH Housing Services', category: 'housing', categoryColor: 'bg-blue-100 text-blue-800',
    description: 'Emergency shelter and housing assistance for individuals and families.',
    address: '340 N Madison Ave, Los Angeles, CA', phone: '(323) 644-2200', website: 'epath.org',
  },
  {
    id: 'resource-007', name: 'Legal Aid Society of Miami', category: 'legal', categoryColor: 'bg-indigo-100 text-indigo-800',
    description: 'Free legal services for low-income individuals and families.',
    address: '3000 Biscayne Blvd, Miami, FL', phone: '(305) 576-0080', website: 'legalservicesmiami.org',
  },
]

const MOCK_PROFILES = [
  { id: 'profile-001', name: 'Maria Garcia', username: 'maria_garcia', initials: 'MG', venmo: 'maria-garcia-feed', paypal: null },
  { id: 'profile-002', name: 'James Wilson', username: 'james_wilson', initials: 'JW', venmo: null, paypal: 'james.wilson@email.com' },
]

// ─── Components ───

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-stone-800">{title}</h2>
      <p className="text-sm text-stone-500">{subtitle}</p>
    </div>
  )
}

function ShareButton({ type, id, label }: { type: 'post' | 'resource' | 'donate'; id: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const url = generateShareUrl(type, id)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [url])

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-xs bg-stone-100 px-3 py-2 rounded-lg truncate font-mono text-stone-600">
        {url}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 px-3 py-2 rounded-lg bg-lime-600 text-white text-sm font-medium hover:bg-lime-700 transition-colors flex items-center gap-1.5"
      >
        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> {label}</>}
      </button>
    </div>
  )
}

function OgPreview({ type, id, label }: { type: string; id: string; label: string }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const src = `${getAppUrl()}/api/og/${type}/${id}`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-lime-600 hover:underline flex items-center gap-1">
          Open raw <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="relative aspect-[1200/630] bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400">
            <ImageIcon className="h-8 w-8 animate-pulse" />
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            Requires running dev server with Supabase data
          </div>
        ) : (
          <img
            src={src}
            alt={`OG image for ${label}`}
            className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main Demo Page ───

export default function SocialDemo() {
  const appUrl = getAppUrl()

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-lime-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-lime-600 flex items-center justify-center text-white font-bold text-lg">F</div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Social Sharing Demo</h1>
              <p className="text-xs text-stone-500">FEED Smart Links + OG Cards</p>
            </div>
          </div>
          <a href="/" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
            Back to App
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-12">

        {/* ─── Section 1: Share URL Generation ─── */}
        <section>
          <SectionHeader
            title="1. Share URL Generation"
            subtitle="generateShareUrl() produces clean /s/ prefixed URLs for each content type"
          />
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            {MOCK_POSTS.slice(0, 2).map(post => (
              <div key={post.id}>
                <p className="text-sm text-stone-600 mb-1.5">Post by {post.user.full_name}</p>
                <ShareButton type="post" id={post.id} label="Copy" />
              </div>
            ))}
            <hr className="border-stone-100" />
            {MOCK_RESOURCES.slice(0, 2).map(resource => (
              <div key={resource.id}>
                <p className="text-sm text-stone-600 mb-1.5">Resource: {resource.name}</p>
                <ShareButton type="resource" id={resource.id} label="Copy" />
              </div>
            ))}
            <hr className="border-stone-100" />
            {MOCK_PROFILES.map(profile => (
              <div key={profile.id}>
                <p className="text-sm text-stone-600 mb-1.5">Donate to {profile.name}</p>
                <ShareButton type="donate" id={profile.id} label="Copy" />
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 2: OG Image Preview ─── */}
        <section>
          <SectionHeader
            title="2. OG Image Generation"
            subtitle="Dynamic 1200x630 images via /api/og/ — rendered as PNG by next/og ImageResponse"
          />
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-6">
            <OgPreview type="post" id="post-001" label="Post OG Card (Maria's post)" />
            <OgPreview type="resource" id="resource-001" label="Resource OG Card (LA Food Bank)" />
            <p className="text-xs text-stone-400 text-center">
              OG images fetch from Supabase — populate data to see live previews
            </p>
          </div>
        </section>

        {/* ─── Section 3: Post Landing Page Preview ─── */}
        <section>
          <SectionHeader
            title="3. Post Landing Page (/s/post/[id])"
            subtitle="Server-rendered page with OG metadata, engagement stats, and payment links"
          />
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            {/* Mock post card preview */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-lime-600 flex items-center justify-center text-white font-semibold">MG</div>
                <div>
                  <p className="font-semibold text-stone-800">Maria Garcia</p>
                  <p className="text-sm text-stone-500">@maria_garcia</p>
                </div>
              </div>
              <p className="text-stone-700 leading-relaxed">{MOCK_POSTS[0].content}</p>
              <div className="flex items-center gap-6 text-stone-500 text-sm border-t border-stone-100 pt-3">
                <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" /> 24 likes</span>
                <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> 5 comments</span>
              </div>
            </div>
            {/* Support section */}
            <div className="bg-stone-50 border-t border-stone-200 p-5 space-y-3">
              <h3 className="text-lg font-semibold text-stone-800">Support Maria Garcia</h3>
              <div className="flex gap-3">
                <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#008CFF] px-4 py-3 text-white font-medium">
                  Venmo @maria-garcia-feed
                </div>
              </div>
            </div>
            {/* CTA */}
            <div className="text-center p-5 border-t border-stone-100">
              <span className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold">
                Join FEED
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {MOCK_POSTS.map(post => (
              <div key={post.id} className="flex items-center gap-2">
                <a
                  href={`/s/post/${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-lime-600 hover:underline flex items-center gap-1"
                >
                  /s/post/{post.id} <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-xs text-stone-400">({post.user.full_name})</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 4: Resource Landing Page Preview ─── */}
        <section>
          <SectionHeader
            title="4. Resource Landing Page (/s/resource/[id])"
            subtitle="Category badge, contact info, address, and eligibility details"
          />
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">Food</span>
            <h3 className="text-2xl font-bold text-stone-800">LA Regional Food Bank</h3>
            <p className="text-stone-600">Provides free groceries and food assistance to families in need. No appointment necessary.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-stone-600">
                <MapPin className="h-5 w-5 text-stone-400 shrink-0" />
                <span>1734 E 41st Street, Los Angeles, CA 90058</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600">
                <Phone className="h-5 w-5 text-stone-400 shrink-0" />
                <span className="text-lime-700">(323) 234-3030</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600">
                <Globe className="h-5 w-5 text-stone-400 shrink-0" />
                <span className="text-lime-700">lafoodbank.org</span>
              </div>
              <div className="flex items-center gap-3 text-stone-600">
                <Clock className="h-5 w-5 text-stone-400 shrink-0" />
                <span>Mon-Fri: 8AM-5PM, Sat: 9AM-1PM</span>
              </div>
            </div>
            <div className="text-center pt-4">
              <span className="inline-flex items-center justify-center rounded-lg bg-lime-600 px-8 py-3 text-white font-semibold">
                View Full Details in FEED
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {MOCK_RESOURCES.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <a
                  href={`/s/resource/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-lime-600 hover:underline flex items-center gap-1"
                >
                  /s/resource/{r.id} <ExternalLink className="h-3 w-3" />
                </a>
                <span className={`text-xs px-2 py-0.5 rounded-full ${r.categoryColor}`}>{r.category}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 5: Donate Landing Page Preview ─── */}
        <section>
          <SectionHeader
            title="5. Donate Landing Page (/s/donate/[id])"
            subtitle="Venmo/PayPal deep link buttons for direct mutual aid"
          />
          <div className="bg-white rounded-xl border border-stone-200 p-6 text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-lime-600 flex items-center justify-center text-white text-2xl font-bold mx-auto">MG</div>
            <div>
              <h3 className="text-xl font-bold text-stone-800">Maria Garcia</h3>
              <p className="text-stone-500">@maria_garcia</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#008CFF] px-6 py-4 text-white text-lg font-semibold">
                Send via Venmo <span className="text-sm font-normal opacity-80">@maria-garcia-feed</span>
              </div>
              <div className="flex items-center justify-center gap-3 w-full rounded-xl bg-[#0070BA] px-6 py-4 text-white text-lg font-semibold">
                Send via PayPal
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {MOCK_PROFILES.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <a
                  href={`/s/donate/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-lime-600 hover:underline flex items-center gap-1"
                >
                  /s/donate/{p.id} <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-xs text-stone-400">
                  ({p.venmo ? `Venmo: @${p.venmo}` : ''}{p.paypal ? `PayPal: ${p.paypal}` : ''})
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Section 6: PostCard Share Button ─── */}
        <section>
          <SectionHeader
            title="6. PostCard Share Integration"
            subtitle="Share button uses Web Share API on mobile, clipboard copy on desktop"
          />
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="p-4 space-y-3">
              {MOCK_POSTS.map(post => (
                <PostCardDemo key={post.id} post={post} />
              ))}
            </div>
          </div>
        </section>

        {/* ─── Section 7: Meta Tags ─── */}
        <section>
          <SectionHeader
            title="7. Root Layout Metadata"
            subtitle="Default OG/Twitter tags applied to all pages — social pages override with dynamic metadata"
          />
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <pre className="text-xs text-stone-600 font-mono whitespace-pre-wrap">{`<title>FEED - Mutual Aid Resource Sharing</title>
<meta name="description" content="Community-powered mutual aid..." />

<!-- OG Tags (default) -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="FEED" />
<meta property="og:title" content="FEED - Mutual Aid Resource Sharing" />

<!-- Twitter Card (default) -->
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="FEED - Mutual Aid Resource Sharing" />

<!-- Social pages override with: -->
<meta property="og:image" content="${appUrl}/api/og/post/[id]" />
<meta name="twitter:card" content="summary_large_image" />`}</pre>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-sm text-stone-400 pb-8">
          FEED Social Sharing Demo — {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}

// ─── PostCard Demo (inline) ───

function PostCardDemo({ post }: { post: typeof MOCK_POSTS[0] }) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(post.likes)
  const [shareConfirm, setShareConfirm] = useState(false)

  const handleShare = useCallback(async () => {
    const url = generateShareUrl('post', post.id)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${post.user.full_name} on FEED`, text: post.content.slice(0, 100), url })
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setShareConfirm(true)
      setTimeout(() => setShareConfirm(false), 2000)
    }
  }, [post])

  return (
    <div className="border border-stone-100 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-lime-600 flex items-center justify-center text-white text-sm font-semibold">
          {post.user.initials}
        </div>
        <div>
          <p className="font-semibold text-stone-800 text-sm">{post.user.full_name}</p>
          <p className="text-xs text-stone-500">{post.created}</p>
        </div>
      </div>
      <p className="text-sm text-stone-700">{post.content.length > 120 ? post.content.slice(0, 117) + '...' : post.content}</p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setLiked(!liked); setLikes(liked ? likes - 1 : likes + 1) }}
          className={`flex items-center gap-1 text-sm ${liked ? 'text-red-500' : 'text-stone-500'} hover:text-red-500 transition-colors`}
        >
          <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
          {likes}
        </button>
        <button className="flex items-center gap-1 text-sm text-stone-500">
          <MessageCircle className="h-4 w-4" /> {post.comments}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-lime-600 transition-colors"
        >
          {shareConfirm ? <><Check className="h-4 w-4 text-green-600" /> Copied!</> : <><Share2 className="h-4 w-4" /> Share</>}
        </button>
      </div>
    </div>
  )
}
