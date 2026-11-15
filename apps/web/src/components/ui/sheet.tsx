"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { guardOutsideClose } from "@/components/ui/dialog-guards"

// Sheet is a right-slide-out drawer built on @radix-ui/react-dialog.
// Matches the existing dialog.tsx conventions (same Radix primitive, same
// overlay, same Tailwind data-state animation approach).

const Sheet = DialogPrimitive.Root

const SheetTrigger = DialogPrimitive.Trigger

const SheetClose = DialogPrimitive.Close

const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = "SheetOverlay"

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: "right"
  /** Extra classes for the backdrop (e.g. a lighter tint so the page behind stays visible). */
  overlayClassName?: string
  /** When set, an outside click / pointer-down-outside does NOT dismiss the sheet. Escape and the
   *  close button stay intentional close paths (same contract as DialogContent). */
  disableOutsideClose?: boolean
  /** Omit the built-in close button (the caller renders its own). */
  hideDefaultClose?: boolean
  /** Screen-reader name of the default close button, in the sheet's language. Without it — or
   *  with an empty one — the name is the English "Close", marked lang="en" so a translated sheet
   *  does not mislabel it and the button is never left unnamed (same contract as DialogContent). */
  closeLabel?: string
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "right", overlayClassName, disableOutsideClose, hideDefaultClose, closeLabel, onPointerDownOutside, onInteractOutside, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col bg-background shadow-lg transition ease-in-out",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        // Right-side slide
        side === "right" && [
          "inset-y-0 right-0 h-full w-80 max-w-[85vw]",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          "duration-300",
        ],
        className
      )}
      onPointerDownOutside={guardOutsideClose(disableOutsideClose, onPointerDownOutside)}
      onInteractOutside={guardOutsideClose(disableOutsideClose, onInteractOutside)}
      lang="en"
      dir="ltr"
      {...props}
    >
      {children}
      {!hideDefaultClose && (
        <DialogPrimitive.Close className="absolute end-3 top-3 rounded-sm p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only" lang={closeLabel ? undefined : 'en'}>{closeLabel || 'Close'}</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = "SheetContent"

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-stone-900", className)}
    {...props}
  />
))
SheetTitle.displayName = "SheetTitle"

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
}
