-- A paused job remains configured and keeps its scheduling data, but is not
-- public or accepting applications until a recruiter reopens it.
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'paused';
