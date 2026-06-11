/**
 * government-forms.ts — SSOT for syncable government PDF forms
 *
 * Imported by BOTH the CLI sync script AND the client UI.
 * Only entries with a non-null sourceUrl are included (syncable subset).
 *
 * storagePath convention: '<agency-prefix>/<form-number-kebab>.pdf'
 * Bucket: 'government-forms' (private; authenticated SELECT only)
 *
 * URL validation notes (probed 2026-06-10):
 *   IRS f1040s8  → 200 OK (residential + datacenter)
 *   HUD-52641    → 200 OK at OCHCO path (PIH path retired)
 *   VA 21-526EZ  → 200 OK
 *   VA 21P-527EZ → 200 OK
 *   SSA-16       → 403 (SSA blocks datacenter IPs; sync expected FAIL; fallback to applicationUrl)
 *   SSA-8000     → 403 (same)
 *   HUD-50058    → 404 on both PIH and OCHCO paths (form retired 2022; not listed here)
 */

export interface GovernmentForm {
  /** Storage bucket path: e.g. 'federal/irs-f1040s8.pdf' */
  storagePath: string
  /** Official form number or identifier */
  formNumber: string
  /** Human-readable program name */
  programName: string
  /** Resource category matching CATEGORY_META in resource-categories.ts */
  category: string
  /** Live URL to fetch the PDF from */
  sourceUrl: string
  /** Agency application portal URL — shown as fallback when PDF not yet in bucket */
  applicationUrl: string | null
}

export const GOVERNMENT_FORMS: GovernmentForm[] = [
  // IRS / Tax Credits — confirmed 200
  {
    storagePath: 'federal/irs-f1040s8.pdf',
    formNumber: '1040 Schedule 8812',
    programName: 'Earned Income Tax Credit / Child Tax Credit',
    category: 'eitc_tax_filing',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/f1040s8.pdf',
    applicationUrl: 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc',
  },

  // HUD / Housing — confirmed 200 at OCHCO path 2026-06-10
  {
    storagePath: 'federal/hud-52641.pdf',
    formNumber: 'HUD-52641',
    programName: 'Section 8 Housing Choice Voucher Application',
    category: 'housing',
    sourceUrl: 'https://www.hud.gov/sites/dfiles/OCHCO/documents/52641.pdf',
    applicationUrl: null,
  },

  // VA / Veterans — confirmed 200
  {
    storagePath: 'federal/va-21-526ez.pdf',
    formNumber: 'VA 21-526EZ',
    programName: 'VA Disability Compensation',
    category: 'veteran',
    sourceUrl: 'https://www.vba.va.gov/pubs/forms/VBA-21-526EZ-ARE.pdf',
    applicationUrl: 'https://www.va.gov/disability/file-disability-claim-form-21-526ez/',
  },
  {
    storagePath: 'federal/va-21p-527ez.pdf',
    formNumber: 'VA 21P-527EZ',
    programName: 'VA Pension',
    category: 'veteran',
    sourceUrl: 'https://www.vba.va.gov/pubs/forms/VBA-21P-527EZ-ARE.pdf',
    applicationUrl: 'https://www.va.gov/pension/application/527EZ/',
  },

  // SSA — expected 403 from datacenter IPs; sync will FAIL; UI shows applicationUrl fallback
  {
    storagePath: 'federal/ssa-16.pdf',
    formNumber: 'SSA-16',
    programName: 'Social Security Disability Insurance (SSDI)',
    category: 'disability',
    sourceUrl: 'https://www.ssa.gov/forms/ssa-16.pdf',
    applicationUrl: 'https://www.ssa.gov/applyfordisability/',
  },
  {
    storagePath: 'federal/ssa-8000.pdf',
    formNumber: 'SSA-8000',
    programName: 'Supplemental Security Income (SSI)',
    category: 'disability',
    sourceUrl: 'https://www.ssa.gov/forms/ssa-8000.pdf',
    applicationUrl: 'https://www.ssa.gov/benefits/ssi/',
  },
]

/** O(1) lookup by storagePath */
export const GOVERNMENT_FORMS_BY_PATH = new Map<string, GovernmentForm>(
  GOVERNMENT_FORMS.map((f) => [f.storagePath, f])
)
