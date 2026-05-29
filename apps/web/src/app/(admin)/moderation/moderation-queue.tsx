'use client'

import { useState, useCallback } from 'react'
import { Check, X, Edit, MapPin, Phone, Globe, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Database } from '@feed/database'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'

// Resource categories
const RESOURCE_CATEGORIES = [
  { value: 'food', label: 'Food & Nutrition' },
  { value: 'housing', label: 'Housing & Shelter' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'substance_abuse', label: 'Substance Abuse' },
  { value: 'employment', label: 'Employment' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'utilities', label: 'Utilities Assistance' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'financial', label: 'Financial Assistance' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'senior_services', label: 'Senior Services' },
  { value: 'disability_services', label: 'Disability Services' },
  { value: 'veteran_services', label: 'Veteran Services' },
  { value: 'domestic_violence', label: 'Domestic Violence' },
  { value: 'immigration', label: 'Immigration Services' },
  { value: 'other', label: 'Other' },
] as const

interface PendingResource {
  id: string
  name: string
  description: string | null
  category: string
  address_line1: string | null
  city: string | null
  state: string | null
  phone: string | null
  website: string | null
  created_at: string
  submitted_by: string | null
}

interface ModerationQueueProps {
  initialResources: PendingResource[]
}

export function ModerationQueue({ initialResources }: ModerationQueueProps) {
  const [resources, setResources] = useState<PendingResource[]>(initialResources)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<PendingResource>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const supabase = createClient()

  const formatCategory = (category: string) => {
    const cat = RESOURCE_CATEGORIES.find((c) => c.value === category)
    return cat?.label || category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleApprove = useCallback(
    async (resourceId: string) => {
      setProcessingId(resourceId)
      try {
        // Apply any pending edits
        const updates = editingId === resourceId ? editData : {}

        const { error } = await supabase
          .from('resources')
          .update({ ...updates as Database['public']['Tables']['resources']['Update'], status: 'approved' })
          .eq('id', resourceId)

        if (error) throw error

        // Remove from list
        setResources((prev) => prev.filter((r) => r.id !== resourceId))
        setEditingId(null)
        setEditData({})
      } catch (error) {
        console.error('Error approving resource:', error)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase, editingId, editData]
  )

  const handleReject = useCallback(
    async (resourceId: string) => {
      setProcessingId(resourceId)
      try {
        const { error } = await supabase
          .from('resources')
          .update({ status: 'rejected' })
          .eq('id', resourceId)

        if (error) throw error

        // Remove from list
        setResources((prev) => prev.filter((r) => r.id !== resourceId))
      } catch (error) {
        console.error('Error rejecting resource:', error)
      } finally {
        setProcessingId(null)
      }
    },
    [supabase]
  )

  const handleStartEdit = useCallback((resource: PendingResource) => {
    setEditingId(resource.id)
    setEditData({
      name: resource.name,
      description: resource.description,
      category: resource.category,
      address_line1: resource.address_line1,
      city: resource.city,
      state: resource.state,
      phone: resource.phone,
      website: resource.website,
    })
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditData({})
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  if (resources.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">All caught up!</h3>
            <p className="text-muted-foreground mt-2">
              There are no pending resources to review at this time.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {resources.length} resource{resources.length !== 1 ? 's' : ''} pending review
      </p>

      {resources.map((resource) => {
        const isExpanded = expandedId === resource.id
        const isEditing = editingId === resource.id
        const isProcessing = processingId === resource.id

        return (
          <Card key={resource.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {formatCategory(resource.category)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(resource.created_at)}
                    </span>
                  </div>
                  <CardTitle className="mt-2">
                    {isEditing ? (
                      <Input
                        value={editData.name || ''}
                        onChange={(e) =>
                          setEditData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="font-bold"
                      />
                    ) : (
                      resource.name
                    )}
                  </CardTitle>
                  {resource.description && (
                    <CardDescription className="mt-1">
                      {isEditing ? (
                        <textarea
                          value={editData.description || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, description: e.target.value }))
                          }
                          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      ) : (
                        resource.description
                      )}
                    </CardDescription>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpand(resource.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                {/* Location */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {isEditing ? (
                      <div className="flex-1 grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Address"
                          value={editData.address_line1 || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, address_line1: e.target.value }))
                          }
                        />
                        <Input
                          placeholder="City"
                          value={editData.city || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, city: e.target.value }))
                          }
                        />
                        <Input
                          placeholder="State"
                          value={editData.state || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, state: e.target.value }))
                          }
                          maxLength={2}
                        />
                      </div>
                    ) : (
                      <span>
                        {[resource.address_line1, resource.city, resource.state]
                          .filter(Boolean)
                          .join(', ') || 'No address provided'}
                      </span>
                    )}
                  </div>

                  {/* Phone */}
                  {(resource.phone || isEditing) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          placeholder="Phone"
                          value={editData.phone || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, phone: e.target.value }))
                          }
                          className="flex-1"
                        />
                      ) : (
                        <span>{resource.phone}</span>
                      )}
                    </div>
                  )}

                  {/* Website */}
                  {(resource.website || isEditing) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {isEditing ? (
                        <Input
                          placeholder="Website"
                          value={editData.website || ''}
                          onChange={(e) =>
                            setEditData((prev) => ({ ...prev, website: e.target.value }))
                          }
                          className="flex-1"
                        />
                      ) : (
                        <a
                          href={resource.website || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {resource.website}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Category (edit mode) */}
                  {isEditing && (
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editData.category || ''}
                        onValueChange={(value) =>
                          setEditData((prev) => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOURCE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={() => handleApprove(resource.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Save & Approve
                      </Button>
                      <Button variant="outline" onClick={handleCancelEdit}>
                        Cancel Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleApprove(resource.id)}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStartEdit(resource)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(resource.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
