-- Fix: profiles.role column doesn't exist. Use is_admin boolean instead.
-- Original policies in 20260120_form_system.sql check profiles.role = 'admin'
-- which always fails because there is no role column on the profiles table.

-- ============================================
-- Fix form_templates admin policies
-- ============================================

DROP POLICY IF EXISTS "form_templates_admin_insert" ON form_templates;
DROP POLICY IF EXISTS "form_templates_admin_update" ON form_templates;
DROP POLICY IF EXISTS "form_templates_admin_delete" ON form_templates;

CREATE POLICY "form_templates_admin_insert" ON form_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "form_templates_admin_update" ON form_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "form_templates_admin_delete" ON form_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- Fix form_submissions admin policies
-- ============================================

DROP POLICY IF EXISTS "form_submissions_admin_select" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_admin_update" ON form_submissions;

CREATE POLICY "form_submissions_admin_select" ON form_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "form_submissions_admin_update" ON form_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ============================================
-- Fix form_signatures admin policy
-- (only if form_signatures table exists)
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'form_signatures'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "form_signatures_admin_select" ON form_signatures';
    EXECUTE '
      CREATE POLICY "form_signatures_admin_select" ON form_signatures
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
          )
        )';
  END IF;
END $$;
