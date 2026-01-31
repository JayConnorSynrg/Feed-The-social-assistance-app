/**
 * SNAP (Supplemental Nutrition Assistance Program) Application Template
 *
 * Based on the standard SNAP application form requirements.
 * This is a simplified version - actual state forms may vary.
 */

import type { FormTemplateSchema, FormFieldSchema, FormSection } from '../form-schemas'
import { commonFields } from '../form-schemas'

// ============================================
// SNAP-Specific Fields
// ============================================

const snapFields: FormFieldSchema[] = [
  // Personal Information Section
  {
    ...commonFields.firstName,
    section: 'personal',
  },
  {
    ...commonFields.lastName,
    section: 'personal',
  },
  {
    id: 'middle_name',
    name: 'middle_name',
    type: 'text',
    label: 'Middle Name',
    section: 'personal',
  },
  {
    id: 'suffix',
    name: 'suffix',
    type: 'select',
    label: 'Suffix',
    options: [
      { value: '', label: 'None' },
      { value: 'jr', label: 'Jr.' },
      { value: 'sr', label: 'Sr.' },
      { value: 'ii', label: 'II' },
      { value: 'iii', label: 'III' },
      { value: 'iv', label: 'IV' },
    ],
    section: 'personal',
  },
  {
    ...commonFields.dateOfBirth,
    section: 'personal',
  },
  {
    ...commonFields.ssn,
    section: 'personal',
    helpText: 'Required for all household members applying for SNAP',
  },
  {
    id: 'gender',
    name: 'gender',
    type: 'select',
    label: 'Gender',
    required: true,
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'nonbinary', label: 'Non-binary' },
      { value: 'prefer_not', label: 'Prefer not to say' },
    ],
    section: 'personal',
  },
  {
    ...commonFields.citizenshipStatus,
    section: 'personal',
  },

  // Contact Information Section
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
    id: 'phone_type',
    name: 'phone_type',
    type: 'select',
    label: 'Phone Type',
    options: [
      { value: 'mobile', label: 'Mobile' },
      { value: 'home', label: 'Home' },
      { value: 'work', label: 'Work' },
    ],
    section: 'contact',
  },
  {
    id: 'alt_phone',
    name: 'alt_phone',
    type: 'phone',
    label: 'Alternate Phone Number',
    section: 'contact',
  },
  {
    ...commonFields.email,
    required: false,
    section: 'contact',
  },
  {
    id: 'preferred_contact',
    name: 'preferred_contact',
    type: 'select',
    label: 'Preferred Contact Method',
    required: true,
    options: [
      { value: 'phone', label: 'Phone' },
      { value: 'email', label: 'Email' },
      { value: 'mail', label: 'Mail' },
    ],
    section: 'contact',
  },

  // Household Information Section
  {
    ...commonFields.householdSize,
    section: 'household',
    helpText: 'Include yourself and all people who live with you and share meals',
  },
  {
    id: 'household_type',
    name: 'household_type',
    type: 'select',
    label: 'Household Type',
    required: true,
    options: [
      { value: 'single', label: 'Single Person' },
      { value: 'married', label: 'Married Couple' },
      { value: 'family_children', label: 'Family with Children' },
      { value: 'multi_generation', label: 'Multi-generational' },
      { value: 'roommates', label: 'Roommates' },
      { value: 'other', label: 'Other' },
    ],
    section: 'household',
  },
  {
    id: 'has_elderly_disabled',
    name: 'has_elderly_disabled',
    type: 'checkbox',
    label: 'Household includes someone age 60+ or disabled',
    section: 'household',
  },
  {
    id: 'has_children_under_18',
    name: 'has_children_under_18',
    type: 'checkbox',
    label: 'Household includes children under 18',
    section: 'household',
  },
  {
    id: 'pregnant_member',
    name: 'pregnant_member',
    type: 'checkbox',
    label: 'Any household member is pregnant',
    section: 'household',
  },

  // Employment & Income Section
  {
    ...commonFields.employmentStatus,
    section: 'income',
  },
  {
    id: 'employer_name',
    name: 'employer_name',
    type: 'text',
    label: "Employer's Name",
    section: 'income',
    conditions: [
      { field: 'employment_status', operator: 'equals', value: 'employed_full' },
    ],
  },
  {
    id: 'employer_name_part',
    name: 'employer_name',
    type: 'text',
    label: "Employer's Name",
    section: 'income',
    conditions: [
      { field: 'employment_status', operator: 'equals', value: 'employed_part' },
    ],
  },
  {
    id: 'monthly_gross_income',
    name: 'monthly_gross_income',
    type: 'currency',
    label: 'Monthly Gross Income (before taxes)',
    required: true,
    sensitive: true,
    section: 'income',
    helpText: 'Include wages, salary, tips from all jobs',
  },
  {
    id: 'self_employment_income',
    name: 'self_employment_income',
    type: 'currency',
    label: 'Monthly Self-Employment Income',
    section: 'income',
    conditions: [
      { field: 'employment_status', operator: 'equals', value: 'self_employed' },
    ],
  },
  {
    id: 'other_income_sources',
    name: 'other_income_sources',
    type: 'multiselect',
    label: 'Other Sources of Income (select all that apply)',
    options: [
      { value: 'social_security', label: 'Social Security' },
      { value: 'ssi', label: 'SSI (Supplemental Security Income)' },
      { value: 'unemployment', label: 'Unemployment Benefits' },
      { value: 'child_support', label: 'Child Support' },
      { value: 'alimony', label: 'Alimony' },
      { value: 'pension', label: 'Pension/Retirement' },
      { value: 'rental', label: 'Rental Income' },
      { value: 'tanf', label: 'TANF/Cash Assistance' },
      { value: 'veterans', label: 'Veterans Benefits' },
      { value: 'workers_comp', label: "Workers' Compensation" },
      { value: 'none', label: 'None' },
    ],
    section: 'income',
  },
  {
    id: 'other_income_amount',
    name: 'other_income_amount',
    type: 'currency',
    label: 'Total Monthly Amount from Other Sources',
    section: 'income',
    conditions: [{ field: 'other_income_sources', operator: 'notEmpty' }],
  },

  // Expenses Section
  {
    id: 'rent_mortgage',
    name: 'rent_mortgage',
    type: 'currency',
    label: 'Monthly Rent or Mortgage Payment',
    required: true,
    section: 'expenses',
  },
  {
    id: 'housing_type',
    name: 'housing_type',
    type: 'select',
    label: 'Housing Type',
    required: true,
    options: [
      { value: 'rent', label: 'Rent' },
      { value: 'own', label: 'Own/Mortgage' },
      { value: 'subsidized', label: 'Subsidized Housing' },
      { value: 'homeless', label: 'Homeless/No Fixed Address' },
      { value: 'staying_others', label: 'Staying with Others' },
    ],
    section: 'expenses',
  },
  {
    id: 'utilities_included',
    name: 'utilities_included',
    type: 'checkbox',
    label: 'Utilities are included in rent',
    section: 'expenses',
    conditions: [{ field: 'housing_type', operator: 'equals', value: 'rent' }],
  },
  {
    id: 'utility_expenses',
    name: 'utility_expenses',
    type: 'multiselect',
    label: 'Utilities You Pay (select all that apply)',
    options: [
      { value: 'electric', label: 'Electricity' },
      { value: 'gas', label: 'Gas/Heating' },
      { value: 'water', label: 'Water/Sewer' },
      { value: 'phone', label: 'Phone' },
      { value: 'trash', label: 'Trash' },
    ],
    section: 'expenses',
  },
  {
    id: 'childcare_expenses',
    name: 'childcare_expenses',
    type: 'currency',
    label: 'Monthly Childcare Expenses',
    section: 'expenses',
    conditions: [{ field: 'has_children_under_18', operator: 'equals', value: true }],
  },
  {
    id: 'medical_expenses',
    name: 'medical_expenses',
    type: 'currency',
    label: 'Monthly Medical Expenses (out-of-pocket)',
    section: 'expenses',
    conditions: [{ field: 'has_elderly_disabled', operator: 'equals', value: true }],
    helpText: 'Include insurance premiums, medications, medical supplies',
  },
  {
    id: 'child_support_paid',
    name: 'child_support_paid',
    type: 'currency',
    label: 'Monthly Child Support Paid',
    section: 'expenses',
  },

  // Assets Section
  {
    id: 'bank_accounts_total',
    name: 'bank_accounts_total',
    type: 'currency',
    label: 'Total in All Bank Accounts',
    required: true,
    sensitive: true,
    section: 'assets',
    helpText: 'Checking, savings, and other accounts',
  },
  {
    id: 'cash_on_hand',
    name: 'cash_on_hand',
    type: 'currency',
    label: 'Cash on Hand',
    section: 'assets',
  },
  {
    id: 'owns_vehicle',
    name: 'owns_vehicle',
    type: 'checkbox',
    label: 'Do you own a vehicle?',
    section: 'assets',
  },
  {
    id: 'vehicle_value',
    name: 'vehicle_value',
    type: 'currency',
    label: 'Approximate Vehicle Value',
    section: 'assets',
    conditions: [{ field: 'owns_vehicle', operator: 'equals', value: true }],
  },

  // Expedited Service Section
  {
    id: 'expedited_need',
    name: 'expedited_need',
    type: 'checkbox',
    label: 'I need expedited (emergency) SNAP benefits',
    section: 'expedited',
    helpText: 'Check if your household has little or no income and resources',
  },
  {
    id: 'expedited_reason',
    name: 'expedited_reason',
    type: 'multiselect',
    label: 'Reason for Expedited Service',
    options: [
      { value: 'no_income', label: 'No income this month' },
      { value: 'migrant', label: 'Migrant/seasonal farmworker' },
      { value: 'expenses_exceed', label: 'Monthly expenses exceed income' },
      { value: 'under_150_assets', label: 'Less than $150 in assets' },
    ],
    section: 'expedited',
    conditions: [{ field: 'expedited_need', operator: 'equals', value: true }],
  },

  // Certification Section
  {
    id: 'certification_statement',
    name: 'certification_statement',
    type: 'checkbox',
    label:
      'I certify that the information provided is true and correct to the best of my knowledge. I understand that providing false information may result in denial or termination of benefits and may be subject to civil or criminal penalties.',
    required: true,
    section: 'certification',
  },
  {
    id: 'authorize_verification',
    name: 'authorize_verification',
    type: 'checkbox',
    label:
      'I authorize the agency to verify the information provided through third parties including employers, financial institutions, and government agencies.',
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
// SNAP Form Sections
// ============================================

const snapSections: FormSection[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Tell us about yourself',
    fields: [
      'first_name',
      'last_name',
      'middle_name',
      'suffix',
      'date_of_birth',
      'ssn',
      'gender',
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
      'phone_type',
      'alt_phone',
      'email',
      'preferred_contact',
    ],
  },
  {
    id: 'household',
    title: 'Household Information',
    description: 'Tell us about your household',
    fields: [
      'household_size',
      'household_type',
      'has_elderly_disabled',
      'has_children_under_18',
      'pregnant_member',
    ],
  },
  {
    id: 'income',
    title: 'Employment & Income',
    description: 'Tell us about your income',
    fields: [
      'employment_status',
      'employer_name',
      'monthly_gross_income',
      'self_employment_income',
      'other_income_sources',
      'other_income_amount',
    ],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'Tell us about your monthly expenses',
    fields: [
      'rent_mortgage',
      'housing_type',
      'utilities_included',
      'utility_expenses',
      'childcare_expenses',
      'medical_expenses',
      'child_support_paid',
    ],
  },
  {
    id: 'assets',
    title: 'Assets & Resources',
    description: 'Tell us about your assets',
    fields: ['bank_accounts_total', 'cash_on_hand', 'owns_vehicle', 'vehicle_value'],
  },
  {
    id: 'expedited',
    title: 'Expedited Service',
    description: 'Request emergency benefits if you qualify',
    fields: ['expedited_need', 'expedited_reason'],
  },
  {
    id: 'certification',
    title: 'Certification & Signature',
    description: 'Review and sign your application',
    fields: [
      'certification_statement',
      'authorize_verification',
      'signature',
      'signature_date',
    ],
  },
]

// ============================================
// Complete SNAP Template
// ============================================

export const snapApplicationTemplate: FormTemplateSchema = {
  id: 'snap-application-v1',
  name: 'SNAP Benefits Application',
  description:
    'Apply for the Supplemental Nutrition Assistance Program (SNAP), formerly known as food stamps. SNAP helps eligible low-income individuals and families buy nutritious food.',
  version: 1,
  sections: snapSections,
  fields: snapFields,
  metadata: {
    category: 'benefits',
    agency: 'USDA',
    estimatedTime: 30,
    requiredDocuments: [
      'Government-issued ID',
      'Proof of income (pay stubs, benefit letters)',
      'Proof of expenses (rent/mortgage, utility bills)',
      'Social Security cards for all household members',
      'Proof of citizenship or immigration status',
    ],
  },
}

export default snapApplicationTemplate
