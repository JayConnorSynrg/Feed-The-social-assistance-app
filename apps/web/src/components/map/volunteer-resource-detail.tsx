'use client'

import { useState } from 'react'
import { User, MessageSquare, MapPin, Clock, Phone, X, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useConversations } from '@/hooks/use-conversations'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface VolunteerResourceDetailProps {
  resource: {
    id: string
    name: string
    description?: string | null
    category: string
    phone?: string | null
    address_line1?: string | null
    eligibility_requirements?: string | null
    hours_of_operation?: Record<string, string> | null
    submitted_by?: string | null
  }
  onClose: () => void
  onNavigateToMessages?: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  housing: 'Housing',
  employment: 'Jobs',
  transportation: 'Transportation',
  legal: 'Legal',
  other: 'General',
  healthcare: 'Healthcare',
  education: 'Education',
}

export function VolunteerResourceDetail({ resource, onClose, onNavigateToMessages }: VolunteerResourceDetailProps) {
  const { user } = useAuth()
  const { sendRequest, error: convError } = useConversations()
  const [messageDialogOpen, setMessageDialogOpen] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const isOwnResource = resource.submitted_by === user?.id
  const categoryLabel = CATEGORY_LABELS[resource.category] ?? resource.category

  const handleSendRequest = async () => {
    if (!messageText.trim() || !resource.submitted_by) return
    setIsSending(true)
    setSendError(null)

    const result = await sendRequest(resource.id, resource.submitted_by, messageText.trim())
    setIsSending(false)

    if (result) {
      setRequestSent(true)
      setMessageText('')
      setTimeout(() => {
        setMessageDialogOpen(false)
        setRequestSent(false)
      }, 2000)
    } else if (convError) {
      setSendError(convError)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <User className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-800 text-sm">{resource.name}</h3>
            <div className="flex gap-1.5 mt-1">
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">
                Volunteer
              </Badge>
              <Badge variant="outline" className="text-xs">
                {categoryLabel}
              </Badge>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="text-sm text-stone-600 leading-relaxed">{resource.description}</p>
      )}

      {/* Contact */}
      {resource.phone && (
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Phone className="w-4 h-4 text-stone-400" />
          <span>{resource.phone}</span>
        </div>
      )}

      {/* Directions */}
      {resource.address_line1 && (
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <MapPin className="w-4 h-4 text-stone-400" />
          <span>{resource.address_line1}</span>
        </div>
      )}

      {/* Availability */}
      {resource.eligibility_requirements && (
        <div className="flex items-center gap-2 text-sm text-stone-600">
          <Clock className="w-4 h-4 text-stone-400" />
          <span>{resource.eligibility_requirements}</span>
        </div>
      )}

      {/* Message Button */}
      {!isOwnResource && (
        <Button
          onClick={() => { setMessageDialogOpen(true); setSendError(null); setRequestSent(false) }}
          className="w-full bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Message {resource.name.split(' ')[0]}
        </Button>
      )}

      {/* Message Request Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          {requestSent ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Send className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-800">Request sent!</h3>
              <p className="text-sm text-stone-500 text-center">
                {resource.name.split(' ')[0]} will be notified. You&apos;ll hear back when they accept.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Send a message request</DialogTitle>
                <DialogDescription>
                  {resource.name.split(' ')[0]} will see your message and can choose to accept the conversation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Introduce yourself and describe what help you need..."
                  className="min-h-[120px] text-stone-900 placeholder:text-stone-400"
                  maxLength={2000}
                />
                <p className="text-xs text-stone-400 text-right">{messageText.length}/2000</p>
                {sendError && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3">{sendError}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setMessageDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSendRequest}
                  disabled={isSending || !messageText.trim()}
                  className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Request
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
