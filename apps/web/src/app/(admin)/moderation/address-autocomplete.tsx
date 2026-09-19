'use client'

// Live address autocomplete for the resource edit/approve dialog (W2). Renders
// a debounced text input backed by Mapbox Geocoding v6 (client browser token
// NEXT_PUBLIC_MAPBOX_TOKEN, referer-restricted). Typing shows suggestions;
// selecting one autofills the address parts and hands the classified match to
// the parent for the move-only-on-strong-match accuracy gate. Free typing
// (no selection) still saves via the dialog's on-save geocode fallback.
//
// The suggestion list renders inline (absolutely positioned inside the dialog),
// never in a separate portal, so interacting with it counts as a click INSIDE
// the dialog — it can never trip the dialog's outside-close path (W1).

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { logger } from '@/lib/logger'
import { suggestAddressesV6, type AddressSuggestion } from '@/lib/mapbox-geocode-v6'

const DEBOUNCE_MS = 300
const MIN_QUERY_LEN = 3

export interface AddressAutocompleteProps {
  value: string
  /** Fired on free typing — the parent owns the address_line1 field. */
  onChange: (value: string) => void
  /** Fired when a suggestion is chosen — parent autofills parts + coords. */
  onSelect: (suggestion: AddressSuggestion) => void
  disabled?: boolean
  className?: string
}

export function AddressAutocomplete({
  value, onChange, onSelect, disabled, className,
}: AddressAutocompleteProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Monotonic request id — a later query invalidates any in-flight earlier one,
  // so a slow response can never overwrite suggestions for newer input.
  const reqSeq = useRef(0)
  // Set true the instant a suggestion is picked so the effect that reacts to the
  // value change (now the selected text) does not immediately re-query it.
  const justSelected = useRef(false)

  const listboxId = useId()

  const runSearch = useCallback(async (q: string) => {
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      const results = await suggestAddressesV6(q, token, { limit: 5 })
      if (seq !== reqSeq.current) return // a newer query superseded this one
      setSuggestions(results)
      setOpen(results.length > 0)
      setActive(results.length > 0 ? 0 : -1)
    } catch (err) {
      // suggestAddressesV6 already swallows failures to []; this is belt-and-suspenders.
      if (seq === reqSeq.current) { setSuggestions([]); setOpen(false); setActive(-1) }
      logger.warn('admin.resource.address_autocomplete.error', {
        message: err instanceof Error ? err.message : 'unknown',
      })
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [token])

  // Debounced search on typed value. Skips the fetch right after a selection
  // (the value became the chosen address) and for sub-threshold queries.
  useEffect(() => {
    if (justSelected.current) { justSelected.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < MIN_QUERY_LEN) {
      reqSeq.current++ // invalidate any in-flight request
      setSuggestions([]); setOpen(false); setActive(-1); setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => { void runSearch(q) }, DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, runSearch])

  // Close the list when the pointer goes down outside this widget. Only closes
  // the local list — never the dialog (the click is inside the dialog content).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const choose = useCallback((s: AddressSuggestion) => {
    justSelected.current = true
    reqSeq.current++ // invalidate any in-flight request so it can't reopen the list
    setOpen(false)
    setSuggestions([])
    setActive(-1)
    onSelect(s)
  }, [onSelect])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      if (active >= 0 && active < suggestions.length) {
        e.preventDefault()
        choose(suggestions[active])
      }
    } else if (e.key === 'Escape') {
      // Close only the suggestion list; stop the event so Radix does not also
      // close the whole dialog on this keystroke.
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      setActive(-1)
    }
  }

  const activeId = active >= 0 && suggestions[active]
    ? `${listboxId}-opt-${active}`
    : undefined

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          className={className ?? 'text-stone-900'}
          placeholder="Start typing an address…"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-stone-400"
            aria-hidden="true" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // pointerdown (not click) so selection wins over the document
              // pointerdown listener that would otherwise close the list first.
              onPointerDown={(e) => { e.preventDefault(); choose(s) }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${
                i === active ? 'bg-lime-50 text-stone-900' : 'text-stone-700'
              }`}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
