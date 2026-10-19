-- ============================================================
-- Kazi: Initial Schema
-- Custom users table (no Supabase Auth), recruitment Phase 1
-- ============================================================

-- Enums
create type user_role as enum ('admin', 'hr', 'hiring_manager', 'interviewer', 'manager', 'employee');
create type job_status as enum ('draft', 'open', 'closed');
create type candidate_stage as enum ('applied', 'screened', 'interview', 'offer', 'hired', 'rejected');

-- ============================================================
-- Users (custom — Supabase Auth is NOT used)
-- ============================================================
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  role          user_role not null default 'employee',
  department    text,
  avatar_url    text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Sessions (NextAuth custom adapter)
-- ============================================================
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  session_token text not null unique,
  expires       timestamptz not null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Jobs
-- ============================================================
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  department      text,
  location        text,
  description     text,
  requirements    jsonb not null default '{"must_haves": [], "nice_to_haves": []}',
  scoring_rubric  jsonb not null default '[]',
  status          job_status not null default 'draft',
  created_by      uuid not null references users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- Candidates
-- ============================================================
create table candidates (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references jobs(id) on delete cascade,
  -- Personal info (visible to humans; anonymised before AI scoring)
  full_name           text not null,
  email               text not null,
  phone               text,
  location            text,
  -- CV storage
  cv_url              text,                  -- Supabase Storage path
  cv_text             text,                  -- raw extracted text
  cv_parsed           jsonb,                 -- structured: {experience, skills, education}
  -- Pipeline
  stage               candidate_stage not null default 'applied',
  assigned_to         uuid references users(id),
  source              text,                  -- linkedin, referral, direct, etc.
  -- AI screening (run on anonymised data)
  ai_score            numeric(4,1),          -- 0–100
  ai_justification    text,
  shortlisted         boolean not null default false,
  -- DPA compliance
  consented_at        timestamptz,
  -- Timestamps
  applied_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- Candidate Notes
-- ============================================================
create table candidate_notes (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references candidates(id) on delete cascade,
  user_id       uuid not null references users(id),
  note          text not null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Interview Scorecards
-- ============================================================
create table interview_scorecards (
  id              uuid primary key default gen_random_uuid(),
  candidate_id    uuid not null references candidates(id) on delete cascade,
  interviewer_id  uuid not null references users(id),
  questions       jsonb not null default '[]',   -- [{question, answer, score}]
  overall_score   numeric(4,1),
  recommendation  text,                          -- hire, no_hire, maybe
  ai_summary      text,                          -- AI summary of this scorecard
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- AI Logs (auditability — every AI call recorded)
-- ============================================================
create table ai_logs (
  id            uuid primary key default gen_random_uuid(),
  operation     text not null,    -- cv_parse, screening, jd_draft, interview_questions, scorecard_summary
  entity_type   text not null,    -- candidate, job
  entity_id     uuid not null,
  model         text not null,
  prompt        text not null,
  response      text not null,
  tokens_used   integer,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Updated-at triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger trg_jobs_updated_at
  before update on jobs
  for each row execute function set_updated_at();

create trigger trg_candidates_updated_at
  before update on candidates
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table users               enable row level security;
alter table sessions            enable row level security;
alter table jobs                enable row level security;
alter table candidates          enable row level security;
alter table candidate_notes     enable row level security;
alter table interview_scorecards enable row level security;
alter table ai_logs             enable row level security;

-- Service role bypasses RLS (used server-side only)
-- App-level access is enforced in API route handlers via session checks,
-- not via Supabase JWT policies (we use custom sessions, not Supabase Auth).
-- Policies below allow the anon key zero access; all reads/writes go through
-- the service role key on the server.

create policy "no_anon_access" on users             for all to anon using (false);
create policy "no_anon_access" on sessions          for all to anon using (false);
create policy "no_anon_access" on jobs              for all to anon using (false);
create policy "no_anon_access" on candidates        for all to anon using (false);
create policy "no_anon_access" on candidate_notes   for all to anon using (false);
create policy "no_anon_access" on interview_scorecards for all to anon using (false);
create policy "no_anon_access" on ai_logs           for all to anon using (false);

-- ============================================================
-- Grants (service_role used by server; anon blocked by RLS policies above)
-- ============================================================
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ============================================================
-- Indexes
-- ============================================================
create index on sessions(user_id);
create index on sessions(session_token);
create index on jobs(status);
create index on candidates(job_id);
create index on candidates(stage);
create index on candidates(assigned_to);
create index on candidate_notes(candidate_id);
create index on interview_scorecards(candidate_id);
create index on ai_logs(entity_id);
