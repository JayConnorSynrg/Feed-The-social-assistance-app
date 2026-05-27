-- Saved resources: users can bookmark resources they find useful
CREATE TABLE IF NOT EXISTS public.saved_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  resource_name TEXT NOT NULL,
  resource_category TEXT,
  resource_address TEXT,
  resource_phone TEXT,
  resource_website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint: one save per user per resource (when resource_id is not null)
CREATE UNIQUE INDEX idx_saved_resources_user_resource
  ON public.saved_resources(user_id, resource_id)
  WHERE resource_id IS NOT NULL;

ALTER TABLE public.saved_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved resources" ON public.saved_resources
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Documents attached to a specific saved resource
CREATE TABLE IF NOT EXISTS public.saved_resource_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_resource_id UUID NOT NULL REFERENCES public.saved_resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_resource_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own resource documents" ON public.saved_resource_documents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
