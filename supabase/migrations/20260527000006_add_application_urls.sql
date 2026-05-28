ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  ADD COLUMN IF NOT EXISTS application_form_url TEXT;

COMMENT ON COLUMN public.resources.application_url IS 'URL to online application portal';
COMMENT ON COLUMN public.resources.application_form_url IS 'URL to downloadable PDF application form';
