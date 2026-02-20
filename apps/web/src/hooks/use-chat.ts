// apps/web/src/hooks/use-chat.ts
// Chat hook with streaming support for FEED AI Assistant

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSystemPrompt, detectCrisisKeywords, type SystemPromptKey } from '@/lib/ai/system-prompts'

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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
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
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
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
            }),
            signal: abortControllerRef.current.signal,
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Request failed: ${response.status}`)
        }

        // Handle streaming response
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let accumulatedContent = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(line => line.trim() !== '')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)

                if (data === '[DONE]') {
                  // Streaming complete
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
      } catch (err) {
        const error = err as Error

        // Don't report abort errors
        if (error.name === 'AbortError') {
          setMessages(prev => prev.filter(m => m.id !== assistantMessage.id))
          return
        }

        setError(error)
        onError?.(error)

        // Update message with error state
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
