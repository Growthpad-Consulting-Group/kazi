update public.candidates
set linkedin_url = regexp_replace(btrim(linkedin_url), '/in/%20+', '/in/', 'i')
where linkedin_url is not null;
update public.candidates
set portfolio_url = btrim(portfolio_url)
where portfolio_url is not null;
