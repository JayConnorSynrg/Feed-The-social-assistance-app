'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { withMetric } from '@/lib/logger'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

interface ConversationProfile {
  // Cross-user join exposes FIRST NAME only — surname is private (name-privacy
  // lockdown #9). The asymmetric surname reveal is computed server-side by the
  // SECDEF accessor get_my_conversation_counterparties() and merged in as
  // counterpartyDisplayName below.
  first_name: string | null
}

interface ConversationResource {
  name: string
  category: string
}

interface Conversation {
  id: string
  resource_id: string | null
  volunteer_id: string
  requester_id: string
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled'
  created_at: string | null
  updated_at: string | null
  volunteer: ConversationProfile | null
  requester: ConversationProfile | null
  resource: ConversationResource | null
  /**
   * Counterparty display name as permitted by the privacy rule for THIS caller:
   * the SOURCER (volunteer) sees the SEEKER's full name; the SEEKER sees only
   * the SOURCER's first name. Computed by get_my_conversation_counterparties()
   * — never assembled client-side from a surname the rule forbids.
   */
  counterpartyDisplayName: string | null
}

interface CounterpartyRow {
  conversation_id: string
  counterparty_id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string | null
}

const CONVERSATION_SELECT = [
  'id',
  'resource_id',
  'volunteer_id',
  'requester_id',
  'status',
  'created_at',
  'updated_at',
  'volunteer:profiles!conversations_volunteer_id_profiles_fkey(first_name)',
  'requester:profiles!conversations_requester_id_profiles_fkey(first_name)',
  'resource:resources!conversations_resource_id_fkey(name, category)',
].join(', ')

