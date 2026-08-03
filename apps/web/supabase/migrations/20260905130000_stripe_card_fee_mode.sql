-- Workspace choice: who covers Stripe card processing fees on invoice Checkout.
-- pass_to_client: add estimated fee as Checkout line item; retain as application_fee
-- absorb_in_payout: client pays invoice only; application_fee reduces connected transfer

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS stripe_card_fee_mode text NOT NULL DEFAULT 'absorb_in_payout';

ALTER TABLE public.account_payment_settings
  DROP CONSTRAINT IF EXISTS account_payment_settings_stripe_card_fee_mode_check;

ALTER TABLE public.account_payment_settings
  ADD CONSTRAINT account_payment_settings_stripe_card_fee_mode_check
  CHECK (stripe_card_fee_mode IN ('pass_to_client', 'absorb_in_payout'));

COMMENT ON COLUMN public.account_payment_settings.stripe_card_fee_mode IS
  'How Stripe card fees are handled on invoice Checkout: pass_to_client adds fee at checkout; absorb_in_payout deducts from connected account transfer via application_fee_amount.';
