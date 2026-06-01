-- Reconcile form_templates.id / form_submissions.template_id from uuid -> text.
-- Root cause: form tables were provisioned with uuid ids (dashboard/diverged 20260120),
-- but app code + forms-as-code TS templates use semantic string ids (e.g. snap-application-v1).
-- text-id-into-uuid-column caused 22P02 on every submit. Both tables empty -> trivial cast.
-- Idempotent: only converts when currently uuid, so a fresh `db reset` (repo text schema)
-- is a no-op -> repo and live converge to the same end state.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='form_templates' AND column_name='id')='uuid' THEN
    ALTER TABLE public.form_submissions DROP CONSTRAINT form_submissions_template_id_fkey;
    ALTER TABLE public.form_templates   ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.form_templates   ALTER COLUMN id          TYPE text USING id::text;
    ALTER TABLE public.form_submissions ALTER COLUMN template_id TYPE text USING template_id::text;
    ALTER TABLE public.form_submissions
      ADD CONSTRAINT form_submissions_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.form_templates(id) ON DELETE RESTRICT;
  END IF;
END $$;
