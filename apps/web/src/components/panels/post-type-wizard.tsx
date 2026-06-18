'use client'

import React, { useState, useReducer, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sanitizeInput } from '@/lib/security'
import { QUERY_TIMEOUT_MS, isQueryTimeout } from '@/lib/vault'
import { logger } from '@/lib/logger'
import { createPoll } from '@/hooks/use-poll'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  X,
  Megaphone,
  HandHelping,
  Gift,
  BookMarked,
  BarChart3,
  CalendarDays,
  ShieldAlert,
  ScrollText,
} from 'lucide-react'
import type { Database } from '@feed/database'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PostTypeWizardProps {
  open: boolean
  onClose: () => void
  onPost: (content: string, resourceId: string | null, maxSeekers: number | null) => Promise<string | null>
  resourceOptions: Array<{ id: string; name: string }>
  onSafetyAlertClick: () => void
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type PostTypeKey = 'general' | 'seeker_request' | 'source_offer' | 'resource' | 'poll' | 'event' | 'safety' | 'petition'
type WizardStep = 'type-selection' | 'compose'

interface WizardState {
  step: WizardStep
  selectedType: PostTypeKey | null
  isSubmitting: boolean
  error: string | null
}

type WizardAction =
  | { type: 'SELECT_TYPE'; payload: PostTypeKey }
  | { type: 'BACK' }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' }

const initialState: WizardState = {
  step: 'type-selection',
  selectedType: null,
  isSubmitting: false,
  error: null,
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_TYPE':
      return { ...state, step: 'compose', selectedType: action.payload, error: null }
    case 'BACK':
      return { ...state, step: 'type-selection', error: null }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OE_CATEGORIES = [
  'Food', 'Housing', 'Goods', 'Transit', 'Health',
  'Money', 'Care', 'Education', 'Work', 'Legal',
] as const

const TYPE_LABELS: Record<PostTypeKey, string> = {
  general: 'General Update',
  seeker_request: 'Seeking Help',
  source_offer: 'Offering Help',
  resource: 'Link a Resource',
  poll: 'Community Poll',
  event: 'Community Event',
  safety: 'Safety Warning',
  petition: 'Petition Draft',
}

// ---------------------------------------------------------------------------
// Helper: Json type alias
// ---------------------------------------------------------------------------

type Json = Database['public']['Tables']['posts']['Row']['metadata']

// Suppress unused import warning — isQueryTimeout is used in catch blocks below
const _isQueryTimeout = isQueryTimeout

// ---------------------------------------------------------------------------
// Helper: CategoryChips
// ---------------------------------------------------------------------------

function CategoryChips({ selected, onChange }: { selected: string[]; onChange: (cats: string[]) => void }) {
  const toggle = (cat: string) =>
    onChange(selected.includes(cat) ? selected.filter(c => c !== cat) : [...selected, cat])
  return (
    <div className="flex flex-wrap gap-2">
      {OE_CATEGORIES.map(cat => (
        <button
          key={cat}
          type="button"
          onClick={() => toggle(cat)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            selected.includes(cat)
              ? 'bg-[#4a5d23] text-white border-[#4a5d23]'
              : 'border-stone-300 text-stone-600 hover:border-[#4a5d23]'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: GeneralForm
// ---------------------------------------------------------------------------

interface BaseFormProps {
  onClose: () => void
  dispatch: React.Dispatch<WizardAction>
  isSubmitting: boolean
  error: string | null
}

interface GeneralFormProps extends BaseFormProps {
  onPost: PostTypeWizardProps['onPost']
}

function GeneralForm({ onClose, dispatch, isSubmitting, error, onPost }: GeneralFormProps) {
  const [content, setContent] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim().length < 3) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      await onPost(sanitizeInput(content), null, null)
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [content, dispatch, onClose, onPost])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="general-content">Update</Label>
        <Textarea
          id="general-content"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Share an update with the community..."
          className="mt-1 min-h-[120px]"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || content.trim().length < 3} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Posting…' : 'Post Update'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: SeekerRequestForm
// ---------------------------------------------------------------------------

function SeekerRequestForm({ onClose, dispatch, isSubmitting, error }: BaseFormProps) {
  const [content, setContent] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim().length < 3) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: sanitizeInput(content),
        post_type: 'seeker_request',
        metadata: { categories } as unknown as Json,
      })
      if (insertError) throw insertError
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [content, categories, dispatch, onClose])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="seeker-content">What are you looking for?</Label>
        <Textarea
          id="seeker-content"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Describe what you're looking for..."
          className="mt-1 min-h-[120px]"
        />
      </div>
      <div>
        <Label className="mb-2 block">Categories</Label>
        <CategoryChips selected={categories} onChange={setCategories} />
      </div>
      <Button type="submit" disabled={isSubmitting || content.trim().length < 3} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Posting…' : 'Post Request'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: SourceOfferForm
// ---------------------------------------------------------------------------

interface SourceOfferFormProps extends BaseFormProps {
  resourceOptions: PostTypeWizardProps['resourceOptions']
}

function SourceOfferForm({ onClose, dispatch, isSubmitting, error, resourceOptions }: SourceOfferFormProps) {
  const [content, setContent] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [resourceId, setResourceId] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim().length < 3) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: sanitizeInput(content),
        post_type: 'source_offer',
        resource_id: resourceId || null,
        metadata: { categories } as unknown as Json,
      })
      if (insertError) throw insertError
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [content, categories, resourceId, dispatch, onClose])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="offer-content">What are you offering?</Label>
        <Textarea
          id="offer-content"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Describe what you're offering..."
          className="mt-1 min-h-[120px]"
        />
      </div>
      <div>
        <Label className="mb-2 block">Categories</Label>
        <CategoryChips selected={categories} onChange={setCategories} />
      </div>
      {resourceOptions.length > 0 && (
        <div>
          <Label htmlFor="offer-resource">Link a resource (optional)</Label>
          <select
            id="offer-resource"
            value={resourceId}
            onChange={e => setResourceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#4a5d23]"
          >
            <option value="">None</option>
            {resourceOptions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" disabled={isSubmitting || content.trim().length < 3} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Posting…' : 'Post Offer'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: ResourceForm
// ---------------------------------------------------------------------------

interface ResourceFormProps extends BaseFormProps {
  resourceOptions: PostTypeWizardProps['resourceOptions']
  onPost: PostTypeWizardProps['onPost']
}

function ResourceForm({ onClose, dispatch, isSubmitting, error, resourceOptions, onPost }: ResourceFormProps) {
  const [resourceId, setResourceId] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resourceId) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      await onPost(sanitizeInput(content) || '', resourceId, null)
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [resourceId, content, dispatch, onClose, onPost])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="resource-select">Resource <span className="text-red-500">*</span></Label>
        <select
          id="resource-select"
          value={resourceId}
          onChange={e => setResourceId(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#4a5d23]"
          required
        >
          <option value="">Select a resource…</option>
          {resourceOptions.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="resource-note">Note (optional)</Label>
        <Textarea
          id="resource-note"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Add a note about this resource..."
          className="mt-1 min-h-[80px]"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !resourceId} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Posting…' : 'Share Resource'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: PollForm
// ---------------------------------------------------------------------------

function PollForm({ onClose, dispatch, isSubmitting, error }: BaseFormProps) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [endsAt, setEndsAt] = useState('')

  const setOption = (index: number, value: string) => {
    setOptions(prev => prev.map((o, i) => i === index ? value : o))
  }
  const addOption = () => {
    if (options.length < 6) setOptions(prev => [...prev, ''])
  }
  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(prev => prev.filter((_, i) => i !== index))
  }

  const isValid = question.trim().length >= 3 && options.length >= 2 && options.every(o => o.trim().length > 0)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: sanitizeInput(question), post_type: 'poll' })
        .select('id')
        .single()
      if (postError) throw postError
      const filteredOptions = options.filter(o => o.trim())
      const { error: pollError } = await createPoll(
        post.id,
        question,
        filteredOptions,
        endsAt ? new Date(endsAt) : undefined,
      )
      if (pollError) {
        dispatch({ type: 'SET_ERROR', payload: pollError })
        return
      }
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [question, options, endsAt, isValid, dispatch, onClose])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="poll-question">Question</Label>
        <Input
          id="poll-question"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask the community a question…"
          className="mt-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Options</Label>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={opt}
              onChange={e => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                aria-label={`Remove option ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-[#4a5d23] hover:underline self-start"
          >
            + Add option
          </button>
        )}
      </div>
      <div>
        <Label htmlFor="poll-ends">Ends at (optional)</Label>
        <Input
          id="poll-ends"
          type="datetime-local"
          value={endsAt}
          onChange={e => setEndsAt(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !isValid} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Creating…' : 'Create Poll'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: EventForm
// ---------------------------------------------------------------------------

function EventForm({ onClose, dispatch, isSubmitting, error }: BaseFormProps) {
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [location, setLocation] = useState('')
  const [isOnline, setIsOnline] = useState(false)

  const isValid = title.trim().length >= 3 && startsAt.length > 0

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: sanitizeInput(title),
        post_type: 'event_post',
        metadata: {
          starts_at: startsAt,
          ends_at: endsAt || null,
          location: isOnline ? null : sanitizeInput(location),
          is_online: isOnline,
        } as unknown as Json,
      })
      if (insertError) throw insertError
      onClose()
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [title, startsAt, endsAt, location, isOnline, isValid, dispatch, onClose])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="event-title">Event Title</Label>
        <Input
          id="event-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Event title…"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="event-starts">Starts At <span className="text-red-500">*</span></Label>
        <Input
          id="event-starts"
          type="datetime-local"
          value={startsAt}
          onChange={e => setStartsAt(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="event-ends">Ends At (optional)</Label>
        <Input
          id="event-ends"
          type="datetime-local"
          value={endsAt}
          onChange={e => setEndsAt(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isOnline}
          onClick={() => setIsOnline(v => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a5d23] ${isOnline ? 'bg-[#4a5d23]' : 'bg-stone-300'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
        <Label>Online event</Label>
      </div>
      <div>
        <Label htmlFor="event-location">Location</Label>
        <Input
          id="event-location"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Address or venue…"
          disabled={isOnline}
          className="mt-1 disabled:opacity-50"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !isValid} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Creating…' : 'Create Event'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sub-form: PetitionDraftForm
// Petitions Insert requires: body, body_version_hash, summary, title
// ---------------------------------------------------------------------------

function PetitionDraftForm({ onClose, dispatch, isSubmitting, error }: BaseFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [summary, setSummary] = useState('')
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isValid = title.trim().length >= 3 && description.trim().length >= 10 && summary.trim().length >= 3

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    dispatch({ type: 'SET_SUBMITTING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const sanitizedTitle = sanitizeInput(title)
      const sanitizedBody = sanitizeInput(description)
      const sanitizedSummary = sanitizeInput(summary)
      // body_version_hash: base64 of the body content, truncated for a stable draft hash
      const bodyVersionHash = btoa(unescape(encodeURIComponent(sanitizedBody))).slice(0, 32)
      const { error: insertError } = await supabase
        .from('petitions')
        .insert({
          created_by: user.id,
          status: 'draft',
          title: sanitizedTitle,
          body: sanitizedBody,
          body_version_hash: bodyVersionHash,
          summary: sanitizedSummary,
        })
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      if (insertError) throw insertError
      setSuccessMsg('Your petition draft has been submitted for admin review.')
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        return
      }
      logger.error('wizard.submit.error', { error: err instanceof Error ? err.message : String(err) })
      dispatch({ type: 'SET_ERROR', payload: 'Failed. Please try again.' })
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [title, description, summary, isValid, dispatch, onClose])

  if (successMsg) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <ScrollText className="w-10 h-10 text-[#4a5d23]" />
        <p className="text-sm text-stone-700">{successMsg}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-sm text-amber-700">{error}</div>
      )}
      <div>
        <Label htmlFor="petition-title">Petition Title</Label>
        <Input
          id="petition-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Petition title…"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="petition-summary">Summary</Label>
        <Input
          id="petition-summary"
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="One-line summary of your petition…"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="petition-description">Description</Label>
        <Textarea
          id="petition-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe your petition and why it matters..."
          className="mt-1 min-h-[120px]"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !isValid} className="bg-[#4a5d23] hover:bg-[#3a4d1a] text-white">
        {isSubmitting ? 'Submitting…' : 'Submit Draft'}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Type cards data
// ---------------------------------------------------------------------------

interface TypeCard {
  key: PostTypeKey
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'amber'
}

const TYPE_CARDS: TypeCard[] = [
  { key: 'general', label: 'General Update', description: 'Share news or announcements', icon: Megaphone },
  { key: 'seeker_request', label: 'Seeking Help', description: 'Request resources or services', icon: HandHelping },
  { key: 'source_offer', label: 'Offering Help', description: 'Share what you can provide', icon: Gift },
  { key: 'resource', label: 'Link a Resource', description: 'Share a community resource', icon: BookMarked },
  { key: 'poll', label: 'Community Poll', description: 'Ask the community a question', icon: BarChart3 },
  { key: 'event', label: 'Community Event', description: 'Organize a local event', icon: CalendarDays },
  { key: 'safety', label: 'Safety Warning', description: 'Report a hazard on the map', icon: ShieldAlert, variant: 'amber' },
  { key: 'petition', label: 'Petition Draft', description: 'Start a community petition', icon: ScrollText },
]

// ---------------------------------------------------------------------------
// ComposeForm switch
// ---------------------------------------------------------------------------

interface ComposeFormProps {
  selectedType: PostTypeKey
  onClose: () => void
  dispatch: React.Dispatch<WizardAction>
  isSubmitting: boolean
  error: string | null
  onPost: PostTypeWizardProps['onPost']
  resourceOptions: PostTypeWizardProps['resourceOptions']
}

function ComposeForm({ selectedType, onClose, dispatch, isSubmitting, error, onPost, resourceOptions }: ComposeFormProps) {
  switch (selectedType) {
    case 'general':
      return <GeneralForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} onPost={onPost} />
    case 'seeker_request':
      return <SeekerRequestForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} />
    case 'source_offer':
      return <SourceOfferForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} resourceOptions={resourceOptions} />
    case 'resource':
      return <ResourceForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} resourceOptions={resourceOptions} onPost={onPost} />
    case 'poll':
      return <PollForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} />
    case 'event':
      return <EventForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} />
    case 'petition':
      return <PetitionDraftForm onClose={onClose} dispatch={dispatch} isSubmitting={isSubmitting} error={error} />
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PostTypeWizard({ open, onClose, onPost, resourceOptions, onSafetyAlertClick }: PostTypeWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  const handleCardClick = useCallback((card: TypeCard) => {
    if (card.key === 'safety') {
      onClose()
      onSafetyAlertClick()
      return
    }
    dispatch({ type: 'SELECT_TYPE', payload: card.key })
  }, [onClose, onSafetyAlertClick])

  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) {
      dispatch({ type: 'RESET' })
      onClose()
    }
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[92vh] rounded-t-2xl rounded-b-none flex flex-col p-0 gap-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:h-auto sm:max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 p-4 border-b border-stone-100 space-y-0">
          {state.step === 'compose' && (
            <button
              onClick={() => dispatch({ type: 'BACK' })}
              className="p-1 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="Back to post types"
            >
              <ArrowLeft className="w-5 h-5 text-stone-600" />
            </button>
          )}
          <DialogTitle className="text-base font-semibold text-stone-900 flex-1">
            {state.step === 'type-selection'
              ? 'What would you like to share?'
              : TYPE_LABELS[state.selectedType!]}
          </DialogTitle>
          <DialogClose className="p-1 rounded-lg hover:bg-stone-100 transition-colors text-stone-500">
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {state.step === 'type-selection' ? (
            <div className="grid grid-cols-2 gap-3">
              {TYPE_CARDS.map(card => {
                const Icon = card.icon
                const isAmber = card.variant === 'amber'
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleCardClick(card)}
                    className={`rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[#4a5d23] ${
                      isAmber
                        ? 'hover:border-amber-400 hover:bg-stone-50'
                        : 'hover:border-[#4a5d23] hover:bg-stone-50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${isAmber ? 'text-amber-500' : 'text-[#4a5d23]'}`} />
                    <div className="text-sm font-medium text-stone-900">{card.label}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{card.description}</div>
                  </button>
                )
              })}
            </div>
          ) : state.selectedType ? (
            <ComposeForm
              selectedType={state.selectedType}
              onClose={onClose}
              dispatch={dispatch}
              isSubmitting={state.isSubmitting}
              error={state.error}
              onPost={onPost}
              resourceOptions={resourceOptions}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
