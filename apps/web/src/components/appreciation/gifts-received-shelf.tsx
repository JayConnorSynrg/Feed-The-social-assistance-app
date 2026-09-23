'use client'

// apps/web/src/components/appreciation/gifts-received-shelf.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The signed-in user's "Gifts received" shelf for Settings → Profile (P2.1b). Each received
// item shows its pixel icon, a count, and (owner-only, via RLS) the giver names. Empty state
// "No gifts yet"; loading + error/Retry states mirror the badges card. Owner-only: the read
// is RLS-scoped to receiver_id = the caller.

import { useState, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { PixelItemIcon } from '@/components/appreciation/pixel-item-icon'
import { myReceivedShelf, type ShelfEntry } from '@/lib/appreciation'

export function GiftsReceivedShelf({ userId }: { userId?: string | null }) {
  const supabase = createClient()
  const [shelf, setShelf] = useState<ShelfEntry[]>([])
  const [loading, setLoading] = useState<boolean>(Boolean(userId))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setShelf([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await myReceivedShelf(supabase, userId)
    if (res.ok) {
      setShelf(res.shelf)
    } else {
      setError(res.error)
    }
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    // load() sets loading/error/shelf on mount; matches the repo's badges-card loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <div
      className="rounded-xl border border-stone-200 bg-stone-50/95 p-4 text-stone-900"
      data-testid="gifts-received-shelf"
    >
      <h3 className="mb-3 text-sm font-semibold text-stone-500">Gifts received</h3>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-stone-600">
          <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-hidden="true" />
          <span>Loading your gifts…</span>
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-stone-600">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : shelf.length === 0 ? (
        <p className="text-sm text-stone-500">No gifts yet — appreciation from the community shows up here.</p>
      ) : (
        <ul className="flex flex-wrap gap-3" data-testid="gifts-received-list">
          {shelf.map((entry) => (
            <li
              key={entry.slug}
              className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2"
              data-testid={`gift-received-${entry.slug}`}
            >
              <PixelItemIcon slug={entry.slug} size={32} title={entry.label} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  {entry.label} <span className="text-stone-500">×{entry.count}</span>
                </p>
                <p className="truncate text-xs text-stone-500">
                  from {formatGivers(entry.givers.map((g) => g.name))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "Ada", "Ada & Ben", "Ada, Ben & 3 others". Owner-only names (RLS-scoped). */
function formatGivers(names: string[]): string {
  const unique = names.slice(0, 3)
  if (names.length === 0) return 'the community'
  if (names.length === 1) return unique[0]
  if (names.length === 2) return `${unique[0]} & ${unique[1]}`
  if (names.length === 3) return `${unique[0]}, ${unique[1]} & ${unique[2]}`
  return `${unique[0]}, ${unique[1]} & ${names.length - 2} others`
}
