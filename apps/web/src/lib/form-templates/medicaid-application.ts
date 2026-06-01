/**
 * Medicaid Application Template
 *
 * Based on common Medicaid application requirements.
 * Actual state forms vary - this covers typical fields.
 */

import type { FormTemplateSchema, FormFieldSchema, FormSection } from '../form-schemas'
import { commonFields } from '../form-schemas'

// ============================================
// Medicaid-Specific Fields
// ============================================

const medicaidFields: FormFieldSchema[] = [
  // Applicant Information
  {
    ...commonFields.firstName,
    section: 'applicant',
  },
  {
    ...commonFields.lastName,
    section: 'applicant',
  },
  {
    id: 'middle_name',
    name: 'middle_name',
    type: 'text',
    label: 'Middle Name',
    section: 'applicant',
  },
  {
    ...commonFields.dateOfBirth,
    section: 'applicant',
  },
  {
    ...commonFields.ssn,
    section: 'applicant',
    helpText: 'Required for Medicaid eligibility verification',
  },
  {
    id: 'gender',
    name: 'gender',
    type: 'select',
    label: 'Sex at Birth',
    required: true,
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
    ],
    section: 'applicant',
  },
  {
    id: 'race_ethnicity',
    name: 'race_ethnicity',
    type: 'multiselect',
    label: 'Race/Ethnicity (optional)',
    helpText: 'This information helps ensure equal access to services',
    options: [
      { value: 'american_indian', label: 'American Indian or Alaska Native' },
      { value: 'asian', label: 'Asian' },
      { value: 'black', label: 'Black or African American' },
      { value: 'hispanic', label: 'Hispanic or Latino' },
      { value: 'hawaiian', label: 'Native Hawaiian or Other Pacific Islander' },
      { value: 'white', label: 'White' },
      { value: 'other', label: 'Other' },
      { value: 'prefer_not', label: 'Prefer not to answer' },
    ],
    section: 'applicant',
  },
  {
    ...commonFields.citizenshipStatus,
    section: 'applicant',
  },

  // Contact Information
  {
    ...commonFields.address,
    section: 'contact',
  },
  {
    id: 'mailing_same',
    name: 'mailing_same',
    type: 'checkbox',
    label: 'Mailing address is the same as home address',
    defaultValue: true,
    section: 'contact',
  },
  {
    id: 'mailing_address',
    name: 'mailing_address',
    type: 'address',
    label: 'Mailing Address',
    section: 'contact',
    conditions: [{ field: 'mailing_same', operator: 'equals', value: false }],
  },
  {
    ...commonFields.phone,
    section: 'contact',
    required: true,
  },
  {
    ...commonFields.email,
    section: 'contact',
  },
  {
    id: 'preferred_language',
    name: 'preferred_language',
    type: 'select',
    label: 'Preferred Language',
    required: true,
    options: [
      { value: 'english', label: 'English' },
      { value: 'spanish', label: 'Spanish' },
      { value: 'chinese', label: 'Chinese' },
      { value: 'vietnamese', label: 'Vietnamese' },
      { value: 'korean', label: 'Korean' },
      { value: 'tagalog', label: 'Tagalog' },
      { value: 'russian', label: 'Russian' },
      { value: 'arabic', label: 'Arabic' },
      { value: 'other', label: 'Other' },
    ],
    section: 'contact',
  },
  {
    id: 'needs_interpreter',
    name: 'needs_interpreter',
    type: 'checkbox',
    label: 'I need an interpreter for appointments',
    section: 'contact',
  },

  // Household Information
  {
    ...commonFields.householdSize,
    section: 'household',
  },
  {
    id: 'marital_status',
    name: 'marital_status',
    type: 'select',
    label: 'Marital Status',
    required: true,
    options: [
      { value: 'single', label: 'Single/Never Married' },
      { value: 'married', label: 'Married' },
      { value: 'domestic_partner', label: 'Domestic Partnership' },
      { value: 'divorced', label: 'Divorced' },
      { value: 'separated', label: 'Separated' },
      { value: 'widowed', label: 'Widowed' },
    ],
    section: 'household',
  },
  {
    id: 'filing_taxes',
    name: 'filing_taxes',
    type: 'select',
    label: 'Tax Filing Status (for this year)',
    required: true,
    options: [
      { value: 'single', label: 'Single' },
      { value: 'married_joint', label: 'Married Filing Jointly' },
      { value: 'married_separate', label: 'Married Filing Separately' },
      { value: 'head_household', label: 'Head of Household' },
      { value: 'not_filing', label: 'Not Filing Taxes' },
    ],
    section: 'household',
  },
  {
    id: 'pregnant',
    name: 'pregnant',
    type: 'checkbox',
    label: 'Are you currently pregnant?',
    section: 'household',
  },
  {
    id: 'expected_due_date',
    name: 'expected_due_date',
    type: 'date',
    label: 'Expected Due Date',
    section: 'household',
    conditions: [{ field: 'pregnant', operator: 'equals', value: true }],
  },
  {
    id: 'number_of_babies',
    name: 'number_of_babies',
    type: 'number',
    label: 'Number of Babies Expected',
    section: 'household',
    validation: { min: 1, max: 8 },
    conditions: [{ field: 'pregnant', operator: 'equals', value: true }],
  },

  // Income Information
  {
    ...commonFields.employmentStatus,
    section: 'income',
  },
  {
    id: 'monthly_income',
    name: 'monthly_income',
    type: 'currency',
    label: 'Total Monthly Income (before taxes)',
    required: true,
    sensitive: true,
    section: 'income',
    helpText: 'Include wages, self-employment, tips',
  },
  {
    id: 'income_type',
    name: 'income_type',
    type: 'multiselect',
    label: 'Types of Income Received',
    options: [
      { value: 'wages', label: 'Wages/Salary' },
      { value: 'self_employment', label: 'Self-Employment' },
      { value: 'social_security', label: 'Social Security' },
      { value: 'ssi', label: 'SSI' },
      { value: 'unemployment', label: 'Unemployment' },
      { value: 'pension', label: 'Pension/Retirement' },
      { value: 'alimony', label: 'Alimony' },
      { value: 'child_support', label: 'Child Support' },
      { value: 'rental', label: 'Rental Income' },
      { value: 'investment', label: 'Investment Income' },
      { value: 'none', label: 'No Income' },
    ],
    section: 'income',
  },
  {
    id: 'income_changes',
    name: 'income_changes',
    type: 'checkbox',
    label: 'My income is expected to change in the next few months',
    section: 'income',
  },
  {
    id: 'income_change_reason',
    name: 'income_change_reason',
    type: 'textarea',
    label: 'Explain expected income changes',
    section: 'income',
    conditions: [{ field: 'income_changes', operator: 'equals', value: true }],
  },

  // Current Insurance
  {
    id: 'has_insurance',
    name: 'has_insurance',
    type: 'checkbox',
    label: 'I currently have health insurance',
    section: 'insurance',
  },
  {
    id: 'insurance_type',
    name: 'insurance_type',
    type: 'multiselect',
    label: 'Type of Current Insurance',
    options: [
      { value: 'employer', label: 'Employer-Sponsored' },
      { value: 'marketplace', label: 'Marketplace/ACA' },
      { value: 'medicare', label: 'Medicare' },
      { value: 'medicaid', label: 'Medicaid (other state)' },
      { value: 'tricare', label: 'TRICARE/Military' },
      { value: 'va', label: 'VA Health Care' },
      { value: 'cobra', label: 'COBRA' },
      { value: 'other', label: 'Other' },
    ],
    section: 'insurance',
    conditions: [{ field: 'has_insurance', operator: 'equals', value: true }],
  },
  {
    id: 'insurance_end_date',
    name: 'insurance_end_date',
    type: 'date',
    label: 'When does current coverage end?',
    section: 'insurance',
    conditions: [{ field: 'has_insurance', operator: 'equals', value: true }],
  },
  {
    id: 'employer_offers_insurance',
    name: 'employer_offers_insurance',
    type: 'checkbox',
    label: 'My employer offers health insurance',
    section: 'insurance',
    conditions: [
      { field: 'employment_status', operator: 'equals', value: 'employed_full' },
    ],
  },
  {
    id: 'declined_employer_insurance',
    name: 'declined_employer_insurance',
    type: 'checkbox',
    label: 'I declined employer insurance',
    section: 'insurance',
    conditions: [{ field: 'employer_offers_insurance', operator: 'equals', value: true }],
  },

  // Medical Information
  {
    id: 'has_disability',
    name: 'has_disability',
    type: 'checkbox',
    label: 'I have a disability',
    section: 'medical',
  },
  {
    id: 'disability_type',
    name: 'disability_type',
    type: 'textarea',
    label: 'Please describe your disability',
    section: 'medical',
    conditions: [{ field: 'has_disability', operator: 'equals', value: true }],
  },
  {
    id: 'receives_ssi_ssdi',
    name: 'receives_ssi_ssdi',
    type: 'checkbox',
    label: 'I receive SSI or SSDI disability benefits',
    section: 'medical',
    conditions: [{ field: 'has_disability', operator: 'equals', value: true }],
  },
  {
    id: 'needs_long_term_care',
    name: 'needs_long_term_care',
    type: 'checkbox',
    label: 'I need help with daily activities (bathing, dressing, eating)',
    section: 'medical',
  },
  {
    id: 'nursing_home',
    name: 'nursing_home',
    type: 'checkbox',
    label: 'I live in or plan to move to a nursing home',
    section: 'medical',
  },
  {
    id: 'medical_conditions',
    name: 'medical_conditions',
    type: 'textarea',
    label: 'Current Medical Conditions (optional)',
    section: 'medical',
    helpText: 'List any conditions that require regular treatment',
    sensitive: true,
  },
  {
    id: 'current_medications',
    name: 'current_medications',
    type: 'textarea',
    label: 'Current Medications (optional)',
    section: 'medical',
    sensitive: true,
  },

  // Coverage Options
  {
    id: 'coverage_type_requested',
    name: 'coverage_type_requested',
    type: 'multiselect',
    label: 'What coverage are you applying for?',
    required: true,
    options: [
      { value: 'full_medicaid', label: 'Full Medicaid Coverage' },
      { value: 'emergency', label: 'Emergency Services Only' },
      { value: 'pregnancy', label: 'Pregnancy Coverage' },
      { value: 'breast_cervical', label: 'Breast & Cervical Cancer Treatment' },
      { value: 'family_planning', label: 'Family Planning Services' },
      { value: 'chip', label: "CHIP (Children's Health Insurance)" },
    ],
    section: 'coverage',
  },
  {
    id: 'retroactive_coverage',
    name: 'retroactive_coverage',
    type: 'checkbox',
    label: 'I need coverage for medical bills from the past 3 months',
    section: 'coverage',
  },
  {
    id: 'medical_bills_date',
    name: 'medical_bills_date',
    type: 'date',
    label: 'Date of earliest unpaid medical bill',
    section: 'coverage',
    conditions: [{ field: 'retroactive_coverage', operator: 'equals', value: true }],
  },

  // Certification
  {
    id: 'certification_statement',
    name: 'certification_statement',
    type: 'checkbox',
    label:
      'I certify under penalty of perjury that all information provided is true and complete. I understand that I must report any changes to my income, address, or household within 10 days.',
    required: true,
    section: 'certification',
  },
  {
    id: 'authorize_info_sharing',
    name: 'authorize_info_sharing',
    type: 'checkbox',
    label:
      'I authorize the release of information to verify my eligibility, including income, assets, and immigration status.',
    required: true,
    section: 'certification',
  },
  {
    id: 'assign_medical_rights',
    name: 'assign_medical_rights',
    type: 'checkbox',
    label:
      'I assign to the state any rights to medical support or payments from other insurance or responsible parties.',
    required: true,
    section: 'certification',
  },
  {
    ...commonFields.signature,
    section: 'certification',
  },
  {
    ...commonFields.signatureDate,
    section: 'certification',
  },
]

