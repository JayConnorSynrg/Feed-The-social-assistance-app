'use client'

// apps/web/src/components/panels/documents-panel.tsx
// Documents Panel - Secure document management for uploaded files
// Supports drag-and-drop upload, categorization, and document actions

import React, { useState, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
}

interface DocumentsPanelProps {
  userId?: string
}

// ============================================
// MOCK DATA
// ============================================
const MOCK_DOCUMENTS: Document[] = [
  {
    id: '1',
    name: 'Drivers_License.pdf',
    type: 'pdf',
    category: 'id',
    size: 245760, // 240 KB
    uploadedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
  },
  {
    id: '2',
    name: 'Pay_Stub_January.pdf',
    type: 'pdf',
    category: 'income',
    size: 156000, // 152 KB
    uploadedAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
  },
  {
    id: '3',
    name: 'Lease_Agreement_2025.pdf',
    type: 'pdf',
    category: 'residence',
    size: 1024000, // 1 MB
    uploadedAt: new Date(Date.now() - 86400000 * 10), // 10 days ago
  },
  {
    id: '4',
    name: 'Medical_Records.pdf',
    type: 'pdf',
    category: 'medical',
    size: 512000, // 500 KB
    uploadedAt: new Date(Date.now() - 86400000 * 15), // 15 days ago
  },
  {
    id: '5',
    name: 'Passport_Photo.jpg',
    type: 'image',
    category: 'id',
    size: 2048000, // 2 MB
    uploadedAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
  },
  {
    id: '6',
    name: 'Utility_Bill_December.png',
    type: 'image',
    category: 'residence',
    size: 890000, // 869 KB
    uploadedAt: new Date(Date.now() - 86400000 * 7), // 7 days ago
  },
]

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

// ============================================
// UPLOAD ZONE
// ============================================
interface UploadZoneProps {
  onUpload: (files: FileList) => void
}

function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files)
    }
  }, [onUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files)
    }
  }, [onUpload])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative mb-6 p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer
        ${isDragging
          ? 'border-[#4a5d23] bg-[#4a5d23]/5'
          : 'border-stone-300 bg-[#faf9f6] hover:border-[#4a5d23]/50 hover:bg-[#f5f3ee]'
        }
      `}
    >
      <input
        type="file"
        multiple
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
      />
      <div className="flex flex-col items-center text-center">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-colors
          ${isDragging ? 'bg-[#4a5d23] text-white' : 'bg-[#4a5d23]/10 text-[#4a5d23]'}
        `}>
          <Upload className="w-6 h-6" />
        </div>
        <p className="font-medium text-stone-900 mb-1">
          {isDragging ? 'Drop files here' : 'Upload Documents'}
        </p>
        <p className="text-xs text-stone-500">
          Drag and drop or click to browse. PDF, Images, Word files supported.
        </p>
      </div>
    </div>
  )
}

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
}

function DocumentCard({ document, onView, onDownload, onDelete }: DocumentCardProps) {
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
          <h3 className="font-medium text-sm text-stone-900 truncate mb-1">
            {document.name}
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
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(document)}
            className="h-8 w-8 text-stone-500 hover:text-[#4a5d23] hover:bg-[#4a5d23]/10"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(document)}
            className="h-8 w-8 text-stone-500 hover:text-red-600 hover:bg-red-50"
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
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS)
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Handlers
  const handleUpload = (files: FileList) => {
    const newDocs: Document[] = Array.from(files).map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      name: file.name,
      type: file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'word',
      category: 'other' as DocumentCategory,
      size: file.size,
      uploadedAt: new Date(),
    }))
    setDocuments([...newDocs, ...documents])
  }

  const handleView = (doc: Document) => {
    console.log('View document:', doc.name)
    // Placeholder for view functionality
  }

  const handleDownload = (doc: Document) => {
    console.log('Download document:', doc.name)
    // Placeholder for download functionality
  }

  const handleDelete = (doc: Document) => {
    setDocuments(documents.filter((d) => d.id !== doc.id))
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

        {/* Upload Zone */}
        <UploadZone onUpload={handleUpload} />

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
          {filteredDocuments.length === 0 ? (
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
