export const CATEGORY_FORM_MAP: Record<string, string[]> = {
  food: ['snap', 'wic'],
  housing: ['housing'],
  healthcare: ['medicaid'],
  utilities: ['utility'],
  employment: ['unemployment'],
  childcare: ['childcare'],
  financial: ['tanf'],
  disability_services: ['disability'],
}

export function getFormTypesForCategory(category: string): string[] {
  return CATEGORY_FORM_MAP[category] || []
}

export function hasApplicationForm(category: string): boolean {
  return (CATEGORY_FORM_MAP[category]?.length ?? 0) > 0
}

export interface CategoryDisplay {
  label: string
  icon: string
  color: string
}

export const CATEGORY_DISPLAY: Record<string, CategoryDisplay> = {
  food: {
    label: 'Food',
    icon: 'Utensils',
    color: 'bg-amber-100 text-amber-800',
  },
  housing: {
    label: 'Housing',
    icon: 'Home',
    color: 'bg-stone-200 text-stone-800',
  },
  healthcare: {
    label: 'Healthcare',
    icon: 'Heart',
    color: 'bg-red-100 text-red-800',
  },
  employment: {
    label: 'Employment',
    icon: 'Briefcase',
    color: 'bg-blue-100 text-blue-800',
  },
  education: {
    label: 'Education',
    icon: 'BookOpen',
    color: 'bg-indigo-100 text-indigo-800',
  },
  legal: {
    label: 'Legal',
    icon: 'Scale',
    color: 'bg-slate-200 text-slate-800',
  },
  transportation: {
    label: 'Transportation',
    icon: 'Car',
    color: 'bg-cyan-100 text-cyan-800',
  },
  utilities: {
    label: 'Utilities',
    icon: 'Zap',
    color: 'bg-yellow-100 text-yellow-800',
  },
  clothing: {
    label: 'Clothing',
    icon: 'Shirt',
    color: 'bg-orange-100 text-orange-800',
  },
  financial: {
    label: 'Financial',
    icon: 'DollarSign',
    color: 'bg-green-100 text-green-800',
  },
  mental_health: {
    label: 'Mental Health',
    icon: 'Brain',
    color: 'bg-purple-100 text-purple-800',
  },
  substance_abuse: {
    label: 'Substance Abuse',
    icon: 'Shield',
    color: 'bg-rose-100 text-rose-800',
  },
  domestic_violence: {
    label: 'Domestic Violence',
    icon: 'ShieldAlert',
    color: 'bg-red-200 text-red-900',
  },
  childcare: {
    label: 'Childcare',
    icon: 'Baby',
    color: 'bg-pink-100 text-pink-800',
  },
  senior_services: {
    label: 'Senior Services',
    icon: 'Users',
    color: 'bg-teal-100 text-teal-800',
  },
  disability_services: {
    label: 'Disability Services',
    icon: 'Accessibility',
    color: 'bg-violet-100 text-violet-800',
  },
  veteran_services: {
    label: 'Veteran Services',
    icon: 'Star',
    color: 'bg-stone-300 text-stone-900',
  },
  immigration: {
    label: 'Immigration',
    icon: 'Globe',
    color: 'bg-sky-100 text-sky-800',
  },
  other: {
    label: 'Other',
    icon: 'MoreHorizontal',
    color: 'bg-stone-100 text-stone-700',
  },
}
