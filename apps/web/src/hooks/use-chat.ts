// apps/web/src/hooks/use-chat.ts
// Chat hook with streaming support for FEED AI Assistant

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSystemPrompt, detectCrisisKeywords, type SystemPromptKey, type PersonalizationContext } from '@/lib/ai/system-prompts'
import { useAuth } from '@/hooks/use-auth'
import { logger, createOpId } from '@/lib/logger'
import { track } from '@vercel/analytics'
import { GUEST_LANGUAGE_KEY } from '@/lib/languages'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isStreaming?: boolean
  model?: string
}

export interface UseChatOptions {
  flow?: SystemPromptKey
  onError?: (error: Error) => void
  onCrisisDetected?: () => void
}

/** Classify an error into a user-visible category for translated messages. */
export type ChatErrorKind = 'network' | 'server' | 'auth' | 'unknown'

/**
 * Returns true for transient failures that warrant a single automatic retry:
 *  - Network-level errors (TypeError / "Failed to fetch" / "Load failed")
 *  - HTTP 5xx server errors
 *  - HTTP 429 rate-limit (gateway blip)
 *
 * Returns false for deterministic errors (4xx auth/bad-request) — retrying
 * those would never succeed and would make things worse for the user.
 * AbortErrors are never classified as transient (they're intentional cancels).
 */
function isTransient(err: Error, httpStatus?: number): boolean {
  if (err.name === 'AbortError') return false
  if (httpStatus !== undefined) {
    return httpStatus >= 500 || httpStatus === 429
  }
  // Network-level errors have no status code; detect by message
  const msg = err.message.toLowerCase()
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('network') ||
    msg.includes('networkerror')
  )
}

/**
 * Map an error + optional HTTP status to the user-facing error kind.
 * This drives the translated message shown in the UI.
 */
