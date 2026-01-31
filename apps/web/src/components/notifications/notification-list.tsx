'use client'

// apps/web/src/components/notifications/notification-list.tsx
// Notification UI components

import React, { useState } from 'react'
import Link from 'next/link'
import { type Notification, type Reminder, getNotificationTypeInfo } from '@/hooks/use-notifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Single notification item
interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const typeInfo = getNotificationTypeInfo(notification.type)
  const timeAgo = getTimeAgo(new Date(notification.created_at))

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        notification.is_read
          ? 'bg-background'
          : 'bg-primary/5 border-primary/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{typeInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{notification.title}</h4>
          <p className="text-sm text-muted-foreground mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
        </div>
        <div className="flex items-center gap-1">
          {notification.link && (
            <Link href={notification.link}>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </Link>
          )}
          {!notification.is_read && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(notification.id)}
            >
              ✓
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(notification.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            ✕
          </Button>
        </div>
      </div>
    </div>
  )
}

// Notification list
interface NotificationListProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

export function NotificationList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  isLoading,
}: NotificationListProps) {
  const unreadCount = notifications.filter(n => !n.is_read).length

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse p-3 rounded-lg border">
            <div className="flex gap-3">
              <div className="w-6 h-6 bg-muted rounded" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔔</div>
        <p className="text-muted-foreground">No notifications</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
          <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
            Mark all as read
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map(notification => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

// Notification dropdown (for header)
interface NotificationDropdownProps {
  notifications: Notification[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
}

export function NotificationDropdown({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-card border rounded-lg shadow-lg z-50">
            <div className="p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
                  Mark all read
                </Button>
              )}
            </div>
            <div className="p-2 space-y-1">
              {notifications.slice(0, 5).map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={onMarkAsRead}
                  onDelete={() => {}}
                />
              ))}
              {notifications.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No notifications
                </p>
              )}
            </div>
            {notifications.length > 5 && (
              <div className="p-2 border-t">
                <Link href="/notifications" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full">
                    View all notifications
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Reminder components
interface ReminderItemProps {
  reminder: Reminder
  onComplete: (id: string) => void
  onDelete: (id: string) => void
}

export function ReminderItem({ reminder, onComplete, onDelete }: ReminderItemProps) {
  const remindDate = new Date(reminder.remind_at)
  const isPast = remindDate < new Date()
  const isToday = remindDate.toDateString() === new Date().toDateString()

  return (
    <div
      className={`p-3 rounded-lg border ${
        reminder.is_completed
          ? 'opacity-50'
          : isPast
          ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
          : isToday
          ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(reminder.id)}
          disabled={reminder.is_completed}
          className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 ${
            reminder.is_completed
              ? 'bg-primary border-primary'
              : 'border-border hover:border-primary'
          }`}
        >
          {reminder.is_completed && (
            <span className="text-primary-foreground text-xs">✓</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <h4
            className={`font-medium text-sm ${
              reminder.is_completed ? 'line-through' : ''
            }`}
          >
            {reminder.title}
          </h4>
          {reminder.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {reminder.description}
            </p>
          )}
          <p
            className={`text-xs mt-1 ${
              isPast && !reminder.is_completed
                ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground'
            }`}
          >
            {isPast ? 'Overdue: ' : ''}
            {remindDate.toLocaleDateString()} at{' '}
            {remindDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(reminder.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          ✕
        </Button>
      </div>
    </div>
  )
}

// Create reminder form
interface CreateReminderFormProps {
  onCreateReminder: (reminder: {
    title: string
    description?: string
    remind_at: string
    application_id?: string
  }) => Promise<unknown>
  applicationId?: string
}

export function CreateReminderForm({ onCreateReminder, applicationId }: CreateReminderFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [isCreating, setIsCreating] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !date) return

    setIsCreating(true)
    try {
      const remindAt = new Date(`${date}T${time}`).toISOString()
      await onCreateReminder({
        title: title.trim(),
        description: description.trim() || undefined,
        remind_at: remindAt,
        application_id: applicationId,
      })
      setTitle('')
      setDescription('')
      setDate('')
      setTime('09:00')
    } finally {
      setIsCreating(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Set Reminder</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Submit documents"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Additional details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                min={minDate}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={isCreating || !title.trim() || !date}>
            {isCreating ? 'Creating...' : 'Create Reminder'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Reminder list
interface ReminderListProps {
  reminders: Reminder[]
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  showCompleted?: boolean
}

export function ReminderList({
  reminders,
  onComplete,
  onDelete,
  showCompleted = false,
}: ReminderListProps) {
  const filteredReminders = showCompleted
    ? reminders
    : reminders.filter(r => !r.is_completed)

  if (filteredReminders.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">No reminders</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {filteredReminders.map(reminder => (
        <ReminderItem
          key={reminder.id}
          reminder={reminder}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// Helper function
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return date.toLocaleDateString()
}
