-- Let server-side Kazi Signatures code read the archived template link clicks.
-- The archive is read-only for service_role; browser roles still have no access.
GRANT SELECT ON TABLE signature_template_link_clicks_archive TO service_role;
