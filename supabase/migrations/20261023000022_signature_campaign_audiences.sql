-- Campaign banners may be targeted to selected signature staff, a reusable staff group,
-- or an entire department. No target rows means the campaign remains organisation-wide.
CREATE TABLE IF NOT EXISTS signature_campaign_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES signature_campaigns(id) ON DELETE CASCADE,
  audience_type text NOT NULL CHECK (audience_type IN ('staff', 'staff_group', 'department')),
  staff_profile_id uuid REFERENCES signature_staff_profiles(id) ON DELETE CASCADE,
  staff_group_id uuid REFERENCES staff_groups(id) ON DELETE CASCADE,
  department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (audience_type = 'staff' AND staff_profile_id IS NOT NULL AND staff_group_id IS NULL AND department IS NULL) OR
    (audience_type = 'staff_group' AND staff_profile_id IS NULL AND staff_group_id IS NOT NULL AND department IS NULL) OR
    (audience_type = 'department' AND staff_profile_id IS NULL AND staff_group_id IS NULL AND department IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (campaign_id, audience_type, staff_profile_id, staff_group_id, department)
);

CREATE INDEX IF NOT EXISTS signature_campaign_audiences_campaign_id_idx ON signature_campaign_audiences(campaign_id);
CREATE INDEX IF NOT EXISTS signature_campaign_audiences_staff_profile_id_idx ON signature_campaign_audiences(staff_profile_id);
GRANT ALL ON signature_campaign_audiences TO service_role;
