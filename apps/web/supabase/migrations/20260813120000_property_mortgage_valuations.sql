-- Mortgage fields on properties + month-by-month valuation history.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS mortgage_lender text,
  ADD COLUMN IF NOT EXISTS mortgage_balance bigint,
  ADD COLUMN IF NOT EXISTS mortgage_interest_rate numeric(6, 3),
  ADD COLUMN IF NOT EXISTS mortgage_monthly_payment bigint,
  ADD COLUMN IF NOT EXISTS mortgage_start_date date,
  ADD COLUMN IF NOT EXISTS mortgage_end_date date,
  ADD COLUMN IF NOT EXISTS mortgage_notes text;

COMMENT ON COLUMN public.properties.mortgage_balance IS
  'Outstanding mortgage balance in the smallest currency unit (pence/cents).';
COMMENT ON COLUMN public.properties.mortgage_interest_rate IS
  'Interest rate as a percentage, e.g. 4.250 for 4.25%.';
COMMENT ON COLUMN public.properties.mortgage_monthly_payment IS
  'Monthly mortgage payment in the smallest currency unit (pence/cents).';

CREATE TABLE IF NOT EXISTS public.property_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  valued_month date NOT NULL,
  value_amount bigint NOT NULL CHECK (value_amount >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_valuations_valued_month_first_of_month
    CHECK (valued_month = date_trunc('month', valued_month)::date),
  CONSTRAINT property_valuations_property_month_unique
    UNIQUE (property_id, valued_month)
);

CREATE INDEX IF NOT EXISTS ix_property_valuations_property_id
  ON public.property_valuations(property_id, valued_month DESC);

CREATE INDEX IF NOT EXISTS ix_property_valuations_account_id
  ON public.property_valuations(account_id);

COMMENT ON TABLE public.property_valuations IS
  'Monthly estimated property values for tracking appreciation over time.';
COMMENT ON COLUMN public.property_valuations.valued_month IS
  'First day of the month the valuation applies to.';
COMMENT ON COLUMN public.property_valuations.value_amount IS
  'Estimated value in the smallest currency unit (pence/cents).';

DROP TRIGGER IF EXISTS property_valuations_set_updated_at ON public.property_valuations;
CREATE TRIGGER property_valuations_set_updated_at
  BEFORE UPDATE ON public.property_valuations
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.property_valuations FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_valuations
  TO authenticated, service_role;

DROP POLICY IF EXISTS property_valuations_select ON public.property_valuations;
CREATE POLICY property_valuations_select ON public.property_valuations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = property_valuations.account_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_valuations_insert ON public.property_valuations;
CREATE POLICY property_valuations_insert ON public.property_valuations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = property_valuations.account_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_valuations_update ON public.property_valuations;
CREATE POLICY property_valuations_update ON public.property_valuations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = property_valuations.account_id
        AND am.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = property_valuations.account_id
        AND am.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS property_valuations_delete ON public.property_valuations;
CREATE POLICY property_valuations_delete ON public.property_valuations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = property_valuations.account_id
        AND am.user_id = auth.uid()
    )
  );

-- Seed history from existing current_value (one row per property).
INSERT INTO public.property_valuations (
  property_id,
  account_id,
  valued_month,
  value_amount
)
SELECT
  p.id,
  p.account_id,
  date_trunc(
    'month',
    COALESCE(p.purchase_date, (p.updated_at AT TIME ZONE 'UTC')::date, CURRENT_DATE)
  )::date,
  p.current_value
FROM public.properties p
WHERE p.current_value IS NOT NULL
ON CONFLICT (property_id, valued_month) DO NOTHING;

NOTIFY pgrst, 'reload schema';
