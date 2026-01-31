/**
 * FEED Platform - E2E Test Data Seeder
 *
 * Seeds the database with test data for comprehensive E2E testing.
 * Run with: npx ts-node --esm scripts/seed-e2e-test-data.ts
 *
 * Prerequisites:
 * - Local Supabase running (npx supabase start)
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test user definitions
const TEST_USERS = [
  {
    email: 'test-recipient@feed.local',
    password: 'TestPassword123!',
    profile: {
      full_name: 'Test Recipient User',
      username: 'test_recipient',
      bio: 'A test user for recipient role testing',
      location_city: 'Los Angeles',
      location_state: 'CA',
      is_admin: false,
      is_verified: false
    }
  },
  {
    email: 'test-agency@feed.local',
    password: 'TestPassword123!',
    profile: {
      full_name: 'Test Agency Staff',
      username: 'test_agency',
      bio: 'A test user for agency role testing',
      location_city: 'Los Angeles',
      location_state: 'CA',
      is_admin: false,
      is_verified: true
    }
  },
  {
    email: 'test-admin@feed.local',
    password: 'TestPassword123!',
    profile: {
      full_name: 'Test Admin User',
      username: 'test_admin',
      bio: 'A test user for admin role testing',
      location_city: 'Los Angeles',
      location_state: 'CA',
      is_admin: true,
      is_verified: true
    }
  }
];

// Test resources with various categories
const TEST_RESOURCES = [
  {
    name: 'LA Food Bank - Central Location',
    category: 'food_assistance',
    address_line1: '1734 E 41st St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90058',
    phone: '(323) 234-3030',
    email: 'info@lafoodbank.org',
    website: 'https://www.lafoodbank.org',
    description: 'Free groceries and food assistance for low-income families',
    services_offered: ['Food distribution', 'CalFresh enrollment', 'Senior meals'],
    eligibility_requirements: 'Los Angeles County residents, income verification may be required',
    hours_of_operation: {
      monday: '8:00 AM - 5:00 PM',
      tuesday: '8:00 AM - 5:00 PM',
      wednesday: '8:00 AM - 5:00 PM',
      thursday: '8:00 AM - 5:00 PM',
      friday: '8:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 33.9925,
    longitude: -118.2101
  },
  {
    name: 'St. John\'s Community Health Center',
    category: 'healthcare',
    address_line1: '1665 E 103rd St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90002',
    phone: '(323) 541-1411',
    email: 'contact@stjohns.org',
    website: 'https://www.wellchild.org',
    description: 'Comprehensive primary care services regardless of ability to pay',
    services_offered: ['Primary care', 'Pediatrics', 'Dental care', 'Mental health', 'WIC'],
    eligibility_requirements: 'Open to all, sliding scale fees based on income',
    hours_of_operation: {
      monday: '7:00 AM - 7:00 PM',
      tuesday: '7:00 AM - 7:00 PM',
      wednesday: '7:00 AM - 7:00 PM',
      thursday: '7:00 AM - 7:00 PM',
      friday: '7:00 AM - 5:00 PM',
      saturday: '8:00 AM - 12:00 PM',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 33.9422,
    longitude: -118.2412
  },
  {
    name: 'PATH - Hollywood Homeless Services',
    category: 'housing_assistance',
    address_line1: '5627 Hollywood Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90028',
    phone: '(323) 644-2200',
    email: 'info@epath.org',
    website: 'https://www.epath.org',
    description: 'Emergency shelter, transitional housing, and homeless prevention services',
    services_offered: ['Emergency shelter', 'Transitional housing', 'Case management', 'Employment services'],
    eligibility_requirements: 'Individuals and families experiencing homelessness',
    hours_of_operation: {
      monday: '24 hours',
      tuesday: '24 hours',
      wednesday: '24 hours',
      thursday: '24 hours',
      friday: '24 hours',
      saturday: '24 hours',
      sunday: '24 hours'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.1017,
    longitude: -118.3143
  },
  {
    name: 'LA County DPSS - CalWORKs Office',
    category: 'government_assistance',
    address_line1: '3175 W 6th St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90020',
    phone: '(866) 613-3777',
    website: 'https://dpss.lacounty.gov',
    description: 'CalWORKs, CalFresh, Medi-Cal, and General Relief enrollment',
    services_offered: ['CalWORKs', 'CalFresh (SNAP)', 'Medi-Cal', 'General Relief'],
    eligibility_requirements: 'Varies by program - income and residency requirements',
    hours_of_operation: {
      monday: '7:30 AM - 5:30 PM',
      tuesday: '7:30 AM - 5:30 PM',
      wednesday: '7:30 AM - 5:30 PM',
      thursday: '7:30 AM - 5:30 PM',
      friday: '7:30 AM - 5:30 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.0628,
    longitude: -118.2891
  },
  {
    name: 'Legal Aid Foundation of Los Angeles',
    category: 'legal_services',
    address_line1: '1102 S Crenshaw Blvd',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90019',
    phone: '(800) 399-4529',
    email: 'info@lafla.org',
    website: 'https://lafla.org',
    description: 'Free civil legal services for low-income individuals',
    services_offered: ['Housing law', 'Family law', 'Immigration', 'Consumer rights', 'Public benefits'],
    eligibility_requirements: 'Low-income LA County residents, income verification required',
    hours_of_operation: {
      monday: '9:00 AM - 5:00 PM',
      tuesday: '9:00 AM - 5:00 PM',
      wednesday: '9:00 AM - 5:00 PM',
      thursday: '9:00 AM - 5:00 PM',
      friday: '9:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.0459,
    longitude: -118.3368
  },
  {
    name: 'LADWP Utility Assistance Program',
    category: 'utility_assistance',
    address_line1: '111 N Hope St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90012',
    phone: '(800) 342-5397',
    website: 'https://www.ladwp.com',
    description: 'LIHEAP and utility discount programs for low-income households',
    services_offered: ['LIHEAP', 'EZ-SAVE discount', 'Lifeline discount', 'Payment plans'],
    eligibility_requirements: 'Income at or below 200% federal poverty level',
    hours_of_operation: {
      monday: '8:00 AM - 5:00 PM',
      tuesday: '8:00 AM - 5:00 PM',
      wednesday: '8:00 AM - 5:00 PM',
      thursday: '8:00 AM - 5:00 PM',
      friday: '8:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.0567,
    longitude: -118.2468
  },
  {
    name: 'WorkSource California - Downtown LA',
    category: 'employment',
    address_line1: '215 W 6th St',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90014',
    phone: '(213) 744-7300',
    website: 'https://www.edd.ca.gov',
    description: 'Job search assistance, training programs, and unemployment services',
    services_offered: ['Job search', 'Resume help', 'Training programs', 'Unemployment filing', 'Career counseling'],
    eligibility_requirements: 'Open to all job seekers',
    hours_of_operation: {
      monday: '8:00 AM - 5:00 PM',
      tuesday: '8:00 AM - 5:00 PM',
      wednesday: '8:00 AM - 5:00 PM',
      thursday: '8:00 AM - 5:00 PM',
      friday: '8:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.0453,
    longitude: -118.2551
  },
  {
    name: 'LA Family Housing - Mental Health Services',
    category: 'mental_health',
    address_line1: '7843 Lankershim Blvd',
    city: 'North Hollywood',
    state: 'CA',
    zip: '91605',
    phone: '(818) 982-4091',
    website: 'https://lafh.org',
    description: 'Mental health counseling and crisis intervention services',
    services_offered: ['Individual counseling', 'Group therapy', 'Crisis intervention', 'Case management'],
    eligibility_requirements: 'Open to all, priority for homeless and at-risk individuals',
    hours_of_operation: {
      monday: '8:00 AM - 6:00 PM',
      tuesday: '8:00 AM - 6:00 PM',
      wednesday: '8:00 AM - 6:00 PM',
      thursday: '8:00 AM - 6:00 PM',
      friday: '8:00 AM - 5:00 PM',
      saturday: 'Closed',
      sunday: 'Closed'
    },
    source: 'admin_added',
    status: 'approved',
    is_verified: true,
    latitude: 34.1942,
    longitude: -118.3862
  },
  // Pending resource for moderation testing
  {
    name: 'Community Resource Center (Pending Review)',
    category: 'general_assistance',
    address_line1: '123 Test Street',
    city: 'Los Angeles',
    state: 'CA',
    zip: '90001',
    phone: '(555) 123-4567',
    description: 'A user-submitted resource pending admin review',
    services_offered: ['General assistance'],
    eligibility_requirements: 'Open to all',
    source: 'user_submitted',
    status: 'pending',
    is_verified: false,
    latitude: 33.9425,
    longitude: -118.2551
  }
];

// Test posts for feed
const TEST_POSTS = [
  {
    content: 'Just got approved for CalFresh! The application was easier than I thought. Happy to help anyone with questions about the process.',
    post_type: 'text'
  },
  {
    content: 'Found this amazing food pantry near downtown LA. They have fresh produce every Tuesday and Thursday. No documentation required!',
    post_type: 'text'
  },
  {
    content: 'PSA: The DPSS office on 6th St has much shorter wait times if you go right when they open at 7:30am. Got my Medi-Cal renewal done in under an hour.',
    post_type: 'text'
  },
  {
    content: 'Looking for recommendations for a free legal clinic that helps with housing issues. Facing eviction and need advice.',
    post_type: 'text'
  },
  {
    content: 'Great news! LA County is offering emergency rental assistance again. Application opens next Monday. Will share the link when it goes live.',
    post_type: 'text'
  }
];

async function seedTestUsers() {
  console.log('🔐 Creating test users...');

  const createdUsers: { email: string; id: string }[] = [];

  for (const user of TEST_USERS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          console.log(`  ⚠️  User ${user.email} already exists, updating profile...`);
          // Get existing user
          const { data: existingUser } = await supabase.auth.admin.listUsers();
          const existing = existingUser?.users.find(u => u.email === user.email);
          if (existing) {
            createdUsers.push({ email: user.email, id: existing.id });
            // Update profile
            await supabase.from('profiles').upsert({
              id: existing.id,
              ...user.profile,
              updated_at: new Date().toISOString()
            });
          }
          continue;
        }
        throw authError;
      }

      if (authData.user) {
        createdUsers.push({ email: user.email, id: authData.user.id });
        console.log(`  ✅ Created user: ${user.email}`);

        // Create/update profile
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authData.user.id,
          ...user.profile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        if (profileError) {
          console.log(`  ⚠️  Profile error for ${user.email}:`, profileError.message);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error creating ${user.email}:`, error);
    }
  }

  return createdUsers;
}

async function seedResources() {
  console.log('📍 Seeding test resources...');

  for (const resource of TEST_RESOURCES) {
    try {
      const { latitude, longitude, ...resourceData } = resource;

      // Create resource with PostGIS location
      const { error } = await supabase.from('resources').upsert({
        ...resourceData,
        location: `POINT(${longitude} ${latitude})`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'name'
      });

      if (error) {
        console.log(`  ⚠️  Resource "${resource.name}": ${error.message}`);
      } else {
        console.log(`  ✅ ${resource.status === 'pending' ? '⏳' : '✅'} ${resource.name}`);
      }
    } catch (error) {
      console.error(`  ❌ Error seeding "${resource.name}":`, error);
    }
  }
}

async function seedPosts(users: { email: string; id: string }[]) {
  console.log('📝 Seeding test posts...');

  const recipientUser = users.find(u => u.email === 'test-recipient@feed.local');
  if (!recipientUser) {
    console.log('  ⚠️  Recipient user not found, skipping posts');
    return;
  }

  for (const post of TEST_POSTS) {
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: recipientUser.id,
        content: post.content,
        post_type: post.post_type,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString() // Random time in last 7 days
      });

      if (error) {
        console.log(`  ⚠️  Post error: ${error.message}`);
      } else {
        console.log(`  ✅ Created post: "${post.content.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.error('  ❌ Post error:', error);
    }
  }
}

async function seedFormTemplates() {
  console.log('📋 Verifying form templates...');

  // Check if SNAP template exists
  const { data: snapTemplate } = await supabase
    .from('form_templates')
    .select('id')
    .eq('slug', 'snap')
    .single();

  if (!snapTemplate) {
    console.log('  ⚠️  SNAP template not found - forms will use built-in templates');
  } else {
    console.log('  ✅ SNAP template exists');
  }

  // Check if Medicaid template exists
  const { data: medicaidTemplate } = await supabase
    .from('form_templates')
    .select('id')
    .eq('slug', 'medicaid')
    .single();

  if (!medicaidTemplate) {
    console.log('  ⚠️  Medicaid template not found - forms will use built-in templates');
  } else {
    console.log('  ✅ Medicaid template exists');
  }
}

async function main() {
  console.log('\n🌱 FEED Platform E2E Test Data Seeder\n');
  console.log('='.repeat(50));

  try {
    // 1. Create test users
    const users = await seedTestUsers();

    // 2. Seed resources
    await seedResources();

    // 3. Seed posts
    await seedPosts(users);

    // 4. Verify form templates
    await seedFormTemplates();

    console.log('\n' + '='.repeat(50));
    console.log('✅ E2E Test Data Seeding Complete!\n');

    console.log('📝 Test Accounts:');
    console.log('   Recipient: test-recipient@feed.local / TestPassword123!');
    console.log('   Agency:    test-agency@feed.local / TestPassword123!');
    console.log('   Admin:     test-admin@feed.local / TestPassword123!');

    console.log('\n🚀 Ready for E2E testing!');
    console.log('   Start the dev server: npm run dev');
    console.log('   Navigate to: http://localhost:3000\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
