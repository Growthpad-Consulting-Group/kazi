-- The product is called Wall of Fame everywhere. Rename the tables and their
-- constraints, indexes, triggers and policies to match. Rows and foreign keys are
-- kept as they are; only names change.

ALTER TABLE public.hall_of_fame_cycles RENAME TO wall_of_fame_cycles;
ALTER TABLE public.hall_of_fame_nominations RENAME TO wall_of_fame_nominations;
ALTER TABLE public.hall_of_fame_votes RENAME TO wall_of_fame_votes;
ALTER TABLE public.hall_of_fame_winners RENAME TO wall_of_fame_winners;

-- Indexes and constraints that carry the old prefix.
DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS old_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname LIKE 'hall\_of\_fame%' ESCAPE '\'
  LOOP
    new_name := regexp_replace(r.old_name, '^hall_of_fame', 'wall_of_fame');
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.old_name, new_name);
  END LOOP;

  FOR r IN
    SELECT con.conname AS old_name, cls.relname AS table_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public'
      AND cls.relname LIKE 'wall_of_fame%'
      AND con.conname LIKE 'hall\_of\_fame%' ESCAPE '\'
  LOOP
    new_name := regexp_replace(r.old_name, '^hall_of_fame', 'wall_of_fame');
    EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', r.table_name, r.old_name, new_name);
  END LOOP;

  FOR r IN
    SELECT tg.tgname AS old_name, cls.relname AS table_name
    FROM pg_trigger tg
    JOIN pg_class cls ON cls.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public'
      AND cls.relname LIKE 'wall_of_fame%'
      AND tg.tgname LIKE 'hall\_of\_fame%' ESCAPE '\'
  LOOP
    new_name := regexp_replace(r.old_name, '^hall_of_fame', 'wall_of_fame');
    EXECUTE format('ALTER TRIGGER %I ON public.%I RENAME TO %I', r.old_name, r.table_name, new_name);
  END LOOP;

  FOR r IN
    SELECT pol.polname AS old_name, cls.relname AS table_name
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public'
      AND cls.relname LIKE 'wall_of_fame%'
      AND pol.polname LIKE '%hall\_of\_fame%' ESCAPE '\'
  LOOP
    new_name := replace(r.old_name, 'hall_of_fame', 'wall_of_fame');
    EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I', r.old_name, r.table_name, new_name);
  END LOOP;
END $$;

-- Stored keys that the app reads back. Historical delivery records keep their
-- original category so the audit trail still shows what was sent at the time.
UPDATE public.slack_category_controls
SET category = 'wall_of_fame_nominations'
WHERE category = 'hall_of_fame_nominations';

UPDATE public.pulse_queue_items
SET kind = 'wall_of_fame'
WHERE kind = 'hall_of_fame';

UPDATE public.pulse_link_clicks
SET kind = 'wall_of_fame'
WHERE kind = 'hall_of_fame';
