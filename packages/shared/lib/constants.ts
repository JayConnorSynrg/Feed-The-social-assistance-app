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
