// supabase/functions/chat/index.ts
// OpenRouter Edge Function - Secure AI chat proxy
// Keeps API key server-side, supports streaming responses

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Model fallback chain - cost-effective to premium
const MODEL_FALLBACK_CHAIN = [
  'mistralai/mistral-7b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3.5-sonnet',
]

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 20, // 20 requests per minute per user
}

// CORS configuration - restrict to app domains
const ALLOWED_ORIGINS = [
  Deno.env.get('APP_URL') || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  'capacitor://localhost',  // Mobile app (iOS)
  'http://localhost',       // Mobile app (Android webview)
  'ionic://localhost',      // Ionic dev
]

// Get CORS headers with validated origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] // Default to APP_URL

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  model?: string
  stream?: boolean
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  location?: { city?: string; state?: string; lat?: number; lng?: number }
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory rate limit store (resets on function cold start)
const rateLimitStore = new Map<string, RateLimitEntry>()

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT.windowMs,
    })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetAt: now + RATE_LIMIT.windowMs }
  }

  if (entry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: RATE_LIMIT.maxRequests - entry.count, resetAt: entry.resetAt }
}

async function authenticateUser(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return { userId: user.id }
}

async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  stream: boolean,
  temperature: number,
  maxTokens: number
): Promise<Response> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://feed.app',
      'X-Title': 'FEED Mutual Aid Platform',
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  return response
}

