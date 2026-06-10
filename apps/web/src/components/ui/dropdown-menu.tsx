/**
 * Minimal dropdown-menu primitives.
 *
 * Implements the shadcn/ui DropdownMenu API surface used by documents-panel:
 *   DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem.
 *
 * Built on a controlled div overlay — no extra Radix package required.
 */

'use client'

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { cn } from '@/lib/utils'

// ── Context ──────────────────────────────────────────────────────────────────

interface DropdownCtx {
  open: boolean
  setOpen: (v: boolean) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const DropdownContext = createContext<DropdownCtx>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
})

// ── Root ─────────────────────────────────────────────────────────────────────

interface DropdownMenuProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({ children, open: controlledOpen, onOpenChange }: DropdownMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v)
      onOpenChange?.(v)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>{children}</div>
    </DropdownContext.Provider>
  )
}

// ── Trigger ───────────────────────────────────────────────────────────────────

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  children: React.ReactNode
}

export function DropdownMenuTrigger({ children, asChild, onClick, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useContext(DropdownContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setOpen(!open)
    onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation()
        setOpen(!open)
      },
    })
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

interface DropdownMenuContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'center'
  sideOffset?: number
}

export function DropdownMenuContent({
  children,
  className,
  align = 'end',
}: DropdownMenuContentProps) {
  const { open, setOpen } = useContext(DropdownContext)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const alignStyle: React.CSSProperties =
    align === 'end' ? { right: 0 } : align === 'start' ? { left: 0 } : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-stone-200 bg-white py-1 shadow-md',
        'top-full mt-1',
        className
      )}
      style={alignStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  destructive?: boolean
}

export function DropdownMenuItem({
  children,
  className,
  destructive,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = useContext(DropdownContext)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen(false)
    onClick?.(e)
  }

  return (
    <button
      role="menuitem"
      type="button"
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 focus:bg-stone-100 focus:outline-none',
        destructive && 'text-red-600 hover:bg-red-50',
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Separator (bonus) ─────────────────────────────────────────────────────────

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-1 h-px bg-stone-100', className)} />
}
