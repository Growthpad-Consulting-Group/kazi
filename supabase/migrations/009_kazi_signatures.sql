-- ============================================================
-- Kazi Signatures
-- Imported Signoff data lives in a dedicated namespace so Kazi's shared
-- users, departments, sessions and notifications remain the source of truth.
-- ============================================================

CREATE TABLE IF NOT EXISTS signature_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'google_workspace'
    CHECK (platform IN ('google_workspace', 'microsoft_365', 'other')),
  gateway_status text NOT NULL DEFAULT 'not_configured'
    CHECK (gateway_status IN ('not_configured', 'pending_dns', 'active', 'error')),
  spf_verified boolean NOT NULL DEFAULT false,
  dkim_verified boolean NOT NULL DEFAULT false,
  notes text,
  cloudflare_api_token_encrypted text,
  cloudflare_zone_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  html text NOT NULL DEFAULT '',
  thumbnail_url text,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  blocks jsonb,
  builder_data jsonb,
  canvas_width integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A Kazi user can have profiles for more than one sending domain. user_id is
-- nullable during migration so legacy mailboxes can be reconciled or invited
-- without inventing credentials.
CREATE TABLE IF NOT EXISTS signature_staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  domain_id uuid NOT NULL REFERENCES signature_domains(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role_title text,
  department text,
  phone text,
  mobile text,
  photo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signature_staff_profiles_user_id_idx ON signature_staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS signature_staff_profiles_domain_id_idx ON signature_staff_profiles(domain_id);

CREATE TABLE IF NOT EXISTS signature_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id uuid NOT NULL UNIQUE REFERENCES signature_staff_profiles(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES signature_templates(id) ON DELETE RESTRICT,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_deployed_at timestamptz,
  deploy_status text NOT NULL DEFAULT 'pending' CHECK (deploy_status IN ('pending', 'deployed', 'error')),
  deploy_error text,
  gmail_sync_status text NOT NULL DEFAULT 'pending' CHECK (gmail_sync_status IN ('pending', 'synced', 'error', 'not_applicable')),
  gmail_sync_error text,
  last_gmail_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES signature_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  html text NOT NULL,
  blocks jsonb,
  builder_data jsonb,
  canvas_width integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signature_template_versions_template_id_idx ON signature_template_versions(template_id);

CREATE TABLE IF NOT EXISTS signature_campaign_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS signature_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  link_url text NOT NULL,
  domain_id uuid REFERENCES signature_domains(id) ON DELETE CASCADE,
  experiment_id uuid REFERENCES signature_campaign_experiments(id) ON DELETE SET NULL,
  variant_label text,
  weight integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS signature_campaigns_experiment_id_idx ON signature_campaigns(experiment_id);

CREATE TABLE IF NOT EXISTS signature_campaign_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  UNIQUE (campaign_id, date)
);

CREATE TABLE IF NOT EXISTS signature_campaign_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  staff_profile_id uuid REFERENCES signature_staff_profiles(id) ON DELETE SET NULL,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  public_url text NOT NULL,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signature_template_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES signature_templates(id) ON DELETE CASCADE,
  staff_profile_id uuid REFERENCES signature_staff_profiles(id) ON DELETE SET NULL,
  destination text NOT NULL,
  label text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signature_campaign_daily_stats_campaign_id_idx ON signature_campaign_daily_stats(campaign_id);
CREATE INDEX IF NOT EXISTS signature_campaign_clicks_campaign_id_idx ON signature_campaign_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS signature_template_link_clicks_template_id_idx ON signature_template_link_clicks(template_id);

-- Keep the audit fields aligned with the rest of Kazi's mutable records.
CREATE TRIGGER signature_domains_updated_at BEFORE UPDATE ON signature_domains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER signature_templates_updated_at BEFORE UPDATE ON signature_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER signature_staff_profiles_updated_at BEFORE UPDATE ON signature_staff_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER signature_assignments_updated_at BEFORE UPDATE ON signature_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER signature_campaigns_updated_at BEFORE UPDATE ON signature_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
