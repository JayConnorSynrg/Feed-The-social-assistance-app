// apps/web/src/components/org-form/resource-directory.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Resource DIRECTORY picker for the admin organization form: browse, search, and filter the approved
// resource catalog and pick several, in order. Controlled (value/onChange). It renders as the BODY of
// a right-side panel; the parent owns the panel chrome (title, Back/Done) — no dialog lives here.
//
// Defaults to "resources near this org": the state select and city prefix start at the org's
// location. Results are an accessible checkbox group with an exact total and 50-row "Load more".

'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchDirectoryPage, type DirectoryResource } from '@/lib/resource-directory'
import { getCategoryTailwind } from '@/lib/resource-categories'
import { US_STATES, STATE_TO_ABBR, normalizeState } from '@/lib/us-states'
import { dir, type Locale } from '@/lib/i18n'
import { orgFormT, formatMessage, type OrgFormMessages } from '@/lib/i18n-org-forms'
import { categoryKey } from './org-labels'
import {
  applyClear,
  chipCategories,
  locationText,
  mergePage,
  moveSelected,
  removeSelected,
  toggleSelected,
  zeroResultActions,
  type ClearAction,
  type DirectoryUiFilters,
  type SelectedResource,
} from './resource-directory-model'

export type { SelectedResource } from './resource-directory-model'

export interface ResourceDirectoryProps {
  /** Linked resources, in display order. */
  value: SelectedResource[]
  onChange: (next: SelectedResource[]) => void
  /** The org's state (name or 2-letter code) — the initial state filter. */
  defaultState?: string | null
  /** The org's city — the initial city-prefix filter. */
  defaultCity?: string | null
  locale: Locale
  /** Focus the search box on mount (the panel opens the directory as a sub-view). */
  autoFocusSearch?: boolean
}

const DEBOUNCE_MS = 300

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
const FIELD =
  'h-10 w-full rounded-lg border border-stone-500 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-500 ' +
  FOCUS_RING
const SECONDARY_BUTTON =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-stone-500 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:opacity-50 ' +
  FOCUS_RING
const PRIMARY_BUTTON =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:bg-brand/60 ' +
  FOCUS_RING
const ICON_BUTTON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200 hover:text-stone-900 disabled:opacity-30 disabled:hover:bg-transparent ' +
  FOCUS_RING

const STATE_OPTIONS = US_STATES.map((name) => ({ name, code: STATE_TO_ABBR[name] }))

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

interface ResultState {
  key: string
  rows: DirectoryResource[]
  total: number
  hasMore: boolean
  error: boolean
}

