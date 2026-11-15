'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  CheckSquare, Calendar, FileText, StickyNote, Plus, Trash2, Download,
  MapPin, Phone, ExternalLink, Loader2, Upload, Check, MessageSquare, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useResourceDetail } from '@/hooks/use-resource-detail'
import { VaultGuard } from '@/components/vault'
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { documentsT, documentSize, type DocumentsKey } from '@/lib/i18n-documents'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import { relativeAge } from '@/lib/relative-age'
import { formatCount, formatPercent } from '@/lib/i18n-intl'
import { formatCalendarDate } from '@/lib/event-time'
import { formatMessage } from '@/lib/format-message'
import { failureCode } from '@/lib/failure-code'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { announce, AnnouncementText, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

// P6 W9: the dialog's words are in the member's language (lib/i18n-documents.ts), with lang/dir on
// the portalled content; the category through resourceCategoryLabel (one source for every surface);
// dates and ages in the locale. Everything the member or the community wrote — the resource's name
// and address, tasks, dates' titles, file names, notes, posts and their authors' names — keeps its
// own language and direction (lang="" dir="auto"). A failure shows a translated line, never the
// database's text, and writes one code-only error_surface.shown row (the hook writes none).

interface ResourceDetailDialogProps {
  savedResourceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Posts about this resource ──
interface ResourcePost {
  id: string
  content: string
  created_at: string | null
  author_name: string | null
  author_avatar: string | null
}

interface ResourcePostsProps {
  resourceId: string
  locale: Locale
}

function ResourcePosts({ resourceId, locale }: ResourcePostsProps) {
  const supabase = createClient()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [posts, setPosts] = useState<ResourcePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<DocumentsKey | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('id, content, created_at, user:profiles!posts_user_id_fkey(first_name, avatar_url)')
        .eq('resource_id', resourceId)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(20)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))

      if (fetchError) throw fetchError

      const rows = (data ?? []) as Array<{
        id: string
        content: string
        created_at: string | null
        user: { first_name: string | null; avatar_url: string | null } | null
      }>

      setPosts(rows.map((row) => ({
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        author_name: row.user?.first_name ?? null,
        author_avatar: row.user?.avatar_url ?? null,
      })))
    } catch (err) {
      logger.warn('error_surface.shown', { surface: 'resource-posts', kind: failureCode(err), locale })
      setError(isQueryTimeout(err) ? 'postsTimedOut' : 'postsFailed')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, resourceId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // The failure line's region is always the first child, mounted in every state, so a failure
  // that appears is spoken.
  const shell = (content: React.ReactNode, failure: React.ReactNode = null) => (
    <>
      <div role="alert" data-testid="resource-posts-alert">{failure}</div>
      {content}
    </>
  )

  if (loading) {
    return shell(
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-stone-600" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    return shell(null, <p className="text-xs text-red-700 py-2">{t(error)}</p>)
  }

  if (posts.length === 0) {
    return shell(
      <p className="text-sm text-stone-700 text-center py-3">
        {t('noPosts')}
      </p>
    )
  }

  return shell(
    <div data-testid="resource-posts-list" className="space-y-3">
      {posts.map((post) => (
        <div
          key={post.id}
          data-testid={`resource-post-${post.id}`}
          className="flex gap-2.5"
        >
          <div className="w-7 h-7 rounded-full bg-[#4a5d23] flex items-center justify-center flex-shrink-0 mt-0.5">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt={post.author_name ?? ''} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-stone-800 truncate">
                {post.author_name ? <span lang="" dir="auto">{post.author_name}</span> : t('communityMember')}
              </span>
              <span className="text-xs text-stone-700 flex-shrink-0">
                {post.created_at ? relativeAge(post.created_at, locale) : ''}
              </span>
            </div>
            <p className="text-sm text-stone-700 leading-relaxed" lang="" dir="auto">{post.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResourceDetailDialog({ savedResourceId, open, onOpenChange }: ResourceDetailDialogProps) {
  const locale = useProfileLocale()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const {
    resource, tasks, events, documents, notes,
    addTask, toggleTask, deleteTask,
    addEvent, deleteEvent,
    uploadDocument, deleteDocument, getDocumentUrl,
    updateNotes,
    completedTasks, totalTasks, progress,
    isLoading, error,
  } = useResourceDetail(savedResourceId)

  const [newTask, setNewTask] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventTime, setNewEventTime] = useState('')
  const [localNotes, setLocalNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const taskInputRef = useRef<HTMLInputElement>(null)
  const eventInputRef = useRef<HTMLInputElement>(null)
  const uploadButtonRef = useRef<HTMLButtonElement>(null)

  // One always-mounted status line for results and one alert line for failures (keyed nodes:
  // an identical repeat is spoken again).
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  const [alert, setAlert] = useState<Announcement>(NO_ANNOUNCEMENT)
  /** Say the result of one action: the done line, or the failure line plus one code-only row
   *  (the hook writes none). */
  const report = (ok: boolean, done: DocumentsKey, kind: string) => {
    if (ok) {
      announce(setStatus, t(done))
      return
    }
    announce(setAlert, t('detailFailed'))
    logger.warn('error_surface.shown', { surface: 'resource-detail', kind, locale })
  }
  // A failed load of the dialog (each load ends with isLoading false): the same line, one row.
  useEffect(() => {
    if (error && !isLoading) {
      announce(setAlert, t('detailFailed'))
      logger.warn('error_surface.shown', { surface: 'resource-detail', kind: 'load_failed', locale })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  // Sync notes from hook to local state
  useState(() => { setLocalNotes(notes) })
  // Keep local notes in sync when hook notes change (initial load)
  if (notes && localNotes === '' && notes !== localNotes) {
    setLocalNotes(notes)
  }

  const handleAddTask = async () => {
    if (!newTask.trim()) {
      taskInputRef.current?.focus()
      return
    }
    const ok = await addTask(newTask)
    if (ok) setNewTask('')
    report(ok, 'taskAdded', 'task_add')
    taskInputRef.current?.focus()
  }

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) {
      eventInputRef.current?.focus()
      return
    }
    const ok = await addEvent(newEventTitle, newEventDate, newEventTime || undefined)
    if (ok) {
      setNewEventTitle('')
      setNewEventDate('')
      setNewEventTime('')
    }
    report(ok, 'eventAdded', 'event_add')
    eventInputRef.current?.focus()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    const ok = await uploadDocument(file)
    setIsUploading(false)
    report(ok, 'fileUploaded', 'file_upload')
    if (fileInputRef.current) fileInputRef.current.value = ''
    uploadButtonRef.current?.focus()
  }

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getDocumentUrl(filePath)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
    }
  }

  const handleSaveNotes = async () => {
    if (localNotes === notes) return
    const ok = await updateNotes(localNotes)
    if (!ok) {
      report(false, 'notesSaved', 'notes_save')
      return
    }
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const categoryLabel = resource?.resource_category ? resourceCategoryLabel(resource.resource_category, locale) : ''
  const iconButton = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-stone-700 hover:text-red-700 hover:bg-red-50'
  const addButton = 'bg-[#4a5d23] hover:bg-[#3d4d1c] text-white'
  const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'
  const taskEmpty = !newTask.trim()
  const eventIncomplete = !newEventTitle.trim() || !newEventDate
  const notesUnchanged = localNotes === notes

  if (!savedResourceId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 bg-[#faf9f6] overflow-hidden"
        lang={locale}
        dir={dir(locale)}
        closeLabel={documentsT(locale, 'close')}
        aria-describedby={undefined}
        data-testid="resource-detail-dialog"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-stone-600" aria-hidden="true" />
            <DialogTitle className="sr-only">{t('loadingResource')}</DialogTitle>
          </div>
        ) : resource ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200/50 flex-shrink-0">
              <div className="flex flex-wrap items-center gap-3 pe-8">
                <DialogTitle className="text-xl font-bold text-stone-800">
                  <span lang="" dir="auto">{resource.resource_name}</span>
                </DialogTitle>
                {categoryLabel && (
                  <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{categoryLabel}</Badge>
                )}
              </div>
              <DialogDescription className="flex flex-wrap gap-4 mt-2 text-sm">
                {resource.resource_address && (
                  <span className="flex items-center gap-1 text-stone-700">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> <span lang="" dir="auto">{resource.resource_address}</span>
                  </span>
                )}
                {resource.resource_phone && (
                  <a href={`tel:${resource.resource_phone}`} className="flex items-center gap-1 text-stone-700 hover:text-[#4a5d23]">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" /> <span dir="ltr">{resource.resource_phone}</span>
                  </a>
                )}
                {resource.resource_website && (
                  <a href={resource.resource_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#4a5d23] hover:underline">
                    <ExternalLink className="w-3.5 h-3.5 rtl:-scale-x-100" aria-hidden="true" /> {t('website')}
                  </a>
                )}
              </DialogDescription>
              {totalTasks > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-stone-700 mb-1">
                    <span>{formatMessage(t('tasksComplete'), { done: formatCount(completedTasks, locale), total: formatCount(totalTasks, locale) })}</span>
                    <span>{formatPercent(progress, locale)}</span>
                  </div>
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#4a5d23] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* Scrollable Body — user-authored fields (notes/task+event titles/file
                names) are encrypted at rest, so this surface is vault-gated. The
                header above shows only public listing fields and stays ungated.
                Community Posts are public data (unencrypted) and live OUTSIDE
                the VaultGuard so they are always visible regardless of vault state. */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* ── Community Posts Section (only when resource has a canonical ID) ── */}
              {/* Public data — intentionally outside VaultGuard; no vault required. */}
              {resource.resource_id && (
                <section data-testid="resource-posts-section">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" aria-hidden="true" /> {t('communityPosts')}
                  </h3>
                  <div className="border border-stone-300 rounded-xl bg-white p-4">
                    <ResourcePosts resourceId={resource.resource_id} locale={locale} />
                  </div>
                </section>
              )}

              <VaultGuard onDismiss={() => onOpenChange(false)}>
              {/* ── Tasks Section ── */}
              <section>
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" aria-hidden="true" /> {t('tasks')}
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <Label htmlFor="resource-new-task" className="text-xs text-stone-800">{t('newTask')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="resource-new-task"
                      ref={taskInputRef}
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                      placeholder={t('addTaskPlaceholder')}
                      lang=""
                      dir="auto"
                      className="flex-1 border-stone-500 text-stone-900 placeholder:text-stone-600"
                    />
                    <Button size="sm" onClick={handleAddTask} aria-disabled={taskEmpty} aria-label={t('addTask')} className={cn(addButton, taskEmpty && UNAVAILABLE)}>
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-stone-700 text-center py-2">{t('noTasks')}</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={task.is_completed ?? false}
                            onCheckedChange={async () => { if (!(await toggleTask(task.id))) report(false, 'notesSaved', 'task_toggle') }}
                            aria-labelledby={`task-title-${task.id}`}
                          />
                          <span id={`task-title-${task.id}`} lang="" dir="auto" className={`flex-1 text-sm ${task.is_completed ? 'line-through text-stone-600' : 'text-stone-800'}`}>
                            {task.title}
                          </span>
                          <button
                            type="button"
                            onClick={async () => { report(await deleteTask(task.id), 'taskDeleted', 'task_delete'); taskInputRef.current?.focus() }}
                            aria-label={t('deleteTask')}
                            aria-describedby={`task-title-${task.id}`}
                            className={iconButton}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Schedule Section ── */}
              <section>
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" aria-hidden="true" /> {t('schedule')}
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex-1 min-w-[150px] space-y-1">
                      <Label htmlFor="resource-event-title" className="text-xs text-stone-800">{t('eventTitle')}</Label>
                      <Input
                        id="resource-event-title"
                        ref={eventInputRef}
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder={t('eventTitlePlaceholder')}
                        lang=""
                        dir="auto"
                        className="border-stone-500 text-stone-900 placeholder:text-stone-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="resource-event-date" className="text-xs text-stone-800">{t('eventDate')}</Label>
                      <input
                        id="resource-event-date"
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="block px-3 py-2 border border-stone-500 rounded-md text-sm text-stone-900 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="resource-event-time" className="text-xs text-stone-800">{t('eventTime')}</Label>
                      <input
                        id="resource-event-time"
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                        className="block px-3 py-2 border border-stone-500 rounded-md text-sm text-stone-900 bg-white"
                      />
                    </div>
                    <Button size="sm" onClick={handleAddEvent} aria-disabled={eventIncomplete} aria-label={t('addEvent')} className={cn(addButton, eventIncomplete && UNAVAILABLE)}>
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {events.length === 0 ? (
                    <p className="text-sm text-stone-700 text-center py-2">{t('noEvents')}</p>
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                        <div key={event.id} className="flex flex-wrap items-center gap-3">
                          <Calendar className="w-4 h-4 text-amber-700 flex-shrink-0" aria-hidden="true" />
                          <span className="text-sm font-medium text-stone-700 min-w-20 flex-shrink-0">
                            {/* A calendar date (YYYY-MM-DD, no time): never shifted through a zone. */}
                            {formatCalendarDate(event.event_date, locale, { month: 'short', day: 'numeric' })}
                          </span>
                          {event.event_time && (
                            <span className="text-xs text-stone-700 flex-shrink-0" dir="ltr">
                              {event.event_time.slice(0, 5)}
                            </span>
                          )}
                          <span id={`event-title-${event.id}`} className="flex-1 text-sm text-stone-800" lang="" dir="auto">{event.title}</span>
                          <button
                            type="button"
                            onClick={async () => { report(await deleteEvent(event.id), 'eventDeleted', 'event_delete'); eventInputRef.current?.focus() }}
                            aria-label={t('deleteEvent')}
                            aria-describedby={`event-title-${event.id}`}
                            className={iconButton}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Files Section ── */}
              <section>
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" /> {t('files')}
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv,.xlsx"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <Button
                      ref={uploadButtonRef}
                      variant="outline"
                      onClick={() => { if (!isUploading) fileInputRef.current?.click() }}
                      aria-disabled={isUploading}
                      aria-busy={isUploading || undefined}
                      className={cn('w-full border-dashed border-stone-500 text-stone-700 hover:text-[#4a5d23] hover:border-[#4a5d23]', isUploading && UNAVAILABLE)}
                    >
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 me-2 animate-spin" aria-hidden="true" /> {t('uploadingFile')}</>
                      ) : (
                        <><Upload className="w-4 h-4 me-2" aria-hidden="true" /> {t('chooseFileToUpload')}</>
                      )}
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-sm text-stone-700 text-center py-2">{t('noFiles')}</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-stone-600 flex-shrink-0" aria-hidden="true" />
                          <span id={`file-name-${doc.id}`} className="flex-1 min-w-0 text-sm text-stone-800 truncate" lang="" dir="auto">{doc.file_name}</span>
                          <span className="text-xs text-stone-700 flex-shrink-0">
                            {doc.file_size != null ? documentSize(doc.file_size, locale) : '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDownload(doc.file_path, doc.file_name)}
                            aria-label={t('downloadAttachment')}
                            aria-describedby={`file-name-${doc.id}`}
                            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-stone-700 hover:text-[#4a5d23] hover:bg-stone-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => { report(await deleteDocument(doc.id), 'fileDeleted', 'file_delete'); uploadButtonRef.current?.focus() }}
                            aria-label={t('deleteAttachment')}
                            aria-describedby={`file-name-${doc.id}`}
                            className={iconButton}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Notes Section ── */}
              <section>
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" aria-hidden="true" /> <span id="resource-notes-heading">{t('notes')}</span>
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <Textarea
                    value={localNotes}
                    onChange={(e) => { setLocalNotes(e.target.value); setNotesSaved(false) }}
                    placeholder={t('notesPlaceholder')}
                    aria-labelledby="resource-notes-heading"
                    lang=""
                    dir="auto"
                    className="min-h-[120px] border-stone-500 text-stone-900 placeholder:text-stone-600 resize-y"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <span role="status" className="text-xs text-green-800 flex items-center gap-1">
                      {notesSaved && (<><Check className="w-3 h-3" aria-hidden="true" /> {t('notesSaved')}</>)}
                    </span>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      aria-disabled={notesUnchanged}
                      className={cn(addButton, notesUnchanged && UNAVAILABLE)}
                    >
                      {t('saveNotes')}
                    </Button>
                  </div>
                </div>
              </section>
              </VaultGuard>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-stone-700">
            <DialogTitle className="text-sm font-normal">{t('resourceNotFound')}</DialogTitle>
          </div>
        )}

        {/* Always mounted, so a new failure is announced; never the database's text. */}
        <p role="status" className="sr-only" data-testid="resource-detail-status">
          <AnnouncementText announcement={status} />
        </p>
        <div role="alert" data-testid="resource-detail-alert" className={alert.text ? 'mx-6 mb-4 bg-red-50 border border-red-300 rounded-lg p-3 text-sm text-red-800' : undefined}>
          <AnnouncementText announcement={alert} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
