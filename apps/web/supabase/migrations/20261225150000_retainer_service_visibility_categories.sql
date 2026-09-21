-- Visibility switches + workspace-level service categories.
-- Additive only. Existing services stay visible and uncategorized.

-- ---------------------------------------------------------------------------
-- 1) retainer_service_categories — workspace-scoped grouping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retainer_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retainer_service_categories_name_len CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 80
  )
);

COMMENT ON TABLE public.retainer_service_categories IS
  'Workspace-level groups for retainer services (e.g. Web, Support, Calls).';

CREATE INDEX IF NOT EXISTS ix_retainer_service_categories_account
  ON public.retainer_service_categories (account_id, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS uq_retainer_service_categories_account_name
  ON public.retainer_service_categories (account_id, lower(btrim(name)));

DROP TRIGGER IF EXISTS retainer_service_categories_set_timestamps
  ON public.retainer_service_categories;
CREATE TRIGGER retainer_service_categories_set_timestamps
BEFORE INSERT OR UPDATE ON public.retainer_service_categories
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.retainer_service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retainer_service_categories_select
  ON public.retainer_service_categories;
CREATE POLICY retainer_service_categories_select
  ON public.retainer_service_categories
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_service_categories_insert
  ON public.retainer_service_categories;
CREATE POLICY retainer_service_categories_insert
  ON public.retainer_service_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_service_categories_update
  ON public.retainer_service_categories;
CREATE POLICY retainer_service_categories_update
  ON public.retainer_service_categories
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  )
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_service_categories_delete
  ON public.retainer_service_categories;
CREATE POLICY retainer_service_categories_delete
  ON public.retainer_service_categories
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retainer_service_categories TO authenticated;
GRANT ALL ON public.retainer_service_categories TO service_role;

-- ---------------------------------------------------------------------------
-- 2) retainer_services — category + visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.retainer_services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.retainer_service_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

UPDATE public.retainer_services
SET is_visible = true
WHERE is_visible IS NULL;

COMMENT ON COLUMN public.retainer_services.category_id IS
  'Optional workspace category. Null = Uncategorized. Delete category leaves services uncategorized.';
COMMENT ON COLUMN public.retainer_services.is_visible IS
  'Client-facing visibility. Hidden services stay on agency lists and can still be burned manually.';

CREATE INDEX IF NOT EXISTS ix_retainer_services_category
  ON public.retainer_services (category_id)
  WHERE category_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) client / project override visibility
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_retainer_services
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

ALTER TABLE public.project_retainer_services
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

UPDATE public.client_retainer_services
SET is_visible = true
WHERE is_visible IS NULL;

UPDATE public.project_retainer_services
SET is_visible = true
WHERE is_visible IS NULL;

COMMENT ON COLUMN public.client_retainer_services.is_visible IS
  'Client-layer visibility override. Used only when clients.retainer_services_source = custom.';
COMMENT ON COLUMN public.project_retainer_services.is_visible IS
  'Project-layer visibility override. Used only when project_retainers.services_source = custom.';
