'use client'

// apps/web/src/components/settings/language-section.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Settings › Language. The picker shows the language in effect — the in-memory profile's (or, for
// a guest, this device's) — so it reads the same after the section or the panel re-mounts. A
// choice is saved through useAuth().saveLanguage (lib/language-save.ts): every translated surface
// switches at once, and a failed save puts the previous language back and says so. The section
// itself reads in the viewer's language (lib/i18n-settings-language.ts).

import { useEffect, useId, useRef, useState } from 'react'
import { Globe, Loader2 } from 'lucide-react'
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

/** A language's own name, and the lang its name is written in. */
function ownName(code: string): { name: string; lang: string } {
  const entry = LANGUAGES.find((l) => l.code === code)
  return { name: entry?.nativeName ?? code, lang: isLocale(code) ? code : 'en' }
}

function NamedLanguage({ template, code }: { template: string; code: string }) {
  const [before, after] = splitMessage(template, 'language')
  const { name, lang } = ownName(code)
  return (
    <>
      {before}
      <span lang={lang} dir={isLocale(lang) ? dir(lang) : 'ltr'}>{name}</span>
      {after}
    </>
  )
}

/**
 * What the last choice did. Success in the language now in effect (the new one); failure in the
 * language in effect after the save was taken back (the old one), naming it.
 */
export function SaveStatusLines({ locale, saving, status }: { locale: Locale; saving: boolean; status: LanguageSaveStatus }) {
  const t = (key: Parameters<typeof settingsLanguageT>[1]) => settingsLanguageT(locale, key)
  return (
    <>
      <p role="status" className="text-xs font-medium text-green-700 empty:hidden">
        {saving ? t('saving') : status === 'saved' || status === 'savedDevice' ? t(status) : ''}
      </p>
      {status === 'failed' && (
        <p role="alert" data-testid="settings-language-failed" className="text-xs font-medium text-red-600">
          <NamedLanguage template={t('failed')} code={locale} />
        </p>
      )}
    </>
  )
}

export function LanguageSection() {
  const { user, profile, isAnonymous, saveLanguage } = useAuth()
  const locale = useProfileLocale()
  const device = useDeviceLocale()
  const isGuest = isAnonymous || !user
  const value = languagePickerValue(isGuest, profile, device, locale)
  const t = (key: Parameters<typeof settingsLanguageT>[1]) => settingsLanguageT(locale, key)

  const headingId = useId()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<LanguageSaveStatus>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hideTimer.current), [])

  const handleChange = async (code: string) => {
    if (code === value) return
    clearTimeout(hideTimer.current)
    setStatus(null)
    let ok: boolean
    if (isGuest) {
      ok = (await saveDeviceLanguage(rememberDeviceLocale, device, code)) === 'ok'
    } else {
      setSaving(true)
      ok = (await saveLanguage(code)) === 'ok'
      setSaving(false)
    }
    if (!ok) {
      // Stays until the next choice: the language in effect is the previous one.
      setStatus('failed')
      return
    }
    setStatus(isGuest ? 'savedDevice' : 'saved')
    hideTimer.current = setTimeout(() => setStatus(null), 2500)
  }

  return (
    <section lang={locale} dir={dir(locale)} aria-labelledby={headingId} className="mb-8">
      <div className="mb-4">
        <h3 id={headingId} className="font-semibold text-lg mb-1">{t('heading')}</h3>
        <p className="text-sm text-stone-600">{t('description')}</p>
      </div>
      <div className="space-y-4">
        <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200 space-y-3">
          <div className="relative">
            <Globe aria-hidden="true" className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <select
              data-testid="settings-language-select"
              aria-labelledby={headingId}
              value={value}
              onChange={(e) => void handleChange(e.target.value)}
              disabled={saving}
              className="w-full ps-10 pe-4 py-2.5 rounded-lg border border-stone-200 bg-white text-stone-900 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#4a5d23] disabled:opacity-60"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} — {lang.englishName}
                </option>
              ))}
            </select>
          </div>
          {isGuest && <p className="text-xs text-stone-500">{t('deviceOnly')}</p>}
          <SaveStatusLines locale={locale} saving={saving} status={status} />
          {saving && <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-stone-400" />}
        </div>
      </div>
      {!isGuest && (
        <p className="text-xs text-stone-400 px-1">
          <NamedLanguage template={t('currently')} code={value} />
        </p>
      )}
    </section>
  )
}
