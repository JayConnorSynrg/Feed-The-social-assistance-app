-- Audit Logging Verification Script
-- Run this in Supabase SQL Editor after applying the migration

-- ============================================
-- 1. Verify Table Exists
-- ============================================
SELECT
  'audit_log table exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'audit_log'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 2. Verify Columns
-- ============================================
SELECT
  'audit_log has all required columns' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_name = 'audit_log'
        AND column_name IN (
          'id', 'user_id', 'session_id', 'ip_address', 'user_agent',
          'event_type', 'event_category', 'severity', 'resource_type',
          'resource_id', 'action', 'details', 'created_at'
        )
    ) = 13 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 3. Verify Indexes
-- ============================================
SELECT
  'audit_log has required indexes' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM pg_indexes
      WHERE tablename = 'audit_log'
    ) >= 8 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 4. Verify RLS is Enabled
-- ============================================
SELECT
  'Row Level Security enabled' as check_name,
  CASE
    WHEN (
      SELECT rowsecurity
      FROM pg_tables
      WHERE tablename = 'audit_log'
    ) = true THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 5. Verify RLS Policies
-- ============================================
SELECT
  'RLS policies exist' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM pg_policies
      WHERE tablename = 'audit_log'
    ) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 6. Verify Helper Function
-- ============================================
SELECT
  'log_audit_event function exists' as check_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_name = 'log_audit_event'
        AND routine_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- 7. Verify Constraints
-- ============================================
SELECT
  'Check constraints exist' as check_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM information_schema.table_constraints
      WHERE table_name = 'audit_log'
        AND constraint_type = 'CHECK'
    ) >= 3 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status;

-- ============================================
-- DETAILED INFORMATION (Optional)
-- ============================================

-- List all columns
SELECT
  '=== COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- List all indexes
SELECT
  '=== INDEXES ===' as section,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'audit_log';

-- List all RLS policies
SELECT
  '=== RLS POLICIES ===' as section,
  policyname,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'audit_log';

-- List all constraints
SELECT
  '=== CONSTRAINTS ===' as section,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'audit_log';

-- ============================================
-- TEST INSERT (Optional)
-- ============================================
-- Uncomment to test inserting an audit event

/*
SELECT log_audit_event(
  p_user_id := auth.uid(),
  p_event_type := 'test.event',
  p_event_category := 'system',
  p_action := 'create',
  p_severity := 'info',
  p_resource_type := 'test',
  p_resource_id := 'test-123',
  p_details := '{"test": true}'::jsonb
);

-- Verify the test event was inserted
SELECT * FROM audit_log
WHERE event_type = 'test.event'
ORDER BY created_at DESC
LIMIT 1;

-- Clean up test event
DELETE FROM audit_log WHERE event_type = 'test.event';
*/
