export interface FederalFormMapping {
  programName: string
  category: string
  applicationUrl: string | null
  formUrl: string | null
  formNumber: string | null
}

export const FEDERAL_FORMS: FederalFormMapping[] = [
  // Social Security
  { programName: 'Social Security Disability Insurance (SSDI)', category: 'disability', applicationUrl: 'https://www.ssa.gov/applyfordisability/', formUrl: 'https://www.ssa.gov/forms/ssa-16.pdf', formNumber: 'SSA-16' },
  { programName: 'Supplemental Security Income (SSI)', category: 'disability', applicationUrl: 'https://www.ssa.gov/benefits/ssi/', formUrl: 'https://www.ssa.gov/forms/ssa-8000.pdf', formNumber: 'SSA-8000' },
  { programName: 'Social Security Retirement', category: 'senior', applicationUrl: 'https://www.ssa.gov/retireonline/', formUrl: null, formNumber: null },
  { programName: 'Medicare', category: 'healthcare', applicationUrl: 'https://www.ssa.gov/medicare/', formUrl: null, formNumber: null },

  // IRS / Tax Credits
  { programName: 'Earned Income Tax Credit (EITC)', category: 'financial', applicationUrl: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc', formUrl: 'https://www.irs.gov/pub/irs-pdf/f1040s8.pdf', formNumber: '1040 Schedule 8812' },
  { programName: 'Child Tax Credit', category: 'financial', applicationUrl: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit', formUrl: 'https://www.irs.gov/pub/irs-pdf/f1040s8.pdf', formNumber: '1040 Schedule 8812' },

  // HUD / Housing
  { programName: 'Section 8 Housing Choice Voucher', category: 'housing', applicationUrl: null, formUrl: 'https://www.hud.gov/sites/dfiles/PIH/documents/HUD-52641.pdf', formNumber: 'HUD-52641' },
  { programName: 'Public Housing', category: 'housing', applicationUrl: null, formUrl: 'https://www.hud.gov/sites/dfiles/PIH/documents/HUD-50058.pdf', formNumber: 'HUD-50058' },

  // USDA / Food
  { programName: 'SNAP (Food Stamps)', category: 'food', applicationUrl: null, formUrl: null, formNumber: null },
  { programName: 'WIC', category: 'food', applicationUrl: null, formUrl: null, formNumber: null },

  // DOL / Employment
  { programName: 'Unemployment Insurance', category: 'employment', applicationUrl: null, formUrl: null, formNumber: null },

  // VA / Veterans
  { programName: 'VA Disability Compensation', category: 'veteran', applicationUrl: 'https://www.va.gov/disability/file-disability-claim-form-21-526ez/', formUrl: 'https://www.vba.va.gov/pubs/forms/VBA-21-526EZ-ARE.pdf', formNumber: 'VA 21-526EZ' },
  { programName: 'VA Pension', category: 'veteran', applicationUrl: 'https://www.va.gov/pension/application/527EZ/', formUrl: 'https://www.vba.va.gov/pubs/forms/VBA-21P-527EZ-ARE.pdf', formNumber: 'VA 21P-527EZ' },
  { programName: 'VA Health Care', category: 'veteran', applicationUrl: 'https://www.va.gov/health-care/apply-for-health-care-form-10-10ez/', formUrl: null, formNumber: '10-10EZ' },

  // FEMA
  { programName: 'FEMA Disaster Assistance', category: 'financial', applicationUrl: 'https://www.disasterassistance.gov/', formUrl: null, formNumber: null },

  // Education
  { programName: 'Federal Student Aid (FAFSA)', category: 'financial', applicationUrl: 'https://studentaid.gov/h/apply-for-aid/fafsa', formUrl: null, formNumber: null },
  { programName: 'Pell Grant', category: 'financial', applicationUrl: 'https://studentaid.gov/h/apply-for-aid/fafsa', formUrl: null, formNumber: null },

  // LIHEAP
  { programName: 'LIHEAP (Low Income Home Energy Assistance)', category: 'utilities', applicationUrl: null, formUrl: null, formNumber: null },

  // Lifeline
  { programName: 'Lifeline (Phone/Internet Discount)', category: 'utilities', applicationUrl: 'https://www.lifelinesupport.org/do-i-qualify/', formUrl: null, formNumber: null },
  { programName: 'Affordable Connectivity Program (ACP)', category: 'utilities', applicationUrl: null, formUrl: null, formNumber: null },
]

export function findFederalForm(programName: string): FederalFormMapping | undefined {
  const lower = programName.toLowerCase()
  return FEDERAL_FORMS.find(f =>
    lower.includes(f.programName.toLowerCase()) ||
    f.programName.toLowerCase().includes(lower)
  )
}
