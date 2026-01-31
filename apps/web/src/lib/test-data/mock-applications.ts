// apps/web/src/lib/test-data/mock-applications.ts
// Mock form submissions and applications for end-to-end testing

export type ApplicationStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'pending_info'
  | 'expired'

export interface MockApplication {
  id: string
  user_id: string
  template_id: string
  template_name: string
  form_type: 'snap' | 'medicaid' | 'other'
  status: ApplicationStatus
  current_step: number
  completion_percentage: number
  form_data: Record<string, unknown>
  signature_data: {
    signature_image: string | null
    signed_at: string | null
    ip_address: string | null
  } | null
  agency_reference_number: string | null
  deadline: string | null
  notes: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
}

export interface MockDocument {
  id: string
  user_id: string
  application_id: string | null
  name: string
  file_type: string
  file_size: number
  category: 'identity' | 'income' | 'residence' | 'medical' | 'other'
  description: string | null
  file_path: string
  uploaded_at: string
}

export interface MockReminder {
  id: string
  user_id: string
  application_id: string | null
  title: string
  message: string
  due_date: string
  is_completed: boolean
  created_at: string
}

// Mock applications for testing
export const MOCK_APPLICATIONS: MockApplication[] = [
  // Maria's applications
  {
    id: 'app-001',
    user_id: 'test-user-001',
    template_id: 'tpl-snap-001',
    template_name: 'SNAP Benefits Application',
    form_type: 'snap',
    status: 'submitted',
    current_step: 8,
    completion_percentage: 100,
    form_data: {
      personal_info: {
        first_name: 'Maria',
        last_name: 'Garcia',
        date_of_birth: '1988-03-15',
        ssn: '***-**-6789',
      },
      household: {
        size: 3,
        members: [
          { name: 'Maria Garcia', age: 37, relationship: 'self' },
          { name: 'Sofia Garcia', age: 12, relationship: 'daughter' },
          { name: 'Miguel Garcia', age: 8, relationship: 'son' },
        ],
      },
      income: {
        employment_income: 2333,
        other_income: 0,
        total_monthly: 2333,
      },
      expenses: {
        rent: 1400,
        utilities: 150,
        childcare: 0,
      },
    },
    signature_data: {
      signature_image: 'data:image/png;base64,iVBORw0KGgo=...',
      signed_at: '2026-01-29T14:25:00.000Z',
      ip_address: '192.168.1.100',
    },
    agency_reference_number: 'CA-SNAP-2026-001234',
    deadline: '2026-02-28T23:59:59.000Z',
    notes: 'Interview scheduled for Feb 5th at 10 AM',
    created_at: '2026-01-28T10:00:00.000Z',
    updated_at: '2026-01-29T14:30:00.000Z',
    submitted_at: '2026-01-29T14:25:00.000Z',
  },
  {
    id: 'app-002',
    user_id: 'test-user-001',
    template_id: 'tpl-medicaid-001',
    template_name: 'Medicaid Application',
    form_type: 'medicaid',
    status: 'in_progress',
    current_step: 4,
    completion_percentage: 50,
    form_data: {
      applicant_info: {
        first_name: 'Maria',
        last_name: 'Garcia',
        date_of_birth: '1988-03-15',
      },
      household: {
        size: 3,
      },
      income: {
        employment_income: 2333,
      },
    },
    signature_data: null,
    agency_reference_number: null,
    deadline: null,
    notes: null,
    created_at: '2026-01-30T09:00:00.000Z',
    updated_at: '2026-01-30T09:30:00.000Z',
    submitted_at: null,
  },

  // James's applications
  {
    id: 'app-003',
    user_id: 'test-user-002',
    template_id: 'tpl-snap-001',
    template_name: 'SNAP Benefits Application',
    form_type: 'snap',
    status: 'under_review',
    current_step: 8,
    completion_percentage: 100,
    form_data: {
      personal_info: {
        first_name: 'James',
        last_name: 'Wilson',
        date_of_birth: '1975-07-22',
        ssn: '***-**-4321',
      },
      household: {
        size: 1,
        members: [{ name: 'James Wilson', age: 50, relationship: 'self' }],
      },
      income: {
        employment_income: 0,
        unemployment_benefits: 1800,
        total_monthly: 1800,
      },
      expenses: {
        rent: 1100,
        utilities: 80,
      },
    },
    signature_data: {
      signature_image: 'data:image/png;base64,iVBORw0KGgo=...',
      signed_at: '2026-01-23T15:15:00.000Z',
      ip_address: '10.0.0.50',
    },
    agency_reference_number: 'IL-SNAP-2026-005678',
    deadline: '2026-02-22T23:59:59.000Z',
    notes: 'Additional income verification requested',
    created_at: '2026-01-22T14:00:00.000Z',
    updated_at: '2026-01-25T10:00:00.000Z',
    submitted_at: '2026-01-23T15:15:00.000Z',
  },

  // Sarah's applications
  {
    id: 'app-004',
    user_id: 'test-user-003',
    template_id: 'tpl-medicaid-001',
    template_name: 'Medicaid Application',
    form_type: 'medicaid',
    status: 'approved',
    current_step: 8,
    completion_percentage: 100,
    form_data: {
      applicant_info: {
        first_name: 'Sarah',
        last_name: 'Johnson',
        date_of_birth: '1952-11-08',
      },
      household: {
        size: 2,
        members: [
          { name: 'Sarah Johnson', age: 73, relationship: 'self' },
          { name: 'Robert Johnson', age: 75, relationship: 'spouse' },
        ],
      },
      income: {
        social_security: 1500,
        total_monthly: 1500,
      },
      current_insurance: {
        has_medicare: true,
        medicare_parts: ['A', 'B'],
      },
    },
    signature_data: {
      signature_image: 'data:image/png;base64,iVBORw0KGgo=...',
      signed_at: '2026-01-10T11:00:00.000Z',
      ip_address: '172.16.0.25',
    },
    agency_reference_number: 'FL-MED-2026-009876',
    deadline: null,
    notes: 'Approved for Medicare Savings Program (QMB)',
    created_at: '2026-01-05T09:00:00.000Z',
    updated_at: '2026-01-20T14:00:00.000Z',
    submitted_at: '2026-01-10T11:00:00.000Z',
  },

  // David's draft
  {
    id: 'app-005',
    user_id: 'test-user-004',
    template_id: 'tpl-snap-001',
    template_name: 'SNAP Benefits Application',
    form_type: 'snap',
    status: 'draft',
    current_step: 1,
    completion_percentage: 10,
    form_data: {
      personal_info: {
        first_name: 'David',
        last_name: 'Chen',
      },
    },
    signature_data: null,
    agency_reference_number: null,
    deadline: null,
    notes: null,
    created_at: '2026-01-30T08:00:00.000Z',
    updated_at: '2026-01-30T08:00:00.000Z',
    submitted_at: null,
  },
]

