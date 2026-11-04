-- Selected-project Asana webhooks. Each subscription covers one project chosen by an
-- administrator. The signing secret is stored encrypted and never returned by the API.
CREATE TABLE IF NOT EXISTS public.asana_webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_token text NOT NULL UNIQUE,
  workspace_gid text NOT NULL,
  project_gid text NOT NULL,
  webhook_gid text,
  secret_ciphertext text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sync_token text,
  last_event_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_gid, project_gid)
);

-- One row per Asana event. The key makes retries and overlapping deliveries harmless.
CREATE TABLE IF NOT EXISTS public.asana_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.asana_webhook_subscriptions(id) ON DELETE CASCADE,
  event_key text NOT NULL UNIQUE,
  action text NOT NULL,
  resource_gid text NOT NULL,
  source text NOT NULL CHECK (source IN ('webhook', 'reconciliation')),
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asana_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asana_task_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_asana_webhook_subscriptions"
  ON public.asana_webhook_subscriptions FOR ALL TO anon USING (false);
CREATE POLICY "anon_no_access_asana_task_events"
  ON public.asana_task_events FOR ALL TO anon USING (false);
GRANT ALL ON public.asana_webhook_subscriptions TO service_role;
GRANT ALL ON public.asana_task_events TO service_role;
