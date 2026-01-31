'use client'

// apps/web/src/components/panels/chat-panel.tsx
// AI Chat interface panel - the main landing view
// "Hi, This is Feed. What can we help you gather today?"

import React, { useState } from 'react'
import { Send, Sparkles, Users, CalendarClock, Search, Apple, Building2, Heart, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================
// FEATURE CARDS
// ============================================
interface FeatureCardProps {
  icon: React.ElementType
  iconBg: string
  title: string
  description: string
  onClick?: () => void
}

function FeatureCard({ icon: Icon, iconBg, title, description, onClick }: FeatureCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-xl border border-stone-200 bg-[#faf9f6] hover:border-primary/50 hover:bg-[#f5f3ee] transition-all text-left group shadow-sm"
    >
      <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </button>
  )
}

// ============================================
// QUICK ACTION TAGS
// ============================================
const QUICK_TAGS = [
  { label: 'Find resources', icon: Search },
  { label: 'Program Eligibility', icon: FileText },
  { label: 'Food', icon: Apple },
  { label: 'Social Services', icon: Building2 },
  { label: 'Healthcare', icon: Heart },
]

interface QuickTagProps {
  label: string
  icon: React.ElementType
  onClick: () => void
  isActive?: boolean
}

function QuickTag({ label, icon: Icon, onClick, isActive }: QuickTagProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  )
}

// ============================================
// CHAT MESSAGE
// ============================================
interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: Date
}

function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted rounded-bl-md'
        }`}
      >
        <p className="text-sm">{content}</p>
        {timestamp && (
          <p className={`text-[10px] mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================
// MAIN CHAT PANEL
// ============================================
interface ChatPanelProps {
  onNavigateToMap?: () => void
}

export function ChatPanel({ onNavigateToMap }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessageProps[]>([])
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = () => {
    if (!inputValue.trim()) return

    // Add user message
    const userMessage: ChatMessageProps = {
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')

    // Simulate AI response
    setIsTyping(true)
    setTimeout(() => {
      const assistantMessage: ChatMessageProps = {
        role: 'assistant',
        content: `I can help you find resources related to "${inputValue}". Would you like me to search for nearby services or check your eligibility for assistance programs?`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleTagClick = (tag: string) => {
    setActiveTag(tag)
    setInputValue(tag)
  }

  const handleFeatureClick = (feature: string) => {
    if (feature === 'resources' && onNavigateToMap) {
      onNavigateToMap()
    } else {
      setInputValue(`Help me with ${feature}`)
    }
  }

  // Show greeting or chat thread
  const showGreeting = messages.length === 0

  return (
    <div className="h-full flex flex-col">
      {showGreeting ? (
        // ============================================
        // GREETING VIEW (Initial State)
        // ============================================
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          {/* Greeting Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Hi, This is Feed.
            </h1>
            <p className="text-lg text-muted-foreground">
              What can we help you gather today?
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-8">
            <FeatureCard
              icon={Sparkles}
              iconBg="bg-yellow-100 text-yellow-600"
              title="Find Resources"
              description="Discover local food banks, housing assistance, healthcare, and more near you."
              onClick={() => handleFeatureClick('resources')}
            />
            <FeatureCard
              icon={Users}
              iconBg="bg-blue-100 text-blue-600"
              title="Connect & Share"
              description="Stay connected, share ideas, and get support from your community."
              onClick={() => handleFeatureClick('community')}
            />
            <FeatureCard
              icon={CalendarClock}
              iconBg="bg-green-100 text-green-600"
              title="Apply for Benefits"
              description="Get help applying for SNAP, Medicaid, housing assistance, and other programs."
              onClick={() => handleFeatureClick('benefits')}
            />
          </div>

          {/* Chat Input */}
          <div className="w-full space-y-3">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything about benefits, resources, or assistance..."
                className="pr-12 py-6 rounded-xl bg-[#f8f6f1] border-stone-200"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_TAGS.map((tag) => (
                <QuickTag
                  key={tag.label}
                  {...tag}
                  isActive={activeTag === tag.label}
                  onClick={() => handleTagClick(tag.label)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        // ============================================
        // CONVERSATION VIEW (After first message)
        // ============================================
        <>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto py-4">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} {...msg} />
            ))}
            {isTyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input (Sticky at bottom) */}
          <div className="border-t pt-4 space-y-3">
            <div className="relative">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="pr-12 py-4 rounded-xl"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2">
              {QUICK_TAGS.slice(0, 4).map((tag) => (
                <QuickTag
                  key={tag.label}
                  {...tag}
                  isActive={activeTag === tag.label}
                  onClick={() => handleTagClick(tag.label)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
