'use client'

// Community → Messages sub-tab. Every string is read from lib/i18n-feed-messages.ts in the
// member's language (useProfileLocale); each root — and the confirm dialog, which renders in a
// portal — carries that language and its direction. Names and message bodies are shown as written
// (dir="auto", no page language). What is still English is marked English: the rating display,
// and a failure whose text came from the server.

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
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, splitMessage } from '@/lib/format-message'
import { formatClock, formatCount, formatDate } from '@/lib/i18n-intl'
import { browserTimeZone } from '@/lib/event-time'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { conversationError, conversationStatusLabel, messagesT } from '@/lib/i18n-feed-messages'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'

export function MessagesPanel() {
  const { user, isAnonymous } = useAuth()
  const locale = useProfileLocale()
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
  const unknownUser = messagesT(locale, 'unknownUser')
  const otherUserName = selectedConv
    ? (selectedConv.counterpartyDisplayName
        ?? (isVolunteer ? selectedConv.requester?.first_name : selectedConv.volunteer?.first_name)
        ?? unknownUser)
    : ''
  // A person's name is shown as written (lang=""); the fallback word is FEED's own text.
  const otherUserLang = otherUserName === unknownUser ? undefined : ''
  const [beforeWaitingName, afterWaitingName] = splitMessage(messagesT(locale, 'waitingForAccept'), 'name')
  const [beforeReviewName, afterReviewName] = splitMessage(messagesT(locale, 'reviewPromptBody'), 'name')
  const failure = error ? conversationError(error, locale) : null

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
      <div lang={locale} dir={dir(locale)} className="h-full flex flex-col items-center justify-center p-6">
        <CreateAccountPrompt message={messagesT(locale, 'guestPrompt')} linkLabel={feedChromeT(locale, 'createAccount')} />
      </div>
    )
  }

  // ── Empty State ──
  if (!isLoading && conversations.length === 0) {
    return (
      <div lang={locale} dir={dir(locale)} className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-semibold text-stone-700 mb-2">{messagesT(locale, 'emptyTitle')}</h3>
        <p className="text-sm text-stone-500 max-w-xs">
          {messagesT(locale, 'emptyBody')}
        </p>
      </div>
    )
  }

  return (
    <div lang={locale} dir={dir(locale)} className="h-full flex overflow-hidden">
      {/* ── Left: Conversation List ── */}
      <div className={`${selectedConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-shrink-0 flex-col border-e border-stone-200/50 overflow-y-auto`}>
        <div className="p-4 border-b border-stone-200/50">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {messagesT(locale, 'title')}
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
                  <span className="text-xs font-medium text-amber-700 uppercase tracking-wider rtl:tracking-normal">
                    {formatMessage(messagesT(locale, 'sectionPending'), { n: formatCount(pendingRequests.length, locale) })}
                  </span>
                </div>
                {pendingRequests.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                    locale={locale}
                  />
                ))}
              </div>
            )}

            {/* Active */}
            {activeConversations.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-green-50">
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wider rtl:tracking-normal">
                    {formatMessage(messagesT(locale, 'sectionActive'), { n: formatCount(activeConversations.length, locale) })}
                  </span>
                </div>
                {activeConversations.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                    locale={locale}
                  />
                ))}
              </div>
            )}

            {/* Completed */}
            {completedConversations.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-lime-50">
                  <span className="text-xs font-medium text-lime-700 uppercase tracking-wider rtl:tracking-normal">
                    {formatMessage(messagesT(locale, 'sectionCompleted'), { n: formatCount(completedConversations.length, locale) })}
                  </span>
                </div>
                {completedConversations.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                    locale={locale}
                  />
                ))}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider rtl:tracking-normal">
                    {formatMessage(messagesT(locale, 'sectionHistory'), { n: formatCount(history.length, locale) })}
                  </span>
                </div>
                {history.map(conv => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    userId={user?.id ?? ''}
                    isSelected={conv.id === selectedConversationId}
                    onClick={() => selectConversation(conv.id)}
                    locale={locale}
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
                aria-label={messagesT(locale, 'backToList')}
                className="md:hidden text-stone-400 hover:text-stone-600"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" aria-hidden="true" />
              </button>
              <div className="flex-1">
                <p lang={otherUserLang} dir="auto" className="font-medium text-stone-800 text-sm">{otherUserName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    className={`text-xs ${
                      selectedConv.status === 'active' ? 'bg-green-100 text-green-700' :
                      selectedConv.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      selectedConv.status === 'completed' ? 'bg-lime-100 text-lime-700' :
                      'bg-stone-100 text-stone-500'
                    }`}
                  >
                    {conversationStatusLabel(selectedConv.status, locale)}
                  </Badge>
                  {selectedConv.resource?.category && (
                    <span className="text-xs text-stone-600">
                      {resourceCategoryLabel(selectedConv.resource.category, locale)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {selectedConv.status === 'pending' && isVolunteer && (
                  <>
                    <Button size="sm" onClick={() => acceptRequest(selectedConv.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs">
                      <Check className="w-3 h-3 me-1" /> {messagesT(locale, 'accept')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: 'decline', id: selectedConv.id })} className="text-xs">
                      {messagesT(locale, 'decline')}
                    </Button>
                  </>
                )}
                {selectedConv.status === 'pending' && !isVolunteer && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: 'withdraw', id: selectedConv.id })} className="text-xs">
                    {messagesT(locale, 'withdraw')}
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
                    <CheckCircle className="w-3 h-3 me-1" /> {messagesT(locale, 'endAndReview')}
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
                    {/* Written by a member: its own direction, no page language. */}
                    <p lang="" dir="auto" className="text-sm leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${
                      msg.sender_id === user?.id ? 'text-white/60' : 'text-stone-400'
                    }`}>
                      {msg.created_at ? formatClock(msg.created_at, locale, browserTimeZone()) : ''}
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
                    <span>
                      {beforeWaitingName}
                      <bdi lang={otherUserLang}>{otherUserName}</bdi>
                      {afterWaitingName}
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={messagesT(locale, 'inputPlaceholder')}
                      aria-label={messagesT(locale, 'inputPlaceholder')}
                      dir="auto"
                      className="flex-1 text-stone-900 placeholder:text-stone-400"
                      maxLength={2000}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={isSending || !messageInput.trim()}
                      aria-label={messagesT(locale, 'send')}
                      className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />}
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
                      <p className="text-sm font-medium text-lime-800">{messagesT(locale, 'reviewSubmitted')}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {/* The rating's own name ("4 out of 5 stalks") is not translated yet: marked English. */}
                        <span lang="en" dir="ltr" data-english-only="rating" className="inline-flex">
                          <WheatStalkRatingDisplay
                            value={myReview.rating}
                            size="sm"
                            testIdPrefix={`my-review-stalks-${selectedConv.id}`}
                          />
                        </span>
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
                      {messagesT(locale, 'reviewPromptTitle')}
                    </p>
                    <p className="text-sm text-stone-600 mb-3">
                      {beforeReviewName}
                      <span lang={otherUserLang} dir="auto" className="font-medium">{otherUserName}</span>
                      {afterReviewName}
                    </p>
                    <Button
                      size="sm"
                      data-testid="open-review-modal-btn"
                      onClick={() => setReviewModalOpen(true)}
                      className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white text-xs"
                    >
                      {messagesT(locale, 'rateExperience')}
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
              <p className="text-sm text-stone-600">{messagesT(locale, 'selectConversation')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {failure && (
        /* The hook's own sentences read in the member's language; the server's text is English. */
        <div
          lang={failure.translated ? undefined : 'en'}
          dir={failure.translated ? undefined : 'ltr'}
          className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600"
        >
          {failure.text}
        </div>
      )}

      {/* Confirm dialog for conversation actions */}
      <Dialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        {/* A portal: it does not inherit the panel's language, so it carries its own. */}
        <DialogContent lang={locale} dir={dir(locale)} className="sm:max-w-sm">
          <DialogHeader className="sm:text-start">
            <DialogTitle>
              {confirmAction?.type === 'decline' && messagesT(locale, 'confirmDeclineTitle')}
              {confirmAction?.type === 'withdraw' && messagesT(locale, 'confirmWithdrawTitle')}
              {confirmAction?.type === 'cancel' && messagesT(locale, 'confirmCancelTitle')}
              {confirmAction?.type === 'complete' && messagesT(locale, 'confirmCompleteTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            {confirmAction?.type === 'decline' && messagesT(locale, 'confirmDeclineBody')}
            {confirmAction?.type === 'withdraw' && messagesT(locale, 'confirmWithdrawBody')}
            {confirmAction?.type === 'cancel' && messagesT(locale, 'confirmCancelBody')}
            {confirmAction?.type === 'complete' && messagesT(locale, 'confirmCompleteBody')}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
              {messagesT(locale, 'keepChatting')}
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
              {confirmAction?.type === 'decline' && messagesT(locale, 'confirmDecline')}
              {confirmAction?.type === 'withdraw' && messagesT(locale, 'confirmWithdraw')}
              {confirmAction?.type === 'cancel' && messagesT(locale, 'confirmCancel')}
              {confirmAction?.type === 'complete' && messagesT(locale, 'endAndReview')}
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
  locale: Locale
}

function ConversationCard({ conversation, userId, isSelected, onClick, locale }: ConversationCardProps) {
  const isVolunteer = conversation.volunteer_id === userId
  // Privacy-rule-computed name (full for sourcer→seeker, first-only otherwise);
  // fall back to the first-name base join, then 'User'.
  const otherName = conversation.counterpartyDisplayName
    ?? (isVolunteer ? conversation.requester?.first_name : conversation.volunteer?.first_name)
  const categoryLabel = conversation.resource?.category
    ? resourceCategoryLabel(conversation.resource.category, locale)
    : null

  return (
    <button
      onClick={onClick}
      className={`w-full text-start px-4 py-3 border-b border-stone-100 transition-colors ${
        isSelected ? 'bg-[#4a5d23]/10' : 'hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <p lang={otherName ? '' : undefined} dir="auto" className="text-sm font-medium text-stone-800 truncate">{otherName ?? messagesT(locale, 'unknownUser')}</p>
        <span className="text-[10px] text-stone-600">
          {conversation.updated_at ? formatDate(conversation.updated_at, locale, browserTimeZone()) : ''}
        </span>
      </div>
      {categoryLabel && (
        <span className="text-xs text-stone-600">{categoryLabel}</span>
      )}
    </button>
  )
}
