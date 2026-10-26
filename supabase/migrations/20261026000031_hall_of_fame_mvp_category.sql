ALTER TABLE hall_of_fame_nominations DROP CONSTRAINT IF EXISTS hall_of_fame_nominations_category_check;
ALTER TABLE hall_of_fame_nominations ADD CONSTRAINT hall_of_fame_nominations_category_check CHECK (category IN ('wow', 'mvp'));
