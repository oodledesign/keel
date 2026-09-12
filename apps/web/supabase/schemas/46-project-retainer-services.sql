-- Project retainer services: workspace catalogue, project credit balance,
-- match suggestions from inbound email, and a 24h undo ledger.
-- Additive / IF NOT EXISTS only. Ledger mutations are service_role RPCs.

-- ---------------------------------------------------------------------------
-- 1) retainer_services — workspace catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retainer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  credit_cost integer NOT NULL DEFAULT 1,
  default_status text,
  default_assignee_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  default_duration_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retainer_services_credit_cost_pos CHECK (credit_cost >= 1),
  CONSTRAINT retainer_services_duration_pos CHECK (
    default_duration_minutes IS NULL
    OR default_duration_minutes >= 1
  )
);

COMMENT ON TABLE public.retainer_services IS
  'Workspace retainer service catalogue. Match hints live in description. Never auto-created.';
COMMENT ON COLUMN public.retainer_services.description IS
  'Human description plus AI match hints.';
COMMENT ON COLUMN public.retainer_services.is_active IS
  'False = archived. Archived services stay on historical burns.';

CREATE INDEX IF NOT EXISTS ix_retainer_services_account_active
  ON public.retainer_services (account_id, is_active, sort_order);

DROP TRIGGER IF EXISTS retainer_services_set_timestamps ON public.retainer_services;
CREATE TRIGGER retainer_services_set_timestamps
BEFORE INSERT OR UPDATE ON public.retainer_services
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.retainer_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retainer_services_select ON public.retainer_services;
CREATE POLICY retainer_services_select ON public.retainer_services
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_services_insert ON public.retainer_services;
CREATE POLICY retainer_services_insert ON public.retainer_services
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_services_update ON public.retainer_services;
CREATE POLICY retainer_services_update ON public.retainer_services
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  )
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_services_delete ON public.retainer_services;
CREATE POLICY retainer_services_delete ON public.retainer_services
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retainer_services TO authenticated;
GRANT ALL ON public.retainer_services TO service_role;

-- ---------------------------------------------------------------------------
-- 2) project_retainers — balance + switches on the project (not the client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_retainers (
  project_id uuid PRIMARY KEY REFERENCES public.projects (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  credit_balance integer NOT NULL DEFAULT 0,
  auto_match_enabled boolean NOT NULL DEFAULT false,
  weekly_digest_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_retainers_balance_nonneg CHECK (credit_balance >= 0)
);

COMMENT ON TABLE public.project_retainers IS
  'Retainer credit balance and matching switches for a project. Auto-match and weekly digest default off.';

CREATE INDEX IF NOT EXISTS ix_project_retainers_account_id
  ON public.project_retainers (account_id);

CREATE INDEX IF NOT EXISTS ix_project_retainers_digest
  ON public.project_retainers (account_id)
  WHERE weekly_digest_enabled = true;

DROP TRIGGER IF EXISTS project_retainers_set_timestamps ON public.project_retainers;
CREATE TRIGGER project_retainers_set_timestamps
BEFORE INSERT OR UPDATE ON public.project_retainers
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.project_retainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_retainers_select ON public.project_retainers;
CREATE POLICY project_retainers_select ON public.project_retainers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND p.account_id = account_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS project_retainers_insert ON public.project_retainers;
CREATE POLICY project_retainers_insert ON public.project_retainers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND p.account_id = account_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS project_retainers_update ON public.project_retainers;
CREATE POLICY project_retainers_update ON public.project_retainers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND p.account_id = account_id
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
      WHERE p.id = project_id
        AND p.account_id = account_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.project_retainers TO authenticated;
GRANT ALL ON public.project_retainers TO service_role;

-- ---------------------------------------------------------------------------
-- 3) project_retainer_services — optional allowlist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_retainer_services (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.retainer_services (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, service_id)
);

COMMENT ON TABLE public.project_retainer_services IS
  'Optional project allowlist. Empty means step-1 matching uses previously burned services only.';

CREATE INDEX IF NOT EXISTS ix_project_retainer_services_service
  ON public.project_retainer_services (service_id);

ALTER TABLE public.project_retainer_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_retainer_services_select ON public.project_retainer_services;
CREATE POLICY project_retainer_services_select ON public.project_retainer_services
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

DROP POLICY IF EXISTS project_retainer_services_insert ON public.project_retainer_services;
CREATE POLICY project_retainer_services_insert ON public.project_retainer_services
  FOR INSERT TO authenticated
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

DROP POLICY IF EXISTS project_retainer_services_delete ON public.project_retainer_services;
CREATE POLICY project_retainer_services_delete ON public.project_retainer_services
  FOR DELETE TO authenticated
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
  );

GRANT SELECT, INSERT, DELETE ON public.project_retainer_services TO authenticated;
GRANT ALL ON public.project_retainer_services TO service_role;

