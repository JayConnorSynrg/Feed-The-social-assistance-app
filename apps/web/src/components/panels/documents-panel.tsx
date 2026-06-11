'use client'

// apps/web/src/components/panels/documents-panel.tsx
// Documents Panel - Secure document management for uploaded files
// Supports drag-and-drop upload, categorization, and document actions

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  FileText,
  Image,
  Upload,
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
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useVault } from '@/contexts/vault-context'
import { useVaultSecureProfile } from '@/hooks/use-vault-secure-profile'
import { createClient } from '@/lib/supabase/client'
import { useSavedResources, type SavedResource } from '@/hooks/use-saved-resources'
import { mapProfileToAutofill } from '@/lib/form-field-mapper'
import type { AutofillValues } from '@/lib/form-field-mapper'
import { FormsPanel } from './forms-panel'
import { usePanelContext } from '@/components/layout/feed-shell'
import { VaultUnlockModal } from '@/components/vault'
import { logger, withMetric } from '@/lib/logger'
import { track } from '@vercel/analytics'

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

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; icon: React.ElementType; color: string }> = {
  all: { label: 'All Documents', icon: FolderOpen, color: 'bg-stone-100 text-stone-600' },
  id: { label: 'ID Documents', icon: CreditCard, color: 'bg-blue-100 text-blue-600' },
  income: { label: 'Income Proof', icon: FileCheck, color: 'bg-green-100 text-green-600' },
  residence: { label: 'Residence', icon: Home, color: 'bg-orange-100 text-orange-600' },
  medical: { label: 'Medical', icon: Heart, color: 'bg-red-100 text-red-600' },
  forms: { label: 'Submitted Forms', icon: FileText, color: 'bg-lime-100 text-lime-700' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
}

/** Move-target categories (excludes 'all' sentinel) */
const MOVE_CATEGORIES: Array<Exclude<DocumentCategory, 'all'>> = [
  'id', 'income', 'residence', 'medical', 'forms', 'other',
]

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: Date): string {
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) return 'Today'
  if (diffInDays === 1) return 'Yesterday'
  if (diffInDays < 7) return `${diffInDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ============================================
// DOCUMENT HEADER
// ============================================
interface DocumentsHeaderProps {
  documentCount: number
  searchQuery: string
  onSearchChange: (query: string) => void
}

function DocumentsHeader({ documentCount, searchQuery, onSearchChange }: DocumentsHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">My Documents</h2>
          <p className="text-sm text-stone-600 mt-1">
            Securely store and manage your important documents
          </p>
        </div>
        <span className="text-sm text-stone-500 bg-stone-100 px-3 py-1 rounded-full">
          {documentCount} {documentCount === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
        <Input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-[#faf9f6] border-stone-200"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// Note: Upload zone removed - using EncryptedUpload component instead

// ============================================
// CATEGORY TABS
// ============================================
interface CategoryTabsProps {
  activeCategory: DocumentCategory
  onCategoryChange: (category: DocumentCategory) => void
  documentCounts: Record<DocumentCategory, number>
}

function CategoryTabs({ activeCategory, onCategoryChange, documentCounts }: CategoryTabsProps) {
  const categories: DocumentCategory[] = ['all', 'id', 'income', 'residence', 'medical', 'forms', 'other']

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {categories.map((category) => {
        const config = CATEGORY_CONFIG[category]
        const count = documentCounts[category]
        const isActive = activeCategory === category

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap
              ${isActive
                ? 'bg-[#4a5d23] text-white'
                : 'bg-[#f0ede6] hover:bg-[#e8e4db] text-stone-700'
              }
            `}
          >
            <config.icon className="w-4 h-4" />
            <span>{config.label}</span>
            <span className={`
              px-1.5 py-0.5 rounded-full text-xs
              ${isActive ? 'bg-white/20' : 'bg-stone-200'}
            `}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================
// FOLDER SIDEBAR (Desktop)
// ============================================
interface FolderSidebarProps {
  activeCategory: DocumentCategory
  onCategoryChange: (category: DocumentCategory) => void
  documentCounts: Record<DocumentCategory, number>
}

