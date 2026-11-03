-- Keep one canonical client name in the picker and preserve every existing
-- activity/routine reference when correcting earlier spelling variants.
UPDATE daily_activity_logs
SET
  entries = (
    SELECT jsonb_agg(
      CASE entry->>'client'
        WHEN 'Link Phamarcy' THEN jsonb_set(entry, '{client}', to_jsonb('Link Pharmacy'::text))
        WHEN 'Zamupay' THEN jsonb_set(entry, '{client}', to_jsonb('Zampay'::text))
        ELSE entry
      END
    )
    FROM jsonb_array_elements(entries) AS entry
  ),
  updated_at = now()
WHERE entries @> '[{"client":"Link Phamarcy"}]'::jsonb
   OR entries @> '[{"client":"Zamupay"}]'::jsonb;

UPDATE recurring_work_templates
SET client = CASE client
  WHEN 'Link Phamarcy' THEN 'Link Pharmacy'
  WHEN 'Zamupay' THEN 'Zampay'
  ELSE client
END,
updated_at = now()
WHERE client IN ('Link Phamarcy', 'Zamupay');

DELETE FROM daily_log_clients
WHERE name IN ('Link Phamarcy', 'Zamupay');

-- Case and incidental whitespace should never create separate options.
CREATE OR REPLACE FUNCTION normalize_daily_log_client_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(trim(value), '\\s+', ' ', 'g'));
$$;

DROP INDEX IF EXISTS daily_log_clients_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS daily_log_clients_name_normalized_key
  ON daily_log_clients (normalize_daily_log_client_name(name));
