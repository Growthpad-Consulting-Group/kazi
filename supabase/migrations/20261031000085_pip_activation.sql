alter table public.pips
  add column if not exists activated_at timestamptz,
  add column if not exists activation_exception_reason text;

-- Do not unexpectedly put existing live plans on hold when this safeguard is introduced.
update public.pips
set activated_at = coalesce(activated_at, created_at)
where activated_at is null;

alter table public.pips
  alter column activated_at set default null;
