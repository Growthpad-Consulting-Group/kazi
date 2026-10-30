-- Structured job details extracted from approved job descriptions.
alter table jobs
  add column if not exists employment_type text,
  add column if not exists work_mode text,
  add column if not exists contract_duration text,
  add column if not exists compensation text,
  add column if not exists reports_to text,
  add column if not exists benefits text,
  add column if not exists application_instructions text,
  add column if not exists selection_process text,
  add column if not exists source_document_url text;
