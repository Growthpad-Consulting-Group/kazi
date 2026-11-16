-- Browser push subscriptions, one row per device a user has opted into.
-- The endpoint is unique so re-subscribing the same browser updates its keys.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions(user_id);

-- Row Level Security: only the server (service role) reads or writes these.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_anon_access" ON public.push_subscriptions FOR ALL TO anon USING (false);
GRANT ALL ON public.push_subscriptions TO service_role;