function FolderSidebar({ activeCategory, onCategoryChange, documentCounts }: FolderSidebarProps) {
  const categories: DocumentCategory[] = ['all', 'id', 'income', 'residence', 'medical', 'forms', 'other']

  return (
    <div className="hidden lg:block w-56 flex-shrink-0">
      <div className="space-y-1">
        {categories.map((category) => {
          const config = CATEGORY_CONFIG[category]
          const count = documentCounts[category]
          const isActive = activeCategory === category

          return (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left
                ${isActive
                  ? 'bg-[#4a5d23] text-white'
                  : 'text-stone-700 hover:bg-[#f0ede6]'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${isActive ? 'bg-white/20' : config.color}
              `}>
                <config.icon className="w-4 h-4" />
              </div>
              <span className="flex-1 text-sm font-medium">{config.label}</span>
              <span className={`
                text-xs font-medium
                ${isActive ? 'text-white/80' : 'text-stone-500'}
              `}>
                {count}
              </span>
              {isActive && <ChevronRight className="w-4 h-4" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// DOCUMENT CARD
// ============================================
interface DocumentCardProps {
  document: Document
  onView: (doc: Document) => void
  onDownload: (doc: Document) => void
  onEdit: (doc: Document) => void
  onDelete: (doc: Document) => void
  onRename: (doc: Document) => void
  onMove: (doc: Document, newCategory: DocumentCategory) => void
  isDownloading?: boolean
}

function DocumentCard({ document, onView, onDownload, onEdit, onDelete, onRename, onMove, isDownloading }: DocumentCardProps) {
  const [showActions, setShowActions] = useState(false)

  const getDocumentIcon = () => {
    switch (document.type) {
      case 'pdf':
        return (
          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-red-600" />
          </div>
        )
      case 'image':
        return (
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <Image className="w-6 h-6 text-blue-600" />
          </div>
        )
      case 'word':
        return (
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-700" />
          </div>
        )
      default:
        return (
          <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-stone-600" />
          </div>
        )
    }
  }

  const categoryConfig = CATEGORY_CONFIG[document.category]

  return (
    <div
      className="relative p-4 rounded-xl bg-[#faf9f6] border border-stone-200 hover:border-[#4a5d23]/30 hover:shadow-sm transition-all group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid="document-card"
      data-document-id={document.id}
    >
      <div className="flex items-start gap-4">
        {/* Document Icon */}
        {getDocumentIcon()}

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-stone-900 truncate mb-1 flex items-center gap-2">
            {document.name}
            {document.isEncrypted && (
              <Lock className="w-3 h-3 text-[#4a5d23]" aria-label="Encrypted" />
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${categoryConfig.color}`}>
              {categoryConfig.label}
            </span>
            <span className="text-xs text-stone-500">
              {formatFileSize(document.size)}
            </span>
            <span className="text-xs text-stone-600">
              {formatDate(document.uploadedAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`
          flex items-center gap-1 transition-opacity
          ${showActions ? 'opacity-100' : 'opacity-0 sm:opacity-100'}
        `}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView(document)}
            className="h-8 w-8 text-stone-500 hover:text-[#4a5d23] hover:bg-[#4a5d23]/10"
            disabled={isDownloading}
            data-testid="doc-view-btn"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {document.type === 'pdf' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(document)}
              className="h-8 w-8 text-stone-500 hover:text-blue-600 hover:bg-blue-50"
              disabled={isDownloading}
              data-testid="doc-edit-btn"
              aria-label="Edit PDF annotations"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(document)}
            className="h-8 w-8 text-stone-500 hover:text-[#4a5d23] hover:bg-[#4a5d23]/10"
            disabled={isDownloading}
            data-testid="doc-download-btn"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
          {/* Overflow menu: Rename + Move + Delete */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100"
                disabled={isDownloading}
                data-testid="doc-overflow-menu-btn"
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onRename(document)}
                data-testid="doc-rename-btn"
              >
                <Pencil className="w-4 h-4 mr-2 text-stone-500" />
                Rename
              </DropdownMenuItem>
              {MOVE_CATEGORIES.filter(c => c !== document.category).map(cat => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => onMove(document, cat)}
                  data-testid={`doc-move-to-${cat}`}
                >
                  <FolderOpen className="w-4 h-4 mr-2 text-stone-500" />
                  Move to {CATEGORY_CONFIG[cat].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem
                onClick={() => onDelete(document)}
                className="text-red-600 focus:text-red-600"
                data-testid="doc-delete-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
}

function EmptyState({ category, searchQuery, onUploadClick }: EmptyStateProps) {
  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="font-medium text-stone-900 mb-1">No results found</h3>
        <p className="text-sm text-stone-500">
          No documents match &quot;{searchQuery}&quot;
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center mb-4`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="font-medium text-stone-900 mb-1">
        No {category === 'all' ? 'documents' : config.label.toLowerCase()} yet
      </h3>
      <p className="text-sm text-stone-500 mb-4">
        {category === 'all'
          ? 'Upload your first document to get started'
          : `Upload documents to this category for easy access`
        }
      </p>
      <Button className="gap-2" onClick={onUploadClick}>
        <Plus className="w-4 h-4" />
        Upload Document
      </Button>
    </div>
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

export function DocumentsPanel({ userId }: DocumentsPanelProps) {
  const { user, profile: publicProfile } = useAuthContext()
  const { isUnlocked } = useVault()
  // Ref so callbacks always read the CURRENT isUnlocked value, avoiding
  // a stale-closure race where onSuccess fires handleView before the next
  // render propagates isUnlocked=true to the useCallback dependency.
  const isUnlockedRef = useRef(isUnlocked)
  useEffect(() => { isUnlockedRef.current = isUnlocked }, [isUnlocked])
  const { downloadFile, downloadForEdit, updateAnnotations, renameEncrypted, deleteFile, isDownloading, error: downloadError, clearError: clearDownloadError } = useEncryptedUpload()
  const { updateDocument } = useDocuments()
  // Vault secure profile — used to supply autofill values to the PDF annotator
  const { profile: vaultProfile } = useVaultSecureProfile()
  const { savedResources, isLoading: resourcesLoading, removeResource } = useSavedResources()
  const { panelParams, setPanelParams, setActivePanel } = usePanelContext()
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
  const [viewMode, setViewMode] = useState<'documents' | 'resources' | 'forms'>(() => {
    const sub = typeof panelParams?.subtab === 'string' ? panelParams.subtab : ''
    if (sub === 'forms') return 'forms'
    if (sub === 'resources') return 'resources'
    return 'documents'
  })
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editSource, setEditSource] = useState<EditSource | null>(null)
  // Rename dialog state
  const [renameDoc, setRenameDoc] = useState<Document | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  // Autofill toast state (for PDF fill-from-profile feedback)
  const [fillToast, setFillToast] = useState<string | null>(null)
  // Ref for the EncryptedUpload zone so the empty-state button can scroll to it
  const uploadZoneRef = useRef<HTMLDivElement>(null)

  // Sync viewMode when panelParams.subtab changes (e.g. back-button resolves alias)
  useEffect(() => {
    const sub = typeof panelParams?.subtab === 'string' ? panelParams.subtab : ''
    if (sub === 'forms' && viewMode !== 'forms') setViewMode('forms')
    else if (sub === 'resources' && viewMode !== 'resources') setViewMode('resources')
    else if (sub === 'documents' && viewMode !== 'documents') setViewMode('documents')
  }, [panelParams?.subtab])

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
          console.error('Error loading documents:', error)
          return
        }

        const mappedDocs: Document[] = (data || []).map(mapDocumentRow)

        setDocuments(mappedDocs)
      } catch (err) {
        console.error('Failed to load documents:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  // viewMode added to deps: when the user returns to the 'documents' subtab from
  // forms (same panel, no remount), the effect re-fires and shows newly-saved docs.
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
    const cat = r.resource_category || 'Other'
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
      console.error('Failed to view document:', err)
    } finally {
      setDownloadingId(null)
    }
  }, [downloadFile, downloadForEdit])

  const handleDownload = useCallback(async (doc: Document) => {
    if (!isUnlockedRef.current) {
      setPendingAction({ type: 'download', doc })
      setShowUnlockModal(true)
      return
    }
    try {
      setDownloadingId(doc.id)

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
      console.error('Failed to download document:', err)
    } finally {
      setDownloadingId(null)
    }
  }, [downloadFile, downloadForEdit])

  const handleEdit = useCallback(async (doc: Document) => {
    if (!isUnlockedRef.current) {
      setPendingAction({ type: 'edit', doc })
      setShowUnlockModal(true)
      return
    }
    try {
      setDownloadingId(doc.id)
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
      console.error('Failed to open document for editing:', err)
    } finally {
      setDownloadingId(null)
    }
  }, [downloadForEdit])

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

  const handleRenameOpen = useCallback((doc: Document) => {
    setRenameDoc(doc)
    setRenameDraft(doc.name)
    setRenameError(null)
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    if (!renameDoc || !renameDraft.trim()) return
    const newName = renameDraft.trim()
    if (newName === renameDoc.name) {
      setRenameDoc(null)
      return
    }
    setRenameLoading(true)
    setRenameError(null)

    // Encrypted docs: encrypt the new name into the ciphertext columns and keep
    // the plaintext `name` column as the placeholder (no cleartext re-leak).
    // Requires the vault to be unlocked.
    if (renameDoc.isEncrypted) {
      if (!isUnlocked) {
        setRenameLoading(false)
        setRenameError('Unlock your vault to rename this document.')
        return
      }
      try {
        await renameEncrypted(renameDoc.id, newName)
        setRenameLoading(false)
        // Plaintext `name` stays the placeholder; only the resolved display name changes.
        setDisplayNames((prev) => ({ ...prev, [renameDoc.id]: newName }))
        setRenameDoc(null)
      } catch {
        setRenameLoading(false)
        setRenameError('Failed to rename. Please try again.')
      }
      return
    }

    // Legacy unencrypted docs: plaintext rename via the standard path.
    const ok = await updateDocument(renameDoc.id, { name: newName })
    setRenameLoading(false)
    if (ok) {
      // Optimistically update panel's own document list so the card re-renders immediately
      setDocuments((prev) => prev.map((d) => d.id === renameDoc.id ? { ...d, name: newName } : d))
      setRenameDoc(null)
    } else {
      setRenameError('Failed to rename. Please try again.')
    }
  }, [renameDoc, renameDraft, updateDocument, renameEncrypted, isUnlocked])

  const handleMove = useCallback(async (doc: Document, newCategory: DocumentCategory) => {
    const ok = await updateDocument(doc.id, { category: newCategory })
    if (ok) {
      // Optimistically update panel's own document list so category filter updates immediately
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, category: newCategory } : d))
    } else {
      logger.warn('documents.move.error', { id: doc.id, category: newCategory })
    }
  }, [updateDocument])

  const handleFillComplete = useCallback(({ filled, total }: { filled: number; total: number }) => {
    const msg = `Filled ${filled} of ${total} field${total !== 1 ? 's' : ''}`
    setFillToast(msg)
    setTimeout(() => setFillToast(null), 4000)
  }, [])

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
    // Refresh document list so hasAnnotations flag updates
    setEditingDoc(null)
    setEditSource(null)
    // Re-trigger document fetch by toggling viewMode (same trick used elsewhere)
    setViewMode(prev => {
      // Force re-render with same value — use a dummy toggle then back via timeout
      return prev
    })
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
  }, [editingDoc, updateAnnotations, user?.id])

  const handleEditCancel = useCallback(() => {
    setEditingDoc(null)
    setEditSource(null)
  }, [])

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"?`)) {
      return
    }

    try {
      await deleteFile(doc.id)
      setDocuments(documents.filter((d) => d.id !== doc.id))
    } catch (err) {
      console.error('Failed to delete document:', err)
      alert('Failed to delete document.')
    }
  }

  // Tab switch handler: uniform — all three tabs set both the local render var
  // (viewMode) and the durable context truth (panelParams.subtab) so they can
  // never desync. The sync effect at L477-482 remains the entry point for
  // sidebar/deep-link alias switching (setActivePanel → effect → viewMode); its
  // viewMode !== tab guard makes it a no-op when we already set viewMode here.
  const handleTabSwitch = useCallback((tab: 'documents' | 'resources' | 'forms') => {
    logger.info('nav.subtab.switch', { panel: 'documents', subtab: tab })
    track('nav_subtab', { panel: 'documents', subtab: tab })
    setViewMode(tab)
    setPanelParams((prev) => ({ ...prev, subtab: tab }))
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', tab === 'forms' ? '#forms' : '#documents')
    }
  }, [setPanelParams])

  // ARIA roving tabindex keyboard handler for the Documents tablist
  const handleDocsTabKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIdx: number
  ) => {
    const tabs: Array<'documents' | 'resources' | 'forms'> = ['documents', 'resources', 'forms']
    let next = currentIdx
    if (e.key === 'ArrowRight') { e.preventDefault(); next = (currentIdx + 1) % tabs.length }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next = (currentIdx - 1 + tabs.length) % tabs.length }
    else if (e.key === 'Home') { e.preventDefault(); next = 0 }
    else if (e.key === 'End') { e.preventDefault(); next = tabs.length - 1 }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabSwitch(tabs[currentIdx]); return }
    else return
    const tabEls = (e.currentTarget.closest('[role="tablist"]') as HTMLElement | null)?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabEls?.[next]?.focus()
    handleTabSwitch(tabs[next])
  }, [handleTabSwitch])

  // Inline PDF edit mode — full-panel annotator
  if (editingDoc && editSource) {
    return (
      <VaultGuard onDismiss={handleEditCancel}>
        <>
          {fillToast && (
            <div
              role="status"
              aria-live="polite"
              data-testid="pdf-fill-toast"
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-lime-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg"
            >
              {fillToast}
            </div>
          )}
          <PdfAnnotator
            file={editSource.file}
            initialAnnotations={editSource.annotations}
            onSave={handleEditSave}
            onCancel={handleEditCancel}
            autofillValues={autofillValues}
            onFillComplete={handleFillComplete}
          />
        </>
      </VaultGuard>
    )
  }

  return (
    <div className="h-full flex flex-col" data-testid="documents-panel">
      {/* View Toggle — ARIA tablist (W3C APG Tabs) */}
      <div
        role="tablist"
        aria-label="Documents & Forms sections"
        className="flex gap-2 mb-4 border-b border-stone-200 pb-3"
      >
        <button
          role="tab"
          id="docs-tab-documents"
          data-testid="docs-tab-documents"
          aria-selected={viewMode === 'documents'}
          aria-controls="docs-panel-documents"
          tabIndex={viewMode === 'documents' ? 0 : -1}
          onClick={() => handleTabSwitch('documents')}
          onKeyDown={(e) => handleDocsTabKeyDown(e, 0)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'documents'
              ? 'bg-lime-100 text-lime-800'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            My Documents
          </span>
        </button>
        <button
          role="tab"
          id="docs-tab-resources"
          data-testid="docs-tab-resources"
          aria-selected={viewMode === 'resources'}
          aria-controls="docs-panel-resources"
          tabIndex={viewMode === 'resources' ? 0 : -1}
          onClick={() => handleTabSwitch('resources')}
          onKeyDown={(e) => handleDocsTabKeyDown(e, 1)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'resources'
              ? 'bg-lime-100 text-lime-800'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <Bookmark className="w-4 h-4" />
            My Resources
            {savedResources.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-lime-200 text-lime-800">
                {savedResources.length}
              </span>
            )}
          </span>
        </button>
        <button
          role="tab"
          id="docs-tab-forms"
          data-testid="docs-tab-forms"
          aria-selected={viewMode === 'forms'}
          aria-controls="docs-panel-forms"
          tabIndex={viewMode === 'forms' ? 0 : -1}
          onClick={() => handleTabSwitch('forms')}
          onKeyDown={(e) => handleDocsTabKeyDown(e, 2)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'forms'
              ? 'bg-lime-100 text-lime-800'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Forms
          </span>
        </button>
      </div>

      {viewMode === 'forms' ? (
        /* Forms sub-tab — FormsPanel owns its own scroll; min-h-0 is required
           so the flex child can scroll without double-scroll / zero-height collapse */
        <div
          role="tabpanel"
          id="docs-panel-forms"
          aria-labelledby="docs-tab-forms"
          tabIndex={0}
          className="flex-1 min-h-0"
        >
          <FormsPanel />
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
          <FolderSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            documentCounts={documentCounts}
          />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header with Search */}
            <DocumentsHeader
              documentCount={filteredDocuments.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            {/* Download error banner — surfaces timeout / network errors from the hook */}
            {downloadError && (
              <Alert variant="destructive" className="mb-4" role="alert" data-testid="doc-download-error">
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span>{downloadError}</span>
                  <button
                    onClick={clearDownloadError}
                    className="shrink-0 text-xs underline"
                    aria-label="Dismiss error"
                  >
                    Dismiss
                  </button>
                </AlertDescription>
              </Alert>
            )}

            {/* Encrypted Upload Zone */}
            <div ref={uploadZoneRef}>
              <EncryptedUpload
                category={activeCategory === 'all' ? 'other' : activeCategory}
                onUploadComplete={handleUploadComplete}
                className="mb-6"
              />
            </div>

            {/* Category Tabs (Mobile/Tablet) */}
            <div className="lg:hidden">
              <CategoryTabs
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                documentCounts={documentCounts}
              />
            </div>

            {/* Documents Grid/List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                </div>
              ) : filteredDocuments.length === 0 ? (
                <EmptyState
                  category={activeCategory}
                  searchQuery={searchQuery}
                  onUploadClick={() => uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDocuments.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onView={handleView}
                      onDownload={handleDownload}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onRename={handleRenameOpen}
                      onMove={handleMove}
                      isDownloading={downloadingId === doc.id}
                    />
                  ))}
                </div>
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
          {resourcesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            </div>
          ) : savedResources.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-stone-700">No saved resources yet</h3>
              <p className="text-sm text-stone-500 mt-1">
                Save resources from the chat or map to access them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(resourcesByCategory).map(([category, resources]) => (
                <div key={category} className="border border-stone-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-lime-700" />
                      <span className="font-medium text-stone-800">{category}</span>
                      <span className="text-xs text-stone-500">({resources.length})</span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 transition-transform ${
                        expandedCategory === category ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedCategory === category && (
                    <div className="divide-y divide-stone-100">
                      {resources.map((resource) => (
                        <div
                          key={resource.id}
                          data-testid={`saved-resource-${resource.id}`}
                          className="px-4 py-3 hover:bg-stone-50 cursor-pointer"
                          onClick={() => setSelectedResourceId(resource.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-stone-900 text-sm">{resource.resource_name}</h4>
                              {resource.resource_address && (
                                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  {resource.resource_address}
                                </p>
                              )}
                              {resource.resource_phone && (
                                <a
                                  href={`tel:${resource.resource_phone}`}
                                  className="text-xs text-lime-700 hover:underline mt-0.5 flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="w-3 h-3 flex-shrink-0" />
                                  {resource.resource_phone}
                                </a>
                              )}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {resource.resource_website && (
                                <a
                                  href={resource.resource_website.startsWith('http') ? resource.resource_website : `https://${resource.resource_website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-stone-500 hover:text-lime-700 hover:bg-lime-50 transition-colors"
                                  title="Visit website"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {resource.resource_address && (
                                <a
                                  href={`https://maps.google.com/?q=${encodeURIComponent(resource.resource_address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg text-stone-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                  title="Get directions"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MapPin className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); removeResource(resource.id) }}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove from saved"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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

      {/* Rename dialog */}
      {renameDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rename document"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid="rename-dialog"
        >
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-stone-900 mb-4">Rename Document</h3>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setRenameDoc(null)
              }}
              placeholder="Document name"
              className="mb-3"
              data-testid="rename-input"
              autoFocus
            />
            {renameError && (
              <p className="text-xs text-red-600 mb-3" role="alert">{renameError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRenameDoc(null)}
                disabled={renameLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRenameSubmit}
                disabled={renameLoading || !renameDraft.trim()}
                data-testid="rename-submit-btn"
                className="bg-[#4a5d23] hover:bg-[#3d4d1d] text-white"
              >
                {renameLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Rename
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
