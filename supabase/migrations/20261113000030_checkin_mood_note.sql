-- An optional, staff-authored context note for low weekly mood signals.
-- This stays in the existing check-in access boundary: the staff member,
-- their manager, HR and admins can read it.

ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS mood_note text;
