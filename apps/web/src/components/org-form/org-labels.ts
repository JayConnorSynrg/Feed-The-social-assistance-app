// apps/web/src/components/org-form/org-labels.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Closed-vocabulary value -> i18n-org-forms key maps, so every org type and resource category
// renders in the viewer's language. Record<Union, Key> makes a new enum value a compile error
// until it gets a translated label.

import type { OrgFormMessages } from '@/lib/i18n-org-forms'
import type { NonBusinessOrgType } from '@/lib/org-vocab'
import { isNonBusinessOrgType } from '@/lib/org-vocab'
import type { ResourceCategory } from '@/lib/resource-directory'

type Key = keyof OrgFormMessages

export const ORG_TYPE_KEYS: Record<NonBusinessOrgType, Key> = {
  food_bank: 'typeFoodBank',
  pantry: 'typePantry',
  shelter: 'typeShelter',
  clinic: 'typeClinic',
  mutual_aid: 'typeMutualAid',
  other: 'typeOther',
  community: 'typeCommunity',
  nonprofit: 'typeNonprofit',
  government: 'typeGovernment',
}

/** Dictionary key for an org_type; unknown values fall back to "Other". */
export function orgTypeKey(orgType: string): Key {
  return isNonBusinessOrgType(orgType) ? ORG_TYPE_KEYS[orgType] : 'typeOther'
}

export const CATEGORY_KEYS: Record<ResourceCategory, Key> = {
  food: 'catFood',
  housing: 'catHousing',
  healthcare: 'catHealthcare',
  employment: 'catEmployment',
  education: 'catEducation',
  legal: 'catLegal',
  transportation: 'catTransportation',
  utilities: 'catUtilities',
  clothing: 'catClothing',
  financial: 'catFinancial',
  mental_health: 'catMentalHealth',
  substance_abuse: 'catSubstanceAbuse',
  domestic_violence: 'catDomesticViolence',
  childcare: 'catChildcare',
  senior_services: 'catSeniorServices',
  disability_services: 'catDisabilityServices',
  veteran_services: 'catVeteranServices',
  immigration: 'catImmigration',
  other: 'catOther',
  eitc_tax_filing: 'catEitcTaxFiling',
  free_legal: 'catFreeLegal',
  prenatal_natal_care: 'catPrenatalNatalCare',
  waste_disposal: 'catWasteDisposal',
  free_camping: 'catFreeCamping',
  free_goods_donation: 'catFreeGoodsDonation',
}

/** Every resource category, in enum order. */
export const ALL_CATEGORIES = Object.keys(CATEGORY_KEYS) as ResourceCategory[]

export function categoryKey(category: string): Key {
  return (CATEGORY_KEYS as Record<string, Key>)[category] ?? 'catOther'
}
