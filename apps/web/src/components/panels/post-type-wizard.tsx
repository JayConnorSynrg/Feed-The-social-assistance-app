'use client'

// apps/web/src/components/panels/post-type-wizard.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The "More: offer, request, poll, event, or petition…" wizard. Every post it creates goes through
// create_post (lib/post-rpc.ts — one checked server write, raw text, the member's language as
// posts.lang); a poll and its options are created in that same call. The fields are the shared
// PostFormFields the edit dialog also uses, so a post is created and edited with the same labels and
// limits. A member event carries its venue time zone (default: the device's zone). Petition drafts
// are not posts: they keep their own petitions draft path.

import React, { useState, useReducer, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePostImagePicker, PostImagePickerField } from '@/components/feed/post-image-picker'
import { QUERY_TIMEOUT_MS } from '@/lib/vault'
import { logger } from '@/lib/logger'
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
import type { Locale } from '@/lib/i18n'
import { dir } from '@/lib/i18n'
import { browserTimeZone } from '@/lib/event-time'
import { createPost, type PostType } from '@/lib/post-rpc'
import { petitionBodyHash } from '@/lib/petition-hash'
import { composerT, type ComposerMessages } from '@/lib/i18n-feed-composer'
import { failureText } from '@/lib/i18n-feed-edit'
import { createSingleFlight } from '@/components/feed/composer-guards'
import { PostFormFields } from '@/components/feed/post-form-fields'
import { EMPTY_DRAFT, createFields, validateDraft, type DraftErrors, type PostDraft } from '@/components/feed/post-edit-model'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PostTypeWizardProps {
  open: boolean
  onClose: () => void
  /** A post was created: the feed shows it right away (the realtime insert is deduped by id). */
  onCreated: (postId: string) => void
  resourceOptions: Array<{ id: string; name: string }>
  onSafetyAlertClick: () => void
  locale: Locale
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type PostTypeKey = 'general' | 'seeker_request' | 'source_offer' | 'resource' | 'poll' | 'event' | 'safety' | 'petition'
type WizardStep = 'type-selection' | 'compose'

interface WizardState {
  step: WizardStep
  selectedType: PostTypeKey | null
}

type WizardAction = { type: 'SELECT_TYPE'; payload: PostTypeKey } | { type: 'BACK' } | { type: 'RESET' }

const initialState: WizardState = { step: 'type-selection', selectedType: null }

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SELECT_TYPE':
      return { step: 'compose', selectedType: action.payload }
    case 'BACK':
      return { ...state, step: 'type-selection' }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Type cards
// ---------------------------------------------------------------------------

interface TypeCard {
  key: PostTypeKey
  label: keyof ComposerMessages
  description: keyof ComposerMessages
  icon: React.ComponentType<{ className?: string }>
  variant?: 'amber'
}

const TYPE_CARDS: TypeCard[] = [
  { key: 'general', label: 'typeGeneral', description: 'typeGeneralDesc', icon: Megaphone },
  { key: 'seeker_request', label: 'typeRequest', description: 'typeRequestDesc', icon: HandHelping },
  { key: 'source_offer', label: 'typeOffer', description: 'typeOfferDesc', icon: Gift },
  { key: 'resource', label: 'typeResource', description: 'typeResourceDesc', icon: BookMarked },
  { key: 'poll', label: 'typePoll', description: 'typePollDesc', icon: BarChart3 },
  { key: 'event', label: 'typeEvent', description: 'typeEventDesc', icon: CalendarDays },
  { key: 'safety', label: 'typeSafety', description: 'typeSafetyDesc', icon: ShieldAlert, variant: 'amber' },
  { key: 'petition', label: 'typePetition', description: 'typePetitionDesc', icon: ScrollText },
]

const TYPE_TITLE: Record<PostTypeKey, keyof ComposerMessages> = Object.fromEntries(TYPE_CARDS.map((c) => [c.key, c.label])) as Record<
  PostTypeKey,
  keyof ComposerMessages
>

/** The post_type each structured form creates ('resource' = a plain post linked to a saved resource). */
const POST_TYPE_OF: Record<Exclude<PostTypeKey, 'safety' | 'petition'>, Exclude<PostType, 'petition' | 'resource_post'>> = {
  general: 'feed',
  seeker_request: 'seeker_request',
  source_offer: 'source_offer',
  resource: 'feed',
  poll: 'poll',
  event: 'event_post',
}

const SUBMIT_LABEL: Record<Exclude<PostTypeKey, 'safety' | 'petition'>, keyof ComposerMessages> = {
  general: 'submitUpdate',
  seeker_request: 'submitRequest',
  source_offer: 'submitOffer',
  resource: 'submitResource',
  poll: 'submitPoll',
  event: 'submitEvent',
}

const ERROR_BOX = 'rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900'

// ---------------------------------------------------------------------------
// Structured post form (general / request / offer / resource / poll / event)
// ---------------------------------------------------------------------------

function StructuredForm({
  kind,
  locale,
  resourceOptions,
  onCreated,
  onDone,
}: {
  kind: Exclude<PostTypeKey, 'safety' | 'petition'>
  locale: Locale
  resourceOptions: PostTypeWizardProps['resourceOptions']
  onCreated: (postId: string) => void
  onDone: () => void
}) {
  const postType = POST_TYPE_OF[kind]
  const viewerTz = useMemo(() => browserTimeZone(), [])
  const [draft, setDraft] = useState<PostDraft>(() => ({ ...EMPTY_DRAFT, timeZone: kind === 'event' ? viewerTz : '' }))
  const [resourceId, setResourceId] = useState('')
  const [errors, setErrors] = useState<DraftErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Synchronous single-flight: a double tap creates one post.
  const gate = useRef(createSingleFlight())
  const picker = usePostImagePicker()
  const withImage: PostDraft = kind === 'general' ? { ...draft, imageUrl: picker.imageUrl } : draft

  const resourceName = resourceOptions.find((r) => r.id === resourceId)?.name ?? ''
  // A shared resource with no note reads as the resource's name.
  const submitDraft: PostDraft = kind === 'resource' && !draft.content.trim() ? { ...withImage, content: resourceName } : withImage
  const needsResource = kind === 'resource' && !resourceId
  const canSubmit = !submitting && !picker.imageUploading && !needsResource && submitDraft.content.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canSubmit) return
      const found = validateDraft(postType, submitDraft, { original: null, facts: { pollVotes: 0, committedOptIns: 0, pollEndsAt: null }, viewerTz })
      setErrors(found)
      if (Object.keys(found).length > 0) return
      await gate.current.run(async () => {
        setSubmitting(true)
        setError(null)
        try {
          const res = await createPost(createClient(), {
            postType,
            fields: createFields(postType, submitDraft, viewerTz),
            resourceId: kind === 'resource' || (kind === 'source_offer' && resourceId) ? resourceId : null,
            lang: locale,
          })
          if (!res.ok) {
            setError(failureText(locale, res.failure))
            return
          }
          picker.resetAfterPost()
          onCreated(res.value)
          onDone()
        } finally {
          setSubmitting(false)
        }
      })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error && (
        <div role="alert" className={ERROR_BOX}>
          {error}
        </div>
      )}
      {kind === 'resource' && (
        <div>
          <Label htmlFor="wizard-resource">{composerT(locale, 'fieldResource')}</Label>
          <select
            id="wizard-resource"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23]"
          >
            <option value="">{composerT(locale, 'selectResource')}</option>
            {resourceOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <PostFormFields
        postType={kind === 'resource' ? 'resource_post' : postType}
        draft={withImage}
        onChange={(next) => setDraft({ ...next, imageUrl: null })}
        mode="create"
        locale={locale}
        idPrefix={`wizard-${kind}`}
        errors={errors}
        photoSlot={
          kind === 'general' ? (
            <div lang="en" dir="ltr" data-english-only="photo-picker">
            <PostImagePickerField
              previewUrl={picker.previewUrl}
              imageUploading={picker.imageUploading}
              imageError={picker.imageError}
              fileInputRef={picker.fileInputRef}
              onFileSelect={picker.handleFileSelect}
              onClear={picker.clearImage}
            />
            </div>
          ) : undefined
        }
      />
      {kind === 'source_offer' && resourceOptions.length > 0 && (
        <div>
          <Label htmlFor="wizard-offer-resource">{composerT(locale, 'linkResourceOptional')}</Label>
          <select
            id="wizard-offer-resource"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23]"
          >
            <option value="">{composerT(locale, 'none')}</option>
            {resourceOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button type="submit" disabled={!canSubmit} className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a]">
        {submitting ? composerT(locale, 'posting') : composerT(locale, SUBMIT_LABEL[kind])}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Petition draft (its own petitions path — not a post)
// ---------------------------------------------------------------------------

function PetitionDraftForm({ locale, onDone }: { locale: Locale; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [summary, setSummary] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const gate = useRef(createSingleFlight())

  const isValid = title.trim().length >= 3 && description.trim().length >= 10 && summary.trim().length >= 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    await gate.current.run(async () => {
      setSubmitting(true)
      setError(null)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        // Raw text, like posts: React escapes on render. The draft hash covers the body as stored.
        const body = description.trim()
        const bodyVersionHash = petitionBodyHash(body)
        const { error: insertError } = await supabase
          .from('petitions')
          .insert({ created_by: user.id, status: 'draft', title: title.trim(), body, body_version_hash: bodyVersionHash, summary: summary.trim() })
          .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
        if (insertError) throw insertError
        setSubmitted(true)
      } catch (err) {
        logger.error('wizard.submit.error', err)
        setError(composerT(locale, 'submitFailed'))
      } finally {
        setSubmitting(false)
      }
    })
  }

  if (submitted) {
    // No auto-close (WCAG 2.2.1): the member closes it.
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
        <ScrollText className="h-10 w-10 text-[#4a5d23]" aria-hidden="true" />
        <p role="status" className="text-sm text-stone-800">
          {composerT(locale, 'petitionSubmitted')}
        </p>
        <Button type="button" variant="outline" onClick={onDone}>
          {composerT(locale, 'close')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div role="alert" className={ERROR_BOX}>
          {error}
        </div>
      )}
      <div>
        <Label htmlFor="petition-title">{composerT(locale, 'fieldPetitionTitle')}</Label>
        <Input id="petition-title" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={composerT(locale, 'placeholderPetitionTitle')} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="petition-summary">{composerT(locale, 'fieldPetitionSummary')}</Label>
        <Input id="petition-summary" dir="auto" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={composerT(locale, 'placeholderPetitionSummary')} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="petition-description">{composerT(locale, 'fieldPetitionDescription')}</Label>
        <Textarea
          id="petition-description"
          dir="auto"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={composerT(locale, 'placeholderPetitionDescription')}
          className="mt-1 min-h-[120px]"
        />
      </div>
      <Button type="submit" disabled={submitting || !isValid} className="bg-[#4a5d23] text-white hover:bg-[#3a4d1a]">
        {submitting ? composerT(locale, 'submitting') : composerT(locale, 'submitPetition')}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PostTypeWizard({ open, onClose, onCreated, resourceOptions, onSafetyAlertClick, locale }: PostTypeWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState)

  const close = useCallback(() => {
    dispatch({ type: 'RESET' })
    onClose()
  }, [onClose])

  const handleCardClick = useCallback(
    (card: TypeCard) => {
      if (card.key === 'safety') {
        close()
        onSafetyAlertClick()
        return
      }
      dispatch({ type: 'SELECT_TYPE', payload: card.key })
    },
    [close, onSafetyAlertClick],
  )

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) close()
    },
    [close],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideDefaultClose
        disableOutsideClose
        lang={locale}
        dir={dir(locale)}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[92vh] rounded-t-2xl rounded-b-none flex flex-col p-0 gap-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:h-auto sm:max-h-[88vh] overflow-hidden"
      >
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-stone-100 p-5">
          {state.step === 'compose' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'BACK' })}
              className="rounded-lg p-1 transition-colors hover:bg-stone-100"
              aria-label={composerT(locale, 'backToTypes')}
            >
              <ArrowLeft className="h-5 w-5 text-stone-700 rtl:rotate-180" aria-hidden="true" />
            </button>
          )}
          <DialogTitle className="flex-1 text-base font-semibold text-stone-900">
            {state.step === 'type-selection' || !state.selectedType ? composerT(locale, 'wizardTitle') : composerT(locale, TYPE_TITLE[state.selectedType])}
          </DialogTitle>
          <DialogClose className="rounded-lg p-1 text-stone-600 transition-colors hover:bg-stone-100" aria-label={composerT(locale, 'close')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </DialogClose>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {state.step === 'type-selection' ? (
            <div className="grid grid-cols-2 gap-4">
              {TYPE_CARDS.map((card) => {
                const Icon = card.icon
                const isAmber = card.variant === 'amber'
                return (
                  <button
                    key={card.key}
                    type="button"
                    data-testid={`wizard-type-${card.key}`}
                    onClick={() => handleCardClick(card)}
                    className={`rounded-xl border border-stone-200 bg-white p-5 text-start transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#4a5d23] ${
                      isAmber ? 'hover:border-amber-500 hover:bg-stone-50' : 'hover:border-[#4a5d23] hover:bg-stone-50'
                    }`}
                  >
                    <Icon className={`mb-3 h-7 w-7 ${isAmber ? 'text-amber-700' : 'text-[#4a5d23]'}`} />
                    <div className="text-sm font-semibold text-stone-900">{composerT(locale, card.label)}</div>
                    <div className="mt-1 text-xs leading-relaxed text-stone-600">{composerT(locale, card.description)}</div>
                  </button>
                )
              })}
            </div>
          ) : state.selectedType === 'petition' ? (
            <PetitionDraftForm locale={locale} onDone={close} />
          ) : state.selectedType && state.selectedType !== 'safety' ? (
            <StructuredForm
              key={state.selectedType}
              kind={state.selectedType}
              locale={locale}
              resourceOptions={resourceOptions}
              onCreated={onCreated}
              onDone={close}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
