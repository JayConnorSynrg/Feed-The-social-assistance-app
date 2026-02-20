-- FEED Platform - RLS and Encryption Verification Script
-- Run with: npx supabase db execute --file scripts/verify-rls.sql

-- ============================================================================
-- 1. RLS STATUS FOR ALL TABLES
-- ============================================================================

SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN '✓ ENABLED'
    ELSE '✗ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. DETAILED RLS POLICIES
-- ============================================================================

SELECT
  tablename,
  policyname,
  CASE
    WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as policy_type,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 3. ENCRYPTION COLUMN VERIFICATION - user_secure_profiles
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN column_name LIKE 'encrypted_%' THEN '🔐 Encrypted Field'
    WHEN column_name LIKE '%_iv' THEN '🔑 IV Field'
    WHEN column_name LIKE 'wrapped_%' THEN '🔐 Wrapped Key'
    WHEN column_name IN ('kek_salt', 'auth_tag') THEN '🔑 Crypto Metadata'
    ELSE '📄 Regular Field'
  END as field_type
FROM information_schema.columns
WHERE table_name = 'user_secure_profiles'
ORDER BY
  CASE
    WHEN column_name = 'id' THEN 1
    WHEN column_name = 'user_id' THEN 2
    WHEN column_name LIKE 'wrapped_%' THEN 3
    WHEN column_name LIKE 'encrypted_%' THEN 4
    WHEN column_name LIKE '%_iv' THEN 5
    ELSE 6
  END,
  column_name;

-- ============================================================================
-- 4. ENCRYPTION COLUMN VERIFICATION - form_submissions
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN column_name LIKE 'encrypted_%' THEN '🔐 Encrypted Field'
    WHEN column_name LIKE '%_iv' THEN '🔑 IV Field'
    ELSE '📄 Regular Field'
  END as field_type
FROM information_schema.columns
WHERE table_name = 'form_submissions'
AND (column_name LIKE 'encrypted_%' OR column_name LIKE '%_iv' OR column_name IN ('id', 'user_id', 'form_id', 'status', 'created_at'))
ORDER BY
  CASE
    WHEN column_name = 'id' THEN 1
    WHEN column_name = 'user_id' THEN 2
    WHEN column_name = 'form_id' THEN 3
    WHEN column_name LIKE 'encrypted_%' THEN 4
    WHEN column_name LIKE '%_iv' THEN 5
    ELSE 6
  END,
  column_name;

-- ============================================================================
-- 5. ENCRYPTION COLUMN VERIFICATION - user_documents
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN column_name LIKE 'encrypted_%' THEN '🔐 Encrypted Field'
    WHEN column_name LIKE '%_iv' THEN '🔑 IV Field'
    ELSE '📄 Regular Field'
  END as field_type
FROM information_schema.columns
WHERE table_name = 'user_documents'
AND (column_name LIKE 'encrypted_%' OR column_name LIKE '%_iv' OR column_name IN ('id', 'user_id', 'name', 'type', 'created_at'))
ORDER BY
  CASE
    WHEN column_name = 'id' THEN 1
    WHEN column_name = 'user_id' THEN 2
    WHEN column_name LIKE 'encrypted_%' THEN 3
    WHEN column_name LIKE '%_iv' THEN 4
    ELSE 5
  END,
  column_name;

-- ============================================================================
-- 6. AUTH HARDENING TABLES VERIFICATION
-- ============================================================================

SELECT
  tablename,
  CASE
    WHEN tablename IN ('account_lockouts', 'auth_login_attempts', 'user_sessions', 'password_history', 'mfa_backup_codes') THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('account_lockouts', 'auth_login_attempts', 'user_sessions', 'password_history', 'mfa_backup_codes')
ORDER BY tablename;

-- ============================================================================
-- 7. SENSITIVE TABLES - RLS POLICY CHECK
-- ============================================================================

-- Check that sensitive tables have restrictive policies
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  STRING_AGG(p.policyname, ', ') as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
AND t.tablename IN ('user_secure_profiles', 'form_submissions', 'user_documents', 'mfa_backup_codes', 'password_history', 'user_sessions')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- ============================================================================
-- 8. UNAUTHENTICATED ACCESS CHECK
-- ============================================================================

-- List policies that allow SELECT without authentication
SELECT
  tablename,
  policyname,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'SELECT'
AND (
  qual LIKE '%true%'
  OR qual NOT LIKE '%auth.uid()%'
)
ORDER BY tablename;

-- ============================================================================
-- 9. COLUMN ENCRYPTION SUMMARY
-- ============================================================================

SELECT
  'user_secure_profiles' as table_name,
  COUNT(*) FILTER (WHERE column_name LIKE 'encrypted_%') as encrypted_fields,
  COUNT(*) FILTER (WHERE column_name LIKE '%_iv') as iv_fields,
  COUNT(*) FILTER (WHERE column_name LIKE 'wrapped_%') as wrapped_key_fields
FROM information_schema.columns
WHERE table_name = 'user_secure_profiles'

UNION ALL

SELECT
  'form_submissions' as table_name,
  COUNT(*) FILTER (WHERE column_name LIKE 'encrypted_%') as encrypted_fields,
  COUNT(*) FILTER (WHERE column_name LIKE '%_iv') as iv_fields,
  0 as wrapped_key_fields
FROM information_schema.columns
WHERE table_name = 'form_submissions'

UNION ALL

SELECT
  'user_documents' as table_name,
  COUNT(*) FILTER (WHERE column_name LIKE 'encrypted_%') as encrypted_fields,
  COUNT(*) FILTER (WHERE column_name LIKE '%_iv') as iv_fields,
  0 as wrapped_key_fields
FROM information_schema.columns
WHERE table_name = 'user_documents';
