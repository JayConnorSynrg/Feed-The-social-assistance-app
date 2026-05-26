// apps/web/src/hooks/use-chat.ts
// Chat hook with streaming support for FEED AI Assistant

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSystemPrompt, detectCrisisKeywords, type SystemPromptKey } from '@/lib/ai/system-prompts'
import { useAuth } from '@/hooks/use-auth'

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
        console.log('[CHAT] Getting session...')
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[CHAT] Session:', session ? 'valid' : 'null', 'token length:', session?.access_token?.length)
        if (!session?.access_token) {
          console.error('[CHAT] No session — user not authenticated')
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
        console.log('[CHAT] Fetching:', url, 'with', messages.length, 'messages')
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

        console.log('[CHAT] Response status:', response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('[CHAT] Error response:', response.status, errorText)
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

        console.log('[CHAT] Starting stream reader...')
        const decoder = new TextDecoder()
        let accumulatedContent = ''
        let firstChunk = true
        let streamDone = false

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            if (firstChunk) {
              console.log('[CHAT] First chunk received')
              firstChunk = false
            }

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)

                if (data === '[DONE]') {
                  // Streaming complete
                  console.log('[CHAT] Stream complete, final content length:', accumulatedContent.length)
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
                    console.log('[CHAT] Non-streaming response:', parsed)
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
                    console.warn('Parse error:', parseError)
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
          console.warn('[CHAT] Stream ended without [DONE] — forcing isStreaming=false, content length:', accumulatedContent.length)
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

        // Abort errors are expected in Next.js — suppress before console.error
        if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('signal')) {
          console.log('[CHAT] Stream aborted (expected in Next.js)')
          setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
          return
        }

        console.error('[CHAT] Error:', error.message, error)

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
