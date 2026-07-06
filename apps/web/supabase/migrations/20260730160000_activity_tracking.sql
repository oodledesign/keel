-- Mac activity tracker: blocks, categorisation rules, and per-user privacy settings.
-- RLS Pattern E (self read/write + permission-gated team read on activity_blocks).

-- ---------------------------------------------------------------------------
-- 1) Extend app_permissions with activity.view_team (not granted to roles by default)
-- Procedure + COMMIT so the new enum label can be used in policies below.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE public._migration_add_activity_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permissions'
      AND e.enumlabel = 'activity.view_team'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'activity.view_team';
  END IF;
  COMMIT;
END;
$$;

CALL public._migration_add_activity_permissions_enum();
DROP PROCEDURE public._migration_add_activity_permissions_enum();

-- ---------------------------------------------------------------------------
-- 2) activity_blocks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  app_name text NOT NULL,
  bundle_id text NOT NULL DEFAULT '',
  domain text,
  url text,
  window_title text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  confidence_score numeric,
  is_confirmed boolean NOT NULL DEFAULT false,
  is_excluded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_blocks_time_range_check CHECK (ended_at >= started_at)
);

COMMENT ON TABLE public.activity_blocks IS
  'Desktop activity intervals captured by the Mac activity tracker; optionally linked to projects/clients.';

COMMENT ON COLUMN public.activity_blocks.confidence_score IS
  'AI categorisation confidence (0–1); null until Haiku pass or rule match.';

CREATE INDEX IF NOT EXISTS ix_activity_blocks_account_user_started
  ON public.activity_blocks (account_id, user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ix_activity_blocks_user_started
  ON public.activity_blocks (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ix_activity_blocks_project_id
  ON public.activity_blocks (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_activity_blocks_client_id
  ON public.activity_blocks (client_id)
  WHERE client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) activity_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  match_type text NOT NULL,
  match_value text NOT NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  created_from text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_rules_match_type_check CHECK (
    match_type IN ('domain', 'app_name', 'title_contains')
  ),
  CONSTRAINT activity_rules_created_from_check CHECK (
    created_from IN ('manual', 'learned')
  ),
  CONSTRAINT activity_rules_match_value_nonempty_check CHECK (
    btrim(match_value) <> ''
  )
);

COMMENT ON TABLE public.activity_rules IS
  'User-defined or learned rules mapping app/domain/title patterns to projects and clients.';

CREATE INDEX IF NOT EXISTS ix_activity_rules_account_user
  ON public.activity_rules (account_id, user_id);

CREATE INDEX IF NOT EXISTS ix_activity_rules_account_user_match_type
  ON public.activity_rules (account_id, user_id, match_type);

-- ---------------------------------------------------------------------------
-- 4) activity_privacy_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_privacy_settings (
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  excluded_apps text[] NOT NULL DEFAULT '{}',
  excluded_domains text[] NOT NULL DEFAULT '{}',
  tracking_enabled boolean NOT NULL DEFAULT false,
  capture_full_urls boolean NOT NULL DEFAULT false,
  idle_threshold_seconds integer NOT NULL DEFAULT 120 CHECK (idle_threshold_seconds > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

COMMENT ON TABLE public.activity_privacy_settings IS
  'Per-user activity tracking privacy preferences within a workspace (opt-in tracking).';

COMMENT ON COLUMN public.activity_privacy_settings.tracking_enabled IS
  'Opt-in: tracking is off until explicitly enabled.';

COMMENT ON COLUMN public.activity_privacy_settings.capture_full_urls IS
  'When false, only domain is stored on activity_blocks; full URLs require explicit opt-in.';

CREATE INDEX IF NOT EXISTS ix_activity_privacy_settings_user
  ON public.activity_privacy_settings (user_id);

DROP TRIGGER IF EXISTS activity_privacy_settings_set_timestamps
  ON public.activity_privacy_settings;

CREATE TRIGGER activity_privacy_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.activity_privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- 5) apply_activity_block_rule() — auto-categorise on insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_activity_block_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  matched_rule record;
BEGIN
  IF NEW.is_confirmed = true THEN
    RETURN NEW;
  END IF;

  SELECT
    r.project_id,
    r.client_id
  INTO matched_rule
  FROM public.activity_rules r
  WHERE r.account_id = NEW.account_id
    AND r.user_id = NEW.user_id
    AND (
      (
        r.match_type = 'domain'
        AND NEW.domain IS NOT NULL
        AND (
          lower(NEW.domain) = lower(r.match_value)
          OR lower(NEW.domain) LIKE ('%.' || lower(r.match_value))
        )
      )
      OR (
        r.match_type = 'app_name'
        AND lower(NEW.app_name) = lower(r.match_value)
      )
      OR (
        r.match_type = 'title_contains'
        AND NEW.window_title IS NOT NULL
        AND NEW.window_title ILIKE ('%' || r.match_value || '%')
      )
    )
  ORDER BY
    CASE r.created_from WHEN 'manual' THEN 0 ELSE 1 END,
    r.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF matched_rule.project_id IS NOT NULL THEN
    NEW.project_id := matched_rule.project_id;
  END IF;

  IF matched_rule.client_id IS NOT NULL THEN
    NEW.client_id := matched_rule.client_id;
  END IF;

  IF matched_rule.project_id IS NOT NULL OR matched_rule.client_id IS NOT NULL THEN
    NEW.is_confirmed := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_blocks_apply_rule ON public.activity_blocks;

CREATE TRIGGER activity_blocks_apply_rule
  BEFORE INSERT ON public.activity_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_activity_block_rule();

-- ---------------------------------------------------------------------------
-- 6) RLS — Pattern E (self) + permission-gated team read on activity_blocks
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_privacy_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.activity_blocks FROM authenticated, service_role;
REVOKE ALL ON public.activity_rules FROM authenticated, service_role;
REVOKE ALL ON public.activity_privacy_settings FROM authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_privacy_settings TO authenticated;

GRANT ALL ON public.activity_blocks TO service_role;
GRANT ALL ON public.activity_rules TO service_role;
GRANT ALL ON public.activity_privacy_settings TO service_role;

-- activity_blocks: owner full access
DROP POLICY IF EXISTS activity_blocks_self_all ON public.activity_blocks;
CREATE POLICY activity_blocks_self_all
  ON public.activity_blocks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- activity_blocks: team visibility (requires activity.view_team — not default-on)
DROP POLICY IF EXISTS activity_blocks_team_select ON public.activity_blocks;
CREATE POLICY activity_blocks_team_select
  ON public.activity_blocks
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission (
      auth.uid(),
      account_id,
      'activity.view_team'::public.app_permissions
    )
  );

-- activity_rules: owner only
DROP POLICY IF EXISTS activity_rules_self_all ON public.activity_rules;
CREATE POLICY activity_rules_self_all
  ON public.activity_rules
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- activity_privacy_settings: owner only
DROP POLICY IF EXISTS activity_privacy_settings_self_all ON public.activity_privacy_settings;
CREATE POLICY activity_privacy_settings_self_all
  ON public.activity_privacy_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
