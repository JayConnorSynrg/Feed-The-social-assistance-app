-- Seed: Rutland/Vermont starter resources for 6 new resource_category enum values.
-- Phase 1c — launched 2026-06-08.
-- Reversible: DELETE FROM resources WHERE external_id LIKE 'seed-vt-2026-%';
-- Idempotent: ON CONFLICT (external_id, source) DO NOTHING.
-- Geocoding: ST_SetSRID(ST_MakePoint(<lng>, <lat>), 4326)::geography (lng-first per PostGIS convention).
-- Sources cited inline for each resource.

-- ============================================================
-- EITC / TAX FILING (4 resources)
-- Sources:
--   United Way of Rutland County VITA: https://www.unitedwayrutland.org/vita-free-tax-preparation/
--   AARP Tax-Aide VT: https://www.aarp.org/money/taxes/aarp_taxaide/
--   Vermont EITC: https://tax.vermont.gov/individual/eitc
--   MyFreeTaxes / United Way VT: https://www.unitedwayvt.org/myfreetaxes
-- ============================================================

INSERT INTO public.resources (
  external_id, name, description, category,
  address_line1, city, state, zip_code,
  phone, website,
  eligibility_requirements, services_offered,
  source, status, is_verified, last_verified_at,
  location
)
VALUES

(
  'seed-vt-2026-eitc_tax_filing-1',
  'VITA Free Tax Preparation — United Way of Rutland County',
  'IRS Volunteer Income Tax Assistance (VITA) site hosted by United Way of Rutland County. Trained volunteers prepare and e-file federal and Vermont state returns at no cost, including EITC and Child Tax Credit claims.',
  'eitc_tax_filing',
  NULL, 'Rutland', 'VT', '05701',
  '(802) 773-7477',
  'https://www.unitedwayrutland.org/vita-free-tax-preparation/',
  'Households with annual income under approximately $67,000; bring photo ID, Social Security cards, and prior-year return',
  ARRAY['Free federal tax preparation','Free Vermont state return','EITC filing','Child Tax Credit','E-file'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-eitc_tax_filing-2',
  'AARP Tax-Aide — Vermont Sites',
  'AARP Foundation Tax-Aide provides free federal and state income tax preparation assistance for taxpayers with low-to-moderate incomes, with special attention to those 50 and older. Multiple Vermont sites operate January through April.',
  'eitc_tax_filing',
  NULL, 'Rutland', 'VT', '05701',
  '(888) 687-2277',
  'https://www.aarp.org/money/taxes/aarp_taxaide/',
  'All taxpayers with low to moderate income; no AARP membership required',
  ARRAY['Free tax preparation','EITC assistance','Senior-focused','Volunteer-staffed','E-file'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-eitc_tax_filing-3',
  'Vermont Earned Income Tax Credit (EITC)',
  'Vermont offers a refundable state EITC equal to 38% of the federal EITC for working individuals and families. Claim it on your Vermont income tax return using Form IN-111. Working Vermonters who qualify for the federal EITC automatically qualify.',
  'eitc_tax_filing',
  NULL, 'Montpelier', 'VT', '05602',
  '(802) 828-2865',
  'https://tax.vermont.gov/individual/eitc',
  'Vermont residents who qualify for the federal EITC; earned income limits apply based on filing status and number of children',
  ARRAY['State EITC refund','38% of federal EITC','Vermont tax credit','Refundable benefit'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.577680, 44.259720), 4326)::geography
),

(
  'seed-vt-2026-eitc_tax_filing-4',
  'MyFreeTaxes — United Way of Vermont',
  'Free online DIY federal and state tax filing for households earning under $73,000, offered through United Way of Vermont in partnership with H&R Block. Available statewide with no income minimum.',
  'eitc_tax_filing',
  NULL, 'Burlington', 'VT', '05401',
  NULL,
  'https://www.unitedwayvt.org/myfreetaxes',
  'Vermont households earning under $73,000 annually',
  ARRAY['Free online tax filing','Federal and state returns','DIY e-file','EITC and credits','Statewide access'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-73.209998, 44.476621), 4326)::geography
),


