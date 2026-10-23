-- Add calendar display name to google_calendar_connections
ALTER TABLE google_calendar_connections
  ADD COLUMN IF NOT EXISTS calendar_name text;
