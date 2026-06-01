// apps/web/src/hooks/use-notifications.ts
// Hook for managing notifications and reminders

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export type NotificationType =
  | 'status_update'
  | 'deadline_reminder'
  | 'action_required'
  | 'document_request'
  | 'approval'
  | 'denial'
  | 'general'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link?: string | null
  application_id?: string | null
  is_read: boolean
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  application_id?: string | null
  title: string
  description?: string | null
  remind_at: string
  is_completed: boolean
  created_at: string
}

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  reminders: Reminder[]
  upcomingReminders: Reminder[]
  isLoading: boolean
  error: Error | null
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  createReminder: (reminder: Omit<Reminder, 'id' | 'user_id' | 'is_completed' | 'created_at'>) => Promise<Reminder | null>
  completeReminder: (id: string) => Promise<void>
  deleteReminder: (id: string) => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NOTIFICATION_TYPE_INFO: Record<NotificationType, { icon: string; color: string }> = {
  status_update: { icon: '🔄', color: 'blue' },
  deadline_reminder: { icon: '⏰', color: 'orange' },
  action_required: { icon: '⚠️', color: 'orange' },
  document_request: { icon: '📎', color: 'yellow' },
  approval: { icon: '✅', color: 'green' },
  denial: { icon: '❌', color: 'red' },
  general: { icon: '📣', color: 'gray' },
}

export function getNotificationTypeInfo(type: NotificationType) {
  return NOTIFICATION_TYPE_INFO[type] || NOTIFICATION_TYPE_INFO.general
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.is_read).length

  const upcomingReminders = reminders
    .filter(r => !r.is_completed && new Date(r.remind_at) > new Date())
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())
    .slice(0, 5)

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch notifications
      const { data: notifs, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (notifError) throw notifError

      // Fetch reminders
      const { data: rems, error: remError } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('remind_at', { ascending: true })

      if (remError) throw remError

      setNotifications(notifs || [])
      setReminders(rems || [])
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const markAsRead = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)

      if (updateError) throw updateError

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      setError(err as Error)
    }
  }, [supabase])

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (updateError) throw updateError

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      setError(err as Error)
    }
  }, [supabase])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      setError(err as Error)
    }
  }, [supabase])

  const createReminder = useCallback(async (
    reminder: Omit<Reminder, 'id' | 'user_id' | 'is_completed' | 'created_at'>
  ): Promise<Reminder | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertError } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          ...reminder,
          is_completed: false,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setReminders(prev => [...prev, data].sort(
        (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
      ))

      return data
    } catch (err) {
      setError(err as Error)
      return null
    }
  }, [supabase])

  const completeReminder = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', id)

      if (updateError) throw updateError

      setReminders(prev =>
        prev.map(r => r.id === id ? { ...r, is_completed: true } : r)
      )
    } catch (err) {
      setError(err as Error)
    }
  }, [supabase])

  const deleteReminder = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setReminders(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      setError(err as Error)
    }
  }, [supabase])

  // Initial load and realtime subscription
  useEffect(() => {
    refreshNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refreshNotifications])

  return {
    notifications,
    unreadCount,
    reminders,
    upcomingReminders,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createReminder,
    completeReminder,
    deleteReminder,
    refreshNotifications,
  }
}

// Push notification support check
export function usePushNotifications() {
  // Compute supported/permission during render — safe with typeof window guard (SSR returns false/'default').
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? (Notification.permission as NotificationPermission) : 'default'
  )
  const [isSubscribed] = useState(false)

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch {
      return false
    }
  }, [isSupported])

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') return

    new Notification(title, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...options,
    })
  }, [isSupported, permission])

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    showNotification,
  }
}
