'use client'

import { useState } from 'react'
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  ExternalLink,
  AlertCircle,
  Shield
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface FederatedResourceDetailProps {
  resource: {
    id: string
    name: string
    description: string | null
    category: string
    address_line1: string | null
    city: string | null
    state: string | null
    zip_code: string | null
    phone: string | null
    email?: string | null
    website: string | null
    hours_of_operation?: unknown
    latitude: number | null
    longitude: number | null
    source: 'local' | 'federated'
    source_instance_id?: string
    source_instance_name?: string
    source_instance_url?: string
    trust_score: number
    trust_level?: string
    last_synced_at?: string
    updated_at: string
  }
  onClose?: () => void
  onReport?: (resourceId: string, reason: string) => void
}

export function formatHoursOfOperation(hours: unknown): string[] {
  if (!hours) {
    return ['Hours not available']
  }

  try {
    if (typeof hours === 'string') {
      return [hours]
    }

    if (typeof hours === 'object' && hours !== null) {
      const hoursObj = hours as Record<string, string>
      const formattedHours: string[] = []

      const dayMap: Record<string, string> = {
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun',
      }

      Object.entries(hoursObj).forEach(([day, time]) => {
        const dayName = dayMap[day.toLowerCase()] || day
        formattedHours.push(`${dayName}: ${time}`)
      })

      return formattedHours.length > 0 ? formattedHours : ['Hours not available']
    }

    return ['Hours not available']
  } catch (error) {
    return ['Hours not available']
  }
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  const days = Math.floor(diffInSeconds / 86400)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function getTrustLevelColor(trustLevel?: string): string {
  switch (trustLevel?.toLowerCase()) {
    case 'high':
      return 'border-green-500'
    case 'medium':
      return 'border-yellow-500'
    case 'low':
      return 'border-orange-500'
    default:
      return 'border-gray-300'
  }
}

function getTrustBadgeVariant(trustLevel?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (trustLevel?.toLowerCase()) {
    case 'high':
      return 'default'
    case 'medium':
      return 'secondary'
    case 'low':
      return 'outline'
    default:
      return 'outline'
  }
}

export function FederatedResourceDetail({ resource, onClose, onReport }: FederatedResourceDetailProps) {
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportNotes, setReportNotes] = useState('')

  const isFederated = resource.source === 'federated'
  const borderClass = isFederated ? getTrustLevelColor(resource.trust_level) : 'border-gray-200'

  const fullAddress = [
    resource.address_line1,
    resource.city,
    resource.state,
    resource.zip_code,
  ]
    .filter(Boolean)
    .join(', ')

  const googleMapsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`
    : null

  const sourceUrl = isFederated && resource.source_instance_url
    ? `${resource.source_instance_url}/resources/${resource.id}`
    : null

  const handleReportSubmit = () => {
    if (reportReason && onReport) {
      const fullReason = reportNotes
        ? `${reportReason}: ${reportNotes}`
        : reportReason
      onReport(resource.id, fullReason)
      setIsReportDialogOpen(false)
      setReportReason('')
      setReportNotes('')
    }
  }

  const hoursArray = formatHoursOfOperation(resource.hours_of_operation)

  return (
    <Card className={`border-2 ${borderClass}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-2xl">{resource.name}</CardTitle>
            <CardDescription className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{resource.category}</Badge>
              {isFederated ? (
                <Badge variant="secondary">
                  {resource.source_instance_name || 'Federated'}
                </Badge>
              ) : (
                <Badge>Local</Badge>
              )}
              {resource.trust_level && (
                <Badge variant={getTrustBadgeVariant(resource.trust_level)}>
                  <Shield className="mr-1 h-3 w-3" />
                  {resource.trust_level} Trust ({resource.trust_score}/100)
                </Badge>
              )}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {resource.description && (
          <div>
            <p className="text-sm text-gray-700">{resource.description}</p>
          </div>
        )}

        {(resource.phone || resource.email || resource.website) && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Contact Information</h3>
            <div className="space-y-2">
              {resource.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <a
                    href={`tel:${resource.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {resource.phone}
                  </a>
                </div>
              )}
              {resource.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <a
                    href={`mailto:${resource.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {resource.email}
                  </a>
                </div>
              )}
              {resource.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <a
                    href={resource.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Visit Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {fullAddress && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Location</h3>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-gray-700">{fullAddress}</p>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs flex items-center gap-1 mt-1"
                  >
                    View on Map
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {hoursArray[0] !== 'Hours not available' && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900">Hours of Operation</h3>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                {hoursArray.map((hour, index) => (
                  <p key={index} className="text-gray-700">
                    {hour}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {isFederated && (
          <div className="rounded-lg bg-blue-50 p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Federated Resource
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                This resource is shared from{' '}
                <strong>{resource.source_instance_name || 'a partner instance'}</strong>.
              </p>
              {resource.last_synced_at && (
                <p className="text-xs text-gray-600">
                  Last synced: {getRelativeTime(resource.last_synced_at)}
                </p>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                >
                  View original resource
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <AlertCircle className="mr-2 h-4 w-4" />
                Report incorrect data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Resource Issue</DialogTitle>
                <DialogDescription>
                  Help us keep resource information accurate by reporting issues.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <select
                    id="reason"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="">Select a reason...</option>
                    <option value="Outdated information">Outdated information</option>
                    <option value="Incorrect address">Incorrect address</option>
                    <option value="Wrong phone number">Wrong phone number</option>
                    <option value="Resource no longer exists">Resource no longer exists</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (optional)</Label>
                  <textarea
                    id="notes"
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-h-[100px]"
                    placeholder="Provide any additional details..."
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReportDialogOpen(false)
                    setReportReason('')
                    setReportNotes('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReportSubmit}
                  disabled={!reportReason}
                >
                  Submit Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
