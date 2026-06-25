import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PostGroup = {
  type: string
  count: number
  excerpts: string[]
}

type Theme = {
  type: string
  label: string
  summary: string
  count: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_current_user_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const body = await req.json() as { groups?: PostGroup[] }
  const groups: PostGroup[] = body.groups ?? []

  // k≥20 gate
  const validGroups = groups.filter((g) => g.count >= 20)
  if (validGroups.length === 0) {
    return NextResponse.json({ themes: [], suppressed: true })
  }

  const apiKey = process.env.FIREWORKS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ themes: [], error: 'No AI key configured' })
  }

  const prompt = `You are analyzing community support posts from a mutual aid platform.
For each post category below, provide:
1. A 1-3 word theme label
2. A single sentence describing the community need

Categories:
${validGroups.map((g) => `${g.type} (${g.count} posts): ${g.excerpts.join(' | ')}`).join('\n')}

Respond as JSON: { "themes": [{ "type": string, "label": string, "summary": string, "count": number }] }`

  try {
    const res = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ themes: [], error: 'AI service unavailable' })
    }

    const aiRes = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = aiRes.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content) as { themes?: Theme[] }
    // Merge counts from our validated groups into parsed themes
    const countMap: Record<string, number> = {}
    for (const g of validGroups) countMap[g.type] = g.count
    if (parsed.themes) {
      for (const t of parsed.themes) {
        if (countMap[t.type]) t.count = countMap[t.type]
      }
    }
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ themes: [], error: 'Parse error' })
  }
}
