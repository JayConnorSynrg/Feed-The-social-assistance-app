'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  CheckSquare, Calendar, FileText, StickyNote, Plus, Trash2, Download,
  MapPin, Phone, ExternalLink, Loader2, Upload, Check, MessageSquare, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { createClient } from '@/lib/supabase/client'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'

interface ResourceDetailDialogProps {
  savedResourceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food', housing: 'Housing', employment: 'Jobs', transportation: 'Transportation',
  legal: 'Legal', healthcare: 'Healthcare', education: 'Education', other: 'General',
  mental_health: 'Mental Health', substance_abuse: 'Treatment', childcare: 'Childcare',
  eitc_tax_filing: 'Tax Filing & EITC', free_legal: 'Free Legal Help',
  prenatal_natal_care: 'Prenatal & Newborn Care', waste_disposal: 'Waste & Disposal',
  free_camping: 'Free Camping', free_goods_donation: 'Free Goods & Donations',
}

// ── Posts about this resource ──
interface ResourcePost {
  id: string
  content: string
  created_at: string | null
  author_name: string | null
  author_avatar: string | null
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString()
}

interface ResourcePostsProps {
  resourceId: string
}

function ResourcePosts({ resourceId }: ResourcePostsProps) {
  const supabase = createClient()
  const [posts, setPosts] = useState<ResourcePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('id, content, created_at, user:profiles!posts_user_id_fkey(full_name, avatar_url)')
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
        user: { full_name: string | null; avatar_url: string | null } | null
      }>

      setPosts(rows.map((row) => ({
        id: row.id,
        content: row.content,
        created_at: row.created_at,
        author_name: row.user?.full_name ?? null,
        author_avatar: row.user?.avatar_url ?? null,
      })))
    } catch (err) {
      const msg = isQueryTimeout(err)
        ? 'Posts timed out — please retry.'
        : err instanceof Error ? err.message : 'Failed to load posts'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [supabase, resourceId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-500 py-2">{error}</p>
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-stone-400 text-center py-3">
        No community posts about this resource yet.
      </p>
    )
  }

  return (
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
              <span className="text-xs font-medium text-stone-700 truncate">
                {post.author_name ?? 'Community Member'}
              </span>
              <span className="text-[10px] text-stone-400 flex-shrink-0">
                {getRelativeTime(post.created_at)}
              </span>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">{post.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResourceDetailDialog({ savedResourceId, open, onOpenChange }: ResourceDetailDialogProps) {
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

  // Sync notes from hook to local state
  useState(() => { setLocalNotes(notes) })
  // Keep local notes in sync when hook notes change (initial load)
  if (notes && localNotes === '' && notes !== localNotes) {
    setLocalNotes(notes)
  }

  const handleAddTask = async () => {
    if (!newTask.trim()) return
    await addTask(newTask)
    setNewTask('')
  }

  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) return
    await addEvent(newEventTitle, newEventDate, newEventTime || undefined)
    setNewEventTitle('')
    setNewEventDate('')
    setNewEventTime('')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    await uploadDocument(file)
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
    await updateNotes(localNotes)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
  }

  const categoryLabel = CATEGORY_LABELS[resource?.resource_category ?? ''] ?? resource?.resource_category ?? ''

  if (!savedResourceId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 gap-0 bg-[#faf9f6] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
          </div>
        ) : resource ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-200/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-xl font-bold text-stone-800">
                  {resource.resource_name}
                </DialogTitle>
                {categoryLabel && (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{categoryLabel}</Badge>
                )}
              </div>
              <DialogDescription className="flex flex-wrap gap-4 mt-2 text-sm">
                {resource.resource_address && (
                  <span className="flex items-center gap-1 text-stone-600">
                    <MapPin className="w-3.5 h-3.5" /> {resource.resource_address}
                  </span>
                )}
                {resource.resource_phone && (
                  <a href={`tel:${resource.resource_phone}`} className="flex items-center gap-1 text-stone-600 hover:text-[#4a5d23]">
                    <Phone className="w-3.5 h-3.5" /> {resource.resource_phone}
                  </a>
                )}
                {resource.resource_website && (
                  <a href={resource.resource_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#4a5d23] hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Website
                  </a>
                )}
              </DialogDescription>
              {totalTasks > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                    <span>{completedTasks}/{totalTasks} tasks complete</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#4a5d23] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </DialogHeader>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* ── Community Posts Section (only when resource has a canonical ID) ── */}
              {resource.resource_id && (
                <section data-testid="resource-posts-section">
                  <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Community Posts
                  </h3>
                  <div className="border border-stone-200 rounded-xl bg-white p-4">
                    <ResourcePosts resourceId={resource.resource_id} />
                  </div>
                </section>
              )}

              {/* ── Tasks Section ── */}
              <section>
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> Tasks
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                      placeholder="Add a task..."
                      className="flex-1 text-stone-900 placeholder:text-stone-400"
                    />
                    <Button size="sm" onClick={handleAddTask} disabled={!newTask.trim()} className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-2">No tasks yet</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 group">
                          <Checkbox
                            checked={task.is_completed ?? false}
                            onCheckedChange={() => toggleTask(task.id)}
                          />
                          <span className={`flex-1 text-sm ${task.is_completed ? 'line-through text-stone-400' : 'text-stone-700'}`}>
                            {task.title}
                          </span>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                  <Calendar className="w-4 h-4" /> Schedule
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="Event title..."
                      className="flex-1 min-w-[150px] text-stone-900 placeholder:text-stone-400"
                    />
                    <input
                      type="date"
                      value={newEventDate}
                      onChange={(e) => setNewEventDate(e.target.value)}
                      className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-900 bg-white"
                    />
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-900 bg-white"
                    />
                    <Button size="sm" onClick={handleAddEvent} disabled={!newEventTitle.trim() || !newEventDate} className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {events.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-2">No scheduled dates</p>
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 group">
                          <Calendar className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-stone-600 w-20 flex-shrink-0">
                            {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(event.event_date + 'T00:00:00'))}
                          </span>
                          {event.event_time && (
                            <span className="text-xs text-stone-400 flex-shrink-0">
                              {event.event_time.slice(0, 5)}
                            </span>
                          )}
                          <span className="flex-1 text-sm text-stone-700">{event.title}</span>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                  <FileText className="w-4 h-4" /> Files
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.txt,.csv,.xlsx"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full border-dashed border-stone-300 text-stone-500 hover:text-[#4a5d23] hover:border-[#4a5d23]"
                    >
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4 mr-2" /> Choose file to upload</>
                      )}
                    </Button>
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-sm text-stone-400 text-center py-2">No files attached</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 group">
                          <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
                          <span className="flex-1 text-sm text-stone-700 truncate">{doc.file_name}</span>
                          <span className="text-xs text-stone-400 flex-shrink-0">
                            {doc.file_size != null ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : '—'}
                          </span>
                          <button
                            onClick={() => handleDownload(doc.file_path, doc.file_name)}
                            className="text-stone-400 hover:text-[#4a5d23] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                  <StickyNote className="w-4 h-4" /> Notes
                </h3>
                <div className="border border-stone-200 rounded-xl bg-white p-4 space-y-3">
                  <Textarea
                    value={localNotes}
                    onChange={(e) => { setLocalNotes(e.target.value); setNotesSaved(false) }}
                    placeholder="Add notes about this resource..."
                    className="min-h-[120px] text-stone-900 placeholder:text-stone-400 resize-y"
                  />
                  <div className="flex items-center justify-end gap-2">
                    {notesSaved && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={localNotes === notes}
                      className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                    >
                      Save Notes
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-stone-400">
            Resource not found
          </div>
        )}

        {error && (
          <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
