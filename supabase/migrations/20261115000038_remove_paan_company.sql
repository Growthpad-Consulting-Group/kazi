-- Remove the PAAN company seed. PAAN is not yet in scope; it can be added back
-- via a new migration and membership assignment when needed.
DELETE FROM public.companies WHERE slug = 'paan';