-- ---------------------------------------------------------------------------
-- 4) project_retainer_transactions — immutable ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_retainer_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  suggestion_id uuid,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_retainer_transactions_type_check CHECK (
    type IN ('grant', 'burn', 'undo', 'adjust', 'debit')
  )
);

COMMENT ON TABLE public.project_retainer_transactions IS
  'Immutable project retainer ledger. Burns are negative; grant/undo/adjust restore or set.';

CREATE INDEX IF NOT EXISTS ix_project_retainer_tx_project_created
  ON public.project_retainer_transactions (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_project_retainer_tx_account_created
  ON public.project_retainer_transactions (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_project_retainer_tx_task
  ON public.project_retainer_transactions (task_id)
  WHERE task_id IS NOT NULL;

ALTER TABLE public.project_retainer_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_retainer_transactions_select
  ON public.project_retainer_transactions;
CREATE POLICY project_retainer_transactions_select
  ON public.project_retainer_transactions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

REVOKE ALL ON public.project_retainer_transactions FROM authenticated, service_role;
GRANT SELECT ON public.project_retainer_transactions TO authenticated;
GRANT ALL ON public.project_retainer_transactions TO service_role;

-- ---------------------------------------------------------------------------
-- 5) retainer_match_suggestions — email review cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retainer_match_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  email_thread_id uuid REFERENCES public.email_threads (id) ON DELETE SET NULL,
  email_action_item_id uuid REFERENCES public.email_action_items (id) ON DELETE SET NULL,
  match_kind text NOT NULL,
  service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL,
  proposed_name text,
  proposed_description text,
  proposed_credit_cost integer,
  confidence numeric,
  rationale text,
  credit_cost integer,
  status text NOT NULL DEFAULT 'pending',
  task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retainer_match_suggestions_kind_check CHECK (
    match_kind IN (
      'project_service',
      'workspace_service',
      'propose_new',
      'uncategorised'
    )
  ),
  CONSTRAINT retainer_match_suggestions_status_check CHECK (
    status IN ('pending', 'applied', 'skipped', 'auto_applied')
  )
);

COMMENT ON TABLE public.retainer_match_suggestions IS
  'Gemini Flash match suggestion for an inbound email action item. Human confirm required except auto-apply.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_retainer_match_pending_action_item
  ON public.retainer_match_suggestions (email_action_item_id)
  WHERE email_action_item_id IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS ix_retainer_match_account_pending
  ON public.retainer_match_suggestions (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_retainer_match_thread
  ON public.retainer_match_suggestions (email_thread_id)
  WHERE email_thread_id IS NOT NULL;

DROP TRIGGER IF EXISTS retainer_match_suggestions_set_timestamps
  ON public.retainer_match_suggestions;
CREATE TRIGGER retainer_match_suggestions_set_timestamps
BEFORE INSERT OR UPDATE ON public.retainer_match_suggestions
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.retainer_match_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retainer_match_suggestions_select
  ON public.retainer_match_suggestions;
CREATE POLICY retainer_match_suggestions_select
  ON public.retainer_match_suggestions
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

DROP POLICY IF EXISTS retainer_match_suggestions_insert
  ON public.retainer_match_suggestions;

DROP POLICY IF EXISTS retainer_match_suggestions_update
  ON public.retainer_match_suggestions;
CREATE POLICY retainer_match_suggestions_update
  ON public.retainer_match_suggestions
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  )
  WITH CHECK (
    public.has_role_on_account (account_id)
    OR public.is_super_admin ()
  );

GRANT SELECT, UPDATE ON public.retainer_match_suggestions TO authenticated;
GRANT ALL ON public.retainer_match_suggestions TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_retainer_transactions_suggestion_fk'
  ) THEN
    ALTER TABLE public.project_retainer_transactions
      ADD CONSTRAINT project_retainer_transactions_suggestion_fk
      FOREIGN KEY (suggestion_id)
      REFERENCES public.retainer_match_suggestions (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6) tasks — service stamp + undo window
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS retainer_service_id uuid REFERENCES public.retainer_services (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credits_burned integer,
  ADD COLUMN IF NOT EXISTS credits_burned_at timestamptz,
  ADD COLUMN IF NOT EXISTS retainer_email_thread_id uuid REFERENCES public.email_threads (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_credits_burned_nonneg'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_credits_burned_nonneg
      CHECK (credits_burned IS NULL OR credits_burned >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_tasks_retainer_service_id
  ON public.tasks (retainer_service_id)
  WHERE retainer_service_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 7) weekly digest dedupe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_retainer_digest_log (
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  week_start date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, week_start)
);

ALTER TABLE public.project_retainer_digest_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_retainer_digest_log_select
  ON public.project_retainer_digest_log;
CREATE POLICY project_retainer_digest_log_select
  ON public.project_retainer_digest_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_id
        AND (
          public.has_role_on_account (p.account_id)
          OR public.is_super_admin ()
        )
    )
  );