-- ============================================================
-- FREE LEGAL (4 resources)
-- Sources:
--   Vermont Legal Aid Rutland: https://www.vtlegalaid.org/get-help
--   Legal Services Vermont / LawLineVT: https://www.lawlinevt.org
--   Have Justice Will Travel: https://www.havejusticewilltravel.org
--   VT Bar Association Lawyer Referral Service: https://www.vtbar.org/public/lawyer-referral-service/
-- ============================================================

(
  'seed-vt-2026-free_legal-1',
  'Vermont Legal Aid — Rutland Office',
  'Vermont Legal Aid provides free civil legal representation and advice to low-income Vermonters in housing, public benefits, health care, family, and consumer law matters. The Rutland office serves Rutland and Bennington counties.',
  'free_legal',
  '1085 US-4 Unit 1A', 'Rutland', 'VT', '05701',
  '(802) 775-0021',
  'https://www.vtlegalaid.org',
  'Vermont residents with household income at or below 200% of federal poverty level; civil legal matters only',
  ARRAY['Free civil legal help','Housing law','Benefits appeals','Family law','Consumer protection','Healthcare advocacy'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-free_legal-2',
  'Legal Services Vermont — LawLineVT',
  'Legal Services Vermont operates LawLineVT, a free statewide legal helpline for low-income Vermonters. Attorneys provide advice and brief services on consumer debt, housing, benefits, and family matters by phone.',
  'free_legal',
  NULL, 'Burlington', 'VT', '05401',
  '(800) 889-2047',
  'https://www.lawlinevt.org',
  'Low-income Vermont residents; income at or below 200% FPL for most services',
  ARRAY['Free legal advice by phone','Consumer debt','Housing','Public benefits','Family law','Brief legal services'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-73.209998, 44.476621), 4326)::geography
),

(
  'seed-vt-2026-free_legal-3',
  'Have Justice Will Travel',
  'Have Justice Will Travel provides free civil legal services to low-income Vermonters in rural communities, traveling to meet clients where they are. Covers family law, housing, benefits, and domestic violence matters.',
  'free_legal',
  NULL, 'Montpelier', 'VT', '05602',
  '(802) 225-8373',
  'https://www.havejusticewilltravel.org',
  'Low-income Vermont residents, particularly in rural areas; sliding-scale and free services available',
  ARRAY['Free civil legal services','Rural outreach','Family law','Domestic violence','Housing','Benefits'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.577680, 44.259720), 4326)::geography
),

(
  'seed-vt-2026-free_legal-4',
  'Vermont Bar Association Lawyer Referral Service',
  'The Vermont Bar Association Lawyer Referral Service connects Vermonters with licensed attorneys for a free or reduced-cost 30-minute initial consultation. Covers civil and family law matters statewide.',
  'free_legal',
  NULL, 'Montpelier', 'VT', '05602',
  '(802) 223-2020',
  'https://www.vtbar.org/public/lawyer-referral-service/',
  'Any Vermont resident needing legal help; initial consultation fee may apply for some referrals',
  ARRAY['Attorney referral','Free initial consultation','Family law','Civil matters','Statewide'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.577680, 44.259720), 4326)::geography
),


-- ============================================================
-- PRENATAL / NATAL CARE (4 resources)
-- Sources:
--   RRMC Women's Health / Maternity: https://www.rrmc.org/services/womens-health/
--   Vermont WIC prenatal: https://www.healthvermont.gov/wic
--   Lund Family Center: https://www.lundvt.org
--   CHCRR prenatal care: https://www.chcrr.org/services/
-- ============================================================

