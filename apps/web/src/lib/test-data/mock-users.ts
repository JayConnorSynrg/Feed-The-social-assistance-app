// apps/web/src/lib/test-data/mock-users.ts
// Mock user data for end-to-end testing

export interface MockUser {
  id: string
  email: string
  password: string
  profile: {
    username: string
    full_name: string
    avatar_url: string | null
    bio: string | null
    city: string
    state: string
    is_verified: boolean
  }
  secureProfile: {
    ssn: string
    date_of_birth: string
    household_size: number
    employment_status: 'employed' | 'unemployed' | 'self_employed' | 'retired' | 'disabled' | 'student'
    annual_income: number
    mailing_address: {
      street: string
      city: string
      state: string
      zip: string
    }
    current_benefits: string[]
  }
}

export const MOCK_USERS: MockUser[] = [
  {
    id: 'test-user-001',
    email: 'maria.garcia@test.feedapp.com',
    password: 'TestUser123!',
    profile: {
      username: 'maria_garcia',
      full_name: 'Maria Garcia',
      avatar_url: null,
      bio: 'Single mother looking for resources to support my family.',
      city: 'Los Angeles',
      state: 'CA',
      is_verified: false,
    },
    secureProfile: {
      ssn: '123-45-6789',
      date_of_birth: '1988-03-15',
      household_size: 3,
      employment_status: 'employed',
      annual_income: 28000,
      mailing_address: {
        street: '1234 Main Street Apt 5B',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90012',
      },
      current_benefits: ['none'],
    },
  },
  {
    id: 'test-user-002',
    email: 'james.wilson@test.feedapp.com',
    password: 'TestUser123!',
    profile: {
      username: 'james_wilson',
      full_name: 'James Wilson',
      avatar_url: null,
      bio: 'Recently unemployed, seeking assistance.',
      city: 'Chicago',
      state: 'IL',
      is_verified: false,
    },
    secureProfile: {
      ssn: '987-65-4321',
      date_of_birth: '1975-07-22',
      household_size: 1,
      employment_status: 'unemployed',
      annual_income: 0,
      mailing_address: {
        street: '567 Oak Avenue',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
      },
      current_benefits: ['unemployment'],
    },
  },
  {
    id: 'test-user-003',
    email: 'sarah.johnson@test.feedapp.com',
    password: 'TestUser123!',
    profile: {
      username: 'sarah_johnson',
      full_name: 'Sarah Johnson',
      avatar_url: null,
      bio: 'Senior citizen needing help navigating benefits.',
      city: 'Miami',
      state: 'FL',
      is_verified: true,
    },
    secureProfile: {
      ssn: '456-78-9012',
      date_of_birth: '1952-11-08',
      household_size: 2,
      employment_status: 'retired',
      annual_income: 18000,
      mailing_address: {
        street: '890 Palm Drive Unit 12',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
      },
      current_benefits: ['social_security', 'medicare'],
    },
  },
  {
    id: 'test-user-004',
    email: 'david.chen@test.feedapp.com',
    password: 'TestUser123!',
    profile: {
      username: 'david_chen',
      full_name: 'David Chen',
      avatar_url: null,
      bio: 'Student looking for food assistance and resources.',
      city: 'New York',
      state: 'NY',
      is_verified: false,
    },
    secureProfile: {
      ssn: '234-56-7890',
      date_of_birth: '2000-02-28',
      household_size: 1,
      employment_status: 'student',
      annual_income: 8000,
      mailing_address: {
        street: '123 University Ave Rm 302',
        city: 'New York',
        state: 'NY',
        zip: '10001',
      },
      current_benefits: ['none'],
    },
  },
  {
    id: 'test-user-005',
    email: 'admin@test.feedapp.com',
    password: 'AdminTest123!',
    profile: {
      username: 'feed_admin',
      full_name: 'FEED Administrator',
      avatar_url: null,
      bio: 'Platform administrator for testing.',
      city: 'San Francisco',
      state: 'CA',
      is_verified: true,
    },
    secureProfile: {
      ssn: '000-00-0000',
      date_of_birth: '1990-01-01',
      household_size: 1,
      employment_status: 'employed',
      annual_income: 0,
      mailing_address: {
        street: '1 FEED HQ',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
      },
      current_benefits: [],
    },
  },
]

// Test scenarios mapped to users
export const TEST_SCENARIOS = {
  // Scenario 1: New user onboarding (Maria)
  newUserOnboarding: {
    userId: 'test-user-001',
    description: 'New user signs up, creates profile, explores app',
    steps: [
      'Sign up with email',
      'Verify email (auto-verified in test mode)',
      'Complete profile setup',
      'Navigate to dashboard',
    ],
  },

  // Scenario 2: Resource discovery (James)
  resourceDiscovery: {
    userId: 'test-user-002',
    description: 'Unemployed user finds local resources',
    steps: [
      'Log in',
      'Navigate to resources map',
      'Search for "food assistance"',
      'Filter by category',
      'View resource details',
      'Get directions',
    ],
  },

  // Scenario 3: Benefits application (Maria)
  benefitsApplication: {
    userId: 'test-user-001',
    description: 'User completes SNAP application with autofill',
    steps: [
      'Log in',
      'Set up secure profile',
      'Navigate to forms',
      'Select SNAP application',
      'Use autofill feature',
      'Complete all sections',
      'Add signature',
      'Submit application',
    ],
  },

  // Scenario 4: AI chat assistance (Sarah)
  aiChatAssistance: {
    userId: 'test-user-003',
    description: 'Senior user gets help via AI chat',
    steps: [
      'Log in',
      'Navigate to AI chat',
      'Start eligibility checker flow',
      'Answer guided questions',
      'Receive eligibility recommendations',
      'Start form help flow',
    ],
  },

  // Scenario 5: Case management (Maria)
  caseManagement: {
    userId: 'test-user-001',
    description: 'User manages submitted applications',
    steps: [
      'Log in',
      'View dashboard',
      'Check application status',
      'Upload supporting document',
      'Set reminder',
      'Add note to application',
    ],
  },
}

export function getMockUserByEmail(email: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.email === email)
}

export function getMockUserById(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id)
}
