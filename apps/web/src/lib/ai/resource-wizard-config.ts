// apps/web/src/lib/ai/resource-wizard-config.ts
// Static configuration for the Resource Category Wizard

export interface WizardStepConfig {
  id: string
  question: string
  type: 'single-select' | 'multi-select' | 'text'
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface CategoryWizardConfig {
  id: string
  label: string
  icon: string
  description: string
  steps: WizardStepConfig[]
}

const STATE_STEP: WizardStepConfig = {
  id: 'state',
  question: 'What state are you located in?',
  type: 'single-select',
  options: [
    { label: 'Alabama', value: 'Alabama' },
    { label: 'Alaska', value: 'Alaska' },
    { label: 'Arizona', value: 'Arizona' },
    { label: 'Arkansas', value: 'Arkansas' },
    { label: 'California', value: 'California' },
    { label: 'Colorado', value: 'Colorado' },
    { label: 'Connecticut', value: 'Connecticut' },
    { label: 'Delaware', value: 'Delaware' },
    { label: 'District of Columbia', value: 'District of Columbia' },
    { label: 'Florida', value: 'Florida' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Hawaii', value: 'Hawaii' },
    { label: 'Idaho', value: 'Idaho' },
    { label: 'Illinois', value: 'Illinois' },
    { label: 'Indiana', value: 'Indiana' },
    { label: 'Iowa', value: 'Iowa' },
    { label: 'Kansas', value: 'Kansas' },
    { label: 'Kentucky', value: 'Kentucky' },
    { label: 'Louisiana', value: 'Louisiana' },
    { label: 'Maine', value: 'Maine' },
    { label: 'Maryland', value: 'Maryland' },
    { label: 'Massachusetts', value: 'Massachusetts' },
    { label: 'Michigan', value: 'Michigan' },
    { label: 'Minnesota', value: 'Minnesota' },
    { label: 'Mississippi', value: 'Mississippi' },
    { label: 'Missouri', value: 'Missouri' },
    { label: 'Montana', value: 'Montana' },
    { label: 'Nebraska', value: 'Nebraska' },
    { label: 'Nevada', value: 'Nevada' },
    { label: 'New Hampshire', value: 'New Hampshire' },
    { label: 'New Jersey', value: 'New Jersey' },
    { label: 'New Mexico', value: 'New Mexico' },
    { label: 'New York', value: 'New York' },
    { label: 'North Carolina', value: 'North Carolina' },
    { label: 'North Dakota', value: 'North Dakota' },
    { label: 'Ohio', value: 'Ohio' },
    { label: 'Oklahoma', value: 'Oklahoma' },
    { label: 'Oregon', value: 'Oregon' },
    { label: 'Pennsylvania', value: 'Pennsylvania' },
    { label: 'Rhode Island', value: 'Rhode Island' },
    { label: 'South Carolina', value: 'South Carolina' },
    { label: 'South Dakota', value: 'South Dakota' },
    { label: 'Tennessee', value: 'Tennessee' },
    { label: 'Texas', value: 'Texas' },
    { label: 'Utah', value: 'Utah' },
    { label: 'Vermont', value: 'Vermont' },
    { label: 'Virginia', value: 'Virginia' },
    { label: 'Washington', value: 'Washington' },
    { label: 'West Virginia', value: 'West Virginia' },
    { label: 'Wisconsin', value: 'Wisconsin' },
    { label: 'Wyoming', value: 'Wyoming' },
  ],
}

const CONTACT_STEP: WizardStepConfig = {
  id: 'contact',
  question: 'How would you prefer to be contacted?',
  type: 'single-select',
  options: [
    { label: 'Phone call', value: 'phone call' },
    { label: 'Text message', value: 'text message' },
    { label: 'Email', value: 'email' },
    { label: 'In-person visit', value: 'in-person visit' },
    { label: 'No preference', value: 'no preference' },
  ],
}

export const CATEGORY_WIZARDS: CategoryWizardConfig[] = [
  {
    id: 'food',
    label: 'Food',
    icon: 'Apple',
    description: 'SNAP, food pantries, free meals, and more',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of food assistance are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'SNAP / EBT benefits', value: 'SNAP/EBT benefits' },
          { label: 'Food pantries', value: 'food pantries' },
          { label: 'Free meals', value: 'free meals' },
          { label: 'WIC program', value: 'WIC program' },
          { label: 'School meals', value: 'school meals' },
          { label: 'Community gardens', value: 'community gardens' },
        ],
      },
      {
        id: 'household-size',
        question: 'How many people are in your household?',
        type: 'single-select',
        options: [
          { label: '1 person', value: '1 person' },
          { label: '2 people', value: '2 people' },
          { label: '3 people', value: '3 people' },
          { label: '4 people', value: '4 people' },
          { label: '5 people', value: '5 people' },
          { label: '6 people', value: '6 people' },
          { label: '7 people', value: '7 people' },
          { label: '8 or more people', value: '8 or more people' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'housing',
    label: 'Housing',
    icon: 'Home',
    description: 'Emergency shelter, rent help, and housing vouchers',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of housing help are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Emergency shelter', value: 'emergency shelter' },
          { label: 'Rent assistance', value: 'rent assistance' },
          { label: 'Section 8 / housing vouchers', value: 'Section 8/housing vouchers' },
          { label: 'Utility bill help', value: 'utility bill help' },
          { label: 'Home repair assistance', value: 'home repair assistance' },
          { label: 'Transitional housing', value: 'transitional housing' },
        ],
      },
      {
        id: 'situation',
        question: 'Which best describes your current situation?',
        type: 'single-select',
        options: [
          { label: 'Currently homeless', value: 'currently homeless' },
          { label: 'About to lose housing', value: 'about to lose housing' },
          { label: 'Need more affordable housing', value: 'needing more affordable housing' },
          { label: 'Need repairs on current home', value: 'needing repairs on current home' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: 'Briefcase',
    description: 'Job search, training programs, and career support',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of career help are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Job search help', value: 'job search help' },
          { label: 'Resume and interview coaching', value: 'resume and interview coaching' },
          { label: 'Job training programs', value: 'job training programs' },
          { label: 'Unemployment benefits', value: 'unemployment benefits' },
          { label: 'Career counseling', value: 'career counseling' },
          { label: 'Youth employment programs', value: 'youth employment programs' },
        ],
      },
      {
        id: 'experience',
        question: 'How would you describe your work experience?',
        type: 'single-select',
        options: [
          { label: 'No work experience yet', value: 'no work experience' },
          { label: 'Some experience', value: 'some work experience' },
          { label: 'Experienced worker', value: 'an experienced worker' },
          { label: 'Looking for a career change', value: 'looking for a career change' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'transportation',
    label: 'Transportation',
    icon: 'Car',
    description: 'Bus passes, ride programs, and gas assistance',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of transportation help are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Bus / transit passes', value: 'bus/transit passes' },
          { label: 'Car repair assistance', value: 'car repair assistance' },
          { label: 'Ride programs', value: 'ride programs' },
          { label: 'Gas vouchers', value: 'gas vouchers' },
          { label: 'Vehicle donation program', value: 'vehicle donation program' },
          { label: 'Disabled transportation', value: 'disabled transportation services' },
        ],
      },
      {
        id: 'frequency',
        question: 'How often do you need transportation support?',
        type: 'single-select',
        options: [
          { label: 'Daily (work / school)', value: 'daily for work or school' },
          { label: 'Several times a week', value: 'several times a week' },
          { label: 'Occasional trips', value: 'occasionally' },
          { label: 'One-time need', value: 'a one-time need' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    icon: 'Scale',
    description: 'Free legal aid for housing, family, and benefits',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of legal help are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Tenant rights / eviction', value: 'tenant rights and eviction help' },
          { label: 'Family law', value: 'family law assistance' },
          { label: 'Immigration', value: 'immigration legal help' },
          { label: 'Criminal record expungement', value: 'criminal record expungement' },
          { label: 'Benefits appeals', value: 'benefits appeals assistance' },
          { label: 'Consumer protection', value: 'consumer protection help' },
        ],
      },
      {
        id: 'urgency',
        question: 'How urgent is your legal situation?',
        type: 'single-select',
        options: [
          { label: 'Immediate (court date / deadline this week)', value: 'immediate — I have a court date or deadline this week' },
          { label: 'Urgent (within the next month)', value: 'urgent — within the next month' },
          { label: 'Not urgent, just need guidance', value: 'not urgent, just looking for guidance' },
          { label: 'Just exploring my options', value: 'just exploring my options' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    icon: 'Heart',
    description: 'Free clinics, Medicaid, prescriptions, and mental health',
    steps: [
      {
        id: 'assistance-type',
        question: 'What type of healthcare help are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Medicaid / Medicare enrollment', value: 'Medicaid/Medicare enrollment help' },
          { label: 'Free or low-cost clinics', value: 'free or low-cost clinic access' },
          { label: 'Prescription assistance', value: 'prescription assistance' },
          { label: 'Mental health services', value: 'mental health services' },
          { label: 'Dental care', value: 'dental care' },
          { label: 'Vision care', value: 'vision care' },
        ],
      },
      {
        id: 'insurance',
        question: 'What is your current insurance status?',
        type: 'single-select',
        options: [
          { label: 'No insurance', value: 'no insurance' },
          { label: 'Medicaid', value: 'Medicaid' },
          { label: 'Medicare', value: 'Medicare' },
          { label: 'Private insurance', value: 'private insurance' },
          { label: 'Employer insurance', value: 'employer insurance' },
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
