-- Workspace → client → project retainer service personalization.
-- Additive on top of 46-project-retainer-services.sql.
-- Keep in sync with migration 20261225120000_retainer_service_personalization.sql.

-- ---------------------------------------------------------------------------
-- 1) retainer_services — scope + optional request-type / origin
-- ---------------------------------------------------------------------------
ALTER TABLE public.retainer_services
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retainer_services_scope_check'
  ) THEN
    ALTER TABLE public.retainer_services
      ADD CONSTRAINT retainer_services_scope_check
      CHECK (scope IN ('workspace', 'client', 'project'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'retainer_services_scope_shape'
  ) THEN
    ALTER TABLE public.retainer_services
      ADD CONSTRAINT retainer_services_scope_shape
      CHECK (
        (scope = 'workspace' AND client_id IS NULL AND project_id IS NULL)
        OR (scope = 'client' AND client_id IS NOT NULL AND project_id IS NULL)
        OR (scope = 'project' AND project_id IS NOT NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.retainer_services.scope IS
  'workspace = default catalogue; client/project = custom rows that do not appear in the workspace library.';
COMMENT ON COLUMN public.retainer_services.request_type_id IS
  'Optional portal request-type link for matching / “what can I request?”.';
COMMENT ON COLUMN public.retainer_services.source_service_id IS
  'Workspace library row this custom service was copied from, if any.';

CREATE INDEX IF NOT EXISTS ix_retainer_services_account_scope
  ON public.retainer_services (account_id, scope, is_active, sort_order);

CREATE INDEX IF NOT EXISTS ix_retainer_services_client
  ON public.retainer_services (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_retainer_services_project
  ON public.retainer_services (project_id)
  WHERE project_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) client customization flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS retainer_services_source text NOT NULL DEFAULT 'inherited';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_retainer_services_source_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_retainer_services_source_check
      CHECK (retainer_services_source IN ('inherited', 'custom'));
  END IF;
END $$;

COMMENT ON COLUMN public.clients.retainer_services_source IS
  'inherited = use workspace library; custom = client_retainer_services is the seed list for new projects.';

-- ---------------------------------------------------------------------------
-- 3) project customization flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_retainers
  ADD COLUMN IF NOT EXISTS services_source text NOT NULL DEFAULT 'inherited';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_retainers_services_source_check'
  ) THEN
    ALTER TABLE public.project_retainers
      ADD CONSTRAINT project_retainers_services_source_check
      CHECK (services_source IN ('inherited', 'custom'));
  END IF;
END $$;

COMMENT ON COLUMN public.project_retainers.services_source IS
  'inherited = resolve via client seed then workspace library; custom = project_retainer_services wins.';

-- ---------------------------------------------------------------------------
-- 4) client_retainer_services — client seed / custom list
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_retainer_services (
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.retainer_services (id) ON DELETE CASCADE,
  name text,
  description text,
  credit_cost integer,
  request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, service_id),
  CONSTRAINT client_retainer_services_credit_cost_pos CHECK (
    credit_cost IS NULL OR credit_cost >= 1
  )
);

COMMENT ON TABLE public.client_retainer_services IS
  'Client retainer service list. Present only when clients.retainer_services_source = custom. Seeds new projects.';

CREATE INDEX IF NOT EXISTS ix_client_retainer_services_service
  ON public.client_retainer_services (service_id);

DROP TRIGGER IF EXISTS client_retainer_services_set_timestamps
  ON public.client_retainer_services;
CREATE TRIGGER client_retainer_services_set_timestamps
BEFORE INSERT OR UPDATE ON public.client_retainer_services
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.client_retainer_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_retainer_services_select
  ON public.client_retainer_services;
CREATE POLICY client_retainer_services_select
  ON public.client_retainer_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND (
          public.has_role_on_account (c.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS client_retainer_services_insert
  ON public.client_retainer_services;
CREATE POLICY client_retainer_services_insert
  ON public.client_retainer_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.retainer_services rs ON rs.id = service_id
      WHERE c.id = client_id
        AND rs.account_id = c.account_id
        AND (
          rs.scope = 'workspace'
          OR (rs.scope = 'client' AND rs.client_id = c.id)
        )
        AND (
          public.has_role_on_account (c.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS client_retainer_services_update
  ON public.client_retainer_services;
CREATE POLICY client_retainer_services_update
  ON public.client_retainer_services
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND (
          public.has_role_on_account (c.account_id)
          OR public.is_super_admin ()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.retainer_services rs ON rs.id = service_id
      WHERE c.id = client_id
        AND rs.account_id = c.account_id
        AND (
          rs.scope = 'workspace'
          OR (rs.scope = 'client' AND rs.client_id = c.id)
        )
        AND (
          public.has_role_on_account (c.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS client_retainer_services_delete
  ON public.client_retainer_services;
CREATE POLICY client_retainer_services_delete
  ON public.client_retainer_services
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = client_id
        AND (
          public.has_role_on_account (c.account_id)
          OR public.is_super_admin ()
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_retainer_services TO authenticated;
GRANT ALL ON public.client_retainer_services TO service_role;

-- ---------------------------------------------------------------------------
-- 5) project_retainer_services — override columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_retainer_services
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS credit_cost integer,
  ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.request_types (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_retainer_services_credit_cost_pos'
  ) THEN
    ALTER TABLE public.project_retainer_services
      ADD CONSTRAINT project_retainer_services_credit_cost_pos
      CHECK (credit_cost IS NULL OR credit_cost >= 1);
  END IF;
END $$;

COMMENT ON TABLE public.project_retainer_services IS
  'Project service override list when project_retainers.services_source = custom. Empty + inherited means resolve via client then workspace.';

DROP TRIGGER IF EXISTS project_retainer_services_set_timestamps
  ON public.project_retainer_services;
CREATE TRIGGER project_retainer_services_set_timestamps
BEFORE INSERT OR UPDATE ON public.project_retainer_services
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP POLICY IF EXISTS project_retainer_services_update
  ON public.project_retainer_services;
CREATE POLICY project_retainer_services_update
  ON public.project_retainer_services
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.retainer_services rs ON rs.id = service_id
      WHERE p.id = project_id
        AND rs.account_id = p.account_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.retainer_services rs ON rs.id = service_id
      WHERE p.id = project_id
        AND rs.account_id = p.account_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

GRANT UPDATE ON public.project_retainer_services TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) support_tickets — optional retainer service stamp (portal picker)
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS retainer_service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.support_tickets.retainer_service_id IS
  'Effective retainer service chosen in the portal request wizard, when not a support request_type.';

CREATE INDEX IF NOT EXISTS ix_support_tickets_retainer_service_id
  ON public.support_tickets (retainer_service_id)
  WHERE retainer_service_id IS NOT NULL;
