'use client'

// apps/web/src/components/panels/documents-panel.tsx
// Documents Panel - Secure document management for uploaded files
// Supports drag-and-drop upload, categorization, and document actions.
//
// P6 W9: every word FEED writes here is in the member's language (lib/i18n-documents.ts), with
// lang/dir on the panel root and on each portalled dialog and menu. A document's name, a saved
// resource's name and address are the member's own text (lang="" dir="auto"). Category values,
// storage paths, document ids and every encryption call are the same in every language: only the
// label a member reads is looked up. One always-mounted status line announces each result and one
// always-mounted alert line shows each failure (a translated line; text the server, storage or the
// crypto layer wrote is never shown). Focus never falls to <body>: after delete, a move out of the
// open folder, a dismissed error or a removed saved resource, focus moves to the next item or the
// heading.

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  FileText,
  Image as ImageIcon,
  Search,
  Download,
  Eye,
  Trash2,
  FolderOpen,
  FileCheck,
  CreditCard,
  Home,
  Heart,
  MoreHorizontal,
  X,
  Plus,
  ChevronRight,
  Lock,
  Loader2,
  Bookmark,
  ChevronDown,
  ExternalLink,
  MapPin,
  Phone,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CardActionsMenu, type CardMenuSection } from '@/components/feed/card-actions-menu'
import { EncryptedUpload } from '@/components/documents/encrypted-upload'
import { ResourceDetailDialog } from '@/components/documents/resource-detail-dialog'
import { PdfDocumentViewer } from '@/components/documents/pdf-document-viewer-dynamic'
import { PdfAnnotator } from '@/components/forms/pdf-annotator-dynamic'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { useDocuments } from '@/hooks/use-documents'
import { decryptString } from '@/lib/document-encryption'
import { exportFlattened } from '@/hooks/use-pdf-annotation'
import type { TextAnnotation } from '@/hooks/use-pdf-annotation'
import { VaultGuard } from '@/components/vault'
import { useAuthContext } from '@/providers/auth-provider'
import { CreateAccountPrompt } from '@/components/guest/create-account-prompt'
import { useVault } from '@/contexts/vault-context'
import { useVaultSecureProfile } from '@/hooks/use-vault-secure-profile'
import { createClient } from '@/lib/supabase/client'
import { useSavedResources, type SavedResource } from '@/hooks/use-saved-resources'
import { mapProfileToAutofill } from '@/lib/form-field-mapper'
import type { AutofillValues } from '@/lib/form-field-mapper'
import { FormsPanel } from './forms-panel'
import { usePanelContext } from '@/components/layout/feed-shell'
import { VaultUnlockModal } from '@/components/vault'
import { logEvent, logger, withMetric } from '@/lib/logger'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage, isolate, splitMessage } from '@/lib/format-message'
import { failureCode } from '@/lib/failure-code'
import { formatCount } from '@/lib/i18n-intl'
import { feedChromeT } from '@/lib/i18n-feed-chrome'
import { resourceCategoryLabel } from '@/lib/i18n-resource-categories'
import {
  documentCategoryLabel,
  documentDate,
  documentSize,
  documentsErrorText,
  documentsFileCount,
  documentsT,
  type DocumentsKey,
} from '@/lib/i18n-documents'
import { nextTabIndex } from '@/components/feed/feed-chrome'
import { cn } from '@/lib/utils'
import { afterLayout, announce, AnnouncementText, focusAfterRowRemoval, NO_ANNOUNCEMENT, type Announcement } from '@/app/(admin)/moderation/row-focus'

// ============================================
// TYPES
// ============================================
type DocumentCategory = 'all' | 'id' | 'income' | 'residence' | 'medical' | 'forms' | 'other'

interface Document {
  id: string
  /**
   * Display name. For encrypted rows this is the non-PII placeholder at rest
   * (the real filename lives in the encrypted ciphertext fields below and is
   * resolved into `displayNames` for rendering only when the vault is unlocked).
   * For legacy unencrypted rows this is the real plaintext filename.
   */
  name: string
  type: 'pdf' | 'image' | 'word'
  category: DocumentCategory
  size: number // in bytes
  uploadedAt: Date
  thumbnailUrl?: string
  isEncrypted?: boolean
  hasAnnotations?: boolean // true if encrypted_annotations sidecar is present
  /** Encrypted original filename ciphertext (Base64), if present. */
  encryptedNameCipher?: string | null
  /** IV for the encrypted filename (Base64), if present. */
  encryptedNameIv?: string | null
}

interface DocumentsPanelProps {
  userId?: string
}

/** Icon and colour of each folder; the label is documentCategoryLabel (the member's language). */
const CATEGORY_CONFIG: Record<DocumentCategory, { icon: React.ElementType; color: string }> = {
  all: { icon: FolderOpen, color: 'bg-stone-100 text-stone-700' },
  id: { icon: CreditCard, color: 'bg-blue-100 text-blue-800' },
  income: { icon: FileCheck, color: 'bg-green-100 text-green-800' },
  residence: { icon: Home, color: 'bg-orange-100 text-orange-800' },
  medical: { icon: Heart, color: 'bg-red-100 text-red-800' },
  forms: { icon: FileText, color: 'bg-lime-100 text-lime-800' },
  other: { icon: MoreHorizontal, color: 'bg-stone-100 text-stone-700' },
}

const CATEGORIES: DocumentCategory[] = ['all', 'id', 'income', 'residence', 'medical', 'forms', 'other']

/** Move-target categories (excludes 'all' sentinel) */
const MOVE_CATEGORIES: Array<Exclude<DocumentCategory, 'all'>> = [
  'id', 'income', 'residence', 'medical', 'forms', 'other',
]

/** A busy or unavailable button keeps focus (aria-disabled) and reads as unavailable in solid colours. */
const UNAVAILABLE = 'bg-stone-200 text-stone-700 hover:bg-stone-200 cursor-not-allowed'

