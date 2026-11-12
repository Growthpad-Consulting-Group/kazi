-- Award categories become data. The stable key (for example 'wow') is what nominations,
-- votes and winners store. Labels, copy and icons can change; keys never change.
-- Categories are retired, never deleted, so past cycles keep their history.

CREATE TABLE IF NOT EXISTS public.wall_of_fame_categories (
  key text PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT '',
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  icon text NOT NULL DEFAULT 'solar:medal-ribbon-broken',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wall_of_fame_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_no_access_wall_of_fame_categories" ON public.wall_of_fame_categories;
CREATE POLICY "anon_no_access_wall_of_fame_categories" ON public.wall_of_fame_categories
  FOR ALL TO anon USING (false);
GRANT ALL ON public.wall_of_fame_categories TO service_role;

INSERT INTO public.wall_of_fame_categories (key, label, description, purpose, criteria, icon, sort_order)
VALUES
  (
    'wow',
    'WOW Award',
    'For a person who created an outstanding client experience this month.',
    'Celebrates work that made a client feel genuinely supported, impressed or confident in Growthpad.',
    '["A meaningful client outcome", "Thoughtful ownership", "Exceptional service or delivery"]'::jsonb,
    'solar:magic-stick-3-broken',
    1
  ),
  (
    'mvp',
    'MVP of the month',
    'For a teammate whose overall contribution stood out this month.',
    'Recognises consistent excellence, meaningful teamwork and work that moved Growthpad forward.',
    '["Strong results and initiative", "Meaningful collaboration", "Impact beyond usual responsibilities"]'::jsonb,
    'solar:medal-ribbon-broken',
    2
  )
ON CONFLICT (key) DO NOTHING;

-- Existing rows only use 'wow' and 'mvp', so the new foreign keys hold for them.
ALTER TABLE public.wall_of_fame_nominations DROP CONSTRAINT IF EXISTS wall_of_fame_nominations_category_check;
ALTER TABLE public.wall_of_fame_nominations
  ADD CONSTRAINT wall_of_fame_nominations_category_fkey
  FOREIGN KEY (category) REFERENCES public.wall_of_fame_categories (key);

ALTER TABLE public.wall_of_fame_votes DROP CONSTRAINT IF EXISTS wall_of_fame_votes_category_check;
ALTER TABLE public.wall_of_fame_votes
  ADD CONSTRAINT wall_of_fame_votes_category_fkey
  FOREIGN KEY (category) REFERENCES public.wall_of_fame_categories (key);

ALTER TABLE public.wall_of_fame_winners DROP CONSTRAINT IF EXISTS wall_of_fame_winners_category_check;
ALTER TABLE public.wall_of_fame_winners
  ADD CONSTRAINT wall_of_fame_winners_category_fkey
  FOREIGN KEY (category) REFERENCES public.wall_of_fame_categories (key);
