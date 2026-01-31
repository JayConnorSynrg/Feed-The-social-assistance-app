'use client'

// apps/web/src/components/documents/document-viewer.tsx
// Document viewer and list components

import React, { useState, useEffect } from 'react'
import { type Document, type DocumentCategory, getCategoryInfo } from '@/hooks/use-documents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DocumentCardProps {
  document: Document
  onView: (doc: Document) => void
  onDelete: (id: string) => void
  getUrl: (filePath: string) => Promise<string | null>
}

export function DocumentCard({ document, onView, onDelete, getUrl }: DocumentCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const categoryInfo = getCategoryInfo(document.category)

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDelete = async () => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      await onDelete(document.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const isImage = document.file_type.startsWith('image/')
  const isPdf = document.file_type === 'application/pdf'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Thumbnail/Icon */}
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-2xl flex-shrink-0">
            {isImage ? '🖼️' : isPdf ? '📑' : '📄'}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{document.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {categoryInfo.icon} {categoryInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatSize(document.file_size)}
              </span>
            </div>
            {document.description && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {document.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Uploaded {new Date(document.uploaded_at).toLocaleDateString()}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(document)}
            >
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              {isDeleting ? '...' : 'Delete'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Document Viewer Modal
interface DocumentViewerModalProps {
  document: Document | null
  url: string | null
  onClose: () => void
}

export function DocumentViewerModal({ document, url, onClose }: DocumentViewerModalProps) {
  if (!document) return null

  const isImage = document.file_type.startsWith('image/')
  const isPdf = document.file_type === 'application/pdf'

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">{document.name}</h3>
            <p className="text-sm text-muted-foreground">
              {getCategoryInfo(document.category).label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <a
                href={url}
                download={document.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  Download
                </Button>
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-muted/50">
          {!url ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : isImage ? (
            <img
              src={url}
              alt={document.name}
              className="max-w-full max-h-full mx-auto object-contain"
            />
          ) : isPdf ? (
            <iframe
              src={url}
              title={document.name}
              className="w-full h-full min-h-[600px] rounded"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-muted-foreground mb-4">
                Preview not available for this file type
              </p>
              <a href={url} download={document.name} target="_blank" rel="noopener noreferrer">
                <Button>Download File</Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Document List organized by category
interface DocumentListProps {
  documents: Document[]
  onView: (doc: Document) => void
  onDelete: (id: string) => void
  getUrl: (filePath: string) => Promise<string | null>
  isLoading?: boolean
}

export function DocumentList({
  documents,
  onView,
  onDelete,
  getUrl,
  isLoading,
}: DocumentListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-muted rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">📁</div>
          <p className="text-muted-foreground">No documents uploaded yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onView={onView}
          onDelete={onDelete}
          getUrl={getUrl}
        />
      ))}
    </div>
  )
}

// Documents organized by category
interface DocumentsByCategoryProps {
  documents: Document[]
  onView: (doc: Document) => void
  onDelete: (id: string) => void
  getUrl: (filePath: string) => Promise<string | null>
}

export function DocumentsByCategory({
  documents,
  onView,
  onDelete,
  getUrl,
}: DocumentsByCategoryProps) {
  const categories: DocumentCategory[] = ['identity', 'income', 'residence', 'medical', 'other']

  const documentsByCategory = categories.reduce((acc, category) => {
    acc[category] = documents.filter(d => d.category === category)
    return acc
  }, {} as Record<DocumentCategory, Document[]>)

  return (
    <div className="space-y-6">
      {categories.map(category => {
        const categoryDocs = documentsByCategory[category]
        const info = getCategoryInfo(category)

        if (categoryDocs.length === 0) return null

        return (
          <div key={category}>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>{info.icon}</span>
              {info.label}
              <span className="text-sm font-normal text-muted-foreground">
                ({categoryDocs.length})
              </span>
            </h3>
            <div className="space-y-2">
              {categoryDocs.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onView={onView}
                  onDelete={onDelete}
                  getUrl={getUrl}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
