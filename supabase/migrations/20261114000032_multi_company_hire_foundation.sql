-- Multi-company Hire foundation. Growthpad is the initial/default workspace;
-- CCSA and PAAN can share staff identities while keeping hiring data isolated.

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  website_url text,
  careers_url text,
  logo_url text,
  brand_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_to_email text,
  application_from_name text,
  privacy_url text,
  terms_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.companies (
  slug,
  legal_name,
  display_name,
  website_url,
  careers_url,
  application_from_name
)
VALUES
  (
    'growthpad',
    'Growthpad Consulting Group',
    'Growthpad',
    'https://growthpad.africa',
    'https://growthpad.africa/careers',
    'Growthpad Careers'
  ),
  (
    'ccsa',
    'Call Center Solutions Africa',
    'CCSA',
    'https://callcentersolutionsafrica.com',
    'https://callcentersolutionsafrica.com/careers',
    'CCSA Careers'
  ),
  (
    'paan',
    'PAAN',
    'PAAN',
    NULL,
    NULL,
    'PAAN Careers'
  )
ON CONFLICT (slug) DO UPDATE SET
  legal_name = EXCLUDED.legal_name,
  display_name = EXCLUDED.display_name,
  website_url = COALESCE(public.companies.website_url, EXCLUDED.website_url),
  careers_url = COALESCE(public.companies.careers_url, EXCLUDED.careers_url),
  application_from_name = COALESCE(public.companies.application_from_name, EXCLUDED.application_from_name);

CREATE TABLE IF NOT EXISTS public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hire_role text NOT NULL CHECK (hire_role IN ('company_admin', 'recruiter', 'hiring_manager', 'viewer')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

DROP TRIGGER IF EXISTS trg_company_memberships_updated_at ON public.company_memberships;
CREATE TRIGGER trg_company_memberships_updated_at
  BEFORE UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Existing recruitment users retain their current Growthpad access. Memberships
-- are intentionally separate from the application-wide system role.
INSERT INTO public.company_memberships (company_id, user_id, hire_role)
SELECT
  company.id,
  staff.id,
  CASE
    WHEN staff.role IN ('admin', 'hr') THEN 'company_admin'
    WHEN staff.role = 'hiring_manager' THEN 'hiring_manager'
    ELSE 'viewer'
  END
FROM public.users AS staff
CROSS JOIN public.companies AS company
WHERE company.slug = 'growthpad'
  AND staff.is_active = true
  AND staff.role IN ('admin', 'hr', 'hiring_manager', 'interviewer')
ON CONFLICT (company_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.default_hire_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.companies WHERE slug = 'growthpad' LIMIT 1;
$$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

UPDATE public.jobs
SET company_id = public.default_hire_company_id()
WHERE company_id IS NULL;

ALTER TABLE public.jobs
  ALTER COLUMN company_id SET DEFAULT public.default_hire_company_id(),
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_company_id_idx ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS jobs_company_status_idx ON public.jobs(company_id, status);

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

UPDATE public.candidates AS candidate
SET company_id = job.company_id
FROM public.jobs AS job
WHERE candidate.job_id = job.id
  AND candidate.company_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_candidate_company_from_job()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  job_company_id uuid;
BEGIN
  SELECT company_id INTO job_company_id
  FROM public.jobs
  WHERE id = NEW.job_id;

  IF job_company_id IS NULL THEN
    RAISE EXCEPTION 'Candidate job % must belong to a company', NEW.job_id;
  END IF;

  NEW.company_id := job_company_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_company_from_job ON public.candidates;
CREATE TRIGGER trg_candidates_company_from_job
  BEFORE INSERT OR UPDATE OF job_id ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_candidate_company_from_job();

ALTER TABLE public.candidates
  ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS candidates_company_id_idx ON public.candidates(company_id);
CREATE INDEX IF NOT EXISTS candidates_company_stage_idx ON public.candidates(company_id, stage);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS no_anon_access ON public.companies;
CREATE POLICY no_anon_access ON public.companies FOR ALL TO anon USING (false);
DROP POLICY IF EXISTS no_anon_access ON public.company_memberships;
CREATE POLICY no_anon_access ON public.company_memberships FOR ALL TO anon USING (false);

GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.company_memberships TO service_role;
