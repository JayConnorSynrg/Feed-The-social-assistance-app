'use client'

// apps/web/src/components/settings/language-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Settings › Language. The list shows the language in effect — the in-memory profile's (or, for a
// guest, this device's) — so it reads the same after the section or the panel re-mounts. Save
// commits a new choice through useAuth().saveLanguage (lib/language-save.ts): every translated
// surface switches at once, and a failed save puts the previous language back and says so. Each
// language is listed by its own name, in its own language. The section itself reads in the
// viewer's language (lib/i18n-settings-language.ts).

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Globe, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useDeviceLocale, useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, isLocale, type Locale } from '@/lib/i18n'
import { settingsLanguageT } from '@/lib/i18n-settings-language'
import { splitMessage } from '@/lib/format-message'
import { LANGUAGES } from '@/lib/languages'
import { rememberDeviceLocale } from '@/lib/device-locale'
import { saveDeviceLanguage } from '@/lib/language-save'

export type LanguageSaveStatus = 'saved' | 'savedDevice' | 'failed' | null

/** The choice the picker shows: the profile's stored code, else this device's, else the locale. */
export function languagePickerValue(isGuest: boolean, profile: object | null, device: string | null, locale: Locale): string {
  const stored = isGuest ? null : (profile as { preferred_language?: string | null } | null)?.preferred_language
  return stored || device || locale
}

/** A language's own name and the lang it is written in; 'other' in the viewer's language. */
function ownName(code: string, locale: Locale): { name: string; lang: Locale } {
  if (!isLocale(code)) return { name: settingsLanguageT(locale, 'otherLanguage'), lang: locale }
  const entry = LANGUAGES.find((l) => l.code === code)
  return { name: entry?.nativeName ?? code, lang: code }
}

function NamedLanguage({ template, code, locale }: { template: string; code: string; locale: Locale }) {
  const [before, after] = splitMessage(template, 'language')
  const { name, lang } = ownName(code, locale)
  return (
    <>
      {before}
      <span lang={lang} dir={dir(lang)}>{name}</span>
      {after}
    </>
  )
}

/**
 * What the last save did, in two live regions that stay in the tree (a region added or shown
 * only with its message may never be announced). Success in the language now in effect (the new
 * one); failure in the language in effect after the save was taken back (the old one), naming it.
 */
export function SaveStatusLines({ locale, saving, status }: { locale: Locale; saving: boolean; status: LanguageSaveStatus }) {
  const t = (key: Parameters<typeof settingsLanguageT>[1]) => settingsLanguageT(locale, key)
  return (
    <div className="space-y-1">
      <p role="status" className="text-xs font-medium text-green-700">
        {saving ? t('saving') : status === 'saved' || status === 'savedDevice' ? t(status) : ''}
      </p>
      <p role="alert" data-testid="settings-language-failed" className="text-xs font-medium text-red-600">
        {status === 'failed' ? <NamedLanguage template={t('failed')} code={locale} locale={locale} /> : null}
      </p>
    </div>
  )
}

/**
 * Settings › Language. Choosing in the list changes nothing yet: Save commits the choice. A
 * select commits on every arrow-key press in some browsers (Windows), so saving on change would
 * save — and switch the whole app to — each language passed while browsing. The list stays
 * focusable while a save runs; Save is aria-disabled (still focusable, its handler ignores it)
 * while there is nothing new to save or a save is running.
 */
export function LanguageSection() {
  const { user, profile, isAnonymous, saveLanguage } = useAuth()
  const locale = useProfileLocale()
  const device = useDeviceLocale()
  const isGuest = isAnonymous || !user
  const value = languagePickerValue(isGuest, profile, device, locale)
  const t = (key: Parameters<typeof settingsLanguageT>[1]) => settingsLanguageT(locale, key)

  const headingId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<LanguageSaveStatus>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const shown = draft ?? value
  const canSave = !saving && draft !== null && draft !== value

  const save = async () => {
    if (!canSave || draft === null) return
    const code = draft
    clearTimeout(hideTimer.current)
    setStatus(null)
    setSaving(true)
    const ok = isGuest
      ? (await saveDeviceLanguage(rememberDeviceLocale, device, code)) === 'ok'
      : (await saveLanguage(code)) === 'ok'
    setSaving(false)
    if (!ok) {
      // The choice stays in the list for another try; the language in effect is the previous one.
      setStatus('failed')
      return
    }
    setDraft(null)
    setStatus(isGuest ? 'savedDevice' : 'saved')
    hideTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  return (
    <section lang={locale} dir={dir(locale)} aria-labelledby={headingId} className="mb-8">
      <div className="mb-4">
        <h3 id={headingId} className="font-semibold text-lg mb-1">{t('heading')}</h3>
        <p className="text-sm text-stone-600">{t('description')}</p>
      </div>
      <form
        className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Globe aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
            <select
              data-testid="settings-language-select"
              aria-labelledby={headingId}
              value={shown}
              onChange={(e) => {
                setDraft(e.target.value === value ? null : e.target.value)
                setStatus(null)
              }}
              className="w-full ps-10 pe-10 py-2.5 rounded-lg border border-stone-500 bg-white text-stone-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#4a5d23]"
            >
              {LANGUAGES.map((l) => {
                const { name, lang } = ownName(l.code, locale)
                return (
                  <option key={l.code} value={l.code} lang={lang} dir={dir(lang)}>
                    {name}
                  </option>
                )
              })}
            </select>
            <ChevronDown aria-hidden="true" className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600 pointer-events-none" />
          </div>
          <button
            type="submit"
            data-testid="settings-language-save"
            aria-disabled={!canSave}
            className="px-4 py-2.5 rounded-lg bg-[#4a5d23] text-white text-sm font-medium aria-disabled:opacity-60 aria-disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4a5d23]"
          >
            {t('save')}
          </button>
          {saving && <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-stone-500" />}
        </div>
        {isGuest && <p className="text-xs text-stone-600">{t('deviceOnly')}</p>}
        <SaveStatusLines locale={locale} saving={saving} status={status} />
      </form>
      {!isGuest && (
        <p className="text-xs text-stone-600 px-1">
          <NamedLanguage template={t('currently')} code={value} locale={locale} />
        </p>
      )}
    </section>
  )
}
