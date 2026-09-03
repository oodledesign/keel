-- Contracts phase 3: workspace-reusable contract templates.
-- Additive only. Templates store rich-text HTML with optional {{smart field}}
-- placeholders that the app resolves when a contract is created from a
-- template (and again for any remaining tokens when draft fields change).

CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  default_title text,
  default_total_pence integer NOT NULL DEFAULT 0,
  default_payment_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_contract_templates_account_id_updated_at
  ON public.contract_templates (account_id, updated_at DESC);

DROP TRIGGER IF EXISTS contract_templates_set_timestamps ON public.contract_templates;
CREATE TRIGGER contract_templates_set_timestamps
  BEFORE INSERT OR UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_templates_select ON public.contract_templates;
DROP POLICY IF EXISTS contract_templates_insert ON public.contract_templates;
DROP POLICY IF EXISTS contract_templates_update ON public.contract_templates;
DROP POLICY IF EXISTS contract_templates_delete ON public.contract_templates;

CREATE POLICY contract_templates_select ON public.contract_templates FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions));

CREATE POLICY contract_templates_insert ON public.contract_templates FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_templates_update ON public.contract_templates FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY contract_templates_delete ON public.contract_templates FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_templates TO authenticated;

NOTIFY pgrst, 'reload schema';