(
  'seed-vt-2026-prenatal_natal_care-1',
  'RRMC Women''s Health & Maternity Care',
  'Rutland Regional Medical Center Women''s Health and Maternity services provide comprehensive prenatal, labor and delivery, and postpartum care. The Birth Center offers evidence-based obstetric and midwifery care for Rutland area families.',
  'prenatal_natal_care',
  '160 Allen St', 'Rutland', 'VT', '05701',
  '(802) 775-7111',
  'https://www.rrmc.org/services/womens-health/',
  'All pregnant and postpartum patients; accepts Medicaid, Vermont Health Connect plans, and most private insurance; financial assistance available',
  ARRAY['Prenatal care','Labor and delivery','Birth center','Midwifery','Postpartum care','Lactation support'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-prenatal_natal_care-2',
  'WIC Prenatal and Infant Program — Vermont Health Department',
  'Vermont WIC (Women, Infants and Children) provides nutrition support, breastfeeding assistance, referrals, and food benefits to pregnant, postpartum, and breastfeeding women, infants, and children up to age 5. Free and confidential.',
  'prenatal_natal_care',
  '88 Merchants Row', 'Rutland', 'VT', '05701',
  '(802) 773-3202',
  'https://www.healthvermont.gov/wic',
  'Pregnant, postpartum, or breastfeeding women; infants; children under 5; household income at or below 185% FPL',
  ARRAY['Prenatal nutrition support','Food benefits','Breastfeeding support','Infant formula','Healthcare referrals','Postpartum care'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-prenatal_natal_care-3',
  'CHCRR Prenatal and OB/GYN Care',
  'Community Health Centers of the Rutland Region (CHCRR) offers prenatal care, obstetrics, and gynecology services on a sliding fee scale based on income. Federally Qualified Health Center accepting all patients regardless of ability to pay.',
  'prenatal_natal_care',
  '215 Stratton Rd', 'Rutland', 'VT', '05701',
  '(802) 773-8604',
  'https://www.chcrr.org',
  'All patients regardless of ability to pay; sliding fee scale; accepts Medicaid, Dr. Dynasaur, and most insurance',
  ARRAY['Prenatal care','OB/GYN','Sliding fee scale','Federally Qualified Health Center','Postpartum visits'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-prenatal_natal_care-4',
  'Lund Family Center — Pregnancy and Parenting Support',
  'Lund provides statewide Vermont support for pregnant women and new parents including residential services, counseling, adoption services, and community-based family support programs for those facing complex circumstances.',
  'prenatal_natal_care',
  NULL, 'Burlington', 'VT', '05401',
  '(802) 864-7467',
  'https://www.lundvt.org',
  'Pregnant women and new parents in Vermont, particularly those facing housing instability, substance use challenges, or other complex needs',
  ARRAY['Pregnancy support','Residential program','Counseling','Adoption services','Parenting support','Statewide'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-73.209998, 44.476621), 4326)::geography
),


-- ============================================================
-- WASTE DISPOSAL (3 resources)
-- Sources:
--   Rutland County Solid Waste District (RCSWD): https://www.rcswd.com
--   Vermont Product Stewardship Initiative: https://www.vpsi.org
--   Casella Waste / RecycleRight VT: https://recyclerightvt.com
-- ============================================================

(
  'seed-vt-2026-waste_disposal-1',
  'Rutland County Solid Waste District (RCSWD)',
  'The Rutland County Solid Waste District provides waste disposal, recycling, composting, hazardous waste drop-off events, and e-waste collection for Rutland County residents. Accepts many materials free or at low cost at its Center Rutland facility.',
  'waste_disposal',
  '2501 US-4', 'Center Rutland', 'VT', '05736',
  '(802) 775-7209',
  'https://www.rcswd.com',
  'Rutland County residents and businesses; some services available to all Vermont residents',
  ARRAY['Recycling drop-off','Hazardous waste disposal','E-waste collection','Composting','Bulky waste','Paint drop-off'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.995600, 43.622500), 4326)::geography
),

(
  'seed-vt-2026-waste_disposal-2',
  'Vermont Product Stewardship — Paint, Electronics & More',
  'Vermont Product Stewardship Initiative coordinates free drop-off programs for paint (PaintCare), batteries, electronics, thermostats, and mattresses at retail and municipal locations statewide. Many drop-off sites are free to consumers.',
  'waste_disposal',
  NULL, 'Montpelier', 'VT', '05602',
  NULL,
  'https://www.vpsi.org',
  'All Vermont residents; consumer products only (paint, batteries, electronics, thermostats, fluorescent bulbs)',
  ARRAY['Free paint drop-off','Battery recycling','Electronics recycling','Thermostat disposal','Fluorescent bulb disposal','Statewide sites'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.577680, 44.259720), 4326)::geography
),

