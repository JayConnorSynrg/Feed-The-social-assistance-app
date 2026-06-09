'use client'

/**
 * HazardBubbleMenu — right-slide-out Sheet with all hazard report actions
 * plus the role-gated "Add yourself as a resource" entry.
 *
 * ALL roles see the 4 hazard types.
 * "Add yourself as a resource" is ONLY rendered when user_role is sourcer/provider
 * (same gate as VolunteerResourceFAB: ['providing', 'facilitator', 'both']).
 *
 * The place flow works on the current map center (viewCenter prop).
 * The dialog for each type is a minimal form: severity select + description textarea.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  Cloud,
  Construction,
  Gauge,
  Plus,
  ShieldAlert,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import type { PlaceAlertInput } from '@/hooks/use-safety-alerts'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AlertType = 'weather' | 'road_closure' | 'speeding' | 'general'

interface HazardEntry {
  type: AlertType
  label: string
  icon: React.FC<{ className?: string }>
  testId: string
  description: string
}

const HAZARD_ENTRIES: HazardEntry[] = [
  {
    type: 'weather',
    label: 'Report weather hazard',
    icon: Cloud,
    testId: 'hazard-weather',
    description: 'Ice, flooding, high winds, downed branches, etc.',
  },
  {
    type: 'road_closure',
    label: 'Report road closure',
    icon: Construction,
    testId: 'hazard-road-closure',
    description: 'Blocked road, bridge out, construction, accident.',
  },
  {
    type: 'speeding',
    label: 'Report speeding area',
    icon: Gauge,
    testId: 'hazard-speeding',
    description: 'Vehicles exceeding safe speed near pedestrians.',
  },
  {
    type: 'general',
    label: 'Report general safety issue',
    icon: AlertTriangle,
    testId: 'hazard-general',
    description: 'Other safety concern in this area.',
  },
]

const SEVERITY_OPTIONS = [
  { value: '1', label: 'Low — heads-up' },
  { value: '2', label: 'Moderate — use caution' },
  { value: '3', label: 'High — significant risk' },
  { value: '4', label: 'Critical — avoid area' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface HazardBubbleMenuProps {
  /** Current map center — used as the pin location */
  viewCenter: { lng: number; lat: number }
  onPlaceAlert: (input: PlaceAlertInput) => Promise<unknown>
  /** Called when user taps "Add yourself as a resource" (reuses existing FAB handler) */
  onAddResource: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner place-hazard dialog
// ─────────────────────────────────────────────────────────────────────────────

interface PlaceDialogProps {
  entry: HazardEntry | null
  viewCenter: { lng: number; lat: number }
  onPlace: (input: PlaceAlertInput) => Promise<unknown>
  onClose: () => void
}

function PlaceHazardDialog({ entry, viewCenter, onPlace, onClose }: PlaceDialogProps) {
  const [severity, setSeverity] = useState<string>('2')
  const [description, setDescription] = useState('')
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entry) return
    setPlacing(true)
    setError(null)
    try {
      await onPlace({
        type: entry.type,
        severity: parseInt(severity, 10),
        description,
        lng: viewCenter.lng,
        lat: viewCenter.lat,
      })
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setDescription('')
        setSeverity('2')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place alert')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry && <entry.icon className="w-4 h-4 text-amber-600" />}
            {entry?.label}
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="py-6 text-center text-sm text-stone-700">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="font-medium">Alert placed at map center.</p>
            <p className="text-stone-500 text-xs mt-1">Visible to neighbors immediately.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-stone-500">{entry?.description}</p>
            <p className="text-xs text-stone-400">
              Pin will be placed at the current map center.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="hazard-severity" className="text-sm text-stone-800">
                Severity
              </Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="hazard-severity" className="text-stone-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hazard-description" className="text-sm text-stone-800">
                Description <span className="text-stone-400">(optional)</span>
              </Label>
              <Textarea
                id="hazard-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details neighbors should know..."
                className="text-stone-900 placeholder:text-stone-400 resize-none"
                rows={3}
              />
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                disabled={placing}
              >
                {placing ? 'Placing...' : 'Report hazard'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function HazardBubbleMenu({ viewCenter, onPlaceAlert, onAddResource }: HazardBubbleMenuProps) {
  const { profile } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeEntry, setActiveEntry] = useState<HazardEntry | null>(null)

  // Role gate for "add yourself as a resource" — mirrors VolunteerResourceFAB
  const isProvider = ['providing', 'facilitator', 'both'].includes(profile?.user_role ?? '')

  const handleHazardEntryClick = (entry: HazardEntry) => {
    setSheetOpen(false)
    setActiveEntry(entry)
  }

  const handlePlaceAndClose = async (input: PlaceAlertInput) => {
    await onPlaceAlert(input)
  }

  return (
    <>
      {/* FAB trigger */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <button
            className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg flex items-center justify-center transition-colors z-10"
            aria-label="Report a hazard or add a resource"
            data-testid="hazard-menu-trigger"
          >
            <ShieldAlert className="w-5 h-5" />
          </button>
        </SheetTrigger>

        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Safety &amp; Resources</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-2 px-6 pb-6">
            {/* Hazard entries — ALL roles */}
            {HAZARD_ENTRIES.map((entry) => (
              <button
                key={entry.type}
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50 text-left transition-colors"
                onClick={() => handleHazardEntryClick(entry)}
                data-testid={entry.testId}
              >
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <entry.icon className="w-4 h-4 text-amber-700" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">{entry.label}</p>
                  <p className="text-xs text-stone-500">{entry.description}</p>
                </div>
              </button>
            ))}

            {/* Divider */}
            <hr className="my-2 border-stone-200" />

            {/* Add resource — providers/sourcers only */}
            {isProvider && (
              <button
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:border-lime-300 hover:bg-lime-50 text-left transition-colors"
                onClick={() => {
                  setSheetOpen(false)
                  onAddResource()
                }}
                data-testid="add-resource-entry"
              >
                <span className="w-8 h-8 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-lime-700" />
                </span>
                <div>
                  <p className="text-sm font-medium text-stone-900">Add yourself as a resource</p>
                  <p className="text-xs text-stone-500">Share what you can offer with neighbors.</p>
                </div>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Place-hazard dialog — shown when an entry is selected */}
      <PlaceHazardDialog
        entry={activeEntry}
        viewCenter={viewCenter}
        onPlace={handlePlaceAndClose}
        onClose={() => setActiveEntry(null)}
      />
    </>
  )
}
