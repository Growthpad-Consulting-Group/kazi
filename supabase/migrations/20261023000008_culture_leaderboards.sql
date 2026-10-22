ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS culture_leaderboards_enabled boolean NOT NULL DEFAULT false;
