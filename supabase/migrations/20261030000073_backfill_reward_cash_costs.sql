-- Preserve existing descriptions while moving an explicitly written KES/KSh amount
-- into the dedicated fulfilment-cost field.
update public.reward_catalogue
set cash_cost_kes = replace(
  (regexp_match(description, '(?i)(?:kes|ksh|kshs|ksh\.)\s*([0-9][0-9,]*)'))[1],
  ',',
  ''
)::integer
where cash_cost_kes is null
  and description is not null
  and description ~* '(?:kes|ksh|kshs|ksh\.)\s*[0-9]';
