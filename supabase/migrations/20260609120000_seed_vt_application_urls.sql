-- Migration: 20260609120000_seed_vt_application_urls.sql
-- Seed application_url for VT/Rutland resources that had NULL application_url.
-- Maps by category using authoritative state portal URLs from state-portals.ts.
--
-- Vermont combined portal (all benefits): https://dcf.vermont.gov/benefits/apply
-- VT SNAP (3SquaresVT): https://dcf.vermont.gov/benefits/3squaresVT
-- VT Medicaid: https://dvha.vermont.gov/members
-- VT TANF (Reach Up): https://dcf.vermont.gov/benefits/reach-up
-- VT WIC: https://www.healthvermont.gov/wic
-- VT LIHEAP/fuel: https://dcf.vermont.gov/benefits/seasonal
-- Federal SNAP state directory: https://www.fns.usda.gov/snap/state-directory
-- Federal WIC apply: https://www.fns.usda.gov/wic/apply
-- EITC/VITA - IRS VITA locator: https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc
-- Free legal - Vermont Legal Aid: https://www.vtlegalaid.org/get-help
-- Federal housing/HUD: https://www.hud.gov/topics/rental_assistance
-- VT employment/jobs: https://jobs.vermont.gov
-- VT disability: https://dcf.vermont.gov/benefits
--
-- Strategy: UPDATE by external_id for the 20260527000005 phase-1 seed rows.
-- Only confident category-level matches are filled; ambiguous rows left NULL.
-- Idempotent: UPDATE ... WHERE application_url IS NULL (safe to re-run).

-- ============================================================
-- FOOD (VT SNAP / 3SquaresVT + WIC)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://dcf.vermont.gov/benefits/3squaresVT'
WHERE external_id IN (
  'rutland-3squaresvt'
) AND application_url IS NULL;

UPDATE public.resources
SET application_url = 'https://www.fns.usda.gov/snap/state-directory'
WHERE state = 'VT'
  AND category = 'food'
  AND application_url IS NULL
  AND source IN ('admin_added', '211_api')
  AND external_id NOT LIKE 'seed-vt-2026-%';

UPDATE public.resources
SET application_url = 'https://www.healthvermont.gov/wic'
WHERE external_id = 'rutland-wic' AND application_url IS NULL;

-- WIC entries in the 20260608000100 seed
UPDATE public.resources
SET application_url = 'https://www.healthvermont.gov/wic'
WHERE external_id LIKE 'seed-vt-2026-prenatal_natal_care-%'
  AND name ILIKE '%WIC%'
  AND application_url IS NULL;

-- ============================================================
-- HEALTHCARE (VT Medicaid / DVHA)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://dvha.vermont.gov/members'
WHERE state = 'VT'
  AND category = 'healthcare'
  AND application_url IS NULL
  AND name ILIKE ANY(ARRAY['%medicaid%', '%vermont health%', '%catamount%', '%dr. dynasaur%']);

-- General VT healthcare portal for remaining healthcare resources
UPDATE public.resources
SET application_url = 'https://dcf.vermont.gov/benefits/apply'
WHERE state = 'VT'
  AND category = 'healthcare'
  AND application_url IS NULL
  AND source IN ('admin_added', '211_api');

-- ============================================================
-- HOUSING (VT DCF / HUD)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://dcf.vermont.gov/benefits/apply'
WHERE state = 'VT'
  AND category = 'housing'
  AND application_url IS NULL
  AND name ILIKE ANY(ARRAY['%reach up%', '%emergency housing%', '%general assistance%', '%GA %', '%TANF%']);

UPDATE public.resources
SET application_url = 'https://www.hud.gov/topics/rental_assistance'
WHERE state = 'VT'
  AND category = 'housing'
  AND application_url IS NULL
  AND name ILIKE ANY(ARRAY['%section 8%', '%housing voucher%', '%HUD%', '%public housing%']);

-- ============================================================
-- UTILITIES (VT LIHEAP / fuel assistance)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://dcf.vermont.gov/benefits/seasonal'
WHERE state = 'VT'
  AND category = 'utilities'
  AND application_url IS NULL;

-- ============================================================
-- EMPLOYMENT (VT Department of Labor)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://jobs.vermont.gov'
WHERE state = 'VT'
  AND category = 'employment'
  AND application_url IS NULL;

-- ============================================================
-- EITC / TAX FILING (IRS VITA / EITC portal)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc'
WHERE external_id LIKE 'seed-vt-2026-eitc_tax_filing-%'
  AND application_url IS NULL;

-- ============================================================
-- FREE LEGAL (Vermont Legal Aid)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://www.vtlegalaid.org/get-help'
WHERE external_id LIKE 'seed-vt-2026-free_legal-%'
  AND application_url IS NULL;

-- ============================================================
-- PRENATAL / NATAL CARE (Vermont DVHA / VT Health Connect)
-- ============================================================
UPDATE public.resources
SET application_url = 'https://dvha.vermont.gov/members'
WHERE external_id LIKE 'seed-vt-2026-prenatal_natal_care-%'
  AND application_url IS NULL
  AND name NOT ILIKE '%WIC%';

-- ============================================================
-- VERIFICATION COMMENT (run before/after to confirm)
-- SELECT category, COUNT(*) FILTER (WHERE application_url IS NULL) AS null_count,
--        COUNT(*) AS total
-- FROM public.resources
-- WHERE state = 'VT'
-- GROUP BY category ORDER BY category;
