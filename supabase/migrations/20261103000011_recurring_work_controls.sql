ALTER TABLE recurring_work_templates
  ADD COLUMN IF NOT EXISTS ends_on date;
