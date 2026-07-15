-- Super-admin platform finances: editable AI model rates + monthly operating costs.

CREATE TABLE IF NOT EXISTS public.ai_model_cost_rates (
  model text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('anthropic', 'google', 'other')),
  input_usd_per_mtok numeric(12, 6) NOT NULL CHECK (input_usd_per_mtok >= 0),
  output_usd_per_mtok numeric(12, 6) NOT NULL CHECK (output_usd_per_mtok >= 0),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_model_cost_rates IS
  'USD list rates per million tokens for estimating AI COGS from ai_credit_transactions.';

CREATE TABLE IF NOT EXISTS public.platform_operating_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (
    category IN (
      'vercel',
      'supabase',
      'domain',
      'email',
      'monitoring',
      'ai_provider',
      'other'
    )
  ),
  label text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  period_month date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_operating_costs_period_month_first_day CHECK (
    period_month = date_trunc('month', period_month::timestamptz)::date
  )
);

CREATE INDEX IF NOT EXISTS ix_platform_operating_costs_period
  ON public.platform_operating_costs (period_month DESC, category);

COMMENT ON TABLE public.platform_operating_costs IS
  'Manual monthly infra / SaaS invoices (Vercel, Supabase, email, etc.) for operator unit economics.';

DROP TRIGGER IF EXISTS platform_operating_costs_set_timestamps
  ON public.platform_operating_costs;
CREATE TRIGGER platform_operating_costs_set_timestamps
  BEFORE UPDATE ON public.platform_operating_costs
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.ai_model_cost_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_operating_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_model_cost_rates_select ON public.ai_model_cost_rates;
CREATE POLICY ai_model_cost_rates_select ON public.ai_model_cost_rates
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS ai_model_cost_rates_write ON public.ai_model_cost_rates;
CREATE POLICY ai_model_cost_rates_write ON public.ai_model_cost_rates
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS platform_operating_costs_select ON public.platform_operating_costs;
CREATE POLICY platform_operating_costs_select ON public.platform_operating_costs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS platform_operating_costs_write ON public.platform_operating_costs;
CREATE POLICY platform_operating_costs_write ON public.platform_operating_costs
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON public.ai_model_cost_rates FROM authenticated, service_role;
REVOKE ALL ON public.platform_operating_costs FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_cost_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_operating_costs TO authenticated;
GRANT ALL ON public.ai_model_cost_rates TO service_role;
GRANT ALL ON public.platform_operating_costs TO service_role;

-- Seed list rates for models used by the Ozer AI router (edit in admin as invoices change).
INSERT INTO public.ai_model_cost_rates (
  model,
  provider,
  input_usd_per_mtok,
  output_usd_per_mtok,
  notes
)
VALUES
  (
    'claude-haiku-4-5-20251001',
    'anthropic',
    1.000000,
    5.000000,
    'Anthropic Haiku list rate (USD / MTok) — verify against current invoice'
  ),
  (
    'claude-sonnet-4-6',
    'anthropic',
    3.000000,
    15.000000,
    'Anthropic Sonnet list rate (USD / MTok) — verify against current invoice'
  ),
  (
    'gemini-3.1-flash-lite',
    'google',
    0.100000,
    0.400000,
    'Approximate Gemini Flash-Lite list rate — verify against Google AI billing'
  )
ON CONFLICT (model) DO NOTHING;

NOTIFY pgrst, 'reload schema';
