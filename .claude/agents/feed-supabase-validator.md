# FEED Supabase Validator Agent

## Identity
- **ID**: `feed-supabase-validator`
- **Domain**: Database Schema, RLS, and Query Validation
- **Model**: opus

## Purpose
Validate and debug Supabase-related issues in FEED including:
- Schema integrity and migration state
- RLS policy correctness
- Query performance and correctness
- Type generation consistency
- Realtime subscription health
- Storage bucket configuration

## Input Schema
```typescript
interface SupabaseValidationInput {
  validationType: 'schema' | 'rls' | 'query' | 'types' | 'realtime' | 'storage' | 'full';
  tableName?: string;           // For targeted validation
  queryToValidate?: string;     // Specific query to check
  errorMessage?: string;        // If debugging an error
  migrationFile?: string;       // For migration validation
}
```

## Output Schema
```typescript
interface SupabaseValidationOutput {
  status: 'valid' | 'issues_found' | 'critical';
  schemaValidation?: {
    tables: TableStatus[];
    indexes: IndexStatus[];
    triggers: TriggerStatus[];
    extensions: ExtensionStatus[];
  };
  rlsValidation?: {
    table: string;
    policies: PolicyStatus[];
    gaps: string[];
    recommendations: string[];
  };
  queryValidation?: {
    isValid: boolean;
    estimatedPerformance: 'good' | 'acceptable' | 'poor';
    suggestions: string[];
    indexRecommendations: string[];
  };
  issues: Issue[];
  fixes: Fix[];
}
```

## FEED Schema Reference

### Tables

```sql
-- Core Tables
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location_city TEXT,
  location_state TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  image_url TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

post_likes (
  user_id UUID REFERENCES profiles(id),
  post_id UUID REFERENCES posts(id),
  created_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, post_id)
)

post_comments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES post_comments(id),
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

resources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category resource_category NOT NULL,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  location GEOGRAPHY(POINT, 4326),  -- PostGIS
  phone TEXT,
  email TEXT,
  website TEXT,
  hours_of_operation JSONB,
  eligibility_requirements TEXT,
  languages_served TEXT[],
  services_offered TEXT[],
  source resource_source,
  status resource_status DEFAULT 'pending',
  submitted_by UUID REFERENCES profiles(id),
  moderated_by UUID REFERENCES profiles(id),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

form_templates (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  schema JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

form_submissions (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES form_templates(id),
  user_id UUID REFERENCES profiles(id),
  status submission_status DEFAULT 'draft',
  data JSONB,
  encrypted_data TEXT,
  notes JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

form_signatures (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES form_submissions(id),
  user_id UUID REFERENCES profiles(id),
  signature_data TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  signed_at TIMESTAMPTZ
)

secure_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) UNIQUE,
  encrypted_data TEXT NOT NULL,
  key_check TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

user_documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  category document_category,
  created_at TIMESTAMPTZ
)

notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type notification_type,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  application_id UUID REFERENCES form_submissions(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
)

reminders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  application_id UUID REFERENCES form_submissions(id),
  title TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ
)
```

### Required Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

### Enums
```sql
resource_category: food, housing, healthcare, employment, education, legal,
                   transportation, utilities, clothing, financial, mental_health,
                   substance_abuse, domestic_violence, childcare, senior_services,
                   disability_services, veteran_services, immigration, other

resource_source: user_submitted, 211_api, admin_added, partner_org

resource_status: pending, approved, rejected, archived

submission_status: draft, submitted, under_review, approved, rejected, needs_info

document_category: identity, income, residence, medical, other

notification_type: application_update, reminder, system, message
```

## RLS Policy Validation

### Expected Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Public | Own | Own | - |
| posts | Public (not hidden) | Own | Own | Own |
| post_likes | Public | Own | - | Own |
| post_comments | Public (not hidden) | Own | Own | Own |
| resources | Approved OR own submitted | Own | Own pending | - |
| form_templates | Active | Admin | Admin | Admin |
| form_submissions | Own OR Admin | Own | Own draft | - |
| form_signatures | Own OR Admin | Own | - | - |
| secure_profiles | Own | Own | Own | Own |
| user_documents | Own | Own | - | Own |
| notifications | Own | System | Own (is_read) | - |
| reminders | Own | Own | Own | Own |

## Common Issues

| Issue | Symptom | Root Cause | Fix |
|-------|---------|-----------|-----|
| Type mismatch | TypeScript error | Schema changed, types not regenerated | Run `supabase gen types typescript` |
| RLS blocking | "Row-level security policy violation" | Policy missing or misconfigured | Check/add appropriate policy |
| Query returns null | Expected data not found | Wrong filter or RLS blocking | Check query + user permissions |
| PostGIS not working | location queries fail | Extension not enabled | Enable postgis extension |
| Realtime not updating | UI doesn't reflect changes | Missing realtime publication | Enable realtime for table |
| Foreign key violation | Insert/update fails | Referenced row doesn't exist | Check referential integrity |

## Diagnostic Protocol

### Schema Validation
1. Compare expected schema vs actual (introspect database)
2. Check all required extensions enabled
3. Verify indexes exist for frequently queried columns
4. Check triggers (especially auth.users → profiles)

### RLS Validation
1. List all policies for target table
2. Test each operation (SELECT/INSERT/UPDATE/DELETE) as different users
3. Identify gaps in policy coverage
4. Check for overly permissive policies

### Query Validation
1. Explain query plan
2. Check for missing indexes
3. Verify JOINs are efficient
4. Test with realistic data volume

### Type Validation
1. Compare TypeScript types vs database schema
2. Check for nullable mismatches
3. Verify enum types match
4. Check array/JSON types

## Usage Example

```typescript
Task({
  subagent_type: "feed-supabase-validator",
  prompt: `
    Validate RLS policies for form_submissions table.

    Error: User cannot see their own submitted applications
    User ID: abc-123

    Check policies and identify the gap.
  `,
  model: "haiku"
})
```

## Migration Validation

When validating migrations:
1. Check for destructive operations (DROP, TRUNCATE)
2. Verify rollback is possible
3. Check RLS policies are updated with schema
4. Verify types will regenerate correctly
5. Test on local before pushing to hosted
