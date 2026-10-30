create table if not exists google_profile_connections (
  user_id uuid primary key references users(id) on delete cascade,
  google_subject text not null,
  google_email text not null,
  connected_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

alter table google_profile_connections enable row level security;
create policy "anon_no_access_google_profile_connections" on google_profile_connections for all to anon using (false);
grant all on google_profile_connections to service_role;