export function ResourceDirectory({ value, onChange, defaultState, defaultCity, locale, autoFocusSearch }: ResourceDirectoryProps) {
  const supabase = useMemo(() => createClient(), [])
  const tr = useCallback((key: keyof OrgFormMessages) => orgFormT(locale, key), [locale])
  const uid = useId()
  const ids = {
    search: `${uid}-search`,
    state: `${uid}-state`,
    city: `${uid}-city`,
    category: `${uid}-category`,
    results: `${uid}-results`,
    tray: `${uid}-tray`,
  }

  const [filters, setFilters] = useState<DirectoryUiFilters>(() => ({
    q: '',
    state: normalizeState(defaultState ?? null) ?? '',
    city: (defaultCity ?? '').trim(),
    category: null,
  }))
  const debouncedQ = useDebouncedValue(filters.q, DEBOUNCE_MS)
  const debouncedCity = useDebouncedValue(filters.city, DEBOUNCE_MS)

  const query = useMemo(
    () => ({
      q: debouncedQ.trim(),
      state: filters.state || null,
      city: debouncedCity.trim() || null,
      category: filters.category,
    }),
    [debouncedQ, debouncedCity, filters.state, filters.category]
  )
  const [retryNonce, setRetryNonce] = useState(0)
  const requestKey = `${JSON.stringify(query)}#${retryNonce}`

  const [result, setResult] = useState<ResultState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDirectoryPage(supabase, query, 0).then(
      (page) => {
        if (cancelled) return
        setResult({ key: requestKey, rows: page.rows, total: page.total, hasMore: page.hasMore, error: false })
        setMoreError(false)
      },
      () => {
        if (cancelled) return
        setResult({ key: requestKey, rows: [], total: 0, hasMore: false, error: true })
      }
    )
    return () => {
      cancelled = true
    }
  }, [supabase, query, requestKey])

  const loading = result?.key !== requestKey
  // While a new query is in flight the previous rows stay visible (dimmed, aria-busy) to avoid flicker.
  const rows = result && !result.error ? result.rows : []
  const total = result && !loading ? result.total : 0
  const error = Boolean(result && !loading && result.error)

  const loadMore = async () => {
    if (!result || loading || loadingMore) return
    const key = result.key
    setLoadingMore(true)
    setMoreError(false)
    try {
      const page = await fetchDirectoryPage(supabase, query, result.rows.length)
      // After the merge, focus moves to the first newly loaded row (the button may unmount on the
      // last page).
      const shown = new Set(result.rows.map((r) => r.id))
      const firstNew = page.rows.find((r) => !shown.has(r.id))
      if (firstNew) focusRowAfterLoad.current = firstNew.id
      setResult((prev) =>
        prev && prev.key === key
          ? { ...prev, rows: mergePage(prev.rows, page.rows), total: page.total, hasMore: page.hasMore }
          : prev
      )
    } catch {
      setMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  // ---- selection ---------------------------------------------------------------------------------
  const selectedIds = useMemo(() => new Set(value.map((s) => s.id)), [value])
  const pendingFocus = useRef<string | null>(null)
  const trayHeadingRef = useRef<HTMLHeadingElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const focusRowAfterLoad = useRef<string | null>(null)
  const rowCheckboxId = (id: string) => `${uid}-row-${id}`

  useEffect(() => {
    if (autoFocusSearch) searchRef.current?.focus()
  }, [autoFocusSearch])

  useEffect(() => {
    const id = focusRowAfterLoad.current
    if (!id) return
    focusRowAfterLoad.current = null
    document.getElementById(rowCheckboxId(id))?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a merged page renders
  }, [result])

  // After a reorder/remove, restore focus to the moved item's control (or the tray heading).
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === 'tray') {
      trayHeadingRef.current?.focus()
      return
    }
    const el = document.getElementById(target) as HTMLButtonElement | null
    if (el && !el.disabled) {
      el.focus()
    } else {
      const sibling = target.endsWith('-up') ? target.replace(/-up$/, '-down') : target.replace(/-down$/, '-up')
      ;(document.getElementById(sibling) as HTMLButtonElement | null)?.focus()
    }
  }, [value])

  const trayButtonId = (id: string, action: 'up' | 'down') => `${uid}-sel-${id}-${action}`

  const move = (id: string, delta: -1 | 1) => {
    pendingFocus.current = trayButtonId(id, delta === -1 ? 'up' : 'down')
    onChange(moveSelected(value, id, delta))
  }
  const remove = (id: string) => {
    pendingFocus.current = 'tray'
    onChange(removeSelected(value, id))
  }

  // ---- filters -----------------------------------------------------------------------------------
  const clear = (action: ClearAction) => {
    setFilters((f) => applyClear(f, action))
    searchRef.current?.focus()
  }
  const catLabel = (c: string) => tr(categoryKey(c))
  const chips = useMemo(() => chipCategories((c) => tr(categoryKey(c)), locale), [tr, locale])
  const clearActions = zeroResultActions(filters)
  const clearLabel: Record<ClearAction, keyof OrgFormMessages> = {
    search: 'dirClearSearch',
    category: 'dirClearCategory',
    location: 'dirClearLocation',
  }

  const showing =
    !loading && !error && rows.length > 0
      ? formatMessage(tr('dirShowing'), { shown: rows.length.toLocaleString(locale), total: total.toLocaleString(locale) })
      : ''

  let status: string
  if (loading) status = tr('dirLoading')
  else if (error) status = tr('dirError')
  else if (total === 0) status = clearActions.length ? tr('dirNoMatch') : tr('dirEmpty')
  else status = formatMessage(tr('dirResultCount'), { count: total.toLocaleString(locale) })

  return (
    <div dir={dir(locale)} lang={locale} className="flex flex-col gap-5 text-stone-900">
      {/* ---- Selected tray ---- */}
      <section aria-labelledby={ids.tray} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
        <h3
          id={ids.tray}
          ref={trayHeadingRef}
          tabIndex={-1}
          className={`flex items-baseline justify-between gap-2 rounded text-sm font-semibold ${FOCUS_RING}`}
        >
          <span>{tr('dirSelectedTitle')}</span>
          <span className="text-xs font-medium text-stone-600">
            {formatMessage(tr('dirSelectedCount'), { count: value.length })}
          </span>
        </h3>
        {value.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">{tr('dirSelectedEmpty')}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5">
            {value.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white py-1 ps-3 pe-1"
              >
                <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>
                  {s.name}
                </span>
                <button
                  type="button"
                  id={trayButtonId(s.id, 'up')}
                  className={ICON_BUTTON}
                  aria-label={formatMessage(tr('dirMoveUp'), { name: s.name })}
                  disabled={i === 0}
                  onClick={() => move(s.id, -1)}
                >
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  id={trayButtonId(s.id, 'down')}
                  className={ICON_BUTTON}
                  aria-label={formatMessage(tr('dirMoveDown'), { name: s.name })}
                  disabled={i === value.length - 1}
                  onClick={() => move(s.id, 1)}
                >
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={formatMessage(tr('dirRemove'), { name: s.name })}
                  onClick={() => remove(s.id)}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ---- Search + location ---- */}
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor={ids.search} className="mb-1 block text-sm font-medium text-stone-800">
            {tr('dirSearchLabel')}
          </label>
          <input
            ref={searchRef}
            id={ids.search}
            type="search"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder={tr('dirSearchPlaceholder')}
            autoComplete="off"
            className={FIELD}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.state} className="mb-1 block text-sm font-medium text-stone-800">
              {tr('dirStateLabel')}
            </label>
            <select
              id={ids.state}
              value={filters.state}
              onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}
              className={FIELD}
            >
              <option value="">{tr('dirStateAll')}</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.city} className="mb-1 block text-sm font-medium text-stone-800">
              {tr('dirCityLabel')}
            </label>
            <input
              id={ids.city}
              type="text"
              value={filters.city}
              onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
              placeholder={tr('dirCityPlaceholder')}
              autoComplete="off"
              className={FIELD}
            />
          </div>
        </div>
      </div>

      {/* ---- Category chips (single-select) ---- */}
      <div role="group" aria-labelledby={ids.category}>
        <p id={ids.category} className="mb-1.5 text-sm font-medium text-stone-800">
          {tr('dirCategoryLabel')}
        </p>
        <div className="flex flex-wrap gap-2">
          {[null, ...chips].map((c) => {
            const pressed = filters.category === c
            return (
              <button
                key={c ?? 'all'}
                type="button"
                aria-pressed={pressed}
                onClick={() => setFilters((f) => ({ ...f, category: c }))}
                className={`inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-medium ${FOCUS_RING} ${
                  pressed
                    ? 'border-brand bg-brand text-white hover:bg-brand-hover'
                    : 'border-stone-500 bg-white text-stone-700 hover:bg-stone-100'
                }`}
              >
                {c ? catLabel(c) : tr('dirCategoryAll')}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- Results ---- */}
      <fieldset aria-busy={loading || loadingMore} aria-describedby={`${ids.results}-status`} className="min-w-0">
        <legend className="mb-1 text-sm font-semibold text-stone-900">{tr('dirResultsLegend')}</legend>
        <p id={`${ids.results}-status`} aria-live="polite" className="mb-2 text-sm text-stone-600">
          {status}
          {showing && <span className="sr-only">{` ${showing}`}</span>}
        </p>

        {error && (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setRetryNonce((n) => n + 1)}>
            {tr('dirRetry')}
          </button>
        )}

        {!loading && !error && total === 0 && clearActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {clearActions.map((a) => (
              <button key={a} type="button" className={SECONDARY_BUTTON} onClick={() => clear(a)}>
                {tr(clearLabel[a])}
              </button>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <ul
            className={`flex flex-col divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white ${
              loading ? 'opacity-60' : ''
            }`}
          >
            {rows.map((row) => {
              const where = locationText(row, tr('dirOnline'))
              return (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-stone-50">
                    <input
                      id={rowCheckboxId(row.id)}
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onChange(toggleSelected(value, row))}
                      className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-stone-900">{row.name}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${getCategoryTailwind(row.category)}`}
                        >
                          {catLabel(row.category)}
                        </span>
                        {where && <span>{where}</span>}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="mt-3 flex flex-col items-start gap-2">
            <p className="text-xs text-stone-600" aria-hidden="true">
              {showing}
            </p>
            {moreError && (
              <p role="alert" className="text-sm text-red-700">
                {tr('dirError')}
              </p>
            )}
            {result?.hasMore && (
              <button
                type="button"
                className={PRIMARY_BUTTON}
                aria-disabled={loadingMore || undefined}
                onClick={() => {
                  // Stays focusable while loading; loadMore itself ignores a second press.
                  if (!loadingMore) void loadMore()
                }}
              >
                {loadingMore ? tr('dirLoading') : moreError ? tr('dirRetry') : tr('dirLoadMore')}
              </button>
            )}
          </div>
        )}
      </fieldset>
    </div>
  )
}
