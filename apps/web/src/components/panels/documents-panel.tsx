'use client'

// apps/web/src/components/panels/documents-panel.tsx
// Documents Panel - Secure document management for uploaded files
// Supports drag-and-drop upload, categorization, and document actions

import React, { useState, useCallback, useEffect } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EncryptedUpload } from '@/components/documents/encrypted-upload'
import { useEncryptedUpload } from '@/hooks/use-encrypted-upload'
import { useAuthContext } from '@/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'

// ============================================
// TYPES
// ============================================
type DocumentCategory = 'all' | 'id' | 'income' | 'residence' | 'medical' | 'other'

interface Document {
  id: string
  name: string
  type: 'pdf' | 'image' | 'word'
  category: DocumentCategory
  size: number // in bytes
  uploadedAt: Date
  thumbnailUrl?: string
  isEncrypted?: boolean
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
  other: { label: 'Other', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-600' },
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
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
  const categories: DocumentCategory[] = ['all', 'id', 'income', 'residence', 'medical', 'other']

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
  const categories: DocumentCategory[] = ['all', 'id', 'income', 'residence', 'medical', 'other']

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
  onDelete: (doc: Document) => void
  isDownloading?: boolean
}

function DocumentCard({ document, onView, onDownload, onDelete, isDownloading }: DocumentCardProps) {
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
            <span className="text-xs text-stone-400">
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
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(document)}
            className="h-8 w-8 text-stone-500 hover:text-[#4a5d23] hover:bg-[#4a5d23]/10"
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(document)}
            className="h-8 w-8 text-stone-500 hover:text-red-600 hover:bg-red-50"
            disabled={isDownloading}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
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
}

function EmptyState({ category, searchQuery }: EmptyStateProps) {
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
      <Button className="gap-2">
        <Plus className="w-4 h-4" />
        Upload Document
      </Button>
    </div>
  )
}

// ============================================
// MAIN DOCUMENTS PANEL
// ============================================
export function DocumentsPanel({ userId }: DocumentsPanelProps) {
  const { user } = useAuthContext()
  const { downloadFile, deleteFile, isDownloading } = useEncryptedUpload()
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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

        const mappedDocs: Document[] = (data || []).map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.mime_type?.includes('pdf') ? 'pdf' : doc.mime_type?.includes('image') ? 'image' : 'word',
          category: (doc.category || 'other') as DocumentCategory,
          size: doc.original_size || doc.file_size || 0,
          uploadedAt: new Date(doc.created_at || Date.now()),
          isEncrypted: doc.is_encrypted || false,
        }))

        setDocuments(mappedDocs)
      } catch (err) {
        console.error('Failed to load documents:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()
  }, [user?.id])

  // Calculate document counts per category
  const documentCounts = documents.reduce<Record<DocumentCategory, number>>(
    (acc, doc) => {
      acc.all += 1
      acc[doc.category] += 1
      return acc
    },
    { all: 0, id: 0, income: 0, residence: 0, medical: 0, other: 0 }
  )

  // Filter documents based on category and search
  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory = activeCategory === 'all' || doc.category === activeCategory
    const matchesSearch = searchQuery === '' ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

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
        const mappedDocs: Document[] = data.map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.mime_type?.includes('pdf') ? 'pdf' : doc.mime_type?.includes('image') ? 'image' : 'word',
          category: (doc.category || 'other') as DocumentCategory,
          size: doc.original_size || doc.file_size || 0,
          uploadedAt: new Date(doc.created_at || Date.now()),
          isEncrypted: doc.is_encrypted || false,
        }))
        setDocuments(mappedDocs)
      }
    }

    loadDocuments()
  }, [user?.id])

  const handleView = async (doc: Document) => {
    // Download and view in new tab
    try {
      setDownloadingId(doc.id)
      const file = await downloadFile(doc.id)
      const url = URL.createObjectURL(file)
      window.open(url, '_blank')
      // Clean up object URL after some time
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      console.error('Failed to view document:', err)
      alert('Failed to view document. Please ensure your vault is unlocked.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownload = async (doc: Document) => {
    try {
      setDownloadingId(doc.id)
      const file = await downloadFile(doc.id)

      // Create download link
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download document:', err)
      alert('Failed to download document. Please ensure your vault is unlocked.')
    } finally {
      setDownloadingId(null)
    }
  }

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

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
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

        {/* Encrypted Upload Zone */}
        <EncryptedUpload
          category={activeCategory === 'all' ? 'other' : activeCategory}
          onUploadComplete={handleUploadComplete}
          className="mb-6"
        />

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
            <EmptyState category={activeCategory} searchQuery={searchQuery} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={handleView}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isDownloading={downloadingId === doc.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