(
  'seed-vt-2026-waste_disposal-3',
  'RecycleRight Vermont — Statewide Guidance',
  'RecycleRight Vermont is a statewide program providing residents with clear guidance on what can be recycled, composted, or properly disposed of. Includes an online search tool for drop-off locations and accepted materials across Vermont.',
  'waste_disposal',
  NULL, 'Montpelier', 'VT', '05602',
  NULL,
  'https://recyclerightvt.com',
  'All Vermont residents',
  ARRAY['Recycling guidance','Drop-off locator','Composting resources','Accepted materials list','Online search tool'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.577680, 44.259720), 4326)::geography
),


-- ============================================================
-- FREE CAMPING (4 resources)
-- Sources:
--   Gifford Woods State Park: https://vtstateparks.com/giffordwoods.html
--   Calvin Coolidge State Forest dispersed: https://vtstateparks.com/coolidge.html
--   Green Mountain National Forest dispersed camping: https://www.fs.usda.gov/gmfl
--   Half Moon State Park: https://vtstateparks.com/halfmoon.html
-- ============================================================

(
  'seed-vt-2026-free_camping-1',
  'Green Mountain National Forest — Free Dispersed Camping',
  'The Green Mountain National Forest allows free dispersed (backcountry) camping throughout most of the forest, with no permit required for stays up to 14 days. Campers must set up at least 200 feet from trails, water, and roads. Covers much of central and southern Vermont including the Rutland area.',
  'free_camping',
  NULL, 'Rutland', 'VT', '05701',
  '(802) 747-6700',
  'https://www.fs.usda.gov/gmfl',
  'No permit required; free for up to 14 consecutive nights; must follow Leave No Trace principles; some areas have restrictions — check district maps',
  ARRAY['Free dispersed camping','No permit required','Up to 14 nights','Backcountry','Statewide forest access'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-free_camping-2',
  'Gifford Woods State Park — Primitive Tent Sites',
  'Gifford Woods State Park near Killington offers lean-to and tent sites in a rare hardwood forest. The park has low-cost camping and primitive sites accessible to backcountry users on the Appalachian/Long Trail. State park fee waivers available for income-qualifying Vermont residents.',
  'free_camping',
  '34 Gifford Woods Rd', 'Killington', 'VT', '05751',
  '(802) 775-5354',
  'https://vtstateparks.com/giffordwoods.html',
  'Open to all; nightly camping fee applies; Vermont residents may qualify for fee waiver through state park assistance programs; check vtstateparks.com',
  ARRAY['Tent sites','Lean-to sites','Appalachian/Long Trail access','Fishing','Primitive camping','Fee-waiver eligible'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.784406, 43.657594), 4326)::geography
),

(
  'seed-vt-2026-free_camping-3',
  'Calvin Coolidge State Forest — Free Dispersed Camping',
  'Calvin Coolidge State Forest covers over 26,000 acres in Windsor County and permits free primitive dispersed camping in designated areas away from developed campgrounds. No permit required for backcountry stays following Vermont ANR guidelines.',
  'free_camping',
  NULL, 'Plymouth', 'VT', '05056',
  '(802) 886-2434',
  'https://vtstateparks.com/coolidge.html',
  'Free dispersed camping in undeveloped forest areas; no permit required; follow Vermont ANR dispersed camping rules; no fires during dry conditions',
  ARRAY['Free dispersed camping','Primitive camping','26,000-acre forest','No permit required','Backcountry hiking'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.693694, 43.508853), 4326)::geography
),