function classifyError(err: Error, httpStatus?: number): ChatErrorKind {
  if (httpStatus === 401 || httpStatus === 403 || err.message.includes('sign in')) return 'auth'
  if (isTransient(err, httpStatus)) {
    if (httpStatus !== undefined) return 'server'
    return 'network'
  }
  if (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) return 'auth'
  return 'unknown'
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  isRetrying: boolean
  error: Error | null
  errorKind: ChatErrorKind | null
  currentModel: string | null
  sendMessage: (content: string) => Promise<void>
  /** Re-sends the last user message. Safe to call only when error !== null. */
  retrySend: () => void
  clearMessages: () => void
  setFlow: (flow: SystemPromptKey) => void
  currentFlow: SystemPromptKey
  stopStreaming: () => void
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Delay helper — 800 ms before first retry attempt. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const RETRY_BACKOFF_MS = 800

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { flow: initialFlow = 'general', onError, onCrisisDetected } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [errorKind, setErrorKind] = useState<ChatErrorKind | null>(null)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [currentFlow, setCurrentFlow] = useState<SystemPromptKey>(initialFlow)

  const { profile } = useAuth()

  // Effective preferred language: DB value > localStorage > browser > 'en'
  // Profile is stored in a ref so attemptSend (a useCallback) can read the
  // latest value without being in the dep array. localStorage is read at
  // send-time (inside attemptSend) so it reflects changes that happen between
  // renders without requiring a re-render to propagate them.
  const profileRef = useRef(profile)
  profileRef.current = profile

  const abortControllerRef = useRef<AbortController | null>(null)
  // Track the last user content so retrySend can re-dispatch without
  // the caller having to pass it again.
  const lastContentRef = useRef<string | null>(null)
  const supabase = createClient()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsRetrying(false)
  }, [])

  /**
   * Core send implementation. Called by sendMessage (attempt=1) and the
   * internal retry path (attempt=2). Returns the HTTP status if a non-ok
   * response was encountered, so the caller can classify the error correctly.
   */
  const attemptSend = useCallback(
    async (
      content: string,
      assistantMessageId: string,
      opId: string,
      chatStart: number
    ): Promise<void> => {
      // Get auth token
      logger.debug('chat.session.check', { opId })
      const { data: { session } } = await supabase.auth.getSession()
      logger.debug('chat.session.result', { opId, hasSession: !!session, tokenPresent: !!session?.access_token })
      if (!session?.access_token) {
        logger.warn('chat.session.missing', { opId })
        throw new Error('Please sign in to use the chat')
      }

      // Prepare messages for API (exclude system messages, include history)
      const apiMessages = messages
        .filter(m => m.role !== 'system' && m.id !== assistantMessageId)
        .map(m => ({ role: m.role, content: m.content }))
      apiMessages.push({ role: 'user' as const, content: content.trim() })

      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      // Call Edge Function
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`
      logger.debug('chat.fetch.start', { opId, messageCount: apiMessages.length })

      // -------------------------------------------------------------------------
      // PART 1 — lat/lng privacy strip
      // -------------------------------------------------------------------------
      // The chat edge function only uses city/state for resource DB queries
      // (searchResources() in supabase/functions/chat/index.ts never reads
      // location.lat / location.lng). Precise coordinates are omitted here so
      // they never leave the device for chat purposes. The resource map handles
      // proximity separately via its own viewport RPC.
      const locationForChat = profile ? {
        city: profile.location_city,
        state: profile.location_state,
        // lat + lng intentionally omitted — coarse city/state is sufficient
        // for the chat's resource DB query and Firecrawl search; precise
        // coordinates must not reach any third-party LLM provider.
      } : null

      // -------------------------------------------------------------------------
      // PART 2 — personalization line
      // -------------------------------------------------------------------------
      // Read the opt-out flag at send-time (not render-time) so a toggle change
      // between renders is respected immediately on the next send.
      const personalizationEnabled = (() => {
        if (typeof window === 'undefined') return false
        const stored = localStorage.getItem('feed_chat_personalization')
        // Default ON: absent key → enabled; explicit 'false' → disabled
        return stored !== 'false'
      })()

      const personalizationCtx: PersonalizationContext | undefined = (() => {
        if (!personalizationEnabled) return undefined
        const p = profileRef.current
        if (!p) return undefined // guests and unauthenticated users: skip
        return {
          name: (p as Record<string, unknown>)['first_name'] as string | null
            ?? p.full_name?.split(' ')[0]
            ?? null,
          city: p.location_city ?? null,
          state: p.location_state ?? null,
          role: (p as Record<string, unknown>)['role'] as string | null ?? null,
        }
      })()

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          messages: apiMessages,
          systemPrompt: getSystemPrompt(currentFlow, personalizationCtx),
          stream: true,
          temperature: 0.7,
          maxTokens: 1024,
          location: locationForChat,
          preferredLanguage: (() => {
            // Read at call time (not render time) so localStorage changes
            // between renders are picked up without requiring a re-render.
            const dbCode = (profileRef.current as Record<string, unknown> | null)?.['preferred_language'] as string | null
            if (dbCode) return dbCode
            if (typeof window !== 'undefined') {
              const stored = localStorage.getItem(GUEST_LANGUAGE_KEY)
              if (stored) return stored
            }
            if (typeof navigator !== 'undefined') {
              const raw = navigator.language || ''
              const prefix = raw.split('-')[0].toLowerCase()
              const supported = ['en','es','ht','vi','ar','zh','so','fr','pt','ru','ko','tl','am','hmn','other']
              if (supported.includes(prefix)) return prefix
            }
            return 'en'
          })(),
        }),
        signal: abortControllerRef.current.signal,
      })

      logger.debug('chat.fetch.response', { opId, status: response.status })

      if (!response.ok) {
        const errorText = await response.text()
        logger.warn('chat.fetch.error', { opId, status: response.status })
        let errorMessage = `Request failed: ${response.status}`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          // errorText is not JSON — use as-is
        }
        const err = new Error(errorMessage)
        // Attach status so the outer catch can classify it
        ;(err as Error & { httpStatus?: number }).httpStatus = response.status
        throw err
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      logger.debug('chat.stream.start', { opId })
      const decoder = new TextDecoder()
      let accumulatedContent = ''
      let firstChunk = true
      let streamDone = false
      let resolvedModel: string | null = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (firstChunk) {
            const ttfb_ms = Math.round(performance.now() - chatStart)
            logger.info('chat.stream.firstChunk', { opId, duration_ms: ttfb_ms })
            track('chat.ttfb', { duration_ms: ttfb_ms })
            firstChunk = false
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)

              if (data === '[DONE]') {
                const complete_ms = Math.round(performance.now() - chatStart)
                logger.info('chat.request.completed', {
                  opId,
                  duration_ms: complete_ms,
                  model: resolvedModel ?? currentModel ?? 'unknown',
                  didStream: true,
                  contentLength: accumulatedContent.length,
                })
                track('chat.complete', { duration_ms: complete_ms, ok: true })
                streamDone = true
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId
                      ? { ...m, content: accumulatedContent, isStreaming: false }
                      : m
                  )
                )
                break
              }

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === 'meta' && parsed.model) {
                  resolvedModel = parsed.model
                  setCurrentModel(parsed.model)
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, model: parsed.model }
                        : m
                    )
                  )
                }

                if (parsed.type === 'content' && parsed.content) {
                  accumulatedContent += parsed.content
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: accumulatedContent }
                        : m
                    )
                  )
                }

                if (parsed.type === 'error') {
                  throw new Error(parsed.error)
                }

                // Non-streaming fallback: single JSON response with content field
                if (parsed.content && parsed.type === undefined) {
                  logger.debug('chat.stream.nonStreamingFallback', { opId })
                  accumulatedContent = parsed.content
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessageId
                        ? { ...m, content: accumulatedContent, isStreaming: false }
                        : m
                    )
                  )
                  streamDone = true
                }
              } catch (parseError) {
                // Skip malformed JSON
                if (parseError instanceof Error && parseError.message !== 'error') {
                  logger.warn('chat.stream.parseError', { opId })
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Guard: if stream ended without [DONE], close the streaming state
      if (!streamDone) {
        const complete_ms = Math.round(performance.now() - chatStart)
        logger.warn('chat.stream.missingDone', {
          opId,
          contentLength: accumulatedContent.length,
          duration_ms: complete_ms,
        })
        // Still emit a completed event so the latency is captured
        logger.info('chat.request.completed', {
          opId,
          duration_ms: complete_ms,
          model: resolvedModel ?? currentModel ?? 'unknown',
          didStream: true,
          contentLength: accumulatedContent.length,
        })
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: accumulatedContent || 'No response received.', isStreaming: false }
              : m
          )
        )
      }
    },
    [messages, currentFlow, supabase, profile, currentModel]
  )

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      const opId = createOpId()
      const chatStart = performance.now()
      logger.info('chat.send.start', { opId, userId: profile?.id, flowType: currentFlow, messageCount: messages.length })

      setError(null)
      setErrorKind(null)
      lastContentRef.current = content

      // Check for crisis keywords
      if (detectCrisisKeywords(content)) {
        setCurrentFlow('crisis')
        onCrisisDetected?.()
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)

      // Create placeholder for assistant response
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }

      setMessages(prev => [...prev, assistantMessage])

      // 30s hard timeout for the streaming edge fetch — cleared in finally on every exit path.
      let chatTimeoutId: ReturnType<typeof setTimeout> | undefined

      try {
        chatTimeoutId = setTimeout(() => abortControllerRef.current?.abort(), 30_000)

        try {
          await attemptSend(content, assistantMessage.id, opId, chatStart)
          // Success — clear any lingering error state
          setError(null)
          setErrorKind(null)
          return
        } catch (firstErr) {
          const err = firstErr as Error & { httpStatus?: number }

          // Abort / signal errors are intentional cancels — not failures
          if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal')) {
            logger.debug('chat.stream.aborted', { opId })
            setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
            return
          }

          const httpStatus = err.httpStatus
          const transient = isTransient(err, httpStatus)

          if (transient) {
            // --- One automatic retry on transient failures ---
            logger.warn('chat.request.retrying', {
              opId,
              errorName: err.name,
              errorMessage: err.message.slice(0, 120),
              httpStatus,
              duration_ms: Math.round(performance.now() - chatStart),
            })

            // Show "reconnecting…" in the placeholder message
            setIsRetrying(true)
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: '', isStreaming: true }
                  : m
              )
            )

            await delay(RETRY_BACKOFF_MS)

            try {
              await attemptSend(content, assistantMessage.id, opId, chatStart)
              setIsRetrying(false)
              setError(null)
              setErrorKind(null)
              return
            } catch (retryErr) {
              // Retry also failed — fall through to error handling below
              const rErr = retryErr as Error & { httpStatus?: number }

              // Abort during retry is still intentional
              if (rErr.name === 'AbortError' || rErr.message?.includes('aborted') || rErr.message?.includes('signal')) {
                logger.debug('chat.stream.aborted', { opId })
                setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
                setIsRetrying(false)
                return
              }

              const kind = classifyError(rErr, rErr.httpStatus ?? httpStatus)
              logger.error('chat.request.failed', rErr, {
                opId,
                userId: profile?.id,
                errorName: rErr.name,
                errorMessage: rErr.message.slice(0, 120),
                httpStatus: rErr.httpStatus ?? httpStatus,
                duration_ms: Math.round(performance.now() - chatStart),
                isAbort: false,
                retried: true,
                origin: typeof window !== 'undefined' ? window.location.origin : undefined,
              })

              setIsRetrying(false)
              setError(rErr)
              setErrorKind(kind)
              onError?.(rErr)
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: '', isStreaming: false }
                    : m
                )
              )
              return
            }
          }

          // Non-transient failure — log and surface immediately (no retry)
          const kind = classifyError(err, httpStatus)
          logger.error('chat.request.failed', err, {
            opId,
            userId: profile?.id,
            errorName: err.name,
            errorMessage: err.message.slice(0, 120),
            httpStatus,
            duration_ms: Math.round(performance.now() - chatStart),
            isAbort: false,
            retried: false,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          })

          setError(err)
          setErrorKind(kind)
          onError?.(err)
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessage.id
                ? { ...m, content: '', isStreaming: false }
                : m
            )
          )
        }
      } finally {
        clearTimeout(chatTimeoutId)
        setIsLoading(false)
        setIsRetrying(false)
        abortControllerRef.current = null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, isLoading, currentFlow, supabase, onError, onCrisisDetected, attemptSend, profile]
  )

  /** Re-sends the last user message. Call only when error !== null. */
  const retrySend = useCallback(() => {
    const content = lastContentRef.current
    if (!content) return
    sendMessage(content)
  }, [sendMessage])

  const clearMessages = useCallback(() => {
    stopStreaming()
    setMessages([])
    setError(null)
    setErrorKind(null)
    setCurrentModel(null)
    lastContentRef.current = null
  }, [stopStreaming])

  const setFlow = useCallback((flow: SystemPromptKey) => {
    setCurrentFlow(flow)
  }, [])

  return {
    messages,
    isLoading,
    isRetrying,
    error,
    errorKind,
    currentModel,
    sendMessage,
    retrySend,
    clearMessages,
    setFlow,
    currentFlow,
    stopStreaming,
  }
}
