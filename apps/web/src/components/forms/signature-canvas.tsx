'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Eraser, Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface SignatureCanvasProps {
  onSignature: (dataUrl: string | null) => void
  initialValue?: string
  width?: number
  height?: number
  lineColor?: string
  lineWidth?: number
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Canvas-based signature capture component
 * Uses native Canvas API - zero external dependencies
 */
export function SignatureCanvas({
  onSignature,
  initialValue,
  width = 400,
  height = 150,
  lineColor = '#000000',
  lineWidth = 2,
  label = 'Signature',
  required = false,
  disabled = false,
  className,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)

  // Initialize canvas context
  const getContext = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  // Set up canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set up high DPI canvas
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    // Set drawing style
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth

    // Draw initial value if provided
    if (initialValue) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height)
        setHasSignature(true)
      }
      img.src = initialValue
    } else {
      // Draw signature line
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(20, height - 30)
      ctx.lineTo(width - 20, height - 30)
      ctx.stroke()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = lineWidth
    }
  }, [width, height, lineColor, lineWidth, initialValue])

  // Get point from event
  const getPoint = useCallback(
    (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    },
    []
  )

  // Start drawing
  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return
      e.preventDefault()

      const point = getPoint(e.nativeEvent)
      setIsDrawing(true)
      setLastPoint(point)
    },
    [disabled, getPoint]
  )

  // Continue drawing
  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return
      e.preventDefault()

      const ctx = getContext()
      if (!ctx || !lastPoint) return

      const point = getPoint(e.nativeEvent)

      ctx.beginPath()
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()

      setLastPoint(point)
      setHasSignature(true)
    },
    [isDrawing, disabled, getContext, lastPoint, getPoint]
  )

  // Stop drawing
  const stopDrawing = useCallback(() => {
    if (isDrawing && hasSignature) {
      const canvas = canvasRef.current
      if (canvas) {
        onSignature(canvas.toDataURL('image/png'))
      }
    }
    setIsDrawing(false)
    setLastPoint(null)
  }, [isDrawing, hasSignature, onSignature])

  // Clear signature
  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return

    // Clear and redraw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, height - 30)
    ctx.lineTo(width - 20, height - 30)
    ctx.stroke()

    // Reset stroke style
    ctx.strokeStyle = lineColor
    ctx.lineWidth = lineWidth

    setHasSignature(false)
    onSignature(null)
  }, [getContext, width, height, lineColor, lineWidth, onSignature])

  // Handle touch events
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleTouchMove = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault()
      }
    }

    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      canvas.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isDrawing])

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex gap-2">
          {hasSignature && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSignature}
              disabled={disabled}
              className="h-8"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="relative border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`touch-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair'}`}
          style={{ width: `${width}px`, height: `${height}px` }}
        />

        {/* Placeholder text */}
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm">Sign here</p>
          </div>
        )}

        {/* Signature indicator */}
        {hasSignature && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Check className="h-3 w-3 mr-1" />
              Signed
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Draw your signature above using your mouse or finger
      </p>
    </div>
  )
}

// ============================================
// Typed Signature Component
// ============================================

interface TypedSignatureProps {
  onSignature: (signature: string) => void
  initialValue?: string
  label?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * Text-based signature input (typed name)
 */
export function TypedSignature({
  onSignature,
  initialValue = '',
  label = 'Type Your Full Legal Name',
  required = false,
  disabled = false,
  placeholder = 'John Doe',
  className,
}: TypedSignatureProps) {
  const [value, setValue] = useState(initialValue)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setValue(newValue)
      onSignature(newValue)
    },
    [onSignature]
  )

  return (
    <div className={className}>
      <Label htmlFor="typed-signature">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="mt-2 p-4 border rounded-lg bg-muted/30">
        <input
          id="typed-signature"
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent border-none text-2xl italic font-serif focus:outline-none placeholder:text-muted-foreground/50"
          style={{ fontFamily: "'Brush Script MT', cursive, serif" }}
        />
        <div className="mt-2 border-b border-muted-foreground/30" />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        By typing your name above, you agree this is your legal signature
      </p>
    </div>
  )
}

// ============================================
// Combined Signature Field
// ============================================

type SignatureMode = 'draw' | 'type'

interface SignatureFieldProps {
  onSignature: (data: { mode: SignatureMode; value: string } | null) => void
  initialMode?: SignatureMode
  initialValue?: string
  label?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Combined signature field with draw and type options
 */
export function SignatureField({
  onSignature,
  initialMode = 'type',
  initialValue,
  label = 'Signature',
  required = false,
  disabled = false,
  className,
}: SignatureFieldProps) {
  const [mode, setMode] = useState<SignatureMode>(initialMode)
  const [signature, setSignature] = useState<string | null>(initialValue || null)

  const handleSignatureChange = useCallback(
    (value: string | null) => {
      setSignature(value)
      if (value) {
        onSignature({ mode, value })
      } else {
        onSignature(null)
      }
    },
    [mode, onSignature]
  )

  const switchMode = useCallback(
    (newMode: SignatureMode) => {
      setMode(newMode)
      setSignature(null)
      onSignature(null)
    },
    [onSignature]
  )

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex border rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => switchMode('type')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm ${
              mode === 'type'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Type
          </button>
          <button
            type="button"
            onClick={() => switchMode('draw')}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm ${
              mode === 'draw'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Draw
          </button>
        </div>
      </div>

      {mode === 'type' ? (
        <TypedSignature
          onSignature={handleSignatureChange}
          initialValue={typeof signature === 'string' ? signature : undefined}
          label=""
          required={false}
          disabled={disabled}
        />
      ) : (
        <SignatureCanvas
          onSignature={handleSignatureChange}
          initialValue={signature?.startsWith('data:') ? signature : undefined}
          label=""
          required={false}
          disabled={disabled}
        />
      )}
    </div>
  )
}
