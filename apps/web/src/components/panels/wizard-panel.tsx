'use client'

// apps/web/src/components/panels/wizard-panel.tsx
// Resource category selection grid and wizard flow

import React, { useState } from 'react'
import {
  Apple,
  Home,
  Briefcase,
  Car,
  Scale,
  Heart,
  type LucideProps,
} from 'lucide-react'
import { ResourceWizard } from './resource-wizard'
import { CATEGORY_WIZARDS, type CategoryWizardConfig } from '@/lib/ai/resource-wizard-config'
import { usePanelContext } from '@/components/layout/feed-shell'

// Map icon name strings to Lucide components
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Apple,
  Home,
  Briefcase,
  Car,
  Scale,
  Heart,
}

function CategoryCard({
  category,
  onClick,
}: {
  category: CategoryWizardConfig
  onClick: () => void
}) {
  const Icon = ICON_MAP[category.icon] ?? Heart

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start p-5 rounded-2xl border border-stone-200 bg-[#faf9f6] hover:border-[#4a5d23]/40 hover:bg-[#f5f3ee] hover:shadow-md transition-all text-left group"
    >
      <div className="w-10 h-10 rounded-xl bg-[#4a5d23]/10 flex items-center justify-center mb-3 group-hover:bg-[#4a5d23]/20 transition-colors">
        <Icon className="w-5 h-5 text-[#4a5d23]" />
      </div>
      <h3 className="font-semibold text-sm text-stone-800 mb-1">{category.label}</h3>
      <p className="text-xs text-stone-500 leading-relaxed">{category.description}</p>
    </button>
  )
}

export function WizardPanel() {
  const { setActivePanel, setPanelParams } = usePanelContext()
  const [activeCategory, setActiveCategory] = useState<CategoryWizardConfig | null>(null)

  function handleWizardComplete(answers: Record<string, string | string[]>) {
    if (!activeCategory) return

    setPanelParams({
      flow: activeCategory.id,
      wizardContext: JSON.stringify({ category: activeCategory.id, answers }),
    })
    setActivePanel('chat')
  }

  if (activeCategory) {
    return (
      <div className="h-full flex flex-col overflow-y-auto">
        <ResourceWizard
          category={activeCategory}
          onComplete={handleWizardComplete}
          onBack={() => setActiveCategory(null)}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Find Resources</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Select a category to get personalized help from the AI assistant.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {CATEGORY_WIZARDS.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onClick={() => setActiveCategory(category)}
          />
        ))}
      </div>
    </div>
  )
}