// ============================================
// Medicaid Form Sections
// ============================================

const medicaidSections: FormSection[] = [
  {
    id: 'applicant',
    title: 'Applicant Information',
    description: 'Tell us about yourself',
    fields: [
      'first_name',
      'last_name',
      'middle_name',
      'date_of_birth',
      'ssn',
      'gender',
      'race_ethnicity',
      'citizenship_status',
    ],
  },
  {
    id: 'contact',
    title: 'Contact Information',
    description: 'How can we reach you?',
    fields: [
      'address',
      'mailing_same',
      'mailing_address',
      'phone',
      'email',
      'preferred_language',
      'needs_interpreter',
    ],
  },
  {
    id: 'household',
    title: 'Household Information',
    description: 'Tell us about your household and family',
    fields: [
      'household_size',
      'marital_status',
      'filing_taxes',
      'pregnant',
      'expected_due_date',
      'number_of_babies',
    ],
  },
  {
    id: 'income',
    title: 'Income Information',
    description: 'Tell us about your income',
    fields: [
      'employment_status',
      'monthly_income',
      'income_type',
      'income_changes',
      'income_change_reason',
    ],
  },
  {
    id: 'insurance',
    title: 'Current Health Insurance',
    description: 'Tell us about any current coverage',
    fields: [
      'has_insurance',
      'insurance_type',
      'insurance_end_date',
      'employer_offers_insurance',
      'declined_employer_insurance',
    ],
  },
  {
    id: 'medical',
    title: 'Medical Information',
    description: 'Tell us about your health needs',
    fields: [
      'has_disability',
      'disability_type',
      'receives_ssi_ssdi',
      'needs_long_term_care',
      'nursing_home',
      'medical_conditions',
      'current_medications',
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage Options',
    description: 'What type of coverage do you need?',
    fields: [
      'coverage_type_requested',
      'retroactive_coverage',
      'medical_bills_date',
    ],
  },
  {
    id: 'certification',
    title: 'Certification & Signature',
    description: 'Review and sign your application',
    fields: [
      'certification_statement',
      'authorize_info_sharing',
      'assign_medical_rights',
      'signature',
      'signature_date',
    ],
  },
]

// ============================================
// Complete Medicaid Template
// ============================================

export const medicaidApplicationTemplate: FormTemplateSchema = {
  id: 'medicaid-application-v1',
  name: 'Medicaid Application',
  description:
    'Apply for Medicaid health coverage. Medicaid provides free or low-cost health coverage to eligible low-income individuals, families, pregnant women, elderly adults, and people with disabilities.',
  version: 1,
  sections: medicaidSections,
  fields: medicaidFields,
  metadata: {
    category: 'benefits',
    formType: 'medicaid',
    agency: 'HHS',
    estimatedTime: 25,
    requiredDocuments: [
      'Government-issued ID',
      'Social Security card',
      'Proof of income (pay stubs, tax return)',
      'Proof of citizenship or immigration status',
      'Proof of address',
      'Information about current health insurance (if any)',
    ],
  },
}

export default medicaidApplicationTemplate