// Mock documents
export const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: 'doc-001',
    user_id: 'test-user-001',
    application_id: 'app-001',
    name: 'Driver License - Maria Garcia',
    file_type: 'image/jpeg',
    file_size: 245000,
    category: 'identity',
    description: 'California Driver License',
    file_path: '/documents/test-user-001/drivers-license.jpg',
    uploaded_at: '2026-01-28T10:30:00.000Z',
  },
  {
    id: 'doc-002',
    user_id: 'test-user-001',
    application_id: 'app-001',
    name: 'Pay Stub - January 2026',
    file_type: 'application/pdf',
    file_size: 156000,
    category: 'income',
    description: 'Most recent pay stub from employer',
    file_path: '/documents/test-user-001/paystub-jan.pdf',
    uploaded_at: '2026-01-28T10:35:00.000Z',
  },
  {
    id: 'doc-003',
    user_id: 'test-user-001',
    application_id: 'app-001',
    name: 'Utility Bill',
    file_type: 'application/pdf',
    file_size: 98000,
    category: 'residence',
    description: 'Electric bill showing current address',
    file_path: '/documents/test-user-001/utility-bill.pdf',
    uploaded_at: '2026-01-28T10:40:00.000Z',
  },
  {
    id: 'doc-004',
    user_id: 'test-user-002',
    application_id: 'app-003',
    name: 'Unemployment Letter',
    file_type: 'application/pdf',
    file_size: 120000,
    category: 'income',
    description: 'Unemployment benefits determination letter',
    file_path: '/documents/test-user-002/unemployment-letter.pdf',
    uploaded_at: '2026-01-22T14:30:00.000Z',
  },
  {
    id: 'doc-005',
    user_id: 'test-user-003',
    application_id: 'app-004',
    name: 'Social Security Statement',
    file_type: 'application/pdf',
    file_size: 180000,
    category: 'income',
    description: 'Annual Social Security benefit statement',
    file_path: '/documents/test-user-003/ss-statement.pdf',
    uploaded_at: '2026-01-05T09:30:00.000Z',
  },
  {
    id: 'doc-006',
    user_id: 'test-user-003',
    application_id: 'app-004',
    name: 'Medicare Card',
    file_type: 'image/jpeg',
    file_size: 95000,
    category: 'medical',
    description: 'Medicare card front and back',
    file_path: '/documents/test-user-003/medicare-card.jpg',
    uploaded_at: '2026-01-05T09:35:00.000Z',
  },
]

