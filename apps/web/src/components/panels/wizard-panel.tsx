'use client'

// apps/web/src/components/panels/wizard-panel.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Get Help: the category cards and, once one is chosen, its wizard (resource-wizard.tsx), in the
// member's language (lib/i18n-get-help.ts) with lang/dir on the panel. Finishing hands the answers'
// VALUES to the Assistant (panelParams.wizardContext; the message is lib/ai/wizard-prompt.ts) — the
// same in every language. Leaving the wizard (Cancel, or Back on its first step) returns focus to the
// card that opened it; finishing moves to the Assistant, which focuses its message box.

import React, { useEffect, useId, useRef, useState } from 'react'
import {
  Apple,
  Home,
  Briefcase,
  Car,
  Scale,
  Heart,
  Receipt,
  Gavel,
  Baby,
  Trash2,
  Tent,
  Gift,
  type LucideProps,
} from 'lucide-react'
import { ResourceWizard } from './resource-wizard'
import { CATEGORY_WIZARDS, type CategoryWizardConfig } from '@/lib/ai/resource-wizard-config'
import { usePanelContext } from '@/components/layout/feed-shell'
import { useProfileLocale } from '@/hooks/use-profile-locale'
import { dir, type Locale } from '@/lib/i18n'
import { assistantT } from '@/lib/i18n-assistant'
import { getHelpT, wizardCategoryLabel } from '@/lib/i18n-get-help'
import { logger } from '@/lib/logger'

// Map icon name strings to Lucide components
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Apple,
  Home,
  Briefcase,
  Car,
  Scale,
  Heart,
  Receipt,
  Gavel,
  Baby,
  Trash2,
  Tent,
  Gift,
}

function CategoryCard({
  category,
  locale,
  onClick,
  buttonRef,
}: {
  category: CategoryWizardConfig
  locale: Locale
  onClick: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}) {
  const Icon = ICON_MAP[category.icon] ?? Heart

  // The card is named by its visible words: the category name first, then its description.
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-start p-5 rounded-2xl border border-stone-500 bg-[#faf9f6] hover:border-[#4a5d23] hover:bg-[#f5f3ee] hover:shadow-md transition-all text-start group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5d23]"
    >
      <span aria-hidden="true" className="w-10 h-10 rounded-xl bg-[#4a5d23]/10 flex items-center justify-center mb-3 group-hover:bg-[#4a5d23]/20 transition-colors">
        <Icon className="w-5 h-5 text-[#4a5d23]" />
      </span>
      <span className="block max-w-full font-semibold text-sm text-stone-800 mb-1 break-words hyphens-auto">{wizardCategoryLabel(category.id, locale)}</span>
      <span className="block max-w-full text-xs text-stone-600 leading-relaxed break-words hyphens-auto">{getHelpT(locale, category.description)}</span>
    </button>
  )
}

export function WizardPanel() {
  const { setActivePanel, setPanelParams } = usePanelContext()
  const locale = useProfileLocale()
  const headingId = useId()
  const [activeCategory, setActiveCategory] = useState<CategoryWizardConfig | null>(null)
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const returnFocusRef = useRef<string | null>(null)

  // Back on the first step or Cancel: the cards are mounted again, focus goes to the one that
  // opened the wizard.
  useEffect(() => {
    if (activeCategory || !returnFocusRef.current) return
    cardRefs.current[returnFocusRef.current]?.focus()
    returnFocusRef.current = null
  }, [activeCategory])

  function handleWizardComplete(answers: Record<string, string | string[]>) {
    if (!activeCategory) return

    logger.info('wizard.complete', { category: activeCategory.id, stepCount: activeCategory.steps.length })
    setPanelParams({
      flow: activeCategory.id,
      wizardContext: JSON.stringify({ category: activeCategory.id, answers }),
    })
    setActivePanel('chat')
  }

  function handleWizardCancel() {
    returnFocusRef.current = activeCategory?.id ?? null
    setActiveCategory(null)
  }

  if (activeCategory) {
    return (
      <div lang={locale} dir={dir(locale)} className="h-full flex flex-col overflow-y-auto">
        <ResourceWizard
          key={activeCategory.id}
          category={activeCategory}
          locale={locale}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      </div>
    )
  }

  return (
    <div lang={locale} dir={dir(locale)} className="h-full flex flex-col">
      <div className="mb-6">
        <h1 id={headingId} className="text-2xl font-bold text-stone-800">{assistantT(locale, 'rfName')}</h1>
        <p className="text-stone-600 mt-1 text-sm">{getHelpT(locale, 'subtitle')}</p>
      </div>

      <div role="group" aria-labelledby={headingId} className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 gap-4">
        {CATEGORY_WIZARDS.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            locale={locale}
            buttonRef={(el) => {
              cardRefs.current[category.id] = el
            }}
            onClick={() => {
              logger.info('wizard.start', { category: category.id })
              setActiveCategory(category)
            }}
          />
        ))}
      </div>
    </div>
  )
}
