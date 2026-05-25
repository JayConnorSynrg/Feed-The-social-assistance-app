#!/usr/bin/env npx ts-node
// scripts/seed-test-data.ts
// Seed script to populate local Supabase with test data

import { createClient } from '@supabase/supabase-js'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required')
  console.log('Run: npx supabase status to get the service_role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test user data (matches mock-users.ts)
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!'
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'TestPassword123!'

const TEST_USERS = [
  {
    email: 'maria.garcia@test.feedapp.com',
    password: TEST_USER_PASSWORD,
    profile: {
      username: 'maria_garcia',
      full_name: 'Maria Garcia',
      bio: 'Single mother looking for resources to support my family.',
      city: 'Los Angeles',
      state: 'CA',
    },
  },
  {
    email: 'james.wilson@test.feedapp.com',
    password: TEST_USER_PASSWORD,
    profile: {
      username: 'james_wilson',
      full_name: 'James Wilson',
      bio: 'Recently unemployed, seeking assistance.',
      city: 'Chicago',
      state: 'IL',
    },
  },
  {
    email: 'sarah.johnson@test.feedapp.com',
    password: TEST_USER_PASSWORD,
    profile: {
      username: 'sarah_johnson',
      full_name: 'Sarah Johnson',
      bio: 'Senior citizen needing help navigating benefits.',
      city: 'Miami',
      state: 'FL',
    },
  },
  {
    email: 'david.chen@test.feedapp.com',
    password: TEST_USER_PASSWORD,
    profile: {
      username: 'david_chen',
      full_name: 'David Chen',
      bio: 'Student looking for food assistance and resources.',
      city: 'New York',
      state: 'NY',
    },
  },
  {
    email: 'admin@test.feedapp.com',
    password: TEST_ADMIN_PASSWORD,
    profile: {
      username: 'feed_admin',
      full_name: 'FEED Administrator',
      bio: 'Platform administrator for testing.',
      city: 'San Francisco',
      state: 'CA',
    },
  },
]

// Test resources (matches mock-resources.ts)
const TEST_RESOURCES = [
  {
    name: 'LA Regional Food Bank',
    description: 'Provides free groceries and food assistance to families in need.',
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
    name: 'PATH Housing Services',
    description: 'Emergency shelter and housing assistance for individuals and families.',
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
    name: 'Greater Chicago Food Depository',
    description: "Chicago's food bank providing food assistance through network of pantries.",
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
    services: ['Congregate meals', 'Home-delivered meals', 'Benefits counseling', 'Transportation'],
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
  },
  {
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
]

async function seedUsers() {
  console.log('\n📧 Creating test users...')

  const createdUsers: { id: string; email: string }[] = []

  for (const userData of TEST_USERS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm for testing
      })

      if (authError) {
        if (authError.message.includes('already been registered')) {
          console.log(`  ⚠️  User ${userData.email} already exists, skipping...`)
          // Get existing user
          const { data: users } = await supabase.auth.admin.listUsers()
          const existingUser = users.users.find((u) => u.email === userData.email)
          if (existingUser) {
            createdUsers.push({ id: existingUser.id, email: userData.email })
          }
          continue
        }
        throw authError
      }

      if (authData.user) {
        createdUsers.push({ id: authData.user.id, email: userData.email })

        // Create profile
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          ...userData.profile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (profileError) {
          console.error(`  ❌ Failed to create profile for ${userData.email}:`, profileError.message)
        } else {
          console.log(`  ✅ Created user: ${userData.email}`)
        }
      }
    } catch (error) {
      console.error(`  ❌ Error creating user ${userData.email}:`, error)
    }
  }

  return createdUsers
}

