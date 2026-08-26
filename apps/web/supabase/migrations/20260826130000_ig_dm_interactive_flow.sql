-- Interactive DM flows: step config on triggers + session state for postback advances.

ALTER TABLE public.ig_triggers
  ADD COLUMN IF NOT EXISTS dm_flow jsonb;

COMMENT ON COLUMN public.ig_triggers.dm_flow IS
  'Interactive DM flow (button confirm → link). Null = use dm_mode/dm_template.';

CREATE TABLE IF NOT EXISTS public.ig_dm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES public.ig_connected_accounts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  comment_event_id uuid REFERENCES public.ig_comment_events (id) ON DELETE SET NULL,
  commenter_ig_id text NOT NULL,
  current_step_id text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ig_dm_sessions_active_lookup
  ON public.ig_dm_sessions (ig_account_id, commenter_ig_id, status)
  WHERE status = 'active';

ALTER TABLE public.ig_dm_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_dm_sessions_select ON public.ig_dm_sessions;
CREATE POLICY ig_dm_sessions_select ON public.ig_dm_sessions
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

GRANT SELECT ON public.ig_dm_sessions TO authenticated;
GRANT ALL ON public.ig_dm_sessions TO postgres, service_role;

DROP TRIGGER IF EXISTS ig_dm_sessions_set_updated_at ON public.ig_dm_sessions;
CREATE TRIGGER ig_dm_sessions_set_updated_at
  BEFORE UPDATE ON public.ig_dm_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();
