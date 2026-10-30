alter table jobs
  add column if not exists google_indexed_at timestamptz,
  add column if not exists google_removed_at timestamptz;

comment on column jobs.google_indexed_at is
  'When this public job URL was last sent to the Google Indexing API as URL_UPDATED.';
comment on column jobs.google_removed_at is
  'When this job URL was last sent to the Google Indexing API as URL_DELETED.';
