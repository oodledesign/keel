-- Personal Vision: daily practice deck stored per user + dashboard launch toggle.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS personal_vision_dashboard_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_settings.personal_vision_dashboard_enabled IS
  'When true, show a dedicated Personal Vision launch button on personal and workspace dashboards.';

CREATE TABLE IF NOT EXISTS public.personal_visions (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  finance_account_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.personal_visions IS
  'Personal Vision practice content (foundations, goals, affirmations, etc.) owned by a single user.';
COMMENT ON COLUMN public.personal_visions.content IS
  'Zod-validated JSON sections for the Vision slideshow.';
COMMENT ON COLUMN public.personal_visions.finance_account_ids IS
  'Team account IDs whose finance_transactions income feeds live wealth-goal actuals.';

CREATE OR REPLACE FUNCTION public.set_personal_visions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personal_visions_updated_at ON public.personal_visions;
CREATE TRIGGER trg_personal_visions_updated_at
  BEFORE UPDATE ON public.personal_visions
  FOR EACH ROW EXECUTE FUNCTION public.set_personal_visions_updated_at();

ALTER TABLE public.personal_visions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.personal_visions FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personal_visions TO authenticated;
GRANT ALL ON TABLE public.personal_visions TO service_role;

CREATE POLICY personal_visions_select ON public.personal_visions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY personal_visions_insert ON public.personal_visions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY personal_visions_update ON public.personal_visions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY personal_visions_delete ON public.personal_visions
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
