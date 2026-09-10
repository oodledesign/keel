-- Workspace-scoped customisable delivery project statuses.
-- Replaces the fixed projects_delivery_status_check enum with a per-account list.

CREATE TABLE IF NOT EXISTS public.project_statuses (
  id uuid UNIQUE NOT NULL DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#41606F',
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  category text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (account_id, slug),
  CONSTRAINT project_statuses_slug_format
    CHECK (slug ~ '^[a-z][a-z0-9_]{0,47}$'),
  CONSTRAINT project_statuses_label_len
    CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  CONSTRAINT project_statuses_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT project_statuses_category_check
    CHECK (category IN ('open', 'completed', 'cancelled'))
);

COMMENT ON TABLE public.project_statuses IS
  'Workspace-defined delivery project statuses (label, colour, order). projects.status stores the slug.';

COMMENT ON COLUMN public.project_statuses.slug IS
  'Stable key stored on public.projects.status for this workspace.';

COMMENT ON COLUMN public.project_statuses.category IS
  'open = active pipeline; completed / cancelled are closed tabs.';

COMMENT ON COLUMN public.project_statuses.is_default IS
  'Default status assigned to new delivery projects in this workspace.';

CREATE INDEX IF NOT EXISTS ix_project_statuses_account_id
  ON public.project_statuses (account_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_statuses_account_default
  ON public.project_statuses (account_id)
  WHERE is_default;

DROP TRIGGER IF EXISTS project_statuses_set_timestamps ON public.project_statuses;
CREATE TRIGGER project_statuses_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_statuses FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_statuses TO authenticated;
GRANT ALL ON TABLE public.project_statuses TO service_role;

DROP POLICY IF EXISTS project_statuses_select ON public.project_statuses;
CREATE POLICY project_statuses_select
  ON public.project_statuses
  FOR SELECT
  TO authenticated
  USING (
    account_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS project_statuses_insert ON public.project_statuses;
CREATE POLICY project_statuses_insert
  ON public.project_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = (SELECT auth.uid())
    OR public.is_account_admin(account_id)
  );

DROP POLICY IF EXISTS project_statuses_update ON public.project_statuses;
CREATE POLICY project_statuses_update
  ON public.project_statuses
  FOR UPDATE
  TO authenticated
  USING (
    account_id = (SELECT auth.uid())
    OR public.is_account_admin(account_id)
  )
  WITH CHECK (
    account_id = (SELECT auth.uid())
    OR public.is_account_admin(account_id)
  );

DROP POLICY IF EXISTS project_statuses_delete ON public.project_statuses;
CREATE POLICY project_statuses_delete
  ON public.project_statuses
  FOR DELETE
  TO authenticated
  USING (
    account_id = (SELECT auth.uid())
    OR public.is_account_admin(account_id)
  );

-- Existing delivery projects used a hard-coded five-value check.
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_delivery_status_check;

CREATE OR REPLACE FUNCTION public._seed_default_project_statuses(
  target_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF target_account_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounts WHERE id = target_account_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.project_statuses (
    account_id,
    slug,
    label,
    color,
    sort_order,
    is_default,
    category
  )
  VALUES
    (target_account_id, 'pending', 'Pending', '#41606F', 0, true, 'open'),
    (target_account_id, 'in_progress', 'In progress', '#FF5C34', 1, false, 'open'),
    (target_account_id, 'on_hold', 'On hold', '#F0C14B', 2, false, 'open'),
    (target_account_id, 'completed', 'Completed', '#059669', 3, false, 'completed'),
    (target_account_id, 'cancelled', 'Cancelled', '#B7A4AC', 4, false, 'cancelled')
  ON CONFLICT (account_id, slug) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_statuses
    WHERE account_id = target_account_id
      AND is_default
  ) THEN
    UPDATE public.project_statuses
    SET is_default = true
    WHERE id = (
      SELECT id
      FROM public.project_statuses
      WHERE account_id = target_account_id
      ORDER BY sort_order, created_at
      LIMIT 1
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_project_statuses(
  target_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM target_account_id
     AND NOT public.has_role_on_account(target_account_id)
     AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public._seed_default_project_statuses(target_account_id);
END;
$$;

REVOKE ALL ON FUNCTION public._seed_default_project_statuses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._seed_default_project_statuses(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.seed_default_project_statuses(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_project_statuses(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_accounts_seed_project_statuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public._seed_default_project_statuses(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_seed_project_statuses ON public.accounts;
CREATE TRIGGER accounts_seed_project_statuses
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_accounts_seed_project_statuses();

CREATE OR REPLACE FUNCTION public.enforce_delivery_project_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_slug text;
BEGIN
  IF NEW.project_type IS DISTINCT FROM 'delivery' THEN
    RETURN NEW;
  END IF;

  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_statuses
    WHERE account_id = NEW.account_id
  ) THEN
    PERFORM public._seed_default_project_statuses(NEW.account_id);
  END IF;

  IF NEW.status IS NULL OR btrim(NEW.status) = '' THEN
    SELECT slug
    INTO default_slug
    FROM public.project_statuses
    WHERE account_id = NEW.account_id
      AND is_default
    ORDER BY sort_order
    LIMIT 1;

    IF default_slug IS NULL THEN
      SELECT slug
      INTO default_slug
      FROM public.project_statuses
      WHERE account_id = NEW.account_id
      ORDER BY sort_order
      LIMIT 1;
    END IF;

    NEW.status := coalesce(default_slug, 'pending');
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.project_statuses
    WHERE account_id = NEW.account_id
      AND slug = NEW.status
  ) THEN
    RAISE EXCEPTION 'Unknown project status "%" for this workspace', NEW.status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_enforce_delivery_status ON public.projects;
CREATE TRIGGER projects_enforce_delivery_status
  BEFORE INSERT OR UPDATE OF status, account_id, project_type
  ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_delivery_project_status();

CREATE OR REPLACE FUNCTION public.reorder_workspace_project_statuses(
  target_account_id uuid,
  ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF target_account_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_account_admin(target_account_id)
  THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  IF coalesce(array_length(ordered_ids, 1), 0) = 0
     OR (
       SELECT count(*)
       FROM public.project_statuses
       WHERE account_id = target_account_id
     ) IS DISTINCT FROM array_length(ordered_ids, 1)
     OR EXISTS (
       SELECT 1
       FROM unnest(ordered_ids) AS requested(id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.project_statuses
         WHERE project_statuses.id = requested.id
           AND project_statuses.account_id = target_account_id
       )
     )
  THEN
    RAISE EXCEPTION 'Status list is out of date. Refresh and try again.';
  END IF;

  UPDATE public.project_statuses AS statuses
  SET sort_order = ordered.ord::integer - 1
  FROM unnest(ordered_ids) WITH ORDINALITY AS ordered(id, ord)
  WHERE statuses.id = ordered.id
    AND statuses.account_id = target_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_workspace_project_status(
  target_account_id uuid,
  target_status_id uuid,
  remap_to_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_slug text;
  target_is_default boolean;
  remaining_count integer;
  in_use_count integer;
  remap_slug text;
  next_default_id uuid;
BEGIN
  IF target_account_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_account_admin(target_account_id)
  THEN
    RAISE EXCEPTION 'Access denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT slug, is_default
  INTO target_slug, target_is_default
  FROM public.project_statuses
  WHERE id = target_status_id
    AND account_id = target_account_id
  FOR UPDATE;

  IF target_slug IS NULL THEN
    RAISE EXCEPTION 'Status not found';
  END IF;

  SELECT count(*)
  INTO remaining_count
  FROM public.project_statuses
  WHERE account_id = target_account_id;

  IF remaining_count <= 1 THEN
    RAISE EXCEPTION 'Keep at least one project status';
  END IF;

  SELECT count(*)
  INTO in_use_count
  FROM public.projects
  WHERE account_id = target_account_id
    AND project_type = 'delivery'
    AND status = target_slug;

  IF in_use_count > 0 THEN
    IF remap_to_id IS NULL THEN
      RAISE EXCEPTION '% project(s) use this status. Choose a status to move them to.',
        in_use_count;
    END IF;

    IF remap_to_id = target_status_id THEN
      RAISE EXCEPTION 'Choose a different status to move projects to';
    END IF;

    SELECT slug
    INTO remap_slug
    FROM public.project_statuses
    WHERE id = remap_to_id
      AND account_id = target_account_id
    FOR UPDATE;

    IF remap_slug IS NULL THEN
      RAISE EXCEPTION 'Replacement status not found';
    END IF;

    UPDATE public.projects
    SET status = remap_slug
    WHERE account_id = target_account_id
      AND project_type = 'delivery'
      AND status = target_slug;
  END IF;

  IF target_is_default THEN
    SELECT id
    INTO next_default_id
    FROM public.project_statuses
    WHERE account_id = target_account_id
      AND id IS DISTINCT FROM target_status_id
    ORDER BY CASE WHEN category = 'open' THEN 0 ELSE 1 END, sort_order, created_at
    LIMIT 1;

    IF next_default_id IS NOT NULL THEN
      UPDATE public.project_statuses
      SET is_default = true
      WHERE id = next_default_id
        AND account_id = target_account_id;
    END IF;
  END IF;

  DELETE FROM public.project_statuses
  WHERE id = target_status_id
    AND account_id = target_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_workspace_project_statuses(uuid, uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_workspace_project_statuses(uuid, uuid[])
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.delete_workspace_project_status(uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workspace_project_status(uuid, uuid, uuid)
  TO authenticated, service_role;

-- Existing team + personal workspaces get the current five statuses.
INSERT INTO public.project_statuses (
  account_id,
  slug,
  label,
  color,
  sort_order,
  is_default,
  category
)
SELECT
  a.id,
  seed.slug,
  seed.label,
  seed.color,
  seed.sort_order,
  seed.is_default,
  seed.category
FROM public.accounts a
CROSS JOIN (
  VALUES
    ('pending', 'Pending', '#41606F', 0, true, 'open'),
    ('in_progress', 'In progress', '#FF5C34', 1, false, 'open'),
    ('on_hold', 'On hold', '#F0C14B', 2, false, 'open'),
    ('completed', 'Completed', '#059669', 3, false, 'completed'),
    ('cancelled', 'Cancelled', '#B7A4AC', 4, false, 'cancelled')
) AS seed(slug, label, color, sort_order, is_default, category)
ON CONFLICT (account_id, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
