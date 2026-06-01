-- Seed canonical form templates (Forms-as-Code referential-integrity rows).
-- Canonical source: apps/web/src/lib/form-templates/*.ts. These rows exist for FK
-- referential integrity + the applications-panel name join. Runtime rendering reads
-- the TS modules, not the schema column. Idempotent upsert.
INSERT INTO form_templates (id, name, description, version, form_type, is_active, schema)
VALUES
  (
    'snap-application-v1',
    'SNAP Benefits Application',
    'Apply for the Supplemental Nutrition Assistance Program (SNAP), formerly known as food stamps. SNAP helps eligible low-income individuals and families buy nutritious food.',
    1,
    'snap'::form_type,
    true,
    '{"id":"snap-application-v1","name":"SNAP Benefits Application","version":1,"sections":[{"id":"personal","title":"Personal Information","fields":["first_name","last_name"]}],"fields":[{"id":"first_name","name":"first_name","type":"text","label":"First Name","required":true,"section":"personal"}],"metadata":{"category":"benefits","formType":"snap","agency":"USDA"},"_note":"Faithful field set lives in TS module apps/web/src/lib/form-templates/snap-application.ts; this column is a referential snapshot only."}'::jsonb
  ),
  (
    'medicaid-application-v1',
    'Medicaid Application',
    'Apply for Medicaid health coverage. Medicaid provides free or low-cost health coverage to eligible low-income individuals, families, pregnant women, elderly adults, and people with disabilities.',
    1,
    'medicaid'::form_type,
    true,
    '{"id":"medicaid-application-v1","name":"Medicaid Application","version":1,"sections":[{"id":"applicant","title":"Applicant Information","fields":["first_name","last_name"]}],"fields":[{"id":"first_name","name":"first_name","type":"text","label":"First Name","required":true,"section":"applicant"}],"metadata":{"category":"benefits","formType":"medicaid","agency":"HHS"},"_note":"Faithful field set lives in TS module apps/web/src/lib/form-templates/medicaid-application.ts; this column is a referential snapshot only."}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, version = EXCLUDED.version,
  form_type = EXCLUDED.form_type, is_active = true, schema = EXCLUDED.schema, updated_at = now();
