-- The importer and future server-side Kazi Signatures APIs run through
-- Supabase's service role. Grant it access explicitly; do not grant access to
-- anonymous or authenticated browser roles until module-specific RLS policies
-- are introduced.
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  signature_domains,
  signature_templates,
  signature_staff_profiles,
  signature_assignments,
  signature_template_versions,
  signature_campaign_experiments,
  signature_campaigns,
  signature_campaign_daily_stats,
  signature_campaign_clicks,
  signature_media_assets,
  signature_template_link_clicks
TO service_role;
