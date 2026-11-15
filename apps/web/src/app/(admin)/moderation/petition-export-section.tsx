'use client'

// apps/web/src/app/(admin)/moderation/petition-export-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Moderation › Community: a platform admin picks an approved petition and downloads its signatures
// as a CSV for the organizer. The server route builds the file (four columns, lib/petition-csv.ts),
// enforces the platform-admin gate, writes the admin_actions row and the admin.petition.export
// event. Here: the picker, one single-flight download button (aria-busy while it works), a status
// line for the result and an alert region for an error. Copy: lib/i18n-admin-petitions.ts.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { privilegedFetch } from '@/lib/privileged-action'
import type { Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { adminPetitionsT, petitionExportErrorKey } from '@/lib/i18n-admin-petitions'
import { runPetitionExport } from './petition-export-run'

interface PetitionOption {
  id: string
  title: string
  exported_at: string | null
}

function saveFile(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function PetitionExportSection({ locale }: { locale: Locale }) {
  const supabase = useMemo(() => createClient(), [])
  const t = (key: Parameters<typeof adminPetitionsT>[1]) => adminPetitionsT(locale, key)
  const pickerId = useId()

  const [petitions, setPetitions] = useState<PetitionOption[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('petitions')
      .select('id, title, exported_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data, error: loadErr }) => {
        if (cancelled) return
        if (loadErr) {
          setLoadFailed(true)
          return
        }
        const rows = data ?? []
        setPetitions(rows)
        setSelectedId((current) => current || rows[0]?.id || '')
      })
    return () => {
      cancelled = true
    }
  }, [supabase])

  const selected = petitions?.find((p) => p.id === selectedId) ?? null

  const onDownload = async () => {
    if (!selected) return
    setBusy(true)
    setStatus(null)
    setError(null)
    const result = await runPetitionExport(inFlight, selected.id, {
      post: async (url) => (await privilegedFetch('admin.petition.export', url, { method: 'POST' })).response,
      save: saveFile,
      now: () => new Date(),
    })
    if (result.status === 'busy') return
    setBusy(false)
    if (result.status === 'done') {
      setStatus(formatMessage(t('downloaded'), { count: result.rowCount }))
      const lockedAt = new Date().toISOString()
      setPetitions((prev) => prev?.map((p) => (p.id === selected.id ? { ...p, exported_at: p.exported_at ?? lockedAt } : p)) ?? prev)
    } else {
      setError(t(petitionExportErrorKey(result.code)))
    }
  }

  return (
    <section aria-labelledby={`${pickerId}-heading`} className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6 space-y-3">
      <h2 id={`${pickerId}-heading`} className="text-base font-semibold text-stone-900">
        {t('heading')}
      </h2>
      <p className="text-sm text-stone-600">{t('intro')}</p>
      <p className="text-sm text-stone-600">{t('columnsNote')}</p>
      <p className="text-sm text-amber-800">{t('lockNote')}</p>

      {loadFailed ? (
        <p role="alert" className="text-sm text-red-700">{t('loadFailed')}</p>
      ) : petitions === null ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : petitions.length === 0 ? (
        <p className="text-sm text-stone-500">{t('none')}</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={pickerId} className="text-sm font-medium text-stone-700">
              {t('petitionLabel')}
            </label>
            <select
              id={pickerId}
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setStatus(null)
                setError(null)
              }}
              className="h-10 min-w-0 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900"
            >
              {petitions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onDownload}
            aria-busy={busy}
            aria-disabled={busy || !selected}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-lime-700 px-4 text-sm font-medium text-white hover:bg-lime-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2 aria-disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {busy ? t('downloading') : t('download')}
          </button>
        </div>
      )}

      {selected?.exported_at && <p className="text-xs text-stone-500">{t('alreadyLocked')}</p>}
      <p role="status" className="text-sm text-stone-700">{status}</p>
      <div role="alert" className="text-sm text-red-700">{error}</div>
    </section>
  )
}
