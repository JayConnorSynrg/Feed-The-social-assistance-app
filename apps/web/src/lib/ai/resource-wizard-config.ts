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
  {
    id: 'eitc_tax_filing',
    label: 'Tax Filing & EITC',
    icon: 'Receipt',
    description: 'Free tax prep, EITC refunds, and filing assistance',
    steps: [
      {
        id: 'filing-status',
        question: 'What is your tax filing status?',
        type: 'single-select',
        options: [
          { label: 'Single', value: 'single' },
          { label: 'Married filing jointly', value: 'married filing jointly' },
          { label: 'Married filing separately', value: 'married filing separately' },
          { label: 'Head of household', value: 'head of household' },
          { label: 'Qualifying surviving spouse', value: 'qualifying surviving spouse' },
        ],
      },
      {
        id: 'income-range',
        question: 'What is your approximate annual household income?',
        type: 'single-select',
        options: [
          { label: 'Under $17,000', value: 'under $17,000' },
          { label: '$17,000 – $25,000', value: '$17,000–$25,000' },
          { label: '$25,000 – $40,000', value: '$25,000–$40,000' },
          { label: '$40,000 – $57,000', value: '$40,000–$57,000' },
          { label: 'Over $57,000', value: 'over $57,000' },
        ],
      },
      {
        id: 'dependents',
        question: 'How many qualifying children or dependents do you have?',
        type: 'single-select',
        options: [
          { label: 'None', value: 'no qualifying children' },
          { label: '1 child', value: '1 qualifying child' },
          { label: '2 children', value: '2 qualifying children' },
          { label: '3 or more children', value: '3 or more qualifying children' },
        ],
      },
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_legal',
    label: 'Free Legal Help',
    icon: 'Gavel',
    description: 'Legal aid clinics, pro bono attorneys, and self-help resources',
    steps: [
      {
        id: 'legal-issue',
        question: 'What type of legal issue do you need help with?',
        type: 'multi-select',
        options: [
          { label: 'Eviction or housing court', value: 'eviction or housing court' },
          { label: 'Domestic violence protection order', value: 'domestic violence protection order' },
          { label: 'Child custody or support', value: 'child custody or support' },
          { label: 'Immigration or DACA', value: 'immigration or DACA' },
          { label: 'Criminal record expungement', value: 'criminal record expungement' },
          { label: 'Benefits denial or appeal', value: 'benefits denial or appeal' },
        ],
      },
      {
        id: 'urgency',
        question: 'How urgent is your legal situation?',
        type: 'single-select',
        options: [
          { label: 'Immediate (court date or deadline this week)', value: 'immediate — court date or deadline this week' },
          { label: 'Urgent (within the next 30 days)', value: 'urgent — within the next 30 days' },
          { label: 'Not urgent, need general guidance', value: 'not urgent, need general guidance' },
          { label: 'Just exploring options', value: 'just exploring options' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'prenatal_natal_care',
    label: 'Prenatal & Newborn Care',
    icon: 'Baby',
    description: 'Prenatal visits, WIC, newborn support, and postpartum care',
    steps: [
      {
        id: 'care-type',
        question: 'What type of support are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Prenatal checkups and ultrasounds', value: 'prenatal checkups and ultrasounds' },
          { label: 'WIC nutrition program', value: 'WIC nutrition program' },
          { label: 'Birthing center or hospital financial help', value: 'birthing center or hospital financial help' },
          { label: 'Postpartum mental health support', value: 'postpartum mental health support' },
          { label: 'Newborn care and supplies', value: 'newborn care and supplies' },
          { label: 'Lactation / breastfeeding support', value: 'lactation and breastfeeding support' },
        ],
      },
      {
        id: 'stage',
        question: 'What stage best describes your current situation?',
        type: 'single-select',
        options: [
          { label: 'Currently pregnant (1st trimester)', value: 'currently pregnant — 1st trimester' },
          { label: 'Currently pregnant (2nd trimester)', value: 'currently pregnant — 2nd trimester' },
          { label: 'Currently pregnant (3rd trimester)', value: 'currently pregnant — 3rd trimester' },
          { label: 'Recently gave birth (within 3 months)', value: 'recently gave birth within the last 3 months' },
          { label: 'Planning a pregnancy', value: 'planning a pregnancy' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'waste_disposal',
    label: 'Waste & Disposal',
    icon: 'Trash2',
    description: 'Bulk trash pickup, hazardous waste drop-off, and recycling help',
    steps: [
      {
        id: 'waste-type',
        question: 'What type of waste or disposal help do you need?',
        type: 'multi-select',
        options: [
          { label: 'Bulk item or furniture removal', value: 'bulk item or furniture removal' },
          { label: 'Household hazardous waste (paint, chemicals)', value: 'household hazardous waste disposal' },
          { label: 'Electronics recycling (e-waste)', value: 'electronics recycling (e-waste)' },
          { label: 'Medical sharps or medication disposal', value: 'medical sharps or medication disposal' },
          { label: 'Yard waste or compost', value: 'yard waste or compost' },
          { label: 'General recycling access', value: 'general recycling access' },
        ],
      },
      {
        id: 'situation',
        question: 'Which best describes your situation?',
        type: 'single-select',
        options: [
          { label: 'One-time large cleanout', value: 'one-time large cleanout' },
          { label: 'Ongoing disposal need', value: 'ongoing disposal need' },
          { label: 'Responding to a natural disaster or emergency', value: 'responding to a natural disaster or emergency' },
          { label: 'Moving or eviction cleanup', value: 'moving or eviction cleanup' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_camping',
    label: 'Free Camping',
    icon: 'Tent',
    description: 'Free campsites, dispersed camping, and overnight shelters',
    steps: [
      {
        id: 'camping-type',
        question: 'What type of camping or overnight shelter are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Free dispersed (primitive) camping on public land', value: 'free dispersed camping on public land' },
          { label: 'Free designated campsites (national forest, BLM)', value: 'free designated campsites on federal land' },
          { label: 'Safe overnight parking for a vehicle', value: 'safe overnight parking for a vehicle' },
          { label: 'Emergency overnight shelter', value: 'emergency overnight shelter' },
          { label: 'Long-term camping while awaiting housing', value: 'long-term camping while awaiting housing' },
        ],
      },
      {
        id: 'duration',
        question: 'How long do you need to camp or stay?',
        type: 'single-select',
        options: [
          { label: '1–2 nights', value: '1–2 nights' },
          { label: 'A few days (up to a week)', value: 'a few days up to a week' },
          { label: '1–4 weeks', value: '1–4 weeks' },
          { label: 'More than a month', value: 'more than a month' },
        ],
      },
      STATE_STEP,
      CONTACT_STEP,
    ],
  },
  {
    id: 'free_goods_donation',
    label: 'Free Goods & Donations',
    icon: 'Gift',
    description: 'Free clothing, furniture, household items, and donation programs',
    steps: [
      {
        id: 'goods-type',
        question: 'What types of goods are you looking for?',
        type: 'multi-select',
        options: [
          { label: 'Clothing and shoes', value: 'clothing and shoes' },
          { label: 'Furniture and home goods', value: 'furniture and home goods' },
          { label: 'Baby and children items', value: 'baby and children items' },
          { label: 'Electronics and appliances', value: 'electronics and appliances' },
          { label: 'Hygiene and personal care items', value: 'hygiene and personal care items' },
          { label: 'School supplies', value: 'school supplies' },
        ],
      },
      {
        id: 'household-situation',
        question: 'Which best describes your current situation?',
        type: 'single-select',
        options: [
          { label: 'Setting up a new home', value: 'setting up a new home' },
          { label: 'Lost belongings (fire, flood, disaster)', value: 'lost belongings due to fire, flood, or disaster' },
          { label: 'Experiencing financial hardship', value: 'experiencing financial hardship' },
          { label: 'Transitioning out of shelter or facility', value: 'transitioning out of shelter or a care facility' },
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
