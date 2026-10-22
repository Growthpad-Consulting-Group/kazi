ALTER TABLE feedback ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES recognition_campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS feedback_campaign_id ON feedback(campaign_id);
