-- Part A Task 1: meeting task suggestions + per-account automation preferences.

CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_transcript_id uuid NOT NULL REFERENCES public.meeting_transcripts (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  suggested_title text NOT NULL,
  suggested_description text,
  suggested_assignee_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  assignee_confidence numeric(4, 3),
  suggested_due_date date,
  source_excerpt text,
  status text NOT NULL DEFAULT 'pending_review',
  planner_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT meeting_action_items_status_check CHECK (
    status IN ('pending_review', 'approved', 'rejected', 'auto_published')
  ),
  CONSTRAINT meeting_action_items_assignee_confidence_check CHECK (
    assignee_confidence IS NULL
    OR (assignee_confidence >= 0 AND assignee_confidence <= 1)
  )
);

CREATE INDEX IF NOT EXISTS ix_meeting_action_items_account_status
  ON public.meeting_action_items (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_meeting_action_items_meeting_transcript_id
  ON public.meeting_action_items (meeting_transcript_id);

CREATE INDEX IF NOT EXISTS ix_meeting_action_items_planner_task_id
  ON public.meeting_action_items (planner_task_id)
  WHERE planner_task_id IS NOT NULL;

COMMENT ON TABLE public.meeting_action_items IS
  'AI-extracted candidate tasks from meeting transcripts awaiting review or publish.';

COMMENT ON COLUMN public.meeting_action_items.source_excerpt IS
  'Transcript snippet supporting this suggestion for the moderation UI.';

COMMENT ON COLUMN public.meeting_action_items.planner_task_id IS
  'Planner task created when this suggestion is approved or auto-published.';

CREATE TABLE IF NOT EXISTS public.account_task_automation_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  meeting_tasks_mode text NOT NULL DEFAULT 'requires_moderation',
  email_tasks_mode text NOT NULL DEFAULT 'requires_moderation',
  auto_schedule_on_calendar boolean NOT NULL DEFAULT true,
  calendar_lead_time_minutes integer NOT NULL DEFAULT 30,
  working_hours_start time NOT NULL DEFAULT '09:00',
  working_hours_end time NOT NULL DEFAULT '18:00',
  exclude_personal_calendar_busy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_task_automation_settings_meeting_tasks_mode_check CHECK (
    meeting_tasks_mode IN ('auto_publish', 'requires_moderation')
  ),
  CONSTRAINT account_task_automation_settings_email_tasks_mode_check CHECK (
    email_tasks_mode IN ('auto_publish', 'requires_moderation')
  ),
  CONSTRAINT account_task_automation_settings_lead_time_check CHECK (
    calendar_lead_time_minutes >= 0
  ),
  CONSTRAINT account_task_automation_settings_working_hours_check CHECK (
    working_hours_end > working_hours_start
  )
);

COMMENT ON TABLE public.account_task_automation_settings IS
  'Per-workspace preferences for AI task suggestions, auto-publish, and calendar slotting.';

COMMENT ON COLUMN public.account_task_automation_settings.exclude_personal_calendar_busy IS
  'When false, personal calendar events count as busy when finding free slots.';

DROP TRIGGER IF EXISTS account_task_automation_settings_set_timestamps
  ON public.account_task_automation_settings;

CREATE TRIGGER account_task_automation_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.account_task_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_task_automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_action_items_select ON public.meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_insert ON public.meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_update ON public.meeting_action_items;
DROP POLICY IF EXISTS meeting_action_items_delete ON public.meeting_action_items;

CREATE POLICY meeting_action_items_select ON public.meeting_action_items FOR SELECT TO authenticated
USING (
  public.has_role_on_account (account_id)
  AND NOT public.is_client_on_account (account_id)
);

CREATE POLICY meeting_action_items_insert ON public.meeting_action_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_role_on_account (account_id)
  AND NOT public.is_client_on_account (account_id)
);

CREATE POLICY meeting_action_items_update ON public.meeting_action_items FOR UPDATE TO authenticated
USING (
  public.has_role_on_account (account_id)
  AND NOT public.is_client_on_account (account_id)
)
WITH CHECK (
  public.has_role_on_account (account_id)
  AND NOT public.is_client_on_account (account_id)
);

CREATE POLICY meeting_action_items_delete ON public.meeting_action_items FOR DELETE TO authenticated
USING (
  public.has_role_on_account (account_id)
  AND NOT public.is_client_on_account (account_id)
);

DROP POLICY IF EXISTS account_task_automation_settings_select ON public.account_task_automation_settings;
DROP POLICY IF EXISTS account_task_automation_settings_insert ON public.account_task_automation_settings;
DROP POLICY IF EXISTS account_task_automation_settings_update ON public.account_task_automation_settings;
DROP POLICY IF EXISTS account_task_automation_settings_delete ON public.account_task_automation_settings;

CREATE POLICY account_task_automation_settings_select ON public.account_task_automation_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

CREATE POLICY account_task_automation_settings_insert ON public.account_task_automation_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account (account_id));

CREATE POLICY account_task_automation_settings_update ON public.account_task_automation_settings
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account (account_id))
  WITH CHECK (public.has_role_on_account (account_id));

CREATE POLICY account_task_automation_settings_delete ON public.account_task_automation_settings
  FOR DELETE TO authenticated
  USING (public.has_role_on_account (account_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_action_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_task_automation_settings TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
