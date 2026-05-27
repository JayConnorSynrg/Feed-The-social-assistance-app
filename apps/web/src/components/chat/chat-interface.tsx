'use client'

// apps/web/src/components/chat/chat-interface.tsx
// FEED AI Assistant Chat Interface

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useChat, type ChatMessage } from '@/hooks/use-chat'
import { QUICK_ACTIONS, type SystemPromptKey } from '@/lib/ai/system-prompts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

// Flow configuration
const FLOW_CONFIG: Record<SystemPromptKey, { title: string; description: string; icon: string }> = {
  base: { title: 'FEED Assistant', description: 'General help and guidance', icon: '🤖' },
  general: { title: 'General Help', description: 'Not sure where to start? I can help.', icon: '💬' },
  resourceFinder: { title: 'Find Resources', description: 'Find food, housing, healthcare near you', icon: '📍' },
  eligibilityChecker: { title: 'Check Eligibility', description: 'See what benefits you may qualify for', icon: '✓' },
  formHelp: { title: 'Form Help', description: 'Get help completing applications', icon: '📝' },
  crisis: { title: 'Crisis Support', description: 'Immediate help is available', icon: '🆘' },
  food: { title: 'Food Assistance', description: 'SNAP, food pantries, free meals, and more', icon: '🍎' },
  housing: { title: 'Housing Help', description: 'Shelter, rent assistance, and vouchers', icon: '🏠' },
  jobs: { title: 'Jobs & Career', description: 'Job search, training, and career support', icon: '💼' },
  transportation: { title: 'Transportation', description: 'Bus passes, ride programs, and gas help', icon: '🚌' },
  legal: { title: 'Legal Aid', description: 'Free legal help for housing, family, and more', icon: '⚖️' },
  healthcare: { title: 'Healthcare', description: 'Free clinics, Medicaid, and prescription help', icon: '🏥' },
}

interface MessageBubbleProps {
  message: ChatMessage
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        {message.isStreaming && (
          <span className="inline-block ml-1 animate-pulse">▊</span>
        )}
        {!isUser && message.model && (
          <p className="text-xs opacity-50 mt-1">{message.model.split('/').pop()}</p>
        )}
      </div>
    </div>
  )
}

interface QuickActionsProps {
  actions: string[]
  onSelect: (action: string) => void
  disabled?: boolean
}

function QuickActions({ actions, onSelect, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(action)}
          disabled={disabled}
          className="text-xs"
        >
          {action}
        </Button>
      ))}
    </div>
  )
}

interface FlowSelectorProps {
  currentFlow: SystemPromptKey
  onSelect: (flow: SystemPromptKey) => void
}

function FlowSelector({ currentFlow, onSelect }: FlowSelectorProps) {
  const flows: SystemPromptKey[] = ['general', 'resourceFinder', 'eligibilityChecker', 'formHelp']

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {flows.map(flow => {
        const config = FLOW_CONFIG[flow]
        const isActive = currentFlow === flow

        return (
          <button
            key={flow}
            onClick={() => onSelect(flow)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <span className="text-lg mr-2">{config.icon}</span>
            <span className="font-medium text-sm">{config.title}</span>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </button>
        )
      })}
    </div>
  )
}

interface CrisisBannerProps {
  onDismiss: () => void
}

function CrisisBanner({ onDismiss }: CrisisBannerProps) {
  return (
    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🆘</span>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            Help is Available
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            If you're in crisis, please reach out:
          </p>
          <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1">
            <li>
              <strong>988</strong> - Suicide & Crisis Lifeline (call or text)
            </li>
            <li>
              <strong>911</strong> - Emergency services
            </li>
            <li>
              <strong>Text HOME to 741741</strong> - Crisis Text Line
            </li>
          </ul>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-600 hover:text-red-800"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export interface ChatInterfaceProps {
  initialFlow?: SystemPromptKey
  showFlowSelector?: boolean
  className?: string
}

export function ChatInterface({
  initialFlow = 'general',
  showFlowSelector = true,
  className = '',
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('')
  const [showCrisisBanner, setShowCrisisBanner] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    setFlow,
    currentFlow,
    stopStreaming,
  } = useChat({
    flow: initialFlow,
    onCrisisDetected: () => setShowCrisisBanner(true),
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!inputValue.trim() || isLoading) return

      const message = inputValue.trim()
      setInputValue('')
      await sendMessage(message)
    },
    [inputValue, isLoading, sendMessage]
  )

  const handleQuickAction = useCallback(
    async (action: string) => {
      await sendMessage(action)
    },
    [sendMessage]
  )

  const handleFlowChange = useCallback(
    (flow: SystemPromptKey) => {
      setFlow(flow)
      clearMessages()
    },
    [setFlow, clearMessages]
  )

  const config = FLOW_CONFIG[currentFlow]
  const quickActions = QUICK_ACTIONS[currentFlow]

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <CardTitle className="text-lg">{config.title}</CardTitle>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="text-xs"
            >
              Clear Chat
            </Button>
          )}
        </div>
        {!messages.length && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4">
        {showCrisisBanner && (
          <CrisisBanner onDismiss={() => setShowCrisisBanner(false)} />
        )}

        {messages.length === 0 && (
          <>
            {showFlowSelector && (
              <FlowSelector currentFlow={currentFlow} onSelect={handleFlowChange} />
            )}

            <div className="text-center py-6">
              <p className="text-muted-foreground text-sm mb-4">
                How can I help you today?
              </p>
              <QuickActions
                actions={quickActions}
                onSelect={handleQuickAction}
                disabled={isLoading}
              />
            </div>
          </>
        )}

        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {error && (
          <div className="text-center py-2">
            <p className="text-sm text-destructive">{error.message}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        {messages.length > 0 && messages.length < 6 && (
          <QuickActions
            actions={quickActions.slice(0, 3)}
            onSelect={handleQuickAction}
            disabled={isLoading}
          />
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          {isLoading ? (
            <Button type="button" variant="outline" onClick={stopStreaming}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!inputValue.trim()}>
              Send
            </Button>
          )}
        </form>
      </div>
    </Card>
  )
}

// Minimal chat bubble for embedding
export function ChatBubble({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {isOpen && (
        <div
          className={`fixed bottom-20 right-4 w-96 h-[500px] z-50 shadow-xl ${className}`}
        >
          <ChatInterface showFlowSelector={false} />
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform z-50"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </>
  )
}
