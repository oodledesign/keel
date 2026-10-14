-- Instagram Automation v2: plan-level caps for automations and sends.
-- Follows the account_plan_limits convention: NULL = unlimited / not enforced.

ALTER TABLE public.account_plan_limits
  ADD COLUMN IF NOT EXISTS max_ig_automations integer,
  ADD COLUMN IF NOT EXISTS max_ig_sends_per_month integer,
  ADD COLUMN IF NOT EXISTS ig_hourly_send_cap integer;

COMMENT ON COLUMN public.account_plan_limits.max_ig_automations IS
  'Max Instagram automations (ig_triggers) per account. NULL = unlimited.';
COMMENT ON COLUMN public.account_plan_limits.max_ig_sends_per_month IS
  'Max automated Instagram messages sent per calendar month (UTC). NULL = unlimited.';
COMMENT ON COLUMN public.account_plan_limits.ig_hourly_send_cap IS
  'Per-account hourly Instagram send cap. NULL = use the IG_HOURLY_SEND_CAP env default.';
