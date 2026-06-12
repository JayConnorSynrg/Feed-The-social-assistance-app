'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare,
  Send,
  Check,
  ArrowLeft,
  Clock,
  Loader2,
  Inbox,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { useConversations } from '@/hooks/use-conversations'
import { useReviews } from '@/hooks/use-reviews'
import { usePanelContext } from '@/components/layout/feed-shell'
import { ReviewModal } from '@/components/feed/review-modal'
import { WheatStalkRatingDisplay } from '@/components/ui/wheat-stalk-rating'
import type { ReviewRow } from '@/hooks/use-reviews'

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  housing: 'Housing',
  employment: 'Jobs',
  transportation: 'Transportation',
  legal: 'Legal',
  other: 'General',
  healthcare: 'Healthcare',
  education: 'Education',
  eitc_tax_filing: 'Tax Filing & EITC',
  free_legal: 'Free Legal Help',
  prenatal_natal_care: 'Prenatal & Newborn Care',
  waste_disposal: 'Waste & Disposal',
  free_camping: 'Free Camping',
  free_goods_donation: 'Free Goods & Donations',
}

export function MessagesPanel() {
  const { user, isAnonymous } = useAuth()
  const { panelParams } = usePanelContext()
  const {
    conversations,
    pendingRequests,
    activeConversations,
    completedConversations,
    history,
    messages,
    selectedConversationId,
    selectConversation,
    sendMessage,
    acceptRequest,
    declineRequest,
    completeConversation,
    cancelConversation,
    withdrawRequest,
    isLoading,
    isSending,
    error,
  } = useConversations()

  const { fetchMyReviewForConversation } = useReviews()

  const [messageInput, setMessageInput] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  type ConfirmAction = { type: 'decline' | 'withdraw' | 'cancel' | 'complete'; id: string } | null
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  // Review state for the selected completed conversation
  const [myReview, setMyReview] = useState<ReviewRow | null | undefined>(undefined) // undefined = not yet fetched
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages])

  // Deep-link from map panel
  useEffect(() => {
    if (panelParams?.openConversationId && typeof panelParams.openConversationId === 'string') {
      selectConversation(panelParams.openConversationId)
    }
  }, [panelParams?.openConversationId, selectConversation])

  const selectedConv = conversations.find(c => c.id === selectedConversationId)
  const isVolunteer = selectedConv?.volunteer_id === user?.id
  // counterpartyDisplayName is the privacy-rule-computed name from the SECDEF
  // accessor: full name when the viewer is the SOURCER (volunteer) seeing the
  // SEEKER, first-name-only when the viewer is the SEEKER. We never assemble a
  // surname client-side. Fall back to the first-name base join, then 'User'.
  const otherUserName = selectedConv
    ? (selectedConv.counterpartyDisplayName
        ?? (isVolunteer ? selectedConv.requester?.first_name : selectedConv.volunteer?.first_name)
        ?? 'User')
    : ''

  // Fetch review status when a completed conversation is selected
  const convIdForReview = selectedConv?.status === 'completed' ? selectedConv.id : null

  useEffect(() => {
    if (!convIdForReview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMyReview(undefined)
      return
    }
    let cancelled = false
    setReviewLoading(true)
    fetchMyReviewForConversation(convIdForReview).then((result) => {
      if (!cancelled) {
        setMyReview(result)
        setReviewLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [convIdForReview, fetchMyReviewForConversation])

  const checkReviewStatus = useCallback(async (convId: string) => {
    setMyReview(undefined)
    setReviewLoading(true)
    const result = await fetchMyReviewForConversation(convId)
    setMyReview(result)
    setReviewLoading(false)
  }, [fetchMyReviewForConversation])

  const handleSend = async () => {
    if (!messageInput.trim()) return
    await sendMessage(messageInput.trim())
    setMessageInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReviewSubmitted = async () => {
    setReviewModalOpen(false)
    if (selectedConv?.id) {
      await checkReviewStatus(selectedConv.id)
    }
  }

  // ── Guest gate — must come before empty-state (guests always have 0 conversations) ──
  if (isAnonymous) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6">
        <CreateAccountPrompt message="Create a free account to message volunteers and connect with your community" />
      </div>
    )
  }

  // ── Empty State ──
  if (!isLoading && conversations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-semibold text-stone-700 mb-2">No messages yet</h3>
        <p className="text-sm text-stone-500 max-w-xs">
          Volunteer resources on the map have a Message button. Send a request to start a conversation.
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* ── Left: Conversation List ── */}
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 flex-col border-r border-stone-200/50 overflow-y-auto`}>
        <div className="p-4 border-b border-stone-200/50">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-amber-50">
                  <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                    Pending Requests ({pendingRequests.length})
                  </span>
                </div>
                {pendingRequests.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                  />
                ))}
              </div>
            )}

            {/* Active */}
            {activeConversations.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-green-50">
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wider">
                    Active ({activeConversations.length})
                  </span>
                </div>
                {activeConversations.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                  />
                ))}
              </div>
            )}

            {/* Completed */}
            {completedConversations.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-lime-50">
                  <span className="text-xs font-medium text-lime-700 uppercase tracking-wider">
                    Completed ({completedConversations.length})
                  </span>
                </div>
                {completedConversations.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                  />
                ))}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                    History ({history.length})
                  </span>
                </div>
                {history.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Message Thread ── */}
      <div className={`${selectedConversationId ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedConv ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-stone-200/50 flex items-center gap-3">
              <button
                onClick={() => selectConversation(null)}
                className="md:hidden text-stone-400 hover:text-stone-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <p className="font-medium text-stone-800 text-sm">{otherUserName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    className={`text-xs ${
                      selectedConv.status === 'active' ? 'bg-green-100 text-green-700' :
                      selectedConv.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      selectedConv.status === 'completed' ? 'bg-lime-100 text-lime-700' :
                      'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {selectedConv.status}
                  </Badge>
                  {selectedConv.resource?.category && (
                    <span className="text-xs text-stone-600">
                      {CATEGORY_LABELS[selectedConv.resource.category] ?? selectedConv.resource.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedConv.status === 'pending' && isVolunteer && (
                  <>
                    <Button size="sm" onClick={() => acceptRequest(selectedConv.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                      <Check className="w-3 h-3 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: 'decline', id: selectedConv.id })} className="text-xs">
                      Decline
                    </Button>
                  </>
                )}
                {selectedConv.status === 'pending' && !isVolunteer && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: 'withdraw', id: selectedConv.id })} className="text-xs">
                    Withdraw
                  </Button>
                )}
                {selectedConv.status === 'active' && isVolunteer && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmAction({ type: 'complete', id: selectedConv.id })}
                    className="text-xs text-lime-700 hover:text-lime-800 border-lime-300"
                    data-testid="end-and-review-btn"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> End &amp; review
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      msg.sender_id === user?.id
                        ? 'bg-[#4a5d23] text-white'
                        : 'bg-stone-100 text-stone-800'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${
                      msg.sender_id === user?.id ? 'text-white/60' : 'text-stone-400'
                    }`}>
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input area — active only; completed shows disabled hint */}
            {selectedConv.status === 'active' || (selectedConv.status === 'pending' && !isVolunteer) ? (
              <div className="p-4 border-t border-stone-200/50">
                {selectedConv.status === 'pending' ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
                    <Clock className="w-4 h-4" />
                    <span>Waiting for {otherUserName} to accept your request...</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 text-stone-900 placeholder:text-stone-400"
                      maxLength={2000}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !messageInput.trim()}
                      className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </div>
            ) : selectedConv.status === 'completed' ? (
              /* ── Review prompt card (both parties see this) ── */
              <div className="p-4 border-t border-stone-200/50">
                {reviewLoading || myReview === undefined ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                  </div>
                ) : myReview !== null ? (
                  /* Already reviewed — show their rating */
                  <div
                    data-testid="review-submitted-card"
                    className="flex items-center gap-3 bg-lime-50 border border-lime-200 rounded-xl p-4"
                  >
                    <CheckCircle className="w-5 h-5 text-lime-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-lime-800">Your review was submitted</p>
                      <div className="flex items-center gap-1 mt-1">
                        <WheatStalkRatingDisplay
                          value={myReview.rating}
                          size="sm"
                          testIdPrefix={`my-review-stalks-${selectedConv.id}`}
                        />
                        <span className="text-xs text-lime-700">{myReview.rating}/5</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Not yet reviewed — show the prompt */
                  <div
                    data-testid="review-prompt-card"
                    className="bg-amber-50 border border-amber-200 rounded-xl p-4"
                  >
                    <p className="text-sm font-semibold text-stone-800 mb-1">
                      How did it go?
                    </p>
                    <p className="text-sm text-stone-600 mb-3">
                      Leave a review for <span className="font-medium">{otherUserName}</span>
                    </p>
                    <Button
                      size="sm"
                      data-testid="open-review-modal-btn"
                      onClick={() => setReviewModalOpen(true)}
                      className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white text-xs"
                    >
                      Rate your experience
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-sm text-stone-600">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Confirm dialog for conversation actions */}
      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === 'decline' && 'Decline this request?'}
              {confirmAction?.type === 'withdraw' && 'Withdraw your request?'}
              {confirmAction?.type === 'cancel' && 'End this conversation?'}
              {confirmAction?.type === 'complete' && 'End conversation?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            {confirmAction?.type === 'decline' && 'The requester will be notified that their request was declined.'}
            {confirmAction?.type === 'withdraw' && 'Your request will be cancelled and cannot be recovered.'}
            {confirmAction?.type === 'cancel' && 'This conversation will be closed and cannot be reopened.'}
            {confirmAction?.type === 'complete' && 'Both of you will be able to leave a review once the conversation is marked complete.'}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
              Keep chatting
            </Button>
            <Button
              variant={confirmAction?.type === 'complete' ? 'default' : 'destructive'}
              size="sm"
              data-testid="confirm-end-btn"
              className={confirmAction?.type === 'complete' ? 'bg-lime-700 hover:bg-lime-800 text-white' : ''}
              onClick={() => {
                if (!confirmAction) return
                if (confirmAction.type === 'decline') declineRequest(confirmAction.id)
                else if (confirmAction.type === 'withdraw') withdrawRequest(confirmAction.id)
                else if (confirmAction.type === 'cancel') cancelConversation(confirmAction.id)
                else if (confirmAction.type === 'complete') completeConversation(confirmAction.id)
                setConfirmAction(null)
              }}
            >
              {confirmAction?.type === 'decline' && 'Decline Request'}
              {confirmAction?.type === 'withdraw' && 'Withdraw Request'}
              {confirmAction?.type === 'cancel' && 'End Conversation'}
              {confirmAction?.type === 'complete' && 'End & review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review modal — conversation path */}
      {selectedConv && (
        <ReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          conversationId={selectedConv.id}
          revieweeName={otherUserName}
          revieweeRole={isVolunteer ? 'requester' : 'volunteer'}
          onSubmitted={handleReviewSubmitted}
        />
      )}
    </div>
  )
}

// ── ConversationCard sub-component ──
interface ConversationCardProps {
  conversation: {
    id: string
    volunteer_id: string
    requester_id: string
    volunteer: { first_name: string | null } | null
    requester: { first_name: string | null } | null
    resource: { name: string; category: string } | null
    status: string
    updated_at: string | null
    counterpartyDisplayName: string | null
  }
  userId: string
  isSelected: boolean
  onClick: () => void
}

function ConversationCard({ conversation, userId, isSelected, onClick }: ConversationCardProps) {
  const isVolunteer = conversation.volunteer_id === userId
  // Privacy-rule-computed name (full for sourcer→seeker, first-only otherwise);
  // fall back to the first-name base join, then 'User'.
  const otherName = conversation.counterpartyDisplayName
    ?? (isVolunteer ? conversation.requester?.first_name : conversation.volunteer?.first_name)
  const categoryLabel = conversation.resource?.category
    ? CATEGORY_LABELS[conversation.resource.category] ?? conversation.resource.category
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-stone-100 transition-colors ${
        isSelected ? 'bg-[#4a5d23]/10' : 'hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-800 truncate">{otherName ?? 'User'}</p>
        <span className="text-[10px] text-stone-600">
          {conversation.updated_at ? new Date(conversation.updated_at).toLocaleDateString() : ''}
        </span>
      </div>
      {categoryLabel && (
        <span className="text-xs text-stone-600">{categoryLabel}</span>
      )}
    </button>
  )
}
