// apps/web/src/lib/test-data/mock-resources.ts
// Mock resource data for end-to-end testing

export interface MockResource {
  id: string
  name: string
  description: string
  category: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
  phone: string | null
  email: string | null
  website: string | null
  hours: string | null
  eligibility_requirements: string | null
  languages_served: string[]
  services: string[]
  source: 'user_submitted' | '211_api' | 'admin_added' | 'partner_org'
  status: 'pending' | 'approved' | 'rejected' | 'archived'
  is_verified: boolean
}

export const MOCK_RESOURCES: MockResource[] = [
  // Los Angeles Resources
  {
    id: 'resource-001',
    name: 'LA Regional Food Bank',
    description: 'Provides free groceries and food assistance to families in need. No appointment necessary.',
    category: 'food',
    address: '1734 E 41st Street',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90058',
    latitude: 33.9914,
    longitude: -118.2323,
    phone: '(323) 234-3030',
    email: 'info@lafoodbank.org',
    website: 'https://www.lafoodbank.org',
    hours: 'Mon-Fri: 8AM-5PM, Sat: 9AM-1PM',
    eligibility_requirements: 'Must reside in LA County. Bring ID and proof of address.',
    languages_served: ['English', 'Spanish'],
    services: ['Food distribution', 'Emergency food boxes', 'SNAP enrollment assistance'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
    id: 'resource-002',
    name: 'PATH Housing Services',
    description: 'Emergency shelter and housing assistance for individuals and families experiencing homelessness.',
    category: 'housing',
    address: '340 N Madison Ave',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90004',
    latitude: 34.0765,
    longitude: -118.2887,
    phone: '(323) 644-2200',
    email: 'contact@epath.org',
    website: 'https://epath.org',
    hours: '24/7 for emergency services',
    eligibility_requirements: 'Priority given to veterans and families with children.',
    languages_served: ['English', 'Spanish', 'Korean'],
    services: ['Emergency shelter', 'Transitional housing', 'Case management', 'Job training'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
    id: 'resource-003',
    name: 'St. John\'s Community Health Center',
    description: 'Affordable healthcare services including primary care, dental, and mental health.',
    category: 'healthcare',
    address: '808 W 58th Street',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90037',
    latitude: 33.9856,
    longitude: -118.2950,
    phone: '(323) 541-1411',
    email: 'info@wellchild.org',
    website: 'https://wellchild.org',
    hours: 'Mon-Fri: 8AM-6PM',
    eligibility_requirements: 'Sliding scale fees based on income. No one turned away.',
    languages_served: ['English', 'Spanish', 'Tagalog'],
    services: ['Primary care', 'Dental care', 'Mental health', 'Prenatal care', 'Pediatrics'],
    source: '211_api',
    status: 'approved',
    is_verified: true,
  },

  // Chicago Resources
  {
    id: 'resource-004',
    name: 'Greater Chicago Food Depository',
    description: 'Chicago\'s food bank providing food assistance through network of pantries.',
    category: 'food',
    address: '4100 W Ann Lurie Place',
    city: 'Chicago',
    state: 'IL',
    zip: '60632',
    latitude: 41.8149,
    longitude: -87.7259,
    phone: '(773) 247-3663',
    email: 'info@gcfd.org',
    website: 'https://www.chicagosfoodbank.org',
    hours: 'Mon-Fri: 8:30AM-4:30PM',
    eligibility_requirements: 'Cook County residents. Call for nearest pantry location.',
    languages_served: ['English', 'Spanish', 'Polish'],
    services: ['Food pantry locations', 'Mobile markets', 'SNAP outreach'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
    id: 'resource-005',
    name: 'Chicago Job Center - Loop',
    description: 'Free employment services including job search, resume help, and training programs.',
    category: 'employment',
    address: '10 W 35th Street',
    city: 'Chicago',
    state: 'IL',
    zip: '60616',
    latitude: 41.8313,
    longitude: -87.6250,
    phone: '(312) 746-5300',
    email: null,
    website: 'https://chicagoilworks.com',
    hours: 'Mon-Fri: 8:30AM-5PM',
    eligibility_requirements: 'Must be eligible to work in the US.',
    languages_served: ['English', 'Spanish'],
    services: ['Job search assistance', 'Resume writing', 'Interview prep', 'Training referrals', 'Unemployment filing help'],
    source: '211_api',
    status: 'approved',
    is_verified: true,
  },

  // Miami Resources
  {
    id: 'resource-006',
    name: 'Miami Senior Center',
    description: 'Comprehensive services for seniors including meals, activities, and benefits assistance.',
    category: 'senior_services',
    address: '200 SE 1st Street',
    city: 'Miami',
    state: 'FL',
    zip: '33131',
    latitude: 25.7699,
    longitude: -80.1896,
    phone: '(305) 416-1200',
    email: 'seniors@miamidade.gov',
    website: 'https://www.miamidade.gov/socialservices',
    hours: 'Mon-Fri: 8AM-5PM',
    eligibility_requirements: 'Miami-Dade County residents age 60+',
    languages_served: ['English', 'Spanish', 'Haitian Creole'],
    services: ['Congregate meals', 'Home-delivered meals', 'Benefits counseling', 'Social activities', 'Transportation'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
    id: 'resource-007',
    name: 'Legal Aid Society of Miami',
    description: 'Free legal services for low-income individuals and families.',
    category: 'legal',
    address: '3000 Biscayne Boulevard',
    city: 'Miami',
    state: 'FL',
    zip: '33137',
    latitude: 25.8065,
    longitude: -80.1867,
    phone: '(305) 576-0080',
    email: 'info@legalaidmiami.org',
    website: 'https://www.legalservicesmiami.org',
    hours: 'Mon-Fri: 9AM-5PM, Intake: 9AM-12PM',
    eligibility_requirements: 'Income must be at or below 125% of federal poverty level.',
    languages_served: ['English', 'Spanish', 'Portuguese', 'Haitian Creole'],
    services: ['Housing law', 'Family law', 'Immigration', 'Public benefits', 'Consumer rights'],
    source: '211_api',
    status: 'approved',
    is_verified: true,
  },

  // New York Resources
  {
    id: 'resource-008',
    name: 'NYC Emergency Food Assistance',
    description: 'Network of food pantries and soup kitchens across New York City.',
    category: 'food',
    address: '12 W 21st Street',
    city: 'New York',
    state: 'NY',
    zip: '10010',
    latitude: 40.7407,
    longitude: -73.9930,
    phone: '(212) 206-8001',
    email: 'info@foodbanknyc.org',
    website: 'https://www.foodbanknyc.org',
    hours: 'Varies by location - call for nearest pantry',
    eligibility_requirements: 'NYC residents. No documentation required at most sites.',
    languages_served: ['English', 'Spanish', 'Chinese', 'Russian'],
    services: ['Food pantries', 'Mobile markets', 'Nutrition education', 'Benefits enrollment'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
    id: 'resource-009',
    name: 'NYU Student Resource Center',
    description: 'Support services for students including emergency aid, food pantry, and counseling.',
    category: 'education',
    address: '60 Washington Square South',
    city: 'New York',
    state: 'NY',
    zip: '10012',
    latitude: 40.7295,
    longitude: -73.9965,
    phone: '(212) 998-4411',
    email: 'student.resources@nyu.edu',
    website: 'https://www.nyu.edu/students',
    hours: 'Mon-Fri: 9AM-6PM',
    eligibility_requirements: 'Current NYU students only.',
    languages_served: ['English'],
    services: ['Emergency grants', 'Food pantry', 'Mental health referrals', 'Housing assistance', 'Financial literacy'],
    source: 'partner_org',
    status: 'approved',
    is_verified: true,
  },

  // User-submitted (pending approval)
  {
    id: 'resource-010',
    name: 'Community Mutual Aid Network',
    description: 'Neighbor-to-neighbor support for groceries, transportation, and general assistance.',
    category: 'other',
    address: '456 Community Lane',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    latitude: 33.9425,
    longitude: -118.2551,
    phone: '(213) 555-0123',
    email: 'help@communityaid.org',
    website: null,
    hours: 'Flexible - contact for availability',
    eligibility_requirements: 'Any community member in need.',
    languages_served: ['English', 'Spanish'],
    services: ['Grocery delivery', 'Transportation', 'Check-in calls', 'Resource referrals'],
    source: 'user_submitted',
    status: 'pending',
    is_verified: false,
  },
]

// Helper functions
export function getResourcesByCity(city: string): MockResource[] {
  return MOCK_RESOURCES.filter((r) => r.city.toLowerCase() === city.toLowerCase() && r.status === 'approved')
}

export function getResourcesByCategory(category: string): MockResource[] {
  return MOCK_RESOURCES.filter((r) => r.category === category && r.status === 'approved')
}

export function getResourcesInViewport(bounds: { north: number; south: number; east: number; west: number }): MockResource[] {
  return MOCK_RESOURCES.filter(
    (r) =>
      r.status === 'approved' &&
      r.latitude >= bounds.south &&
      r.latitude <= bounds.north &&
      r.longitude >= bounds.west &&
      r.longitude <= bounds.east
  )
}

export function getPendingResources(): MockResource[] {
  return MOCK_RESOURCES.filter((r) => r.status === 'pending')
}
