-- Identifies the browser install a Kazi Timer token was issued to, so a new
-- connection from one browser only retires that browser's earlier token.
alter table public.browser_extension_tokens
  add column if not exists install_id text;

create index if not exists browser_extension_tokens_install_idx
  on public.browser_extension_tokens (user_id, client_name, install_id);
