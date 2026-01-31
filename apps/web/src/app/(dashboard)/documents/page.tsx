'use client'

// apps/web/src/app/(dashboard)/documents/page.tsx
// Documents management page

import React, { useState } from 'react'
import { DashboardHeader, MobileNav } from '@/components/dashboard/dashboard-layout'
import { DocumentUpload } from '@/components/documents/document-upload'
import {
  DocumentsByCategory,
  DocumentViewerModal,
} from '@/components/documents/document-viewer'
import { useDocuments, type Document, type DocumentCategory } from '@/hooks/use-documents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const CATEGORY_INFO: Record<DocumentCategory, { label: string; icon: string }> = {
  identity: { label: 'Identification', icon: '🪪' },
  income: { label: 'Income Verification', icon: '💵' },
  residence: { label: 'Proof of Residence', icon: '🏠' },
  medical: { label: 'Medical Records', icon: '🏥' },
  other: { label: 'Other Documents', icon: '📄' },
}

export default function DocumentsPage() {
  const {
    documents,
    isLoading,
    uploadDocument,
    deleteDocument,
    getDocumentUrl,
  } = useDocuments()

  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<DocumentCategory | 'all'>('all')

  // Handle document view
  const handleViewDocument = async (doc: Document) => {
    setViewingDocument(doc)
    const url = await getDocumentUrl(doc.file_path)
    setDocumentUrl(url)
  }

  // Handle document upload
  const handleUploadDocument = async (file: File, category: string, description?: string) => {
    await uploadDocument(file, category as DocumentCategory, undefined, description)
  }

  // Get documents by category
  const getDocumentsByCategory = (category: DocumentCategory) => {
    return documents.filter(d => d.category === category)
  }

  // Get filtered documents
  const filteredDocuments = activeCategory === 'all'
    ? documents
    : documents.filter(d => d.category === activeCategory)

  // Get category counts
  const categoryCounts = Object.keys(CATEGORY_INFO).reduce((acc, cat) => {
    acc[cat as DocumentCategory] = getDocumentsByCategory(cat as DocumentCategory).length
    return acc
  }, {} as Record<DocumentCategory, number>)

  return (
    <div className="pb-20 md:pb-0">
      <DashboardHeader
        title="My Documents"
        description="Securely store and organize your important documents"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
            >
              All ({documents.length})
            </Button>
            {(Object.keys(CATEGORY_INFO) as DocumentCategory[]).map(category => (
              <Button
                key={category}
                variant={activeCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(category)}
              >
                {CATEGORY_INFO[category].icon} {CATEGORY_INFO[category].label} ({categoryCounts[category]})
              </Button>
            ))}
          </div>

          {/* Documents Display */}
          {activeCategory === 'all' ? (
            <DocumentsByCategory
              documents={documents}
              onView={handleViewDocument}
              onDelete={deleteDocument}
              getUrl={getDocumentUrl}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{CATEGORY_INFO[activeCategory].icon}</span>
                  {CATEGORY_INFO[activeCategory].label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="animate-pulse h-16 bg-muted rounded" />
                    ))}
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">{CATEGORY_INFO[activeCategory].icon}</div>
                    <p className="text-muted-foreground">
                      No {CATEGORY_INFO[activeCategory].label.toLowerCase()} documents yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-lg border hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {doc.file_type.includes('pdf') ? '📕' :
                             doc.file_type.includes('image') ? '🖼️' : '📄'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{doc.name}</h4>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {doc.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(doc.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteDocument(doc.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUpload onUpload={handleUploadDocument} />
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>💡</span> Document Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>
                <strong>Keep documents organized</strong> by category for easy access during applications.
              </p>
              <p>
                <strong>Accepted formats:</strong> PDF, JPG, PNG (max 10MB)
              </p>
              <p>
                <strong>Common documents needed:</strong>
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Government-issued ID</li>
                <li>Proof of income (pay stubs, tax returns)</li>
                <li>Utility bills or lease agreement</li>
                <li>Medical records or prescriptions</li>
              </ul>
            </CardContent>
          </Card>

          {/* Storage Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Documents stored</span>
                <span className="font-medium">{documents.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Your documents are encrypted and securely stored.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={viewingDocument}
        url={documentUrl}
        onClose={() => {
          setViewingDocument(null)
          setDocumentUrl(null)
        }}
      />

      <MobileNav />
    </div>
  )
}