(
  'seed-vt-2026-free_camping-4',
  'Half Moon State Park — Primitive Lean-To Sites',
  'Half Moon State Park in Orwell (Addison County) offers lean-to sites and tent sites at low cost in a remote lakeside setting. Vermont residents facing financial hardship may access the Vermont State Parks fee-assistance program for free or reduced-rate camping.',
  'free_camping',
  '1621 Black Pond Rd', 'Orwell', 'VT', '05760',
  '(802) 948-2816',
  'https://vtstateparks.com/halfmoon.html',
  'Open to all campers; nightly fee applies; Vermont residents may qualify for VT State Parks fee assistance; call ahead for availability',
  ARRAY['Lean-to sites','Tent camping','Lakeside','Remote setting','Fee assistance available','Primitive camping'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-73.309367, 43.669913), 4326)::geography
),


-- ============================================================
-- FREE GOODS / DONATION (4 resources)
-- Sources:
--   BROC Community Action free goods/clothing: https://www.broc.org
--   ReSOURCE Vermont: https://www.resourcevt.org
--   Habitat for Humanity ReStore Rutland: https://www.habitatrutland.org/restore
--   Salvation Army Family Store Rutland: https://www.salvationarmyusa.org
-- ============================================================

(
  'seed-vt-2026-free_goods_donation-1',
  'ReSOURCE Vermont — Free and Low-Cost Goods',
  'ReSOURCE Vermont is a nonprofit social enterprise accepting and redistributing donated furniture, appliances, clothing, and household goods. Income-qualifying Vermont residents can receive essential items at no cost through their free-goods program. Walk-in and referral-based access.',
  'free_goods_donation',
  '242 Pine St', 'Burlington', 'VT', '05401',
  '(802) 658-4143',
  'https://www.resourcevt.org',
  'Income-qualifying Vermont residents; proof of income or referral from case manager may be requested for free goods; all community members may shop low-cost items',
  ARRAY['Free furniture','Free appliances','Free household goods','Low-cost resale','Donation drop-off','Employment training'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-73.209998, 44.476621), 4326)::geography
),

(
  'seed-vt-2026-free_goods_donation-2',
  'BROC Community Action — Free Clothing and Goods',
  'BROC Community Action distributes donated clothing, household goods, and essential items to individuals and families in need in Rutland and Bennington counties. Contact BROC or visit to inquire about current free-goods availability.',
  'free_goods_donation',
  '45 Union St', 'Rutland', 'VT', '05701',
  '(802) 665-1748',
  'https://www.broc.org',
  'Residents of Rutland and Bennington counties in need; no income documentation required for basic goods',
  ARRAY['Free clothing','Free household goods','Community donations','Essential item distribution','Rutland County'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-free_goods_donation-3',
  'Habitat for Humanity ReStore — Rutland',
  'Habitat for Humanity Rutland Area ReStore sells donated building materials, appliances, furniture, and home goods at deep discounts. Proceeds support affordable housing. Donations accepted. Low-income households can ask about special pricing.',
  'free_goods_donation',
  '40 Curtis Ave', 'Rutland', 'VT', '05701',
  '(802) 775-7769',
  'https://www.habitatrutland.org/restore',
  'Open to all; discounted pricing available; call ahead for current inventory and hours',
  ARRAY['Discounted building materials','Donated appliances','Furniture','Home goods','Donation drop-off','Affordable home improvement'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
),

(
  'seed-vt-2026-free_goods_donation-4',
  'Salvation Army Family Store — Rutland',
  'The Salvation Army Family Store in Rutland accepts donations of clothing, furniture, and household goods and sells them at low prices. Emergency vouchers for free clothing and goods are available to individuals and families in crisis through the Salvation Army social services office.',
  'free_goods_donation',
  '2 Roberts Ave', 'Rutland', 'VT', '05701',
  '(802) 775-1264',
  'https://www.salvationarmyusa.org',
  'All community members welcome; emergency vouchers for free goods available through Salvation Army social services for individuals in crisis',
  ARRAY['Low-cost clothing','Furniture','Household goods','Emergency clothing vouchers','Donation drop-off','Thrift store'],
  'admin_added', 'approved', true, now(),
  ST_SetSRID(ST_MakePoint(-72.910205, 43.624578), 4326)::geography
)

ON CONFLICT (external_id, source) DO NOTHING;
