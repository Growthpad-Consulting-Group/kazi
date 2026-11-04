-- Pulse usefulness measurement and configurable home modules.
-- Queue lifecycle is kept per person only to measure how long an item stays open.
-- Link clicks store the item kind and time, never who clicked, so they cannot be
-- used to watch individuals. Admins see aggregates with a minimum group size.

CREATE TABLE IF NOT EXISTS public.pulse_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('employee', 'attention')),
  kind text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (user_id, scope, kind, first_seen_at)
);

CREATE INDEX IF NOT EXISTS pulse_queue_items_open
  ON public.pulse_queue_items (user_id, scope, kind)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pulse_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('employee', 'attention')),
  kind text NOT NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_link_clicks_kind_time
  ON public.pulse_link_clicks (kind, clicked_at DESC);

CREATE TABLE IF NOT EXISTS public.pulse_home_modules (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  modules text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pulse_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_home_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_pulse_queue_items"
  ON public.pulse_queue_items FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_pulse_link_clicks"
  ON public.pulse_link_clicks FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_pulse_home_modules"
  ON public.pulse_home_modules FOR ALL TO anon USING (false);

GRANT ALL ON public.pulse_queue_items TO service_role;
GRANT ALL ON public.pulse_link_clicks TO service_role;
GRANT ALL ON public.pulse_home_modules TO service_role;
