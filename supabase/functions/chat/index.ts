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

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  modelUsed: string
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
  modelUsed: string
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

serve(async (req: Request) => {
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
    } = body

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Prepend system prompt if provided
    const fullMessages: ChatMessage[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages

    // Call OpenRouter with fallback
    const { response: openRouterResponse, model: modelUsed } = await tryModelWithFallback(
      fullMessages,
      model,
      stream,
      temperature,
      maxTokens
    )

    // Return response (streaming or non-streaming)
    if (stream) {
      return handleStreamingResponse(openRouterResponse, modelUsed)
    } else {
      return handleNonStreamingResponse(openRouterResponse, modelUsed)
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
