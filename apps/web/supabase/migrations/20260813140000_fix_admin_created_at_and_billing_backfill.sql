-- Fix null accounts.created_at (admin UI showed 1970) and backfill
-- account_billing from MakerKit subscriptions so trials appear in at-risk.

-- ─── 1. Backfill accounts.created_at ─────────────────────────────────────────
UPDATE public.accounts a
SET created_at = COALESCE(
  a.created_at,
  (
    SELECT MIN(m.created_at)
    FROM public.accounts_memberships m
    WHERE m.account_id = a.id
      AND m.created_at IS NOT NULL
  ),
  (
    SELECT u.created_at
    FROM auth.users u
    WHERE u.id = a.primary_owner_user_id
  ),
  a.updated_at,
  now()
)
WHERE a.created_at IS NULL;

UPDATE public.accounts a
SET updated_at = COALESCE(a.updated_at, a.created_at, now())
WHERE a.updated_at IS NULL;

ALTER TABLE public.accounts
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.accounts
  ALTER COLUMN updated_at SET DEFAULT now();

-- ─── 2. Reconcile account_billing from subscriptions ─────────────────────────
-- Insert missing rows and refresh status/trial_ends_at from the newest Stripe
-- subscription per account (covers trials that never hit account_billing).

INSERT INTO public.account_billing (
  account_id,
  subscription_status,
  trial_ends_at,
  stripe_customer_id,
  stripe_subscription_id,
  canceled_at
)
SELECT
  s.account_id,
  CASE s.status::text
    WHEN 'trialing' THEN 'trialing'::public.account_billing_status
    WHEN 'active' THEN 'active'::public.account_billing_status
    WHEN 'past_due' THEN 'past_due_grace'::public.account_billing_status
    WHEN 'unpaid' THEN 'past_due_restricted'::public.account_billing_status
    WHEN 'canceled' THEN 'canceled'::public.account_billing_status
    WHEN 'incomplete_expired' THEN 'canceled'::public.account_billing_status
    ELSE NULL
  END,
  s.trial_ends_at,
  bc.customer_id,
  s.id,
  CASE
    WHEN s.status::text IN ('canceled', 'incomplete_expired') THEN s.updated_at
    ELSE NULL
  END
FROM public.subscriptions s
JOIN public.billing_customers bc ON bc.id = s.billing_customer_id
WHERE s.billing_provider = 'stripe'
  AND s.updated_at = (
    SELECT MAX(s2.updated_at)
    FROM public.subscriptions s2
    WHERE s2.account_id = s.account_id
      AND s2.billing_provider = 'stripe'
  )
ON CONFLICT (account_id) DO UPDATE
SET
  subscription_status = COALESCE(
    EXCLUDED.subscription_status,
    public.account_billing.subscription_status
  ),
  trial_ends_at = COALESCE(
    EXCLUDED.trial_ends_at,
    public.account_billing.trial_ends_at
  ),
  stripe_customer_id = COALESCE(
    EXCLUDED.stripe_customer_id,
    public.account_billing.stripe_customer_id
  ),
  stripe_subscription_id = COALESCE(
    EXCLUDED.stripe_subscription_id,
    public.account_billing.stripe_subscription_id
  ),
  canceled_at = CASE
    WHEN EXCLUDED.subscription_status = 'canceled'::public.account_billing_status
      THEN COALESCE(public.account_billing.canceled_at, EXCLUDED.canceled_at)
    ELSE public.account_billing.canceled_at
  END,
  updated_at = now()
WHERE
  public.account_billing.subscription_status IS DISTINCT FROM EXCLUDED.subscription_status
  OR public.account_billing.trial_ends_at IS DISTINCT FROM EXCLUDED.trial_ends_at
  OR public.account_billing.stripe_subscription_id IS DISTINCT FROM EXCLUDED.stripe_subscription_id
  OR public.account_billing.stripe_customer_id IS DISTINCT FROM EXCLUDED.stripe_customer_id;

NOTIFY pgrst, 'reload schema';
