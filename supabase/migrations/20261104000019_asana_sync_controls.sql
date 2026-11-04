-- Asana sync controls. Staff can see whether their sync works, choose which
-- projects Kazi reads, and decide whether Asana counts appear in the Slack brief.
ALTER TABLE public.asana_connections
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS selected_project_gids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS include_in_slack_brief boolean NOT NULL DEFAULT true;
