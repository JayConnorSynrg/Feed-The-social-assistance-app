'use client'

import React, { useState } from 'react'
import {
  Plus, Utensils, Home, Briefcase, Car, Scale, Heart,
  Calculator, Gavel, Baby, Trash2, Tent, Gift,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useVolunteerResource } from '@/hooks/use-volunteer-resource'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { type VolunteerCategory, getCategoryLabel } from '@/lib/resource-categories'

// Re-export so callers that typed ResourceCategory still compile
type ResourceCategory = VolunteerCategory

const CATEGORIES: { icon: React.ElementType; value: ResourceCategory }[] = [
  { icon: Utensils, value: 'food' },
  { icon: Home, value: 'housing' },
  { icon: Briefcase, value: 'employment' },
  { icon: Car, value: 'transportation' },
  { icon: Scale, value: 'legal' },
  { icon: Calculator, value: 'eitc_tax_filing' },
  { icon: Gavel, value: 'free_legal' },
  { icon: Baby, value: 'prenatal_natal_care' },
  { icon: Trash2, value: 'waste_disposal' },
  { icon: Tent, value: 'free_camping' },
  { icon: Gift, value: 'free_goods_donation' },
  { icon: Heart, value: 'other' },
]

const volunteerFormSchema = z.object({
  description: z.string().min(10, 'Please describe what you can offer (at least 10 characters)').max(500),
  contact: z.string().optional(),
  directions: z.string().optional(),
  availability: z.string().optional(),
})

type VolunteerFormData = z.infer<typeof volunteerFormSchema>

interface VolunteerResourceFABProps {
  /** When true, the category speed-dial opens (controlled externally). */
  externalOpen?: boolean
  /** Called when external-open state changes (e.g. backdrop click). */
  onExternalOpenChange?: (open: boolean) => void
}

export function VolunteerResourceFAB({ externalOpen, onExternalOpenChange }: VolunteerResourceFABProps = {}) {
  const { profile } = useAuth()
  const { setActivePanel } = usePanelContext()
  const { registerResource, isRegistering, hasLocation } = useVolunteerResource()

  const [isOpenInternal, setIsOpenInternal] = useState(false)
  const isOpen = externalOpen ?? isOpenInternal
  const setIsOpen = (v: boolean) => {
    setIsOpenInternal(v)
    onExternalOpenChange?.(v)
  }
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerFormSchema),
  })

  const isProvider = ['providing', 'facilitator', 'both'].includes(profile?.user_role ?? '')
  if (!isProvider) return null

  const handleCategoryClick = (category: ResourceCategory) => {
    setSelectedCategory(category)
    setIsOpen(false)
    setDialogOpen(true)
    setSuccess(false)
    reset()
  }

  const onSubmit = async (data: VolunteerFormData) => {
    if (!selectedCategory) return
    const result = await registerResource({
      category: selectedCategory,
      description: data.description,
      contact: data.contact,
      directions: data.directions,
      availability: data.availability,
    })
    if (result) {
      setSuccess(true)
      setTimeout(() => {
        setDialogOpen(false)
        setSuccess(false)
        setActivePanel('map')
      }, 2000)
    }
  }

  const categoryLabel = selectedCategory ? getCategoryLabel(selectedCategory) : ''

  return (
    <>
      {/* Speed Dial Container */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-3">
        {/* Speed Dial Items */}
        {CATEGORIES.map((cat, index) => (
          <div
            key={cat.value}
            className={`flex items-center gap-3 transition-all duration-200 ease-out ${
              isOpen
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
            style={{ transitionDelay: isOpen ? `${index * 40}ms` : '0ms' }}
          >
            <span className="text-sm font-medium text-stone-700 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
              {getCategoryLabel(cat.value)}
            </span>
            <button
              onClick={() => handleCategoryClick(cat.value)}
              className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-[#4a5d23] hover:bg-stone-50 transition-colors border border-stone-200/50"
            >
              <cat.icon className="w-5 h-5" />
            </button>
          </div>
        ))}

        {/* Main FAB Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Add volunteer resource"
          aria-expanded={isOpen}
          className={`w-14 h-14 rounded-full bg-[#4a5d23] hover:bg-[#3d4d1c] text-white shadow-lg flex items-center justify-center transition-all duration-200 ${
            isOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Backdrop when speed dial is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Registration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-800">You&apos;re on the map!</h3>
              <p className="text-sm text-stone-500 text-center">
                Your {categoryLabel.toLowerCase()} resource has been added. Others can now find and message you.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Register as a Volunteer Resource</DialogTitle>
                <DialogDescription>
                  Add yourself to the map so others can find your help.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm text-stone-600">Category</Label>
                    <Badge className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                      {categoryLabel}
                    </Badge>
                  </div>

                  {!hasLocation && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-sm text-amber-700">
                        Set your location in Settings to appear on the map.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-stone-700">
                      What can you offer? <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the help you can provide..."
                      className="text-stone-900 placeholder:text-stone-400"
                      {...register('description')}
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500">{errors.description.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact" className="text-stone-700">Contact info</Label>
                    <Input
                      id="contact"
                      placeholder="Phone, email, or other way to reach you"
                      className="text-stone-900 placeholder:text-stone-400"
                      {...register('contact')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="directions" className="text-stone-700">Directions / Location</Label>
                    <Input
                      id="directions"
                      placeholder="Where to find you or how to get there"
                      className="text-stone-900 placeholder:text-stone-400"
                      {...register('directions')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="availability" className="text-stone-700">Availability</Label>
                    <Input
                      id="availability"
                      placeholder="e.g., Weekdays 9am-5pm, By appointment"
                      className="text-stone-900 placeholder:text-stone-400"
                      {...register('availability')}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isRegistering}
                    className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                  >
                    {isRegistering ? 'Adding...' : 'Add to Map'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