async function handleStreamingResponse(
  openRouterResponse: Response,
  modelUsed: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const reader = openRouterResponse.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Send model info first
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'meta', model: modelUsed })}\n\n`))

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              } else {
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

async function handleNonStreamingResponse(
  openRouterResponse: Response,
  modelUsed: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const data = await openRouterResponse.json()
  const content = data.choices?.[0]?.message?.content || ''
  const usage = data.usage || {}

  return new Response(
    JSON.stringify({
      content,
      model: modelUsed,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function tryModelWithFallback(
  messages: ChatMessage[],
  preferredModel: string | undefined,
  stream: boolean,
  temperature: number,
  maxTokens: number
): Promise<{ response: Response; model: string }> {
  // If preferred model specified, try it first
  const modelsToTry = preferredModel
    ? [preferredModel, ...MODEL_FALLBACK_CHAIN.filter(m => m !== preferredModel)]
    : MODEL_FALLBACK_CHAIN

  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const response = await callOpenRouter(messages, model, stream, temperature, maxTokens)

      if (response.ok) {
        return { response, model }
      }

      // 429 = rate limited, 503 = model unavailable - try next
      if (response.status === 429 || response.status === 503) {
        continue
      }

      // Other errors - throw immediately
      const errorData = await response.json()
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    } catch (error) {
      lastError = error as Error
      continue
    }
  }

  throw lastError || new Error('All models failed')
}

async function searchResources(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  query: string,
  location: { city?: string; state?: string } | null,
  messages: ChatMessage[]
): Promise<string> {
  const sections: string[] = []
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')

  // Run DB query and Firecrawl /search in parallel
  const t0 = Date.now()

  const [dbResult, searchResult] = await Promise.all([
    // DB query
    (async () => {
      try {
        let q = supabaseClient
          .from('resources')
          .select('name, description, category, address_line1, city, state, phone, website')
          .eq('status', 'approved')
          .limit(10)
        if (location?.state) q = q.eq('state', location.state)
        const { data } = await q
        return data || []
      } catch { return [] }
    })(),
    // Firecrawl /search
    (async () => {
      if (!firecrawlKey) return []
      try {
        const searchQuery = location?.city
          ? `free community assistance ${query} ${location.city} ${location.state || ''}`
          : `free community assistance ${query}`
        const resp = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 5 }),
        })
        if (!resp.ok) return []
        const data = await resp.json()
        return data.success ? (data.data || []) : []
      } catch { return [] }
    })(),
  ])

  console.log(`[CHAT] Resource search: ${Date.now() - t0}ms (DB: ${dbResult.length} results, Web: ${searchResult.length} results)`)

  // Enrich local resources with web URLs when website is null
  // deno-lint-ignore no-explicit-any
  const enrichedLocalResources = dbResult.map((r: any) => {
    if (r.website) return r
    const nameLower = r.name.toLowerCase()
    // deno-lint-ignore no-explicit-any
    const match = searchResult.find((web: any) => {
      const titleLower = (web.title || '').toLowerCase()
      return titleLower.includes(nameLower) ||
             nameLower.includes(titleLower.replace(/\s*[-|:–].*/,'').trim()) ||
             nameLower.split(/\s+/).filter((w: string) => w.length > 3 && titleLower.includes(w)).length >= 2
    })
    if (match?.url) {
      return { ...r, website: match.url }
    }
    return r
  })

  // Process DB results (website field now enriched from web results where available)
  if (enrichedLocalResources.length > 0) {
    sections.push('LOCAL RESOURCES (from our database):')
    // deno-lint-ignore no-explicit-any
    for (const r of enrichedLocalResources) {
      sections.push(`- ${r.name} | ${r.address_line1 || ''}, ${r.city || ''} ${r.state || ''} | Phone: ${r.phone || 'N/A'} | Website: ${r.website || 'N/A'} | Category: ${r.category}`)
    }
  }

  // Track which web results were already matched to a local resource
  // deno-lint-ignore no-explicit-any
  const matchedWebUrls = new Set(enrichedLocalResources.map((r: any) => r.website).filter(Boolean))

  // Process Firecrawl /search results — only those not already merged into a local resource
  if (searchResult.length > 0) {
    // deno-lint-ignore no-explicit-any
    const unmatched = searchResult.filter((r: any) => !matchedWebUrls.has(r.url))
    if (unmatched.length > 0) {
      sections.push('\nWEB RESULTS (from internet search):')
      // deno-lint-ignore no-explicit-any
      for (const r of unmatched) {
        sections.push(`- ${r.title} | ${r.url} | ${r.description || ''}`)
      }
    }
  }

  return sections.join('\n')
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check API key is configured
  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OpenRouter API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // Authenticate user
    const auth = await authenticateUser(req.headers.get('authorization'))
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check rate limit
    const rateLimit = checkRateLimit(auth.userId)
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      )
    }

    // Parse request body
    const body: ChatRequest = await req.json()
    const {
      messages,
      model,
      stream = true,
      systemPrompt,
      temperature = 0.7,
      maxTokens = 1024,
      location,
    } = body

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build Supabase client for resource queries (service role for RLS bypass on approved resources)
    const supabaseClient = SUPABASE_URL && SUPABASE_SERVICE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
      : null

    // RAG: always search resources for every message so the LLM always has verified context
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()
    let resourceContext = ''
    if (lastUserMsg && supabaseClient) {
      resourceContext = await searchResources(supabaseClient, lastUserMsg.content, location || null, messages)
    }

    // Build enriched system prompt, always appending verified resource context (or a no-results note)
    let enrichedSystemPrompt = systemPrompt || ''
    const resourceSection = resourceContext
      ? `--- VERIFIED LOCAL RESOURCES ---\n${resourceContext}`
      : `--- VERIFIED LOCAL RESOURCES ---\nNo matching resources found in the database for this query. Direct the user to call 211 (free, 24/7) or visit 211.org for immediate local help.`
    enrichedSystemPrompt += `\n\n${resourceSection}\n\nWhen mentioning ANY resource, you MUST wrap it in double brackets with pipe-separated fields like this:\n[[Resource Name|Full Address|Phone Number|Website URL]]\nOr with an apply link:\n[[Resource Name|Full Address|Phone Number|Website URL|Apply URL]]\nExample: [[Vermont Foodbank|123 Main St, Rutland VT 05701|802-555-1234|www.vtfoodbank.org]]\nWhen a resource in the data above includes "Apply: <url>", include that URL as the 5th field.\nEvery resource MUST use this exact format. The app converts these into clickable cards for the user.\nONLY include FREE community resources. Never recommend paid services.\nAlways prefer local database resources first. Include the resource's phone number and address when available.\nThe Website URL field should be the SPECIFIC page about the service, NOT the organization's homepage. For example, use broc.org/food-shelf-rutland-county instead of broc.org. Direct the user to the exact page where they can get help.`

    // Prepend system prompt if provided
    const fullMessages: ChatMessage[] = enrichedSystemPrompt
      ? [{ role: 'system', content: enrichedSystemPrompt }, ...messages]
      : messages

    // Call OpenRouter with fallback
    const tLLM = Date.now()
    const { response: openRouterResponse, model: modelUsed } = await tryModelWithFallback(
      fullMessages,
      model,
      stream,
      temperature,
      maxTokens
    )
    console.log(`[CHAT] LLM first token: ${Date.now() - tLLM}ms (model: ${modelUsed})`)

    // Return response (streaming or non-streaming)
    if (stream) {
      return handleStreamingResponse(openRouterResponse, modelUsed, corsHeaders)
    } else {
      return handleNonStreamingResponse(openRouterResponse, modelUsed, corsHeaders)
    }
  } catch (error) {
    console.error('Chat function error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
