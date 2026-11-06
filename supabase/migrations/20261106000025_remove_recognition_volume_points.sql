-- Public recognition remains appreciation, not a volume-based earning mechanic.
-- Reverse only still-unspent lots created by the legacy automatic +5 award. This
-- keeps redeemed rewards and the ledger history intact while removing remaining
-- recognition-volume value from wallets.
WITH target_lots AS (
  SELECT lots.id, lots.user_id, lots.remaining_points
  FROM public.reward_point_lots lots
  JOIN public.reward_ledger ledger ON ledger.id = lots.earned_ledger_id
  WHERE ledger.reason = 'Public recognition given'
    AND lots.remaining_points > 0
), removed_lots AS (
  UPDATE public.reward_point_lots lots
  SET remaining_points = 0,
      expired_at = COALESCE(expired_at, now())
  FROM target_lots target
  WHERE lots.id = target.id
  RETURNING target.user_id, target.remaining_points
), reversals AS (
  SELECT user_id, SUM(remaining_points)::integer AS amount
  FROM removed_lots
  GROUP BY user_id
), wallets AS (
  UPDATE public.reward_wallets wallet
  SET balance = GREATEST(wallet.balance - reversals.amount, 0),
      updated_at = now()
  FROM reversals
  WHERE wallet.user_id = reversals.user_id
  RETURNING wallet.user_id, reversals.amount
)
INSERT INTO public.reward_ledger (user_id, amount, reason, reference_type)
SELECT
  user_id,
  -amount,
  'Automatic public-recognition points removed — recognition is not a volume incentive',
  'recognition_policy_reversal'
FROM wallets;
