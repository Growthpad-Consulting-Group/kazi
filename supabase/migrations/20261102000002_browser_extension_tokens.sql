-- Short-lived, revocable credentials for browser extensions. Only token hashes
-- are stored; a raw credential is returned once to the extension after staff
-- approve the connection in an authenticated Kazi session.
CREATE TABLE IF NOT EXISTS public.browser_extension_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  client_name text NOT NULL DEFAULT 'kazi-timer',
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS browser_extension_tokens_user_idx
  ON public.browser_extension_tokens(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.browser_extension_timer_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_entry_id uuid NOT NULL,
  log_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_entry_id)
);

ALTER TABLE public.browser_extension_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_extension_timer_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_extension_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.browser_extension_timer_entries TO service_role;
