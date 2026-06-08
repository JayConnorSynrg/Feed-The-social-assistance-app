// App constants
export const APP_NAME = 'FEED';
export const APP_DESCRIPTION = 'Mutual Aid Resource Sharing Platform';

// API endpoints
export const API_ROUTES = {
  AUTH: '/api/auth',
  POSTS: '/api/posts',
  RESOURCES: '/api/resources',
  FORMS: '/api/forms',
  AI: '/api/ai',
} as const;

// Resource categories
// NOTE: pre-existing gap — 9 enum values (financial, mental_health, substance_abuse,
// domestic_violence, clothing, senior_services, disability_services, veteran_services,
// immigration) are in the DB enum but not in this array. They are not added here to
// stay within the requested scope change (add 6 new values only). TypeScript build
// passes because ResourceCategory is a union of literal strings and no code in this
// package forces exhaustive coverage of the enum. If a build error surfaces in
// downstream packages that assign a DB resource.category to ResourceCategory, bring
// the array to full parity with the enum at that point.
export const RESOURCE_CATEGORIES = [
  'food',
  'housing',
  'healthcare',
  'employment',
  'education',
  'transportation',
  'utilities',
  'legal',
  'childcare',
  'other',
  'eitc_tax_filing',
  'free_legal',
  'prenatal_natal_care',
  'waste_disposal',
  'free_camping',
  'free_goods_donation',
] as const;

export type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

// Form types
export const FORM_TYPES = [
  'snap',
  'medicaid',
  'wic',
  'tanf',
  'liheap',
  'section8',
  'other',
] as const;

export type FormType = typeof FORM_TYPES[number];