// ============================================
// UTILITY FUNCTIONS
// ============================================
/** Map a raw user_documents row into the panel's Document shape. */
function mapDocumentRow(doc: {
  id: string
  name: string
  mime_type?: string | null
  category?: string | null
  original_size?: number | null
  file_size?: number | null
  created_at?: string | null
  is_encrypted?: boolean | null
  encrypted_annotations?: string | null
  annotations_iv?: string | null
  encrypted_original_name?: string | null
  encrypted_name_iv?: string | null
}): Document {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.mime_type?.includes('pdf') ? 'pdf' : doc.mime_type?.includes('image') ? 'image' : 'word',
    category: (doc.category || 'other') as DocumentCategory,
    size: doc.original_size || doc.file_size || 0,
    uploadedAt: new Date(doc.created_at || Date.now()),
    isEncrypted: doc.is_encrypted || false,
    hasAnnotations: !!(doc.encrypted_annotations && doc.annotations_iv),
    encryptedNameCipher: doc.encrypted_original_name ?? null,
    encryptedNameIv: doc.encrypted_name_iv ?? null,
  }
}

/** Focus `target` once the changed list has laid out; else the heading (never <body>). */
function focusAfter(target: () => HTMLElement | null | undefined, heading: () => HTMLElement | null | undefined) {
  afterLayout(() => {
    const el = target() ?? heading()
    el?.focus()
  })
}

// ============================================
// DOCUMENT HEADER
// ============================================
interface DocumentsHeaderProps {
  documentCount: number
  searchQuery: string
  onSearchChange: (query: string) => void
  locale: Locale
  headingRef: React.Ref<HTMLHeadingElement>
}

function DocumentsHeader({ documentCount, searchQuery, onSearchChange, locale, headingRef }: DocumentsHeaderProps) {
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const searchRef = useRef<HTMLInputElement>(null)
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <h2 ref={headingRef} tabIndex={-1} id="documents-heading" className="text-2xl font-bold text-stone-900 focus:outline-hidden">
            {t('tabDocuments')}
          </h2>
          <p className="text-sm text-stone-700 mt-1">{t('subtitle')}</p>
        </div>
        <span className="text-sm text-stone-700 bg-stone-100 px-3 py-1 rounded-full">
          {documentsFileCount(documentCount, locale)}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" aria-hidden="true" />
        <Input
          ref={searchRef}
          type="search"
          aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="ps-10 pe-10 bg-[#faf9f6] border-stone-500 text-stone-900 placeholder:text-stone-600"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('')
              searchRef.current?.focus()
            }}
            aria-label={t('clearSearch')}
            className="absolute end-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-600 hover:text-stone-900"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================
// FOLDERS — one APG radio group (a single choice); the sidebar on wide screens, chips below
// ============================================
interface FolderChoiceProps {
  activeCategory: DocumentCategory
  onCategoryChange: (category: DocumentCategory) => void
  documentCounts: Record<DocumentCategory, number>
  locale: Locale
  variant: 'sidebar' | 'chips'
}