// Mock reminders
export const MOCK_REMINDERS: MockReminder[] = [
  {
    id: 'rem-001',
    user_id: 'test-user-001',
    application_id: 'app-001',
    title: 'SNAP Interview',
    message: 'Phone interview scheduled with case worker',
    due_date: '2026-02-05T10:00:00.000Z',
    is_completed: false,
    created_at: '2026-01-29T15:00:00.000Z',
  },
  {
    id: 'rem-002',
    user_id: 'test-user-001',
    application_id: 'app-002',
    title: 'Complete Medicaid Application',
    message: 'Finish remaining sections of Medicaid application',
    due_date: '2026-02-01T23:59:59.000Z',
    is_completed: false,
    created_at: '2026-01-30T09:30:00.000Z',
  },
  {
    id: 'rem-003',
    user_id: 'test-user-002',
    application_id: 'app-003',
    title: 'Submit Income Verification',
    message: 'Upload additional income documents as requested',
    due_date: '2026-02-01T23:59:59.000Z',
    is_completed: false,
    created_at: '2026-01-25T10:00:00.000Z',
  },
  {
    id: 'rem-004',
    user_id: 'test-user-003',
    application_id: null,
    title: 'Medicare Enrollment Period',
    message: 'Review Medicare Advantage plans for 2027',
    due_date: '2026-10-15T23:59:59.000Z',
    is_completed: false,
    created_at: '2026-01-20T14:00:00.000Z',
  },
]

// Helper functions
export function getApplicationsByUser(userId: string): MockApplication[] {
  return MOCK_APPLICATIONS.filter((a) => a.user_id === userId)
}

export function getApplicationById(id: string): MockApplication | undefined {
  return MOCK_APPLICATIONS.find((a) => a.id === id)
}

export function getDocumentsByUser(userId: string): MockDocument[] {
  return MOCK_DOCUMENTS.filter((d) => d.user_id === userId)
}

export function getDocumentsByApplication(applicationId: string): MockDocument[] {
  return MOCK_DOCUMENTS.filter((d) => d.application_id === applicationId)
}

export function getRemindersByUser(userId: string): MockReminder[] {
  return MOCK_REMINDERS.filter((r) => r.user_id === userId)
}

export function getUpcomingReminders(userId: string): MockReminder[] {
  const now = new Date()
  return MOCK_REMINDERS.filter(
    (r) => r.user_id === userId && !r.is_completed && new Date(r.due_date) > now
  ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
}
