'use client'

// apps/web/src/app/(admin)/moderation/petition-export-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Moderation › Community: a platform admin picks an approved petition and downloads its signatures
// as a CSV for the organizer. The server route builds the file (four columns, lib/petition-csv.ts),
// enforces the platform-admin gate, writes the admin_actions row and the admin.petition.export
// event. Here: the picker, one single-flight download button (aria-busy while it works), one status
// line ("Preparing CSV…", then the count) and one always-mounted alert region (load or download
// failure). The section carries the admin's language (lang/dir); petition titles are member text of
// unknown language, so the picker carries lang="" dir="auto". Copy: lib/i18n-admin-petitions.ts.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { privilegedFetch } from '@/lib/privileged-action'
import { dir, type Locale } from '@/lib/i18n'
import { formatMessage } from '@/lib/format-message'
import { adminPetitionsT, petitionExportErrorKey } from '@/lib/i18n-admin-petitions'
import { IDLE_UI, finishedUi, runPetitionExport, startedUi, type ExportUi } from './petition-export-run'

export interface PetitionOption {
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

export interface PetitionExportViewProps {
  locale: Locale
  pickerId: string
  petitions: PetitionOption[] | null
  loadFailed: boolean
  selectedId: string
  ui: ExportUi
  onSelect: (id: string) => void
  onDownload: () => void
}

/** The section's markup from its state alone (no data access), so it renders in tests. */
export function PetitionExportView({ locale, pickerId, petitions, loadFailed, selectedId, ui, onSelect, onDownload }: PetitionExportViewProps) {
  const t = (key: Parameters<typeof adminPetitionsT>[1]) => adminPetitionsT(locale, key)
  const selected = petitions?.find((p) => p.id === selectedId) ?? null
  const alertText = loadFailed ? t('loadFailed') : ui.error

  return (
    <section
      lang={locale}
      dir={dir(locale)}
      aria-labelledby={`${pickerId}-heading`}
      className="rounded-xl border border-stone-200 bg-white p-4 sm:p-6 space-y-3"
    >
      <h2 id={`${pickerId}-heading`} className="text-base font-semibold text-stone-900">
        {t('heading')}
      </h2>
      <p className="text-sm text-stone-600">{t('intro')}</p>
      <p className="text-sm text-stone-600">{t('columnsNote')}</p>
      <p className="text-sm text-amber-800">{t('lockNote')}</p>

      {loadFailed ? null : petitions === null ? (
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
              lang=""
              dir="auto"
              value={selectedId}
              onChange={(e) => onSelect(e.target.value)}
              className="h-10 min-w-0 rounded-md border border-stone-500 bg-white px-3 text-sm text-stone-900"
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
            aria-busy={ui.busy}
            aria-disabled={ui.busy || !selected}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md bg-lime-700 px-4 text-sm font-medium text-white hover:bg-lime-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-600 focus-visible:ring-offset-2${selected ? '' : ' opacity-70'}`}
          >
            {ui.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {ui.busy ? t('downloading') : t('download')}
          </button>
        </div>
      )}

      {selected?.exported_at && <p className="text-xs text-stone-500">{t('alreadyLocked')}</p>}
      <p role="status" className="text-sm text-stone-700">{ui.status}</p>
      <div role="alert" className="text-sm text-red-700">{alertText}</div>
    </section>
  )
}

export function PetitionExportSection({ locale }: { locale: Locale }) {
  const supabase = useMemo(() => createClient(), [])
  const pickerId = useId()

  const [petitions, setPetitions] = useState<PetitionOption[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [ui, setUi] = useState<ExportUi>(IDLE_UI)
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

  const onDownload = async () => {
    const selected = petitions?.find((p) => p.id === selectedId)
    if (!selected || inFlight.current) return
    setUi(startedUi(adminPetitionsT(locale, 'downloading')))
    const result = await runPetitionExport(inFlight, selected.id, {
      post: async (url) => (await privilegedFetch('admin.petition.export', url, { method: 'POST' })).response,
      save: saveFile,
      now: () => new Date(),
    })
    setUi((current) =>
      finishedUi(current, result, {
        downloaded: (count) => formatMessage(adminPetitionsT(locale, 'downloaded'), { count }),
        error: (code) => adminPetitionsT(locale, petitionExportErrorKey(code)),
      }),
    )
    if (result.status === 'done') {
      const lockedAt = new Date().toISOString()
      setPetitions((prev) => prev?.map((p) => (p.id === selected.id ? { ...p, exported_at: p.exported_at ?? lockedAt } : p)) ?? prev)
    }
  }

  return (
    <PetitionExportView
      locale={locale}
      pickerId={pickerId}
      petitions={petitions}
      loadFailed={loadFailed}
      selectedId={selectedId}
      ui={ui}
      onSelect={(id) => {
        setSelectedId(id)
        setUi((current) => (current.busy ? current : IDLE_UI))
      }}
      onDownload={onDownload}
    />
  )
}
