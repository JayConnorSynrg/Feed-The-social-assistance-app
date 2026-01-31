'use client'

// apps/web/src/app/(dashboard)/chat/page.tsx
// FEED AI Assistant Chat Page

import React, { useState } from 'react'
import { ChatInterface } from '@/components/chat/chat-interface'
import { GuidedFlowComponent, FlowSelector } from '@/components/chat/guided-flow'
import {
  GUIDED_FLOWS,
  resourceFinderFlow,
  eligibilityCheckerFlow,
  formHelpFlow,
  type GuidedFlow,
} from '@/lib/ai/guided-flows'

type ViewMode = 'home' | 'chat' | 'guided-flow'

export default function ChatPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('home')
  const [selectedFlow, setSelectedFlow] = useState<GuidedFlow | null>(null)

  const handleFlowSelect = (flow: GuidedFlow) => {
    setSelectedFlow(flow)
    setViewMode('guided-flow')
  }

  const handleFlowComplete = () => {
    setViewMode('home')
    setSelectedFlow(null)
  }

  const handleFlowCancel = () => {
    setViewMode('home')
    setSelectedFlow(null)
  }

  const handleStartChat = () => {
    setViewMode('chat')
  }

  const handleBackToHome = () => {
    setViewMode('home')
  }

  // Home view - show options
  if (viewMode === 'home') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">FEED Assistant</h1>
          <p className="text-muted-foreground">
            Get help finding resources, checking eligibility, and completing forms
          </p>
        </div>

        {/* Guided Flows */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Quick Start Guides</h2>
          <p className="text-muted-foreground mb-6">
            Answer a few questions to get personalized help
          </p>

          <FlowSelector
            flows={[resourceFinderFlow, eligibilityCheckerFlow, formHelpFlow]}
            onSelect={handleFlowSelect}
          />
        </section>

        {/* Free Chat Option */}
        <section className="text-center">
          <div className="border-t pt-8">
            <p className="text-muted-foreground mb-4">
              Or have a conversation with the AI assistant
            </p>
            <button
              onClick={handleStartChat}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <span className="text-xl">💬</span>
              <span>Start Free Chat</span>
            </button>
          </div>
        </section>

        {/* Help Text */}
        <section className="mt-12 p-6 bg-muted/50 rounded-xl">
          <h3 className="font-semibold mb-3">How FEED Assistant Can Help</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span>📍</span>
              <span>
                <strong>Find Resources:</strong> Locate food pantries, shelters,
                healthcare clinics, and other services near you
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>✓</span>
              <span>
                <strong>Check Eligibility:</strong> Get a quick assessment of what
                benefits programs you may qualify for
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>📝</span>
              <span>
                <strong>Form Help:</strong> Get guidance on completing benefit
                applications and understanding requirements
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>🆘</span>
              <span>
                <strong>Crisis Support:</strong> Access crisis resources and hotlines
                when you need immediate help
              </span>
            </li>
          </ul>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Privacy Note:</strong> Your conversations are not stored
              permanently. For official benefit determinations, please contact the
              appropriate agency directly.
            </p>
          </div>
        </section>
      </div>
    )
  }

  // Chat view - full chat interface
  if (viewMode === 'chat') {
    return (
      <div className="container mx-auto px-4 py-4 max-w-3xl h-[calc(100vh-6rem)]">
        <div className="mb-4">
          <button
            onClick={handleBackToHome}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </button>
        </div>
        <ChatInterface className="h-full" />
      </div>
    )
  }

  // Guided flow view
  if (viewMode === 'guided-flow' && selectedFlow) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <GuidedFlowComponent
          flow={selectedFlow}
          onComplete={handleFlowComplete}
          onCancel={handleFlowCancel}
        />
      </div>
    )
  }

  // Fallback
  return null
}
