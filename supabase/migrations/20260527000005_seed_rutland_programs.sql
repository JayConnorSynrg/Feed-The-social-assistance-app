-- Seed: 86 verified benefit programs for Rutland, Vermont
-- Source: admin-curated, verified against program websites and 211 Vermont
-- Conflict target: resources_external_id_source_uniq (external_id, source)

INSERT INTO public.resources (
  external_id, name, description, category,
  address_line1, city, state, zip_code,
  phone, email, website,
  eligibility_requirements, services_offered,
  source, status, is_verified, last_verified_at
)
VALUES

-- ============================================================
-- FOOD (11)
-- ============================================================
(
  'rutland-3squaresvt', '3SquaresVT (SNAP)',
  'Vermont name for the federal Supplemental Nutrition Assistance Program (SNAP). Provides monthly benefits on an EBT card for grocery purchases.',
  'food', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://mybenefits.vermont.gov',
  'Income-based; apply at myBenefits.vermont.gov',
  ARRAY['Monthly food benefits','EBT card','Grocery assistance'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-wic', 'WIC — Women, Infants & Children',
  'Provides food benefits, nutrition education, breastfeeding support, and healthcare referrals for eligible participants.',
  'food', '88 Merchants Row', 'Rutland', 'VT', '05701',
  '(802) 773-3202', NULL, 'https://www.healthvermont.gov/wic',
  'Pregnant, postpartum, or breastfeeding women; children under 5; income ≤185% FPL',
  ARRAY['Food benefits','Nutrition education','Breastfeeding support','Healthcare referrals'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-csfp', 'CSFP — Commodity Supplemental Food Program',
  'Monthly food package for low-income seniors through Vermont Foodbank and USDA.',
  'food', NULL, 'Rutland', 'VT', '05701',
  '(802) 477-4580', NULL, 'https://www.vtfoodbank.org',
  'Seniors 60+ at ≤130% FPL',
  ARRAY['Monthly food package','Senior nutrition'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-tefap', 'TEFAP — Emergency Food Assistance',
  'The Emergency Food Assistance Program distributes USDA commodities through Vermont food shelves.',
  'food', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.vtfoodbank.org',
  'Income-based; distributed via local food shelves',
  ARRAY['Emergency food boxes','USDA commodities'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-free-reduced-meals', 'Free and Reduced School Meals',
  'Provides free or reduced-price breakfast and lunch to eligible students in Rutland City Schools.',
  'food', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.rcpsvt.org',
  'Income ≤130% FPL (free) or ≤185% FPL (reduced); apply through school',
  ARRAY['Free breakfast','Free or reduced lunch'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-summer-food', 'Summer Food Service Program',
  'Free meals for children at open sites throughout Rutland during summer months when school is not in session.',
  'food', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.fns.usda.gov/sfsp',
  'All children 18 and under; no income verification required',
  ARRAY['Free summer meals','Open meal sites'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-meals-on-wheels', 'Meals on Wheels — SVCOA',
  'Home-delivered hot meals for homebound seniors in Rutland County through Southwestern Vermont Council on Aging.',
  'food', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5990', NULL, 'https://www.svcoa.org',
  'Seniors 60+ who are homebound',
  ARRAY['Home-delivered meals','Senior nutrition','Wellness check'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-broc-food-shelf', 'BROC Community Action Food Shelf',
  'Food shelf providing groceries and emergency food assistance to Rutland and Bennington County residents.',
  'food', '45 Union St', 'Rutland', 'VT', '05701',
  '(802) 665-1748', NULL, 'https://www.broc.org',
  'Rutland/Bennington County residents',
  ARRAY['Grocery assistance','Emergency food','Food shelf'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-county-food-shelves', 'Rutland County Food Shelves Network',
  'Network of community food shelves throughout Rutland County. Call 2-1-1 for locations and hours.',
  'food', NULL, 'Rutland', 'VT', '05701',
  '211', NULL, 'https://www.vermont211.org',
  'Open to community members in need',
  ARRAY['Food shelf access','Emergency groceries'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-veggievango', 'VeggieVanGo — Vermont Foodbank',
  'Mobile produce distribution events providing free fresh fruits and vegetables to community members.',
  'food', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.vtfoodbank.org/veggievango',
  'Open to anyone at distribution events; no income verification',
  ARRAY['Fresh produce','Mobile food distribution'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-community-gardens', 'Community Gardens — Rutland Area Farm & Food Link',
  'Community garden plots for growing food, available to Rutland area residents.',
  'food', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.raffl.org',
  'Open to community members',
  ARRAY['Garden plots','Food growing','Community gardening'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- HEALTHCARE (7)
-- ============================================================
(
  'rutland-medicaid', 'Vermont Medicaid (Green Mountain Care)',
  'State Medicaid program covering doctor visits, hospital care, prescriptions, dental, and more for eligible Vermonters.',
  'healthcare', NULL, 'Rutland', 'VT', '05701',
  '(855) 899-9600', NULL, 'https://mybenefits.vermont.gov',
  'Income-based; apply at myBenefits.vermont.gov',
  ARRAY['Medical coverage','Prescriptions','Dental','Vision','Mental health'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-dr-dynasaur', 'Dr. Dynasaur — Vermont Children''s Health Program',
  'Free or low-cost health insurance for Vermont children and young adults up to age 19.',
  'healthcare', NULL, 'Rutland', 'VT', '05701',
  '(855) 899-9600', NULL, 'https://healthconnect.vermont.gov',
  'Children under 19; family income up to 317% FPL',
  ARRAY['Free/low-cost health insurance','Pediatric care','Dental','Vision'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-health-connect', 'Vermont Health Connect',
  'Vermont''s health insurance marketplace where individuals and families can shop for and enroll in health coverage.',
  'healthcare', NULL, 'Rutland', 'VT', '05701',
  '(855) 899-9600', NULL, 'https://healthconnect.vermont.gov',
  'All Vermont residents; subsidies available for households at 100–400% FPL',
  ARRAY['Health insurance enrollment','Premium tax credits','Plan comparison'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vpharm', 'VPharm — Vermont Pharmaceutical Assistance',
  'Helps Medicare Part D enrollees with low incomes pay for prescription drugs not covered by Medicare.',
  'healthcare', NULL, 'Rutland', 'VT', '05701',
  '(800) 250-8427', NULL, 'https://dvha.vermont.gov/vpharm',
  'Medicare Part D enrollees with income ≤225% FPL',
  ARRAY['Prescription drug assistance','Medicare supplement'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-chcrr', 'Community Health Centers — Rutland Region (CHCRR)',
  'Federally Qualified Health Center providing primary care, dental, behavioral health, and pharmacy services on a sliding fee scale.',
  'healthcare', '215 Stratton Rd', 'Rutland', 'VT', '05701',
  '(802) 773-8604', NULL, 'https://www.chcrr.org',
  'Open to all; sliding fee scale based on income',
  ARRAY['Primary care','Dental','Behavioral health','Pharmacy','Sliding fee scale'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-rrmc-financial-assistance', 'RRMC Financial Assistance Program',
  'Rutland Regional Medical Center provides free or reduced-cost care to uninsured and underinsured patients who qualify.',
  'healthcare', '160 Allen St', 'Rutland', 'VT', '05701',
  '(802) 775-7111', NULL, 'https://www.rrmc.org',
  'Uninsured or underinsured patients meeting income guidelines',
  ARRAY['Hospital financial assistance','Discounted medical care','Charity care'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-dental-medicaid', 'Dental Care via Medicaid and Dr. Dynasaur',
  'Dental benefits for Medicaid and Dr. Dynasaur enrollees including cleanings, fillings, extractions, and preventive care.',
  'healthcare', NULL, 'Rutland', 'VT', '05701',
  '(855) 899-9600', NULL, 'https://dvha.vermont.gov',
  'Medicaid and Dr. Dynasaur enrollees',
  ARRAY['Dental cleanings','Fillings','Extractions','Preventive dental care'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- MENTAL HEALTH (4)
-- ============================================================
(
  'rutland-ccn-mental-health', 'Community Care Network — Mental Health Services',
  'Rutland Mental Health Services (part of Community Care Network) provides outpatient and crisis mental health services for Rutland County.',
  'mental_health', '78 S Main St', 'Rutland', 'VT', '05701',
  '(802) 775-2381', NULL, 'https://www.ccnvt.org',
  'Open to all Rutland County residents',
  ARRAY['Outpatient therapy','Psychiatric evaluation','Crisis services','Case management'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-ccn-substance-use', 'Community Care Network — Substance Use Treatment',
  'Substance use disorder treatment services including assessment, counseling, medication-assisted treatment, and peer support.',
  'mental_health', '78 S Main St', 'Rutland', 'VT', '05701',
  '(802) 775-2381', NULL, 'https://www.ccnvt.org',
  'Open to all; accepts Medicaid, Medicare, and uninsured patients',
  ARRAY['Substance use assessment','Counseling','MAT','Peer support','Recovery planning'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-rrmc-behavioral-health', 'RRMC Behavioral Health',
  'Inpatient and outpatient behavioral health services at Rutland Regional Medical Center.',
  'mental_health', '160 Allen St', 'Rutland', 'VT', '05701',
  '(802) 775-7111', NULL, 'https://www.rrmc.org',
  'Open to all patients',
  ARRAY['Inpatient behavioral health','Outpatient psychiatry','Crisis stabilization'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-turning-point', 'Turning Point Center of Rutland County',
  'Peer-run recovery community center offering support for people in or seeking recovery from substance use disorders.',
  'mental_health', '141 State St', 'Rutland', 'VT', '05701',
  '(802) 773-6010', NULL, 'https://www.turningpointrutland.org',
  'Anyone in or seeking recovery from substance use',
  ARRAY['Peer recovery support','Recovery coaching','Community events','Wellness activities'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- HOUSING (8)
-- ============================================================
(
  'rutland-section-8', 'Section 8 Housing Choice Vouchers — Rutland Housing Authority',
  'Federal rental assistance vouchers administered by Rutland Housing Authority for low-income families and individuals.',
  'housing', '5 Tremont St', 'Rutland', 'VT', '05701',
  '(802) 775-2926', NULL, 'https://www.rutlandhousing.org',
  'Income ≤50% of area median income; waitlist may apply',
  ARRAY['Rental assistance vouchers','Tenant-based housing subsidy'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-rha-public-housing', 'RHA Public Housing',
  'Income-based public housing units owned and managed by the Rutland Housing Authority.',
  'housing', '5 Tremont St', 'Rutland', 'VT', '05701',
  '(802) 775-2926', NULL, 'https://www.rutlandhousing.org',
  'Income-based eligibility',
  ARRAY['Affordable housing units','Public housing'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-housing-opportunity-program', 'Housing Opportunity Program — BROC/DCF',
  'Rapid rehousing and homelessness prevention assistance for people who are homeless or at risk of homelessness.',
  'housing', NULL, 'Rutland', 'VT', '05701',
  '(802) 665-1748', NULL, 'https://www.broc.org',
  'Individuals and families who are homeless or at risk',
  ARRAY['Rapid rehousing','Homelessness prevention','Security deposit assistance','First month rent'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-emergency-housing', 'Vermont Emergency Housing',
  'State-funded emergency motel vouchers for households facing homelessness when shelters are full.',
  'housing', NULL, 'Rutland', 'VT', '05701',
  '(800) 775-0506', NULL, 'https://dcf.vermont.gov/benefits/ea',
  'Individuals and families facing homelessness',
  ARRAY['Emergency motel vouchers','Temporary shelter','Homelessness crisis response'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-open-door-mission', 'Open Door Mission',
  'Emergency shelter providing safe lodging for men and families in Rutland.',
  'housing', '5 Engrem Ave', 'Rutland', 'VT', '05701',
  '(802) 775-5506', NULL, NULL,
  'Emergency shelter open to men and families',
  ARRAY['Emergency shelter','Meals','Case management','Supportive services'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-transitional-rehousing', 'Transitional and Rapid Re-Housing — BROC',
  'Case-managed transitional and rapid rehousing services helping homeless individuals and families stabilize.',
  'housing', NULL, 'Rutland', 'VT', '05701',
  '(802) 665-1748', NULL, 'https://www.broc.org',
  'Individuals and families experiencing homelessness; referral via BROC',
  ARRAY['Transitional housing','Rapid rehousing','Case management','Life skills'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-hud-housing-counseling', 'HUD Housing Counseling — NeighborWorks Western VT',
  'HUD-approved housing counseling for homebuyers, renters, and homeowners facing foreclosure.',
  'housing', NULL, 'Rutland', 'VT', '05701',
  '(802) 438-2303', NULL, 'https://www.nwwvt.org',
  'Open to all; pre-purchase, renter, foreclosure counseling',
  ARRAY['Homebuyer counseling','Foreclosure prevention','Renter counseling','Financial coaching'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vhfa-homeownership', 'VHFA Homeownership Programs',
  'Vermont Housing Finance Agency offers affordable mortgages, down payment assistance, and homebuyer education for first-time buyers.',
  'housing', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.vhfa.org',
  'First-time homebuyers with income within VHFA limits',
  ARRAY['Affordable mortgages','Down payment assistance','Homebuyer education','First-time buyer programs'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- UTILITIES (6)
-- ============================================================
(
  'rutland-liheap-fuel', 'LIHEAP Fuel Assistance — BROC',
  'Low Income Home Energy Assistance Program helps income-eligible households pay for heating fuel and electric heat costs.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  '(802) 775-0878', NULL, 'https://www.broc.org',
  'Income-based eligibility; assistance available November through May',
  ARRAY['Heating fuel assistance','Electric heat assistance','Home energy bill help'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-liheap-crisis', 'LIHEAP Crisis Fuel Assistance — BROC',
  'Emergency fuel assistance for income-eligible households facing a heating crisis or fuel runout.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  '(802) 775-0878', NULL, 'https://www.broc.org',
  'Fuel emergency; income-eligible households',
  ARRAY['Emergency fuel delivery','Crisis heating assistance'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-weatherization', 'Weatherization Assistance Program — BROC',
  'Free home energy efficiency upgrades including insulation, air sealing, and heating system repairs for income-eligible households.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  '(802) 665-1748', NULL, 'https://www.broc.org',
  'Income-eligible households in Rutland/Bennington counties',
  ARRAY['Free insulation','Air sealing','Heating system repair','Energy audits'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-efficiency-vt', 'Efficiency Vermont Income-Qualified Programs',
  'Free energy-efficient appliances, lighting, and insulation for income-qualified Vermont households.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  '(888) 921-5990', NULL, 'https://www.efficiencyvermont.com',
  'Income-eligible Vermont households',
  ARRAY['Free efficient appliances','Insulation','Lighting upgrades','Energy savings'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-gmp-customer-assistance', 'Green Mountain Power Customer Assistance',
  'Bill payment assistance, budget billing, and arrearage management for Green Mountain Power customers experiencing hardship.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  '(888) 835-4672', NULL, 'https://www.greenmountainpower.com',
  'GMP customers experiencing financial hardship',
  ARRAY['Electric bill assistance','Budget billing','Arrearage management','Payment plans'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-lifeline', 'Lifeline Phone and Internet Assistance',
  'FCC program providing monthly discounts on phone and broadband internet service for eligible low-income households.',
  'utilities', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.lifelinesupport.org',
  'Income ≤135% FPL or enrolled in Medicaid, SNAP, SSI, or other qualifying programs',
  ARRAY['Phone bill discount','Internet bill discount','Monthly service credit'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- EMPLOYMENT (5)
-- ============================================================
(
  'rutland-vt-dol-crc', 'Vermont DOL Career Resource Center — Rutland',
  'Vermont Department of Labor office providing job search assistance, unemployment insurance, resume help, and labor market information.',
  'employment', '200 Asa Bloomer Building', 'Rutland', 'VT', '05701',
  '(802) 786-5837', NULL, 'https://labor.vermont.gov',
  'Open to all job seekers',
  ARRAY['Job search assistance','Unemployment insurance','Resume help','Labor market info','Career counseling'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-wioa-training', 'WIOA Adult Training — Vermont DOL',
  'Workforce Innovation and Opportunity Act funded job training, skills development, and career services.',
  'employment', '200 Asa Bloomer Building', 'Rutland', 'VT', '05701',
  '(802) 786-5837', NULL, 'https://labor.vermont.gov',
  'Adults 18+; priority to low-income individuals and veterans',
  ARRAY['Job training','Skills development','Occupational certifications','Career services'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-adult-learning', 'Vermont Adult Learning — Rutland',
  'Free adult education including GED preparation, literacy, numeracy, and English as a Second Language (ESL) classes.',
  'education', NULL, 'Rutland', 'VT', '05701',
  '(802) 775-0617', NULL, 'https://www.vtadultlearning.org',
  'Adults needing GED, basic literacy, numeracy, or ESL instruction',
  ARRAY['GED preparation','Literacy instruction','ESL classes','Numeracy skills'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-hireability', 'HireAbility Vermont — Division of Vocational Rehabilitation',
  'Vocational rehabilitation services helping Vermonters with disabilities prepare for, find, and keep employment.',
  'employment', '26 West St', 'Rutland', 'VT', '05701',
  '(866) 690-1944', NULL, 'https://labor.vermont.gov/dvr',
  'Vermonters with physical, mental, or cognitive disabilities',
  ARRAY['Vocational rehabilitation','Job placement','Career counseling','Assistive technology','Job coaching'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-resource-vt', 'ReSOURCE Vermont — Job Training',
  'Social enterprise providing job training and employment opportunities for youth and adults, including retail, construction, and logistics.',
  'employment', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.resourcevt.org',
  'Youth and adults seeking job training and employment experience',
  ARRAY['Job training','Work experience','Retail training','Construction training','Employment placement'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- FINANCIAL (9)
-- ============================================================
(
  'rutland-reach-up', 'Reach Up (Vermont TANF)',
  'Vermont''s Temporary Assistance for Needy Families program providing cash assistance and support services to families with children.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://mybenefits.vermont.gov',
  'Families with dependent children meeting income limits',
  ARRAY['Cash assistance','Employment support','Childcare assistance','Transportation help'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-essential-person', 'Essential Person Program — Vermont DCF',
  'Cash assistance for elderly or disabled individuals who live with and depend on a caregiver.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://dcf.vermont.gov',
  'Elderly or disabled individuals living with an essential caregiver; income limits apply',
  ARRAY['Cash assistance','Caregiver support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-emergency-assistance', 'Emergency Assistance — Vermont DCF',
  'One-time emergency cash assistance for families with children facing a crisis such as loss of housing or utilities.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://dcf.vermont.gov/benefits/ea',
  'Families with dependent children in a crisis situation',
  ARRAY['Emergency cash assistance','One-time benefit','Crisis intervention'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-general-assistance', 'General Assistance — Vermont DCF',
  'Emergency financial assistance for individuals and households facing a crisis with no other resources available.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://dcf.vermont.gov/benefits/ga',
  'Individuals in emergency need with no other resources',
  ARRAY['Emergency financial assistance','Rent/utility help','One-time aid'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-ssi', 'Supplemental Security Income (SSI)',
  'Federal program providing monthly cash payments to aged, blind, or disabled individuals with limited income and resources.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.ssa.gov/ssi',
  'Aged 65+ or blind or disabled; limited income and assets',
  ARRAY['Monthly cash payments','Disability income','Senior income support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-ssdi', 'Social Security Disability Insurance (SSDI)',
  'Federal disability insurance benefits for workers who have paid Social Security taxes and become disabled.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.ssa.gov/disability',
  'Workers with a qualifying disability and sufficient work credits',
  ARRAY['Monthly disability benefits','Medicare after 24 months'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-eitc', 'Earned Income Tax Credit (EITC)',
  'Federal and Vermont state tax credits for working individuals and families with low to moderate incomes.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit',
  'Working individuals and families below income thresholds; claim on tax return',
  ARRAY['Federal tax credit','Vermont state EITC','Refundable tax benefit'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-renter-rebate', 'Vermont Renter Rebate Program',
  'Vermont property tax rebate for renters with income under approximately $47,000.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://tax.vermont.gov/property-owners/renter-rebate',
  'Vermont renters with household income under ~$47,000',
  ARRAY['Property tax rebate','Annual benefit','Renter assistance'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vita', 'VITA Free Tax Preparation',
  'IRS Volunteer Income Tax Assistance program offering free tax return preparation for households earning under ~$67,000.',
  'financial', NULL, 'Rutland', 'VT', '05701',
  '211', NULL, 'https://www.irs.gov/vita',
  'Households with income under ~$67,000; call 2-1-1 for local site',
  ARRAY['Free tax preparation','EITC filing','Tax credits','IRS forms'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- CHILDCARE (5)
-- ============================================================
(
  'rutland-ccfap', 'Child Care Financial Assistance Program (CCFAP)',
  'Vermont''s subsidized childcare program helping working families pay for licensed childcare.',
  'childcare', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://dcf.vermont.gov/benefits/ccfap',
  'Families earning up to 575% FPL who need childcare for work, education, or job training',
  ARRAY['Childcare subsidies','Licensed childcare payment','Working family support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-head-start', 'Head Start — Community Care Network',
  'Federally funded early childhood program for children ages 3–5 from low-income families, providing education, health, and family services.',
  'childcare', '78 Meadow St', 'Rutland', 'VT', '05701',
  '(802) 775-8225', NULL, 'https://www.ccnvt.org',
  'Children 3–5 years old from families at or below 100% FPL',
  ARRAY['Early childhood education','Health screenings','Family services','Meals','Transportation'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-early-head-start', 'Early Head Start — Community Care Network',
  'Early childhood program for pregnant women and children ages 0–3 from low-income families.',
  'childcare', '78 Meadow St', 'Rutland', 'VT', '05701',
  '(802) 775-8225', NULL, 'https://www.ccnvt.org',
  'Pregnant women and children 0–3 from low-income families',
  ARRAY['Infant/toddler care','Prenatal support','Home visiting','Family support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-universal-prek', 'Universal Pre-K — Vermont School Districts',
  'Vermont''s universal pre-kindergarten program providing 10 hours per week of free pre-K for all 3 and 4 year olds.',
  'childcare', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://education.vermont.gov/vermont-schools/early-education',
  'All Vermont children ages 3–4 regardless of income',
  ARRAY['Free pre-K','10 hours/week','Early education','School readiness'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-afterschool-programs', 'Afterschool Programs — Rutland Rec & Boys and Girls Club',
  'Afterschool and summer programs for school-age children through Rutland Recreation and Boys & Girls Club; scholarships available.',
  'childcare', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.rutlandcity.org/recreation',
  'School-age children; income-based scholarships available',
  ARRAY['Afterschool care','Summer programs','Youth activities','Scholarships available'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- LEGAL (4)
-- ============================================================
(
  'rutland-vt-legal-aid', 'Vermont Legal Aid — Rutland Office',
  'Free civil legal assistance for low-income Vermonters in areas including housing, benefits, family, and consumer law.',
  'legal', '1085 US-4 Unit 1A', 'Rutland', 'VT', '05701',
  '(802) 775-0021', NULL, 'https://www.vtlegalaid.org',
  'Low-income Vermonters; civil legal matters',
  ARRAY['Free legal help','Housing law','Benefits appeals','Family law','Consumer protection'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-legal-services-vt', 'Legal Services Vermont',
  'Free civil legal services for low-income Vermonters including consumer debt, housing, and public benefits matters.',
  'legal', NULL, 'Rutland', 'VT', '05701',
  '(800) 889-2047', NULL, 'https://www.lawlinevt.org',
  'Low-income Vermonters; consumer, housing, and benefits cases',
  ARRAY['Free legal advice','Consumer law','Housing','Benefits','Debt issues'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-disability-rights-vt', 'Disability Rights Vermont',
  'Protection and advocacy organization providing legal and self-advocacy services to Vermonters with disabilities.',
  'legal', NULL, 'Rutland', 'VT', '05701',
  '(800) 834-7890', NULL, 'https://www.disabilityrightsvt.org',
  'Vermonters with disabilities',
  ARRAY['Legal advocacy','Disability rights','Self-advocacy training','Systems advocacy'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-health-care-advocate', 'Vermont Health Care Advocate — Vermont Legal Aid',
  'Free help for Vermonters dealing with health insurance denials, billing problems, and access to care issues.',
  'legal', NULL, 'Rutland', 'VT', '05701',
  '(800) 917-7787', NULL, 'https://www.vtlegalaid.org/health-care-advocate',
  'All Vermonters with health insurance problems',
  ARRAY['Insurance denial appeals','Billing disputes','Access to care','Health benefits help'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- DISABILITY SERVICES (3)
-- ============================================================
(
  'rutland-dail', 'Vermont DAIL — Developmental and Physical Disabilities',
  'Vermont Agency of Human Services Department of Disabilities, Aging and Independent Living providing services for people with disabilities.',
  'disability_services', NULL, 'Rutland', 'VT', '05701',
  '(802) 241-2401', NULL, 'https://dail.vermont.gov',
  'Vermonters with developmental or physical disabilities',
  ARRAY['Developmental services','Physical disability services','Home and community-based waiver','Case management'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vcil', 'Vermont Center for Independent Living (VCIL)',
  'Consumer-controlled independent living center providing peer support, skills training, and advocacy for people with disabilities.',
  'disability_services', '60 Center St #1', 'Rutland', 'VT', '05701',
  '(800) 639-1522', NULL, 'https://www.vcil.org',
  'People with all types of disabilities',
  ARRAY['Independent living skills','Peer counseling','Benefits counseling','Home modifications','Advocacy'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-hireability-dvr', 'HireAbility Vermont — Vocational Rehabilitation (DVR)',
  'Division of Vocational Rehabilitation career counseling, job placement, and assistive technology for Vermonters with disabilities.',
  'disability_services', '26 West St', 'Rutland', 'VT', '05701',
  '(866) 690-1944', NULL, 'https://labor.vermont.gov/dvr',
  'Vermonters with disabilities seeking employment',
  ARRAY['Vocational rehabilitation','Career counseling','Job placement','Assistive technology'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- VETERAN SERVICES (5)
-- ============================================================
(
  'rutland-vt-veterans-services', 'Vermont Office of Veterans Affairs',
  'State office providing benefits counseling, claims assistance, and referrals for all Vermont veterans.',
  'veteran_services', NULL, 'Rutland', 'VT', '05701',
  '(888) 666-9844', NULL, 'https://veterans.vermont.gov',
  'All Vermont veterans and their families',
  ARRAY['Benefits counseling','Claims assistance','VA referrals','State veteran programs'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-va-cboc', 'VA Community-Based Outpatient Clinic — Rutland',
  'VA outpatient clinic at CHCRR providing primary care and mental health services to enrolled veterans.',
  'veteran_services', '215 Stratton Rd', 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.va.gov',
  'Veterans enrolled in the VA healthcare system',
  ARRAY['Primary care','Mental health','Preventive care','VA specialty referrals'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-white-river-vamc', 'White River Junction VA Medical Center',
  'Full-service VA medical center serving Vermont veterans with comprehensive medical, surgical, and mental health care.',
  'veteran_services', NULL, 'White River Junction', 'VT', '05001',
  '(802) 295-9363', NULL, 'https://www.va.gov/white-river-junction-health-care',
  'Veterans enrolled in VA healthcare system',
  ARRAY['Full VA medical care','Surgery','Mental health','Rehabilitation','Specialty care'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-hud-vash', 'HUD-VASH — Veterans Homelessness Assistance',
  'Joint HUD-VA program combining housing vouchers with VA supportive services for homeless veterans.',
  'veteran_services', NULL, 'Rutland', 'VT', '05701',
  '(877) 424-3838', NULL, 'https://www.va.gov/homeless/hud-vash.asp',
  'Homeless veterans',
  ARRAY['Housing vouchers','VA case management','Permanent supportive housing'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-veterans-fund', 'Vermont Veterans Fund',
  'State emergency financial assistance fund for Vermont veterans facing a crisis.',
  'veteran_services', NULL, 'Rutland', 'VT', '05701',
  '(888) 666-9844', NULL, 'https://veterans.vermont.gov',
  'Vermont veterans in financial crisis',
  ARRAY['Emergency financial assistance','Veteran crisis aid'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- SENIOR SERVICES (4)
-- ============================================================
(
  'rutland-svcoa', 'Southwestern Vermont Council on Aging (SVCOA)',
  'Area Agency on Aging serving seniors 60+ in Rutland and Bennington counties with meals, transportation, benefits counseling, and more.',
  'senior_services', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5990', NULL, 'https://www.svcoa.org',
  'Adults 60+ in Rutland and Bennington counties',
  ARRAY['Meals on wheels','Senior transportation','Benefits counseling','Case management','Caregiver support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-choices-for-care', 'Choices for Care — Vermont Long-Term Care',
  'Vermont''s Medicaid waiver program allowing elderly and disabled individuals to receive long-term care at home or in a residential setting.',
  'senior_services', NULL, 'Rutland', 'VT', '05701',
  '(800) 479-6151', NULL, 'https://dail.vermont.gov/choices-for-care',
  'Elderly or disabled Vermonters who are Medicaid-eligible and need nursing home level of care',
  ARRAY['Home-based long-term care','Residential care','Personal care','Nursing home alternative'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-medicare-savings', 'Medicare Savings Programs',
  'Vermont programs helping Medicare beneficiaries with limited income pay their Medicare premiums, deductibles, and copays.',
  'senior_services', NULL, 'Rutland', 'VT', '05701',
  '(855) 899-9600', NULL, 'https://dvha.vermont.gov/medicare',
  'Medicare beneficiaries with limited income and resources',
  ARRAY['Medicare premium help','Deductible assistance','Copay assistance','Part D extra help'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-senior-companion', 'Senior Companion Program — AmeriCorps Seniors',
  'Volunteer program matching senior volunteers with homebound older adults for companionship and light assistance.',
  'senior_services', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5990', NULL, 'https://americorps.gov/serve/americorps-seniors/senior-companion-program',
  'Homebound seniors needing companionship; 55+ volunteers welcome',
  ARRAY['Companionship','Light assistance','Social connection','Volunteer matching'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- TRANSPORTATION (5)
-- ============================================================
(
  'rutland-marble-valley-transit', 'Marble Valley Regional Transit District (The Bus)',
  'Public bus service in Rutland County with routes throughout the city and region; reduced fares for seniors and people with disabilities.',
  'transportation', NULL, 'Rutland', 'VT', '05701',
  '(802) 773-3244', NULL, 'https://www.thebus.com',
  'Open to all riders; reduced fares for seniors and disabled individuals',
  ARRAY['Fixed-route bus service','Reduced senior fares','ADA paratransit'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-medicaid-transport', 'Medicaid Non-Emergency Medical Transportation',
  'Free transportation to medical appointments for Medicaid enrollees who have no other means of getting to care.',
  'transportation', NULL, 'Rutland', 'VT', '05701',
  '(802) 747-3502', NULL, 'https://dvha.vermont.gov',
  'Medicaid recipients needing transportation to medical appointments',
  ARRAY['Free medical rides','Appointment transportation','Medicaid transport benefit'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-good-news-garage-donated', 'Good News Garage — Donated Wheels Program',
  'Donated vehicles for Reach Up (TANF) participants to support employment and self-sufficiency.',
  'transportation', NULL, 'Rutland', 'VT', '05701',
  '(877) 448-3288', NULL, 'https://www.goodnewsgarage.org',
  'Reach Up (TANF) program participants',
  ARRAY['Donated vehicles','Car ownership support','Work transportation'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-good-news-garage-ready', 'Good News Garage — Ready to Go Program',
  'Free rides to work for low-income Vermonters who need transportation assistance to maintain employment.',
  'transportation', NULL, 'Rutland', 'VT', '05701',
  '(877) 448-3288', NULL, 'https://www.goodnewsgarage.org',
  'Low-income individuals who need rides to maintain employment',
  ARRAY['Free work rides','Employment transportation'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-svcoa-volunteer-drivers', 'SVCOA Volunteer Driver Program',
  'Volunteer driver program providing rides to medical appointments and essential errands for seniors and people with disabilities.',
  'transportation', NULL, 'Rutland', 'VT', '05701',
  '(802) 786-5990', NULL, 'https://www.svcoa.org',
  'Seniors 60+ and individuals with disabilities in Rutland/Bennington counties',
  ARRAY['Volunteer driver rides','Medical appointment transport','Essential errands'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- IMMIGRATION (4)
-- ============================================================
(
  'rutland-uscri-vt', 'USCRI Vermont — US Committee for Refugees and Immigrants',
  'Resettlement and integration services for refugees and asylees in Vermont.',
  'immigration', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://refugees.org/uscri-vermont',
  'Refugees, asylees, and other immigrants in Vermont',
  ARRAY['Refugee resettlement','Employment services','ESL','Benefits enrollment','Cultural orientation'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-aalv', 'Association of Africans Living in Vermont (AALV)',
  'Organization serving African and other New American communities in Vermont with integration, advocacy, and cultural support.',
  'immigration', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.aalv-vt.org',
  'New Americans, African immigrants, and refugees in Vermont',
  ARRAY['Cultural support','Community advocacy','Integration services','Translation','Community events'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-asylum-assistance', 'Vermont Asylum Assistance Program (VAAP)',
  'Legal assistance and support services for asylum seekers in Vermont.',
  'immigration', NULL, 'Rutland', 'VT', '05701',
  NULL, NULL, 'https://www.vaapvt.org',
  'Asylum seekers in Vermont',
  ARRAY['Asylum legal assistance','Case management','Community support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-state-refugee-office', 'Vermont State Refugee Office',
  'State office coordinating refugee resettlement services and integration support across Vermont.',
  'immigration', NULL, 'Rutland', 'VT', '05701',
  '(802) 241-0440', NULL, 'https://ifs.vermont.gov/refugees',
  'Refugees and asylees resettled in Vermont',
  ARRAY['Refugee coordination','Benefits enrollment','Employment support','Integration services'],
  'admin_added', 'approved', true, now()
),

-- ============================================================
-- OTHER / MULTI-SERVICE (6)
-- ============================================================
(
  'rutland-211-vermont', '211 Vermont — United Way Information & Referral',
  '24/7 free and confidential information and referral service connecting Vermonters to health, human service, and community resources.',
  'other', NULL, 'Rutland', 'VT', '05701',
  '211', NULL, 'https://www.vermont211.org',
  'All Vermonters; available 24/7 by calling or texting 2-1-1',
  ARRAY['Resource referral','Benefits navigation','Crisis support','24/7 availability','Multilingual'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-united-way', 'United Way of Rutland County',
  'Local United Way chapter investing in education, financial stability, and health for Rutland County residents.',
  'other', NULL, 'Rutland', 'VT', '05701',
  '(802) 773-7477', NULL, 'https://www.unitedwayrutland.org',
  'Rutland County residents',
  ARRAY['Community programs','Volunteer opportunities','VITA tax prep','Resource navigation'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-broc-community-action', 'BROC Community Action',
  'Community action agency serving Bennington and Rutland counties with energy, housing, food, employment, and other assistance programs.',
  'other', NULL, 'Rutland', 'VT', '05701',
  '(802) 665-1748', NULL, 'https://www.broc.org',
  'Bennington and Rutland county residents',
  ARRAY['Energy assistance','Food shelf','Housing help','Employment services','Head Start','Weatherization'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-salvation-army', 'Salvation Army — Rutland Corps',
  'Emergency financial assistance, food, clothing, and social services for individuals and families in crisis.',
  'other', '2 Roberts Ave', 'Rutland', 'VT', '05701',
  '(802) 775-1264', NULL, 'https://www.salvationarmyusa.org',
  'Individuals and families in crisis need',
  ARRAY['Emergency financial assistance','Food pantry','Clothing','Holiday programs','Crisis services'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-vt-catholic-charities', 'Vermont Catholic Charities',
  'Social service agency providing emergency assistance, immigration services, and family support regardless of faith background.',
  'other', NULL, 'Rutland', 'VT', '05701',
  '(802) 658-6110', NULL, 'https://www.vermontcatholic.org/charities',
  'All individuals and families regardless of religion',
  ARRAY['Emergency financial aid','Immigration services','Refugee resettlement','Family support'],
  'admin_added', 'approved', true, now()
),
(
  'rutland-esd', 'Rutland Economic Services Division (ESD) — Vermont DCF',
  'State office serving as the gateway for applying for Vermont benefit programs including 3SquaresVT, Medicaid, Reach Up, and General Assistance.',
  'other', '200 Asa Bloomer Building', 'Rutland', 'VT', '05701',
  '(802) 786-5817', NULL, 'https://mybenefits.vermont.gov',
  'All Rutland County residents seeking state benefit programs',
  ARRAY['Benefits application','3SquaresVT enrollment','Medicaid enrollment','Reach Up','Case management'],
  'admin_added', 'approved', true, now()
)

ON CONFLICT (external_id, source) DO NOTHING;