GRANT SELECT ON public.project_retainer_digest_log TO authenticated;
GRANT ALL ON public.project_retainer_digest_log TO service_role;

-- ---------------------------------------------------------------------------
-- 8) RPCs — service_role only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_project_retainer(
  p_project_id uuid,
  p_account_id uuid
)
RETURNS public.project_retainers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.project_retainers;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.account_id = p_account_id
  ) THEN
    RAISE EXCEPTION 'project_account_mismatch';
  END IF;

  INSERT INTO public.project_retainers (project_id, account_id)
  VALUES (p_project_id, p_account_id)
  ON CONFLICT (project_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.project_id IS NULL THEN
    SELECT * INTO v_row
    FROM public.project_retainers
    WHERE project_id = p_project_id;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_project_retainer_credits(
  p_project_id uuid,
  p_account_id uuid,
  p_delta integer,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.project_retainers;
  v_type text;
BEGIN
  IF p_delta = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'zero_delta');
  END IF;

  PERFORM public.ensure_project_retainer(p_project_id, p_account_id);

  UPDATE public.project_retainers
  SET credit_balance = credit_balance + p_delta
  WHERE project_id = p_project_id
    AND credit_balance + p_delta >= 0
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row
    FROM public.project_retainers
    WHERE project_id = p_project_id;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'available', coalesce(v_row.credit_balance, 0),
      'requested', abs(p_delta)
    );
  END IF;

  v_type := CASE WHEN p_delta > 0 THEN 'grant' ELSE 'debit' END;

  INSERT INTO public.project_retainer_transactions (
    project_id, account_id, type, amount, actor_id, reason
  ) VALUES (
    p_project_id, p_account_id, v_type, p_delta, p_actor_id, p_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_row.credit_balance,
    'delta', p_delta
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_project_retainer_credits(
  p_project_id uuid,
  p_account_id uuid,
  p_amount integer,
  p_service_id uuid DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_suggestion_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.project_retainers;
  v_existing uuid;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  IF p_task_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.project_retainer_transactions
    WHERE task_id = p_task_id
      AND type = 'burn'
      AND NOT EXISTS (
        SELECT 1
        FROM public.project_retainer_transactions u
        WHERE u.task_id = p_task_id
          AND u.type = 'undo'
          AND u.created_at > public.project_retainer_transactions.created_at
      )
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'consumed', p_amount);
    END IF;
  END IF;

  v_row := public.ensure_project_retainer(p_project_id, p_account_id);

  IF v_row.credit_balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'available', v_row.credit_balance,
      'requested', p_amount
    );
  END IF;

  UPDATE public.project_retainers
  SET credit_balance = credit_balance - p_amount
  WHERE project_id = p_project_id
    AND credit_balance >= p_amount
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_balance',
      'available', (
        SELECT credit_balance FROM public.project_retainers WHERE project_id = p_project_id
      ),
      'requested', p_amount
    );
  END IF;

  INSERT INTO public.project_retainer_transactions (
    project_id, account_id, type, amount, service_id, task_id, suggestion_id, actor_id, reason
  ) VALUES (
    p_project_id, p_account_id, 'burn', -p_amount, p_service_id, p_task_id,
    p_suggestion_id, p_actor_id, p_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'consumed', p_amount,
    'balance', v_row.credit_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_project_retainer_credits(
  p_task_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'undo'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_burn public.project_retainer_transactions;
  v_row public.project_retainers;
  v_amount integer;
BEGIN
  SELECT *
  INTO v_burn
  FROM public.project_retainer_transactions
  WHERE task_id = p_task_id
    AND type = 'burn'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_burn.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_burn', 'refunded', 0);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.project_retainer_transactions
    WHERE task_id = p_task_id
      AND type = 'undo'
      AND created_at > v_burn.created_at
  ) THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'refunded', 0);
  END IF;

  v_amount := abs(v_burn.amount);

  UPDATE public.project_retainers
  SET credit_balance = credit_balance + v_amount
  WHERE project_id = v_burn.project_id
  RETURNING * INTO v_row;

  INSERT INTO public.project_retainer_transactions (
    project_id, account_id, type, amount, service_id, task_id, suggestion_id, actor_id, reason
  ) VALUES (
    v_burn.project_id, v_burn.account_id, 'undo', v_amount, v_burn.service_id,
    p_task_id, v_burn.suggestion_id, p_actor_id, p_reason
  );

  RETURN jsonb_build_object(
    'ok', true,
    'refunded', v_amount,
    'balance', v_row.credit_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_project_retainer(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.adjust_project_retainer_credits(uuid, uuid, integer, uuid, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.consume_project_retainer_credits(uuid, uuid, integer, uuid, uuid, uuid, uuid, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.restore_project_retainer_credits(uuid, uuid, text) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_project_retainer(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_project_retainer_credits(uuid, uuid, integer, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_project_retainer_credits(uuid, uuid, integer, uuid, uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_project_retainer_credits(uuid, uuid, text) TO service_role;
