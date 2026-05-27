-- Task checklist for saved resources
CREATE TABLE IF NOT EXISTS public.saved_resource_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_resource_id UUID NOT NULL REFERENCES public.saved_resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.saved_resource_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tasks" ON public.saved_resource_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_resource_tasks_resource ON public.saved_resource_tasks(saved_resource_id);

-- Calendar events for saved resources
CREATE TABLE IF NOT EXISTS public.saved_resource_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_resource_id UUID NOT NULL REFERENCES public.saved_resources(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  reminder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.saved_resource_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own events" ON public.saved_resource_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_resource_events_resource ON public.saved_resource_events(saved_resource_id);
CREATE INDEX idx_resource_events_date ON public.saved_resource_events(event_date);