async function seedResources(users: { id: string; email: string }[]) {
  console.log('\n📍 Creating test resources...')

  const adminUser = users.find((u) => u.email === 'admin@test.feedapp.com')

  for (const resource of TEST_RESOURCES) {
    try {
      const { error } = await supabase.from('resources').upsert({
        ...resource,
        submitted_by: adminUser?.id,
        moderated_by: adminUser?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error(`  ❌ Failed to create resource ${resource.name}:`, error.message)
      } else {
        console.log(`  ✅ Created resource: ${resource.name}`)
      }
    } catch (error) {
      console.error(`  ❌ Error creating resource ${resource.name}:`, error)
    }
  }
}

async function seedPosts(users: { id: string; email: string }[]) {
  console.log('\n💬 Creating test posts...')

  const posts = [
    {
      user_email: 'maria.garcia@test.feedapp.com',
      content:
        "Just found out about FEED and I'm so grateful! Finally got help applying for SNAP benefits.",
      is_pinned: true,
    },
    {
      user_email: 'james.wilson@test.feedapp.com',
      content:
        'Update on my job search: Thanks to the Chicago Job Center, I had two interviews this week!',
      is_pinned: false,
    },
    {
      user_email: 'sarah.johnson@test.feedapp.com',
      content:
        'Reminder for seniors: The Senior Center has free benefits counseling every Tuesday!',
      is_pinned: false,
    },
    {
      user_email: 'david.chen@test.feedapp.com',
      content:
        "Fellow students: NYU has a food pantry at Washington Square! Don't struggle alone.",
      is_pinned: false,
    },
    {
      user_email: 'admin@test.feedapp.com',
      content:
        "📢 Community Update: We've added 15 new verified resources to the map this week!",
      is_pinned: true,
    },
  ]

  for (const post of posts) {
    const user = users.find((u) => u.email === post.user_email)
    if (!user) continue

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: post.content,
        is_pinned: post.is_pinned,
        is_hidden: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (error) {
        console.error(`  ❌ Failed to create post:`, error.message)
      } else {
        console.log(`  ✅ Created post from: ${post.user_email}`)
      }
    } catch (error) {
      console.error(`  ❌ Error creating post:`, error)
    }
  }
}

async function seedFormTemplates() {
  console.log('\n📝 Creating form templates...')

  const templates = [
    {
      name: 'SNAP Benefits Application',
      form_type: 'snap',
      version: '1.0.0',
      is_active: true,
      schema: {
        sections: [
          { id: 'personal', title: 'Personal Information' },
          { id: 'household', title: 'Household Information' },
          { id: 'income', title: 'Income Information' },
          { id: 'expenses', title: 'Monthly Expenses' },
          { id: 'certification', title: 'Certification & Signature' },
        ],
      },
      required_documents: ['ID', 'Proof of income', 'Proof of address'],
      agency_name: 'Department of Social Services',
      agency_contact: '1-800-SNAP-HELP',
    },
    {
      name: 'Medicaid Application',
      form_type: 'medicaid',
      version: '1.0.0',
      is_active: true,
      schema: {
        sections: [
          { id: 'applicant', title: 'Applicant Information' },
          { id: 'household', title: 'Household Members' },
          { id: 'income', title: 'Income & Assets' },
          { id: 'insurance', title: 'Current Insurance' },
          { id: 'certification', title: 'Certification & Signature' },
        ],
      },
      required_documents: ['ID', 'Proof of income', 'Insurance cards if applicable'],
      agency_name: 'Medicaid Services',
      agency_contact: '1-800-MEDICAID',
    },
  ]

  for (const template of templates) {
    try {
      const { error } = await supabase.from('form_templates').upsert(
        {
          ...template,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'name' }
      )

      if (error) {
        console.error(`  ❌ Failed to create template ${template.name}:`, error.message)
      } else {
        console.log(`  ✅ Created template: ${template.name}`)
      }
    } catch (error) {
      console.error(`  ❌ Error creating template ${template.name}:`, error)
    }
  }
}

async function main() {
  console.log('🌱 FEED Test Data Seeder')
  console.log('========================')
  console.log(`Supabase URL: ${supabaseUrl}`)

  try {
    // Seed in order
    const users = await seedUsers()
    await seedResources(users)
    await seedPosts(users)
    await seedFormTemplates()

    console.log('\n✨ Seeding complete!')
    console.log('\nTest user emails:')
    console.log('------------------------')
    for (const user of TEST_USERS) {
      console.log(`Email: ${user.email}`)
    }
    console.log('\nPasswords sourced from TEST_USER_PASSWORD / TEST_ADMIN_PASSWORD env vars (or defaults).')
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

main()
