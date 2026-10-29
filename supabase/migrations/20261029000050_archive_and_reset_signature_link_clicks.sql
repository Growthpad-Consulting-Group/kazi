-- Archive the current signature template link clicks, then clear the live table
-- so template click counts restart from zero. The archive keeps every row for recovery.

CREATE TABLE IF NOT EXISTS signature_template_link_clicks_archive (
  LIKE signature_template_link_clicks INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO signature_template_link_clicks_archive (
  id, template_id, staff_profile_id, destination, label, clicked_at
)
SELECT id, template_id, staff_profile_id, destination, label, clicked_at
FROM signature_template_link_clicks;

DELETE FROM signature_template_link_clicks;
