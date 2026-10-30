create table if not exists passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_type text not null check (device_type in ('singleDevice', 'multiDevice')),
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_id_idx on passkeys(user_id);
alter table passkeys enable row level security;
create policy "anon_no_access_passkeys" on passkeys for all to anon using (false);
grant all on passkeys to service_role;
