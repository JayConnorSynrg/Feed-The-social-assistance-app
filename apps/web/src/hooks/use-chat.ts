// apps/web/src/hooks/use-chat.ts
// Chat hook with streaming support for FEED AI Assistant

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSystemPrompt, detectCrisisKeywords, type SystemPromptKey } from '@/lib/ai/system-prompts'
import { useAuth } from '@/hooks/use-auth'
import { logger, createOpId } from '@/lib/logger'
import { track } from '@vercel/analytics'

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

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: Error | null
  currentModel: string | null
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  setFlow: (flow: SystemPromptKey) => void
  currentFlow: SystemPromptKey
  stopStreaming: () => void
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { flow: initialFlow = 'general', onError, onCrisisDetected } = options

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [currentFlow, setCurrentFlow] = useState<SystemPromptKey>(initialFlow)

  const { profile } = useAuth()

  const abortControllerRef = useRef<AbortController | null>(null)
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
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return

      const opId = createOpId()
      const chatStart = performance.now()
      logger.info('chat.send.start', { opId, userId: profile?.id, flowType: currentFlow, messageCount: messages.length })

      setError(null)

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

      try {
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
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role, content: m.content }))
        apiMessages.push({ role: 'user' as const, content: content.trim() })

        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        // Call Edge Function
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`
        logger.debug('chat.fetch.start', { opId, messageCount: messages.length })
        const response = await fetch(
          url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              messages: apiMessages,
              systemPrompt: getSystemPrompt(currentFlow),
              stream: true,
              temperature: 0.7,
              maxTokens: 1024,
              location: profile ? {
                city: profile.location_city,
                state: profile.location_state,
                lat: profile.latitude,
                lng: profile.longitude,
              } : null,
            }),
            signal: abortControllerRef.current.signal,
          }
        )

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
          throw new Error(errorMessage)
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
                  // Streaming complete
                  const complete_ms = Math.round(performance.now() - chatStart)
                  logger.info('chat.send.complete', {
                    opId,
                    userId: profile?.id,
                    duration_ms: complete_ms,
                    model: currentModel ?? 'unknown',
                    contentLength: accumulatedContent.length,
                  })
                  track('chat.complete', { duration_ms: complete_ms, ok: true })
                  streamDone = true
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMessage.id
                        ? { ...m, content: accumulatedContent, isStreaming: false }
                        : m
                    )
                  )
                  break
                }

                try {
                  const parsed = JSON.parse(data)

                  if (parsed.type === 'meta' && parsed.model) {
                    setCurrentModel(parsed.model)
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMessage.id
                          ? { ...m, model: parsed.model }
                          : m
                      )
                    )
                  }

                  if (parsed.type === 'content' && parsed.content) {
                    accumulatedContent += parsed.content
                    setMessages(prev =>
                      prev.map(m =>
                        m.id === assistantMessage.id
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
                        m.id === assistantMessage.id
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

        // Guard: if stream ended without [DONE], close the streaming state so dots don't persist
        if (!streamDone) {
          logger.warn('chat.stream.missingDone', { opId, contentLength: accumulatedContent.length, duration_ms: Math.round(performance.now() - chatStart) })
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessage.id
                ? { ...m, content: accumulatedContent || 'No response received.', isStreaming: false }
                : m
            )
          )
        }
      } catch (err) {
        const error = err as Error

        // Abort errors are expected in Next.js — suppress before logging
        if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('signal')) {
          logger.debug('chat.stream.aborted', { opId })
          setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
          return
        }

        logger.error('chat.send.error', error, { opId, userId: profile?.id, duration_ms: Math.round(performance.now() - chatStart) })

        setError(error)
        onError?.(error)

        // Update message with error state — always clear isStreaming so dots don't persist
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: 'Sorry, I encountered an error. Please try again.',
                  isStreaming: false,
                }
              : m
          )
        )
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [messages, isLoading, currentFlow, supabase, onError, onCrisisDetected]
  )

  const clearMessages = useCallback(() => {
    stopStreaming()
    setMessages([])
    setError(null)
    setCurrentModel(null)
  }, [stopStreaming])

  const setFlow = useCallback((flow: SystemPromptKey) => {
    setCurrentFlow(flow)
  }, [])

  return {
    messages,
    isLoading,
    error,
    currentModel,
    sendMessage,
    clearMessages,
    setFlow,
    currentFlow,
    stopStreaming,
  }
}
