-- Older wallet balances predate reliable ledger records. Add one explicit
-- reconciliation entry per mismatch so every available balance is auditable.
with ledger_totals as (
  select user_id, coalesce(sum(amount), 0)::integer as ledger_balance
  from public.reward_ledger
  group by user_id
), adjustments as (
  select
    wallet.user_id,
    wallet.balance - coalesce(ledger.ledger_balance, 0) as amount
  from public.reward_wallets wallet
  left join ledger_totals ledger on ledger.user_id = wallet.user_id
)
insert into public.reward_ledger (
  user_id,
  amount,
  reason,
  reference_type
)
select
  user_id,
  amount,
  'Historical wallet balance reconciled into the reward ledger',
  'wallet_reconciliation'
from adjustments
where amount <> 0;
