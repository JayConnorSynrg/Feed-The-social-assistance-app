// apps/web/src/lib/ai/resource-wizard-config.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The Get Help wizard's categories and steps. Every option has a value and a label: the value is
// what the member's answer IS — English, the same in every language, handed to the Assistant
// (lib/ai/wizard-prompt.ts) and logged by category id; the label is only how the option reads, in the
// member's language (lib/i18n-get-help.ts wizardLabelText). Questions and card descriptions are keys
// of the same dictionary; a category's name is wizardCategoryLabel(id). The values are pinned by
// resource-wizard-config.test.ts.

import type { AssistantKey } from '@/lib/i18n-assistant'
import type { GetHelpKey, WizardLabel } from '@/lib/i18n-get-help'

export interface WizardOption {
  label: WizardLabel
  value: string
}

export interface WizardStepConfig {
  id: string
  /** The question, a getHelp key. */
  question: GetHelpKey
  type: 'single-select' | 'multi-select'
  options: WizardOption[]
}

export interface CategoryWizardConfig {
  id: string
  icon: string
  /** The card's description, a getHelp key. */
  description: GetHelpKey
  steps: WizardStepConfig[]
}

const option = (key: GetHelpKey, value: string): WizardOption => ({ label: { kind: 'getHelp', key }, value })
const assistant = (key: AssistantKey, value: string, lang?: 'en'): WizardOption => ({ label: lang ? { kind: 'assistant', key, lang } : { kind: 'assistant', key }, value })
const usd = (label: WizardLabel, value: string): WizardOption => ({ label, value })

/** The states the wizard offers, by English name: each name is its option's value. */
const STATE_NAMES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii',
  'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
]

const STATE_STEP: WizardStepConfig = {
  id: 'state',
  question: 'qStateLocated',
  type: 'single-select',
  options: STATE_NAMES.map((name) => ({ label: { kind: 'state', name }, value: name })),
}

const CONTACT_STEP: WizardStepConfig = {
  id: 'contact',
  question: 'qWouldPreferBeContacted',
  type: 'single-select',
  options: [
    option('oPhoneCall', 'phone call'),
    option('oTextMessage', 'text message'),
    option('oEmail', 'email'),
    option('oPersonVisit', 'in-person visit'),
    option('oNoPreference', 'no preference'),
  ],
}

