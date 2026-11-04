-- Links a Kazi commitment to the Asana task a person created from it.
-- Created only after the person confirms; the link keeps the source record, not its notes.
CREATE TABLE IF NOT EXISTS public.asana_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('one_on_one_action', 'development_action')),
  source_id text NOT NULL,
  action_index integer NOT NULL CHECK (action_index >= 0),
  asana_task_gid text NOT NULL,
  workspace_gid text NOT NULL,
  project_gid text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_type, source_id, action_index)
);

ALTER TABLE public.asana_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_asana_task_links"
  ON public.asana_task_links FOR ALL TO anon USING (false);
GRANT ALL ON public.asana_task_links TO service_role;
