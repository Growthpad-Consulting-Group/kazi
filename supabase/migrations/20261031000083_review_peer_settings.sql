alter table public.review_cycles
  add column if not exists min_peer_reviews smallint not null default 1 check (min_peer_reviews between 0 and 10),
  add column if not exists max_peer_reviews smallint not null default 3 check (max_peer_reviews between 1 and 10),
  add column if not exists peer_feedback_anonymous boolean not null default false,
  add constraint review_cycles_peer_limits_check check (min_peer_reviews <= max_peer_reviews);