export const CATEGORY_WIZARDS: CategoryWizardConfig[] = [
  {
    id: 'food',
    icon: 'Apple',
    description: 'descFood',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeFoodAssistance',
        type: 'multi-select',
        options: [
          option('oSnapEbtBenefits', 'SNAP/EBT benefits'),
          option('oFoodPantries', 'food pantries'),
          option('oFreeMeals', 'free meals'),
          option('oWicProgram', 'WIC program'),
          option('oSchoolMeals', 'school meals'),
          option('oCommunityGardens', 'community gardens'),
        ],
      },
      {
        id: 'household-size',
        question: 'qManyPeopleHousehold',
        type: 'single-select',
        options: [
          option('o1Person', '1 person'),
          option('o2People', '2 people'),
          option('o3People', '3 people'),
          option('o4People', '4 people'),
          option('o5People', '5 people'),
          option('o6People', '6 people'),
          option('o7People', '7 people'),
          option('o8MorePeople', '8 or more people'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'housing',
    icon: 'Home',
    description: 'descHousing',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeHousing',
        type: 'multi-select',
        options: [
          option('oEmergencyShelter', 'emergency shelter'),
          option('oRentAssistance', 'rent assistance'),
          option('oSection8HousingVouchers', 'Section 8/housing vouchers'),
          option('oUtilityBill', 'utility bill help'),
          option('oHomeRepairAssistance', 'home repair assistance'),
          option('oTransitionalHousing', 'transitional housing'),
        ],
      },
      {
        id: 'situation',
        question: 'qDescribesCurrentSituation',
        type: 'single-select',
        options: [
          option('oCurrentlyHomeless', 'currently homeless'),
          option('oAboutLoseHousing', 'about to lose housing'),
          option('oNeedMoreAffordableHousing', 'needing more affordable housing'),
          option('oNeedRepairsCurrentHome', 'needing repairs on current home'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'jobs',
    icon: 'Briefcase',
    description: 'descJobs',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeCareer',
        type: 'multi-select',
        options: [
          option('oJobSearch', 'job search help'),
          option('oResumeInterviewCoaching', 'resume and interview coaching'),
          option('oJobTrainingPrograms', 'job training programs'),
          option('oUnemploymentBenefits', 'unemployment benefits'),
          option('oCareerCounseling', 'career counseling'),
          option('oYouthEmploymentPrograms', 'youth employment programs'),
        ],
      },
      {
        id: 'experience',
        question: 'qWouldDescribeWorkExperience',
        type: 'single-select',
        options: [
          option('oNoWorkExperienceYet', 'no work experience'),
          option('oSomeExperience', 'some work experience'),
          option('oExperiencedWorker', 'an experienced worker'),
          option('oCareerChange', 'looking for a career change'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'transportation',
    icon: 'Car',
    description: 'descTransportation',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeTransportation',
        type: 'multi-select',
        options: [
          option('oBusTransitPasses', 'bus/transit passes'),
          option('oCarRepairAssistance', 'car repair assistance'),
          option('oRidePrograms', 'ride programs'),
          option('oGasVouchers', 'gas vouchers'),
          option('oVehicleDonationProgram', 'vehicle donation program'),
          option('oDisabledTransportation', 'disabled transportation services'),
        ],
      },
      {
        id: 'frequency',
        question: 'qOftenNeedTransportationSupport',
        type: 'single-select',
        options: [
          option('oDailyWorkSchool', 'daily for work or school'),
          option('oSeveralTimesWeek', 'several times a week'),
          option('oOccasionalTrips', 'occasionally'),
          option('oOneTimeNeed', 'a one-time need'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'legal',
    icon: 'Scale',
    description: 'descLegal',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeLegal',
        type: 'multi-select',
        options: [
          option('oTenantRightsEviction', 'tenant rights and eviction help'),
          option('oFamilyLaw', 'family law assistance'),
          option('oImmigration', 'immigration legal help'),
          option('oCriminalRecordExpungement', 'criminal record expungement'),
          option('oBenefitsAppeals', 'benefits appeals assistance'),
          option('oConsumerProtection', 'consumer protection help'),
        ],
      },
      {
        id: 'urgency',
        question: 'qUrgentLegalSituation',
        type: 'single-select',
        options: [
          option('oImmediateCourtDateDeadlineThis', 'immediate — I have a court date or deadline this week'),
          option('oUrgentWithinNextMonth', 'urgent — within the next month'),
          option('oNotUrgentJustNeedGuidance', 'not urgent, just looking for guidance'),
          option('oJustExploringMyOptions', 'just exploring my options'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'healthcare',
    icon: 'Heart',
    description: 'descHealthcare',
    steps: [
      {
        id: 'assistance-type',
        question: 'qTypeHealthcare',
        type: 'multi-select',
        options: [
          option('oMedicaidMedicareEnrollment', 'Medicaid/Medicare enrollment help'),
          option('oFreeLowCostClinics', 'free or low-cost clinic access'),
          option('oPrescriptionAssistance', 'prescription assistance'),
          option('oMentalHealthServices', 'mental health services'),
          option('oDentalCare', 'dental care'),
          option('oVisionCare', 'vision care'),
        ],
      },
      {
        id: 'insurance',
        question: 'qCurrentInsuranceStatus',
        type: 'single-select',
        options: [
          option('oNoInsurance', 'no insurance'),
          assistant('ecMedicaid', 'Medicaid', 'en'),
          assistant('ecMedicare', 'Medicare', 'en'),
          option('oPrivateInsurance', 'private insurance'),
          option('oEmployerInsurance', 'employer insurance'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'eitc_tax_filing',
    icon: 'Receipt',
    description: 'descEitcTaxFiling',
    steps: [
      {
        id: 'filing-status',
        question: 'qTaxFilingStatus',
        type: 'single-select',
        options: [
          option('oSingle', 'single'),
          option('oMarriedFilingJointly', 'married filing jointly'),
          option('oMarriedFilingSeparately', 'married filing separately'),
          option('oHeadHousehold', 'head of household'),
          option('oQualifyingSurvivingSpouse', 'qualifying surviving spouse'),
        ],
      },
      {
        id: 'income-range',
        question: 'qApproximateAnnualHouseholdIncome',
        type: 'single-select',
        options: [
          usd({ kind: 'usdUnder', amount: 17000 }, 'under $17,000'),
          usd({ kind: 'usdRange', from: 17000, to: 25000 }, '$17,000–$25,000'),
          usd({ kind: 'usdRange', from: 25000, to: 40000 }, '$25,000–$40,000'),
          usd({ kind: 'usdRange', from: 40000, to: 57000 }, '$40,000–$57,000'),
          usd({ kind: 'usdOver', amount: 57000 }, 'over $57,000'),
        ],
      },
      {
        id: 'dependents',
        question: 'qManyQualifyingChildrenDependentsHave',
        type: 'single-select',
        options: [
          option('oNone', 'no qualifying children'),
          option('o1Child', '1 qualifying child'),
          option('o2Children', '2 qualifying children'),
          option('o3MoreChildren', '3 or more qualifying children'),
        ],
      },
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_legal',
    icon: 'Gavel',
    description: 'descFreeLegal',
    steps: [
      {
        id: 'legal-issue',
        question: 'qTypeLegalIssueNeedWith',
        type: 'multi-select',
        options: [
          option('oEvictionHousingCourt', 'eviction or housing court'),
          option('oDomesticViolenceProtectionOrder', 'domestic violence protection order'),
          option('oChildCustodySupport', 'child custody or support'),
          option('oImmigrationDaca', 'immigration or DACA'),
          option('oCriminalRecordExpungement', 'criminal record expungement'),
          option('oBenefitsDenialAppeal', 'benefits denial or appeal'),
        ],
      },
      {
        id: 'urgency',
        question: 'qUrgentLegalSituation',
        type: 'single-select',
        options: [
          option('oImmediateCourtDateOrDeadline', 'immediate — court date or deadline this week'),
          option('oUrgentWithinNext30Days', 'urgent — within the next 30 days'),
          option('oNotUrgentNeedGeneralGuidance', 'not urgent, need general guidance'),
          assistant('rfExploring', 'just exploring options'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'prenatal_natal_care',
    icon: 'Baby',
    description: 'descPrenatalNatalCare',
    steps: [
      {
        id: 'care-type',
        question: 'qTypeSupport',
        type: 'multi-select',
        options: [
          option('oPrenatalCheckupsUltrasounds', 'prenatal checkups and ultrasounds'),
          option('oWicNutritionProgram', 'WIC nutrition program'),
          option('oBirthingCenterHospitalFinancial', 'birthing center or hospital financial help'),
          option('oPostpartumMentalHealthSupport', 'postpartum mental health support'),
          option('oNewbornCareSupplies', 'newborn care and supplies'),
          option('oLactationBreastfeedingSupport', 'lactation and breastfeeding support'),
        ],
      },
      {
        id: 'stage',
        question: 'qStageDescribesCurrentSituation',
        type: 'single-select',
        options: [
          option('oCurrentlyPregnant1stTrimester', 'currently pregnant — 1st trimester'),
          option('oCurrentlyPregnant2ndTrimester', 'currently pregnant — 2nd trimester'),
          option('oCurrentlyPregnant3rdTrimester', 'currently pregnant — 3rd trimester'),
          option('oRecentlyGaveBirthWithin3', 'recently gave birth within the last 3 months'),
          option('oPlanningPregnancy', 'planning a pregnancy'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'waste_disposal',
    icon: 'Trash2',
    description: 'descWasteDisposal',
    steps: [
      {
        id: 'waste-type',
        question: 'qTypeWasteDisposalNeed',
        type: 'multi-select',
        options: [
          option('oBulkItemFurnitureRemoval', 'bulk item or furniture removal'),
          option('oHouseholdHazardousWastePaintChemicals', 'household hazardous waste disposal'),
          option('oElectronicsRecyclingEWaste', 'electronics recycling (e-waste)'),
          option('oMedicalSharpsMedicationDisposal', 'medical sharps or medication disposal'),
          option('oYardWasteCompost', 'yard waste or compost'),
          option('oGeneralRecyclingAccess', 'general recycling access'),
        ],
      },
      {
        id: 'situation',
        question: 'qDescribesSituation',
        type: 'single-select',
        options: [
          option('oOneTimeLargeCleanout', 'one-time large cleanout'),
          option('oOngoingDisposalNeed', 'ongoing disposal need'),
          option('oRespondingNaturalDisasterEmergency', 'responding to a natural disaster or emergency'),
          option('oMovingEvictionCleanup', 'moving or eviction cleanup'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_camping',
    icon: 'Tent',
    description: 'descFreeCamping',
    steps: [
      {
        id: 'camping-type',
        question: 'qTypeCampingOvernightShelter',
        type: 'multi-select',
        options: [
          option('oFreeDispersedPrimitiveCampingPublic', 'free dispersed camping on public land'),
          option('oFreeDesignatedCampsitesNationalForest', 'free designated campsites on federal land'),
          option('oSafeOvernightParkingVehicle', 'safe overnight parking for a vehicle'),
          option('oEmergencyOvernightShelter', 'emergency overnight shelter'),
          option('oLongTermCampingWhileAwaiting', 'long-term camping while awaiting housing'),
        ],
      },
      {
        id: 'duration',
        question: 'qLongNeedCampStay',
        type: 'single-select',
        options: [
          option('o12Nights', '1–2 nights'),
          option('oFewDaysUpWeek', 'a few days up to a week'),
          option('o14Weeks', '1–4 weeks'),
          option('oMoreThanMonth', 'more than a month'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_goods_donation',
    icon: 'Gift',
    description: 'descFreeGoodsDonation',
    steps: [
      {
        id: 'goods-type',
        question: 'qTypesGoods',
        type: 'multi-select',
        options: [
          option('oClothingShoes', 'clothing and shoes'),
          option('oFurnitureHomeGoods', 'furniture and home goods'),
          option('oBabyChildrenItems', 'baby and children items'),
          option('oElectronicsAppliances', 'electronics and appliances'),
          option('oHygienePersonalCareItems', 'hygiene and personal care items'),
          option('oSchoolSupplies', 'school supplies'),
        ],
      },
      {
        id: 'household-situation',
        question: 'qDescribesCurrentSituation',
        type: 'single-select',
        options: [
          option('oSettingUpNewHome', 'setting up a new home'),
          option('oLostBelongingsFireFloodDisaster', 'lost belongings due to fire, flood, or disaster'),
          option('oExperiencingFinancialHardship', 'experiencing financial hardship'),
          option('oTransitioningOutShelterFacility', 'transitioning out of shelter or a care facility'),
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
]

export const CATEGORY_WIZARD_MAP: Record<string, CategoryWizardConfig> = Object.fromEntries(
  CATEGORY_WIZARDS.map((c) => [c.id, c])
)