function FolderChoice({ activeCategory, onCategoryChange, documentCounts, locale, variant }: FolderChoiceProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    // Up / Down move as well as the reading-direction arrows (APG radio group).
    const key = e.key === 'ArrowDown' ? (dir(locale) === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
      : e.key === 'ArrowUp' ? (dir(locale) === 'rtl' ? 'ArrowRight' : 'ArrowLeft')
      : e.key
    const next = nextTabIndex(key, index, CATEGORIES.length, locale)
    if (next === null) return
    e.preventDefault()
    onCategoryChange(CATEGORIES[next])
    refs.current[next]?.focus()
  }
  const sidebar = variant === 'sidebar'
  return (
    <div
      role="radiogroup"
      aria-label={documentsT(locale, 'foldersLabel')}
      className={sidebar ? 'space-y-1' : 'flex flex-wrap gap-2 pb-2 mb-6'}
    >
      {CATEGORIES.map((category, index) => {
        const config = CATEGORY_CONFIG[category]
        const count = documentCounts[category]
        const isActive = activeCategory === category
        return (
          <button
            key={category}
            ref={(node) => { refs.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onCategoryChange(category)}
            onKeyDown={(e) => onKeyDown(e, index)}
            data-testid={`doc-folder-${category}`}
            className={cn(
              sidebar
                ? 'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-start'
                : 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-9',
              isActive ? 'bg-[#4a5d23] text-white' : sidebar ? 'text-stone-800 hover:bg-[#f0ede6]' : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-800',
            )}
          >
            {sidebar ? (
              <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', isActive ? 'bg-white/20' : config.color)}>
                <config.icon className="w-4 h-4" aria-hidden="true" />
              </span>
            ) : (
              <config.icon className="w-4 h-4" aria-hidden="true" />
            )}
            <span className={sidebar ? 'flex-1 text-sm font-medium' : undefined}>{documentCategoryLabel(category, locale)}</span>
            <span className={cn('px-1.5 py-0.5 rounded-full text-xs font-medium', isActive ? 'bg-black/20 text-white' : 'bg-stone-200 text-stone-800')}>
              {formatCount(count, locale)}
            </span>
            {sidebar && isActive && <ChevronRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

// ============================================
// DOCUMENT CARD
// ============================================
interface DocumentCardProps {
  document: Document
  locale: Locale
  onView: (doc: Document) => void
  onDownload: (doc: Document) => void
  onEdit: (doc: Document) => void
  onDelete: (doc: Document) => void
  onRename: (doc: Document) => void
  onMove: (doc: Document, newCategory: Exclude<DocumentCategory, 'all'>) => void
  menuTriggerRef: (node: HTMLButtonElement | null) => void
  isDownloading?: boolean
}

function DocumentCard({ document, locale, onView, onDownload, onEdit, onDelete, onRename, onMove, menuTriggerRef, isDownloading = false }: DocumentCardProps) {
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const titleId = `doc-title-${document.id}`

  const getDocumentIcon = () => {
    switch (document.type) {
      case 'pdf':
        return (
          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-red-700" aria-hidden="true" />
          </div>
        )
      case 'image':
        return (
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-6 h-6 text-blue-700" aria-hidden="true" />
          </div>
        )
      default:
        return (
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-700" aria-hidden="true" />
          </div>
        )
    }
  }

  // A busy card's buttons stay focusable (aria-disabled); a press does nothing.
  const guarded = (fn: () => void) => () => { if (!isDownloading) fn() }
  const iconButton = 'h-8 w-8 text-stone-700 hover:text-[#4a5d23] hover:bg-[#4a5d23]/10'

  const sections: CardMenuSection[] = [
    { id: 'name', items: [{ kind: 'action', id: 'rename', label: t('rename'), onSelect: () => onRename(document), testId: 'doc-rename-btn', icon: <Pencil className="w-4 h-4 text-stone-700" aria-hidden="true" /> }] },
    {
      id: 'move',
      items: MOVE_CATEGORIES.filter((c) => c !== document.category).map((cat) => ({
        kind: 'action' as const,
        id: `move-${cat}`,
        label: formatMessage(t('moveTo'), { category: documentCategoryLabel(cat, locale) }),
        onSelect: () => onMove(document, cat),
        testId: `doc-move-to-${cat}`,
        icon: <FolderOpen className="w-4 h-4 text-stone-700" aria-hidden="true" />,
      })),
    },
    { id: 'danger', items: [{ kind: 'action', id: 'delete', label: t('delete'), onSelect: () => onDelete(document), destructive: true, testId: 'doc-delete-btn', icon: <Trash2 className="w-4 h-4" aria-hidden="true" /> }] },
  ]

  return (
    <div
      className="relative p-4 rounded-xl bg-[#faf9f6] border border-stone-300 hover:border-[#4a5d23]/50 hover:shadow-sm transition-colors"
      data-testid="document-card"
      data-document-id={document.id}
    >
      <div className="flex flex-wrap items-start gap-4">
        {getDocumentIcon()}

        {/* Document Info — the name is the member's own text */}
        <div className="flex-1 min-w-0">
          <h3 id={titleId} className="font-medium text-sm text-stone-900 mb-1 flex items-center gap-2 min-w-0">
            <span lang="" dir="auto" className="truncate">{document.name}</span>
            {document.isEncrypted && (
              <Lock className="w-3 h-3 flex-shrink-0 text-[#4a5d23]" role="img" aria-label={t('encrypted')} />
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_CONFIG[document.category].color}`}>
              {documentCategoryLabel(document.category, locale)}
            </span>
            <span className="text-xs text-stone-700">{documentSize(document.size, locale)}</span>
            <span className="text-xs text-stone-700">{documentDate(document.uploadedAt, locale)}</span>
          </div>
        </div>

        {/* Action Buttons — always visible, so a keyboard user sees where focus is */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={guarded(() => onView(document))}
            className={cn(iconButton, isDownloading && UNAVAILABLE)}
            aria-disabled={isDownloading}
            aria-label={t('view')}
            aria-describedby={titleId}
            data-testid="doc-view-btn"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
          </Button>
          {document.type === 'pdf' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={guarded(() => onEdit(document))}
              className={cn('h-8 w-8 text-stone-700 hover:text-blue-700 hover:bg-blue-50', isDownloading && UNAVAILABLE)}
              aria-disabled={isDownloading}
              data-testid="doc-edit-btn"
              aria-label={t('editAnnotations')}
              aria-describedby={titleId}
            >
              <Pencil className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={guarded(() => onDownload(document))}
            className={cn(iconButton, isDownloading && UNAVAILABLE)}
            aria-disabled={isDownloading}
            aria-busy={isDownloading || undefined}
            aria-label={t('download')}
            aria-describedby={titleId}
            data-testid="doc-download-btn"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
          </Button>
          {/* Overflow menu: Rename + Move + Delete */}
          <CardActionsMenu
            sections={sections}
            triggerLabel={formatMessage(t('moreOptions'), { name: isolate(document.name) })}
            locale={locale}
            triggerRef={menuTriggerRef}
            testId="doc-overflow-menu-btn"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  category: DocumentCategory
  searchQuery: string
  onUploadClick?: () => void
  locale: Locale
}

function EmptyState({ category, searchQuery, onUploadClick, locale }: EmptyStateProps) {
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  if (searchQuery) {
    const [before, after] = splitMessage(t('noMatch'), 'query')
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-stone-600" aria-hidden="true" />
        </div>
        <h3 className="font-medium text-stone-900 mb-1">{t('noResults')}</h3>
        <p className="text-sm text-stone-700">
          {before}<bdi lang="" dir="auto">{searchQuery}</bdi>{after}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center mb-4`}>
        <Icon className="w-8 h-8" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-stone-900 mb-1">
        {category === 'all' ? t('emptyAll') : formatMessage(t('emptyCategory'), { category: documentCategoryLabel(category, locale) })}
      </h3>
      <p className="text-sm text-stone-700 mb-4">
        {category === 'all' ? t('emptyAllBody') : t('emptyCategoryBody')}
      </p>
      <Button className="gap-2" onClick={onUploadClick}>
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t('uploadDocument')}
      </Button>
    </div>
  )
}

// ============================================
// RENAME and DELETE dialogs (Radix Dialog; focus returns to the card's menu button)
// ============================================
interface RenameDialogProps {
  doc: Document | null
  locale: Locale
  onClose: () => void
  onSubmit: (newName: string) => Promise<DocumentsKey | null>
  returnFocus: () => HTMLElement | null | undefined
}

function RenameDocumentDialog({ doc, locale, onClose, onSubmit, returnFocus }: RenameDialogProps) {
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [draft, setDraft] = useState(doc?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Announcement>(NO_ANNOUNCEMENT)
  const inFlight = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const empty = !draft.trim()

  useEffect(() => {
    setDraft(doc?.name ?? '')
    setError(NO_ANNOUNCEMENT)
  }, [doc])

  const submit = async () => {
    if (inFlight.current) return
    if (empty) {
      announce(setError, t('nameRequired'))
      inputRef.current?.focus()
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const failure = await onSubmit(draft.trim())
      if (failure) {
        announce(setError, t(failure))
        inputRef.current?.focus()
      }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => { if (!open && !inFlight.current) onClose() }}>
      <DialogContent
        lang={locale}
        dir={dir(locale)}
        closeLabel={documentsT(locale, 'close')}
        className="sm:max-w-sm"
        data-testid="rename-dialog"
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select() }}
        onCloseAutoFocus={(e) => { e.preventDefault(); returnFocus()?.focus() }}
      >
        <form
          noValidate
          onSubmit={(e) => { e.preventDefault(); void submit() }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('renameTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{t('nameLabel')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-document-input">{t('nameLabel')}</Label>
            <Input
              id="rename-document-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              lang=""
              dir="auto"
              required
              aria-required="true"
              aria-invalid={error.text ? true : undefined}
              aria-describedby="rename-document-error"
              className="border-stone-500 text-stone-900"
              data-testid="rename-input"
            />
            <p id="rename-document-error" role="alert" className="text-sm text-red-700">
              <AnnouncementText announcement={error} />
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { if (!inFlight.current) onClose() }} className="border-stone-500">
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              aria-disabled={busy}
              aria-busy={busy || undefined}
              data-testid="rename-submit-btn"
              className={cn('bg-[#4a5d23] hover:bg-[#3d4d1d] text-white', busy && UNAVAILABLE)}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
              {t('rename')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  doc: Document | null
  locale: Locale
  onClose: () => void
  onConfirm: () => Promise<boolean>
  returnFocus: () => HTMLElement | null | undefined
}

function DeleteDocumentDialog({ doc, locale, onClose, onConfirm, returnFocus }: DeleteDialogProps) {
  const t = (key: DocumentsKey) => documentsT(locale, key)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  // Set when the document left: focus then goes where the panel sends it, not to its menu button.
  const deletedRef = useRef(false)
  const [before, after] = splitMessage(t('deleteBody'), 'name')

  const confirm = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      deletedRef.current = await onConfirm()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => { if (!open && !inFlight.current) onClose() }}>
      <DialogContent
        lang={locale}
        dir={dir(locale)}
        closeLabel={documentsT(locale, 'close')}
        className="sm:max-w-sm"
        data-testid="delete-document-dialog"
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          if (deletedRef.current) { deletedRef.current = false; return }
          returnFocus()?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('deleteTitle')}</DialogTitle>
          <DialogDescription className="text-stone-700">
            {before}<bdi lang="" dir="auto">{doc?.name}</bdi>{after}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { if (!inFlight.current) onClose() }} className="border-stone-500">
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void confirm()}
            aria-disabled={busy}
            aria-busy={busy || undefined}
            data-testid="delete-document-confirm"
            className={cn(busy && UNAVAILABLE)}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Trash2 className="w-4 h-4" aria-hidden="true" />}
            {t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// MAIN DOCUMENTS PANEL
// ============================================
type PendingAction = { type: 'view'; doc: Document } | { type: 'download'; doc: Document } | { type: 'edit'; doc: Document }

interface EditSource {
  file: File
  annotations: TextAnnotation[]
}

type ViewMode = 'documents' | 'applications' | 'resources'
const VIEW_TABS: ViewMode[] = ['documents', 'applications', 'resources']
const TAB_KEYS: Record<ViewMode, DocumentsKey> = { documents: 'tabDocuments', applications: 'tabApplications', resources: 'tabResources' }

export function DocumentsPanel({ userId }: DocumentsPanelProps) {
  const { user, profile: publicProfile, isAnonymous } = useAuthContext()
  const { isUnlocked } = useVault()
  const locale = useProfileLocale()
  const t = (key: DocumentsKey) => documentsT(locale, key)
  // Ref so callbacks always read the CURRENT isUnlocked value, avoiding
  // a stale-closure race where onSuccess fires handleView before the next
  // render propagates isUnlocked=true to the useCallback dependency.
  const isUnlockedRef = useRef(isUnlocked)
  useEffect(() => { isUnlockedRef.current = isUnlocked }, [isUnlocked])
  const { downloadFile, downloadForEdit, updateAnnotations, renameEncrypted, deleteFile, error: downloadError, clearError: clearDownloadError } = useEncryptedUpload()
  const { updateDocument } = useDocuments()
  // Vault secure profile — used to supply autofill values to the PDF annotator
  const { profile: vaultProfile } = useVaultSecureProfile()
  const { savedResources, isLoading: resourcesLoading, removeResource } = useSavedResources()
  const { panelParams, setPanelParams } = usePanelContext()
  const [documents, setDocuments] = useState<Document[]>([])
  // Resolved display names keyed by document id. Encrypted rows are decrypted
  // here (only when the vault is unlocked); locked rows fall back to the
  // placeholder/legacy plaintext `name`. Kept separate from `documents` so the
  // list re-resolves reactively when the vault unlocks without a re-fetch.
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerFile, setViewerFile] = useState<File | null>(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  // viewMode is driven by panelParams.subtab when set (deep-link / alias routing)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const sub = typeof panelParams?.subtab === 'string' ? panelParams.subtab : ''
    if (sub === 'resources') return 'resources'
    if (sub === 'applications') return 'applications'
    return 'documents'
  })
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editSource, setEditSource] = useState<EditSource | null>(null)
  const [renameDoc, setRenameDoc] = useState<Document | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  // The panel's own failure line (load, open, move, delete); the hook's line is read as a code.
  const [panelError, setPanelErrorKey] = useState<DocumentsKey | null>(null)
  // Each failure takes a new number: the alert's node is replaced, so an identical failure is
  // spoken again.
  const [failSeq, setFailSeq] = useState(0)
  const setPanelError = useCallback((key: DocumentsKey | null) => {
    setPanelErrorKey(key)
    if (key) setFailSeq((n) => n + 1)
  }, [])
  const [status, setStatus] = useState<Announcement>(NO_ANNOUNCEMENT)
  // Ref for the EncryptedUpload zone so the empty-state button can move to it
  const uploadZoneRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resourcesHeadingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>())
  const resourceButtons = useRef(new Map<string, HTMLButtonElement>())
  const categoryButtons = useRef(new Map<string, HTMLButtonElement>())

  // Sync viewMode when panelParams.subtab changes (e.g. back-button resolves alias)
  useEffect(() => {
    const sub = typeof panelParams?.subtab === 'string' ? panelParams.subtab : ''
    if (sub === 'resources' && viewMode !== 'resources') setViewMode('resources')
    else if (sub === 'applications' && viewMode !== 'applications') setViewMode('applications')
    else if (sub === 'documents' && viewMode !== 'documents') setViewMode('documents')
  }, [panelParams?.subtab])

  // A switch of section from outside the tab bar (a deep link, the forms hub saving a PDF) leaves
  // focus nowhere: it goes to the section's heading.
  useEffect(() => {
    afterLayout(() => {
      if (typeof document === 'undefined' || document.activeElement !== document.body) return
      if (viewMode === 'documents') headingRef.current?.focus()
      else if (viewMode === 'resources') resourcesHeadingRef.current?.focus()
    })
  }, [viewMode])

  // Load documents from database
  useEffect(() => {
    const loadDocuments = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('user_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          // One code-only row; the member reads the translated line.
          logger.warn('error_surface.shown', { surface: 'documents', kind: failureCode(error), locale })
          setPanelError('loadFailed')
          return
        }

        const mappedDocs: Document[] = (data || []).map(mapDocumentRow)

        setDocuments(mappedDocs)
      } catch (err) {
        logger.warn('error_surface.shown', { surface: 'documents', kind: failureCode(err), locale })
        setPanelError('loadFailed')
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  // viewMode added to deps: when the user returns to the 'documents' subtab from
  // forms (same panel, no remount), the effect re-fires and shows newly-saved docs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, viewMode])

  // Resolve decrypted display names. Runs whenever the document list or vault
  // unlock state changes. When the vault is unlocked and a row has the encrypted
  // filename ciphertext, decrypt it for display; otherwise fall back to the
  // stored `name` (placeholder when locked, legacy plaintext for old rows).
  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      const next: Record<string, string> = {}
      for (const doc of documents) {
        if (isUnlocked && doc.encryptedNameCipher && doc.encryptedNameIv) {
          try {
            next[doc.id] = await decryptString(doc.encryptedNameCipher, doc.encryptedNameIv)
          } catch {
            // Decrypt failed (e.g. vault locked mid-resolve) — graceful fallback,
            // never surface garbage or crash.
            next[doc.id] = doc.name
          }
        } else {
          next[doc.id] = doc.name
        }
      }
      if (!cancelled) setDisplayNames(next)
    }
    resolve()
    return () => { cancelled = true }
  }, [documents, isUnlocked])

  // Calculate document counts per category
  const documentCounts = documents.reduce<Record<DocumentCategory, number>>(
    (acc, doc) => {
      acc.all += 1
      acc[doc.category] += 1
      return acc
    },
    { all: 0, id: 0, income: 0, residence: 0, medical: 0, forms: 0, other: 0 }
  )

  // Overlay the resolved display name (decrypted when unlocked, placeholder when
  // locked) onto each document so the list, search, rename, and delete confirm
  // all operate on the user-facing name.
  const documentsForDisplay = documents.map((doc) => ({
    ...doc,
    name: displayNames[doc.id] ?? doc.name,
  }))

  // Filter documents based on category and search
  const filteredDocuments = documentsForDisplay.filter((doc) => {
    const matchesCategory = activeCategory === 'all' || doc.category === activeCategory
    const matchesSearch = searchQuery === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Group saved resources by category
  const resourcesByCategory = savedResources.reduce<Record<string, SavedResource[]>>((acc, r) => {
    const cat = r.resource_category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})

  // Handler for upload completion
  const handleUploadComplete = useCallback(() => {
    // Reload documents after upload
    const loadDocuments = async () => {
      if (!user?.id) return

      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setDocuments(data.map(mapDocumentRow))
      }
    }

    loadDocuments()
  }, [user?.id])

  // Default scale used when flattening for view/download — mirrors annotator default
  const DEFAULT_FLATTEN_SCALE = 1.5

  const handleView = useCallback(async (doc: Document) => {
    if (!isUnlockedRef.current) {
      setPendingAction({ type: 'view', doc })
      setShowUnlockModal(true)
      return
    }
    try {
      setDownloadingId(doc.id)
      setPanelError(null)
      let file: File

      await withMetric(
        'documents.view',
        { documentId: doc.id, has_annotations: doc.hasAnnotations ?? false, flattened: doc.hasAnnotations ?? false },
        async () => {
          if (doc.hasAnnotations) {
            // Re-editable doc: download source + annotations, flatten for in-app viewing
            const { sourceFile, annotations } = await downloadForEdit(doc.id)
            const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer())
            const flatBytes = await exportFlattened(sourceBytes, annotations, DEFAULT_FLATTEN_SCALE)
            file = new File([flatBytes as Uint8Array<ArrayBuffer>], sourceFile.name, { type: 'application/pdf' })
          } else {
            // Legacy flattened doc: download directly
            file = await downloadFile(doc.id)
          }
        }
      )

      setViewerFile(file!)
      setViewerOpen(true)
    } catch (err) {
      logger.error('documents.view.error', err, { documentId: doc.id })
      setPanelError('docFailed')
    } finally {
      setDownloadingId(null)
    }
  }, [downloadFile, downloadForEdit, setPanelError])

  const handleDownload = useCallback(async (doc: Document) => {
    if (!isUnlockedRef.current) {
      setPendingAction({ type: 'download', doc })
      setShowUnlockModal(true)
      return
    }
    try {
      setDownloadingId(doc.id)
      setPanelError(null)

      await withMetric(
        'documents.download',
        { documentId: doc.id, has_annotations: doc.hasAnnotations ?? false },
        async () => {
          let file: File

          if (doc.hasAnnotations) {
            // Re-editable doc: flatten before download
            const { sourceFile, annotations } = await downloadForEdit(doc.id)
            const sourceBytes = new Uint8Array(await sourceFile.arrayBuffer())
            const flatBytes = await exportFlattened(sourceBytes, annotations, DEFAULT_FLATTEN_SCALE)
            file = new File([flatBytes as Uint8Array<ArrayBuffer>], sourceFile.name, { type: 'application/pdf' })
          } else {
            // Legacy flattened doc: download directly
            file = await downloadFile(doc.id)
          }

          // CSP-safe anchor download pattern
          const url = URL.createObjectURL(file)
          const a = document.createElement('a')
          a.href = url
          a.download = file.name
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      )
    } catch (err) {
      logger.error('documents.download.error', err, { documentId: doc.id })
      setPanelError('docFailed')
    } finally {
      setDownloadingId(null)
    }
  }, [downloadFile, downloadForEdit, setPanelError])

  const handleEdit = useCallback(async (doc: Document) => {
    if (!isUnlockedRef.current) {
      setPendingAction({ type: 'edit', doc })
      setShowUnlockModal(true)
      return
    }
    try {
      setDownloadingId(doc.id)
      setPanelError(null)
      const { sourceFile, annotations } = await withMetric(
        'documents.edit.open',
        { documentId: doc.id, annotation_count: 0 },
        async () => {
          const result = await downloadForEdit(doc.id)
          return result
        }
      )
      logger.info('documents.edit.open.annotations', { documentId: doc.id, annotation_count: annotations.length })
      setEditingDoc(doc)
      setEditSource({ file: sourceFile, annotations })
    } catch (err) {
      logger.error('documents.edit.open.error', err, { documentId: doc.id })
      setPanelError('docFailed')
    } finally {
      setDownloadingId(null)
    }
  }, [downloadForEdit, setPanelError])

  // Autofill values — derived from public profile + vault profile.
  // Recomputed whenever any source changes; passed to PdfAnnotator.
  // ssn/dob/annual_income deliberately excluded (see form-field-mapper.ts).
  const autofillValues: AutofillValues = useMemo(
    () => mapProfileToAutofill({
      vaultProfile: vaultProfile ?? null,
      publicProfile: publicProfile ?? null,
      email: user?.email,
    }),
    [vaultProfile, publicProfile, user?.email]
  )

  // The document whose menu opened the rename / delete dialog: focus returns to its menu button.
  const actionDocId = useRef<string | null>(null)
  const returnToMenu = () => (actionDocId.current ? menuTriggers.current.get(actionDocId.current) : null) ?? headingRef.current
  const openRename = (doc: Document) => { actionDocId.current = doc.id; setRenameDoc(doc) }
  const openDelete = (doc: Document) => { actionDocId.current = doc.id; setDeleteDoc(doc) }

  /** Rename; returns the failure line's key, or null on success (the dialog then closes). */
  const handleRenameSubmit = useCallback(async (newName: string): Promise<DocumentsKey | null> => {
    const doc = renameDoc
    if (!doc) return null
    if (newName === doc.name) {
      setRenameDoc(null)
      return null
    }

    // Encrypted docs: encrypt the new name into the ciphertext columns and keep
    // the plaintext `name` column as the placeholder (no cleartext re-leak).
    // Requires the vault to be unlocked.
    if (doc.isEncrypted) {
      if (!isUnlocked) return 'renameLocked'
      try {
        await renameEncrypted(doc.id, newName)
        // Plaintext `name` stays the placeholder; only the resolved display name changes.
        setDisplayNames((prev) => ({ ...prev, [doc.id]: newName }))
        setRenameDoc(null)
        announce(setStatus, t('renamed'))
        return null
      } catch {
        // documents.rename.encrypted.error is written by the hook.
        return 'renameFailed'
      }
    }

    // Legacy unencrypted docs: plaintext rename via the standard path.
    const ok = await updateDocument(doc.id, { name: newName })
    if (ok) {
      // Optimistically update panel's own document list so the card re-renders immediately
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, name: newName } : d))
      setRenameDoc(null)
      announce(setStatus, t('renamed'))
      return null
    }
    // documents.update.error is written by the hook.
    return 'renameFailed'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameDoc, updateDocument, renameEncrypted, isUnlocked, locale])

  const handleMove = useCallback(async (doc: Document, newCategory: Exclude<DocumentCategory, 'all'>) => {
    // Chosen before the card can leave the open folder.
    const ids = filteredDocuments.map((d) => d.id)
    const leaves = activeCategory !== 'all' && newCategory !== activeCategory
    const ok = await updateDocument(doc.id, { category: newCategory })
    if (ok) {
      // Optimistically update panel's own document list so category filter updates immediately
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, category: newCategory } : d))
      announce(setStatus, formatMessage(t('moved'), { category: documentCategoryLabel(newCategory, locale) }))
      if (leaves) {
        const nextId = focusAfterRowRemoval(ids, doc.id)
        focusAfter(() => (nextId ? menuTriggers.current.get(nextId) : null), () => headingRef.current)
      }
    } else {
      logger.warn('documents.move.error', { id: doc.id, category: newCategory })
      setPanelError('moveFailed')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateDocument, filteredDocuments, activeCategory, locale])

  const handleEditSave = useCallback(async (data: { sourceBytes: Uint8Array; annotations: TextAnnotation[] }) => {
    if (!editingDoc) return
    await withMetric(
      'documents.annotations.update',
      { documentId: editingDoc.id, annotation_count: data.annotations.length },
      () => updateAnnotations(editingDoc.id, data.annotations)
    ).catch((err) => {
      logger.error('documents.annotations.update.error', err, { documentId: editingDoc.id, annotation_count: data.annotations.length })
      throw err
    })
    const savedId = editingDoc.id
    // Refresh document list so hasAnnotations flag updates
    setEditingDoc(null)
    setEditSource(null)
    // Reload documents directly
    if (user?.id) {
      const supabase = createClient()
      const { data: rows, error } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (!error && rows) {
        setDocuments(rows.map(mapDocumentRow))
      }
    }
    // Back on the list: focus the edited document's menu button, else the heading; the save is
    // said once in the status line.
    focusAfter(() => menuTriggers.current.get(savedId), () => headingRef.current)
    afterLayout(() => announce(setStatus, t('annotationsSaved')))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDoc, updateAnnotations, user?.id, locale])

  const handleEditCancel = useCallback(() => {
    const id = editingDoc?.id
    setEditingDoc(null)
    setEditSource(null)
    focusAfter(() => (id ? menuTriggers.current.get(id) : null), () => headingRef.current)
  }, [editingDoc])

  /** Delete the open dialog's document; true when it left (focus is then moved here). */
  const handleDeleteConfirm = useCallback(async (): Promise<boolean> => {
    const doc = deleteDoc
    if (!doc) return false
    const ids = filteredDocuments.map((d) => d.id)
    try {
      await deleteFile(doc.id)
      clearDownloadError()
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      setDeleteDoc(null)
      announce(setStatus, t('deleted'))
      const nextId = focusAfterRowRemoval(ids, doc.id)
      focusAfter(() => (nextId ? menuTriggers.current.get(nextId) : null), () => headingRef.current)
      return true
    } catch (err) {
      // deleteFile writes no row for this failure: one code-only row here.
      logger.warn('error_surface.shown', { surface: 'documents', kind: failureCode(err), locale })
      clearDownloadError()
      setDeleteDoc(null)
      setPanelError('deleteFailed')
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteDoc, filteredDocuments, deleteFile, clearDownloadError, locale])

  const handleRemoveSaved = useCallback(async (resource: SavedResource, siblings: SavedResource[], category: string) => {
    const ids = siblings.map((r) => r.id)
    const ok = await removeResource(resource.id)
    if (ok) {
      announce(setStatus, t('removedSaved'))
      const nextId = focusAfterRowRemoval(ids, resource.id)
      focusAfter(
        () => (nextId ? resourceButtons.current.get(nextId) : categoryButtons.current.get(category)),
        () => resourcesHeadingRef.current,
      )
    } else {
      setPanelError('removeSavedFailed')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeResource, locale])

  // Tab switch handler: uniform — all three tabs set both the local render var
  // (viewMode) and the durable context truth (panelParams.subtab) so they can
  // never desync. The sync effect at L477-482 remains the entry point for
  // sidebar/deep-link alias switching (setActivePanel → effect → viewMode); its
  // viewMode !== tab guard makes it a no-op when we already set viewMode here.
  const handleTabSwitch = useCallback((tab: ViewMode) => {
    logEvent('nav.subtab.switch', { panel: 'documents', subtab: tab })
    setViewMode(tab)
    setPanelParams((prev) => ({ ...prev, subtab: tab }))
    if (typeof window !== 'undefined') {
      const hashMap: Record<typeof tab, string> = {
        documents: '#documents',
        applications: '#applications',
        resources: '#documents',
      }
      window.history.replaceState(null, '', hashMap[tab])
    }
  }, [setPanelParams])

  // ARIA roving tabindex keyboard handler for the Documents tablist; Left / Right follow the
  // reading direction.
  const handleDocsTabKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabSwitch(VIEW_TABS[currentIdx]); return }
    const next = nextTabIndex(e.key, currentIdx, VIEW_TABS.length, locale)
    if (next === null) return
    e.preventDefault()
    tabRefs.current[next]?.focus()
    handleTabSwitch(VIEW_TABS[next])
  }, [handleTabSwitch, locale])

  const dismissError = () => {
    clearDownloadError()
    setPanelError(null)
    headingRef.current?.focus()
  }

  // The failure line: the hook's sentence read as a code first (it names a timeout), else the
  // panel's own line. Never the text the server, storage or the crypto layer wrote.
  const errorText = downloadError ? documentsErrorText(downloadError, locale) : panelError ? t(panelError) : ''

  const regions = (
    <>
      <p role="status" className="sr-only" data-testid="documents-status">
        <AnnouncementText announcement={status} />
      </p>
    </>
  )

  // Inline PDF edit mode — full-panel annotator
  if (editingDoc && editSource) {
    return (
      <div lang={locale} dir={dir(locale)} className="h-full">
        <VaultGuard onDismiss={handleEditCancel}>
          <PdfAnnotator
            file={editSource.file}
            initialAnnotations={editSource.annotations}
            onSave={handleEditSave}
            onCancel={handleEditCancel}
            autofillValues={autofillValues}
          />
        </VaultGuard>
      </div>
    )
  }

  // Anonymous guests cannot use the vault or upload documents
  if (isAnonymous) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" data-testid="documents-panel" lang={locale} dir={dir(locale)}>
        <CreateAccountPrompt message={t('guestPrompt')} linkLabel={feedChromeT(locale, 'createAccount')} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" data-testid="documents-panel" lang={locale} dir={dir(locale)}>
      {regions}
      {/* View Toggle — ARIA tablist (W3C APG Tabs) */}
      <div
        role="tablist"
        aria-label={t('sectionsLabel')}
        className="flex flex-wrap gap-2 mb-4 border-b border-stone-300 pb-3"
      >
        {VIEW_TABS.map((tab, index) => {
          const selected = viewMode === tab
          return (
            <button
              key={tab}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`docs-tab-${tab}`}
              data-testid={`docs-tab-${tab}`}
              aria-selected={selected}
              aria-controls={`docs-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => handleTabSwitch(tab)}
              onKeyDown={(e) => handleDocsTabKeyDown(e, index)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-9',
                selected ? 'bg-lime-100 text-lime-900' : 'text-stone-700 hover:bg-stone-100',
              )}
            >
              <span className="flex items-center gap-2">
                {tab === 'resources' ? <Bookmark className="w-4 h-4" aria-hidden="true" /> : <FileText className="w-4 h-4" aria-hidden="true" />}
                {t(TAB_KEYS[tab])}
                {tab === 'resources' && savedResources.length > 0 && (
                  <span className="ms-1 px-1.5 py-0.5 text-xs rounded-full bg-lime-200 text-lime-900">
                    {formatCount(savedResources.length, locale)}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* The failure line: always mounted, so each new failure is announced. */}
      <div role="alert" data-testid="documents-alert">
        {errorText && (
          <div key={failSeq} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" data-testid="doc-download-error">
            <span>{errorText}</span>
            <button type="button" onClick={dismissError} className="shrink-0 min-h-6 px-2 text-sm font-medium underline">
              {t('dismiss')}
            </button>
          </div>
        )}
      </div>

      {viewMode === 'applications' ? (
        /* Applications sub-tab — FormsPanel is the Forms & Applications hub;
           min-h-0 prevents flex-child collapse in a flex column parent */
        <div
          role="tabpanel"
          id="docs-panel-applications"
          aria-labelledby="docs-tab-applications"
          tabIndex={0}
          className="flex-1 min-h-0"
        >
          <FormsPanel onPdfSaved={() => afterLayout(() => announce(setStatus, t('pdfSaved')))} />
        </div>
      ) : viewMode === 'documents' ? (
        <div
          role="tabpanel"
          id="docs-panel-documents"
          aria-labelledby="docs-tab-documents"
          tabIndex={0}
          className="flex-1 flex flex-col lg:flex-row gap-6"
        >
          {/* Folder Sidebar (Desktop only) */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <FolderChoice variant="sidebar" activeCategory={activeCategory} onCategoryChange={setActiveCategory} documentCounts={documentCounts} locale={locale} />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <DocumentsHeader
              documentCount={filteredDocuments.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              locale={locale}
              headingRef={headingRef}
            />

            {/* Encrypted Upload Zone */}
            <div ref={uploadZoneRef}>
              <EncryptedUpload
                category={activeCategory === 'all' ? 'other' : activeCategory}
                onUploadComplete={handleUploadComplete}
                className="mb-6"
              />
            </div>

            {/* Folder chips (Mobile/Tablet) */}
            <div className="lg:hidden">
              <FolderChoice variant="chips" activeCategory={activeCategory} onCategoryChange={setActiveCategory} documentCounts={documentCounts} locale={locale} />
            </div>

            {/* Documents Grid/List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12" role="presentation">
                  <Loader2 className="w-8 h-8 animate-spin text-stone-600" aria-hidden="true" />
                  <span className="sr-only">{t('loading')}</span>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <EmptyState
                  category={activeCategory}
                  searchQuery={searchQuery}
                  locale={locale}
                  onUploadClick={() => {
                    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
                    uploadZoneRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
                    uploadZoneRef.current?.querySelector<HTMLElement>('input[type="file"], button')?.focus({ preventScroll: true })
                  }}
                />
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-labelledby="documents-heading">
                  {filteredDocuments.map((doc) => (
                    <li key={doc.id}>
                      <DocumentCard
                        document={doc}
                        locale={locale}
                        onView={handleView}
                        onDownload={handleDownload}
                        onEdit={handleEdit}
                        onDelete={openDelete}
                        onRename={openRename}
                        onMove={handleMove}
                        menuTriggerRef={(node) => { if (node) menuTriggers.current.set(doc.id, node); else menuTriggers.current.delete(doc.id) }}
                        isDownloading={downloadingId === doc.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Saved Resources View */
        <div
          role="tabpanel"
          id="docs-panel-resources"
          aria-labelledby="docs-tab-resources"
          tabIndex={0}
          className="flex-1 overflow-y-auto"
        >
          <h2 ref={resourcesHeadingRef} tabIndex={-1} className="sr-only">{t('tabResources')}</h2>
          {resourcesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-stone-600" aria-hidden="true" />
            </div>
          ) : savedResources.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-stone-500 mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-lg font-medium text-stone-800">{t('noSaved')}</h3>
              <p className="text-sm text-stone-700 mt-1">{t('noSavedBody')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(resourcesByCategory).map(([category, resources]) => {
                const expanded = expandedCategory === category
                const listId = `saved-resources-${category}`
                return (
                  <div key={category} className="border border-stone-300 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      ref={(node) => { if (node) categoryButtons.current.set(category, node); else categoryButtons.current.delete(category) }}
                      onClick={() => setExpandedCategory(expanded ? null : category)}
                      aria-expanded={expanded}
                      aria-controls={listId}
                      className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-lime-700" aria-hidden="true" />
                        <span className="font-medium text-stone-800">{resourceCategoryLabel(category, locale)}</span>
                        <span className="text-xs text-stone-700">({formatCount(resources.length, locale)})</span>
                      </span>
                      <ChevronDown className={cn('w-4 h-4 text-stone-600 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {expanded && (
                      <ul id={listId} className="divide-y divide-stone-200">
                        {resources.map((resource) => (
                          <li
                            key={resource.id}
                            data-testid={`saved-resource-${resource.id}`}
                            className="px-4 py-3 hover:bg-stone-50"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <button
                                  type="button"
                                  ref={(node) => { if (node) resourceButtons.current.set(resource.id, node); else resourceButtons.current.delete(resource.id) }}
                                  onClick={() => setSelectedResourceId(resource.id)}
                                  className="text-start font-medium text-stone-900 text-sm hover:underline"
                                >
                                  <span lang="" dir="auto">{resource.resource_name}</span>
                                </button>
                                {resource.resource_address && (
                                  <p className="text-xs text-stone-700 mt-0.5 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                    <span lang="" dir="auto">{resource.resource_address}</span>
                                  </p>
                                )}
                                {resource.resource_phone && (
                                  <a
                                    href={`tel:${resource.resource_phone}`}
                                    className="text-xs text-lime-800 hover:underline mt-0.5 flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                    <span dir="ltr">{resource.resource_phone}</span>
                                  </a>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {resource.resource_website && (
                                  <a
                                    href={resource.resource_website.startsWith('http') ? resource.resource_website : `https://${resource.resource_website}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-700 hover:text-lime-800 hover:bg-lime-50 transition-colors"
                                    aria-label={t('visitWebsite')}
                                    title={t('visitWebsite')}
                                  >
                                    <ExternalLink className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
                                  </a>
                                )}
                                {resource.resource_address && (
                                  <a
                                    href={`https://maps.google.com/?q=${encodeURIComponent(resource.resource_address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-700 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                                    aria-label={t('getDirections')}
                                    title={t('getDirections')}
                                  >
                                    <MapPin className="w-4 h-4" aria-hidden="true" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveSaved(resource, resources, category)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-700 hover:text-red-700 hover:bg-red-50 transition-colors"
                                  aria-label={t('removeSaved')}
                                  title={t('removeSaved')}
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <ResourceDetailDialog
        savedResourceId={selectedResourceId}
        open={selectedResourceId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedResourceId(null)
        }}
      />
      <PdfDocumentViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        file={viewerFile}
      />
      <VaultUnlockModal
        open={showUnlockModal}
        onOpenChange={setShowUnlockModal}
        mode="unlock"
        onSuccess={() => {
          setShowUnlockModal(false)
          // Update ref synchronously before replaying the action so handleView/
          // handleDownload/handleEdit see isUnlocked=true before the next render.
          isUnlockedRef.current = true
          const a = pendingAction
          setPendingAction(null)
          if (a?.type === 'view') handleView(a.doc)
          else if (a?.type === 'download') handleDownload(a.doc)
          else if (a?.type === 'edit') handleEdit(a.doc)
        }}
      />
      <RenameDocumentDialog
        doc={renameDoc}
        locale={locale}
        onClose={() => setRenameDoc(null)}
        onSubmit={handleRenameSubmit}
        returnFocus={returnToMenu}
      />
      <DeleteDocumentDialog
        doc={deleteDoc}
        locale={locale}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
        returnFocus={returnToMenu}
      />
    </div>
  )
}