export function useConversations() {
  const supabase = createClient()
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const convVolChannelRef = useRef<RealtimeChannel | null>(null)
  const convReqChannelRef = useRef<RealtimeChannel | null>(null)
  const msgChannelRef = useRef<RealtimeChannel | null>(null)

  // Derived state
  const pendingRequests = conversations.filter(
    (c) => c.volunteer_id === user?.id && c.status === 'pending'
  )
  const activeConversations = conversations.filter((c) => c.status === 'active')
  const completedConversations = conversations.filter((c) => c.status === 'completed')
  const history = conversations.filter(
    (c) => c.status === 'declined' || c.status === 'cancelled'
  )

  const fetchConversations = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      // Fetch the conversation list (first-name-only base join) and the
      // privacy-rule-computed counterparty display names in parallel. The
      // SECDEF accessor returns the permitted name per direction (full for
      // sourcer→seeker, first-only for seeker→sourcer) and enforces the
      // participant guard server-side.
      const [convResult, cpResult] = await Promise.all([
        supabase
          .from('conversations')
          .select(CONVERSATION_SELECT)
          .or(`volunteer_id.eq.${user.id},requester_id.eq.${user.id}`)
          .order('updated_at', { ascending: false })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
        supabase.rpc('get_my_conversation_counterparties'),
      ])

      const { data, error: fetchError } = convResult
      if (fetchError) throw new Error(isQueryTimeout(fetchError)
        ? 'Messages timed out — please check your connection and retry.'
        : fetchError.message)

      // Map conversation_id → permitted display name.
      const cpRows = (cpResult.data ?? []) as unknown as CounterpartyRow[]
      const displayByConv = new Map<string, string | null>(
        cpRows.map((r) => [r.conversation_id, r.display_name])
      )

      const rows = ((data ?? []) as unknown as Conversation[]).map((c) => ({
        ...c,
        counterpartyDisplayName: displayByConv.get(c.id) ?? null,
      }))
      setConversations(rows)

      // Recompute unread count across all active conversations
      const unread = rows.filter(
        (c) => c.status === 'active' || c.status === 'pending'
      )
      // Lightweight unread badge: count will be refined per-message on select
      setUnreadCount(unread.length > 0 ? unread.length : 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id])

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, is_read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (fetchError) throw new Error(fetchError.message)
      setMessages(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages')
    }
  }, [supabase])

  // Subscribe to conversation-list realtime updates for this user
  useEffect(() => {
    if (!user?.id) return

    fetchConversations()

    // Channel: conversations where user is the volunteer
    const volChannel = supabase
      .channel(`conv-vol-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `volunteer_id=eq.${user.id}`,
        },
        () => { fetchConversations() }
      )
      .subscribe()

    convVolChannelRef.current = volChannel

    // Channel: conversations where user is the requester
    const reqChannel = supabase
      .channel(`conv-req-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `requester_id=eq.${user.id}`,
        },
        () => { fetchConversations() }
      )
      .subscribe()

    convReqChannelRef.current = reqChannel

    return () => {
      if (convVolChannelRef.current) {
        supabase.removeChannel(convVolChannelRef.current)
        convVolChannelRef.current = null
      }
      if (convReqChannelRef.current) {
        supabase.removeChannel(convReqChannelRef.current)
        convReqChannelRef.current = null
      }
    }
  }, [supabase, user?.id, fetchConversations])

  const selectConversation = useCallback(async (id: string | null) => {
    setSelectedConversationId(id)
    if (id === null) {
      setMessages([])
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current)
        msgChannelRef.current = null
      }
      return
    }
    await fetchMessages(id)

    // Unsubscribe from any previous message channel
    if (msgChannelRef.current) {
      supabase.removeChannel(msgChannelRef.current)
      msgChannelRef.current = null
    }

    // Subscribe to new messages for this conversation
    const msgChannel = supabase
      .channel(`msg-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload: { new: Message }) => {
          setMessages((prev) => {
            const incoming = payload.new
            // Deduplicate by id
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    msgChannelRef.current = msgChannel
  }, [supabase, fetchMessages])

  // Cleanup message channel on unmount
  useEffect(() => {
    return () => {
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current)
        msgChannelRef.current = null
      }
    }
  }, [supabase])

  const sendRequest = useCallback(
    async (resourceId: string, volunteerId: string, initialMessage: string) => {
      if (!user?.id) {
        setError('Please sign in to send a request')
        return null
      }
      setIsSending(true)
      setError(null)
      try {
        // Insert the conversation (pending status)
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .insert({
            resource_id: resourceId,
            volunteer_id: volunteerId,
            requester_id: user.id,
            status: 'pending',
          })
          .select('id')
          .single()

        if (convError) {
          if (convError.code === '23505') {
            setError('This volunteer already has a pending request. Please try again later.')
          } else {
            throw new Error(convError.message)
          }
          return null
        }

        // Insert the opening message
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: convData.id,
            sender_id: user.id,
            content: initialMessage,
            is_read: false,
          })

        if (msgError) throw new Error(msgError.message)

        await fetchConversations()
        return convData as { id: string }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send request')
        return null
      } finally {
        setIsSending(false)
      }
    },
    [supabase, user?.id, fetchConversations]
  )

  const acceptRequest = useCallback(async (id: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', id)
        .eq('volunteer_id', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept request')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchConversations])

  const declineRequest = useCallback(async (id: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'declined' })
        .eq('id', id)
        .eq('volunteer_id', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline request')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchConversations])

  const cancelConversation = useCallback(async (id: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('volunteer_id', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel conversation')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchConversations])

  /**
   * Complete a conversation (volunteer-only). Status transitions to 'completed',
   * which unlocks the bilateral review prompt for both participants.
   */
  const completeConversation = useCallback(async (id: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'completed' })
        .eq('id', id)
        .eq('volunteer_id', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete conversation')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchConversations])

  const withdrawRequest = useCallback(async (id: string) => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('requester_id', user.id)

      if (updateError) throw new Error(updateError.message)
      await fetchConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw request')
    } finally {
      setIsLoading(false)
    }
  }, [supabase, user?.id, fetchConversations])

  const sendMessage = useCallback(async (content: string) => {
    if (!user?.id || !selectedConversationId) {
      setError('No conversation selected')
      return
    }
    setIsSending(true)
    setError(null)
    try {
      const { error: insertError } = await withMetric(
        'messages.send',
        { content_length: content.length },
        async () => await supabase
          .from('messages')
          .insert({
            conversation_id: selectedConversationId,
            sender_id: user.id,
            content,
            is_read: false,
          })
      )

      if (insertError) throw new Error(insertError.message)
      // Optimistic append happens via realtime INSERT event; no manual push needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsSending(false)
    }
  }, [supabase, user?.id, selectedConversationId])

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user?.id) return
    try {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false)

      if (updateError) throw new Error(updateError.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark messages as read')
    }
  }, [supabase, user?.id])

  return {
    // State
    conversations,
    messages,
    selectedConversationId,
    unreadCount,
    isLoading,
    isSending,
    error,
    // Derived
    pendingRequests,
    activeConversations,
    completedConversations,
    history,
    // Actions
    sendRequest,
    acceptRequest,
    declineRequest,
    completeConversation,
    cancelConversation,
    withdrawRequest,
    sendMessage,
    selectConversation,
    markAsRead,
  }
}
