-- Visits & Meetings: job_events and job_event_assignments.
-- Naming follows repo: account_id (org scope), UUID PKs, ix_ indexes, trigger_set_timestamps.

-- 1) job_events (visits/meetings linked to a job)
CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  event_type text NOT NULL,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NULL,
  location text NULL,
  prep_notes text NULL,
  outcome_notes text NULL,
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_events_event_type_check CHECK (event_type IN ('site_visit', 'meeting'))
);

COMMENT ON TABLE public.job_events IS 'Visits and meetings linked to a job; org-scoped by account_id.';
CREATE INDEX IF NOT EXISTS ix_job_events_account_id_job_id_start ON public.job_events(account_id, job_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS ix_job_events_account_id_start ON public.job_events(account_id, scheduled_start_at);

DROP TRIGGER IF EXISTS job_events_set_timestamps ON public.job_events;
CREATE TRIGGER job_events_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_events
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 2) job_event_assignments (team members assigned to an event)
CREATE TABLE IF NOT EXISTS public.job_event_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_event_id uuid NOT NULL REFERENCES public.job_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_on_event text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_event_id, user_id)
);

COMMENT ON TABLE public.job_event_assignments IS 'Assigns users to job events (visits/meetings).';
CREATE INDEX IF NOT EXISTS ix_job_event_assignments_account_id_event ON public.job_event_assignments(account_id, job_event_id);
CREATE INDEX IF NOT EXISTS ix_job_event_assignments_account_id_user ON public.job_event_assignments(account_id, user_id);

DROP TRIGGER IF EXISTS job_event_assignments_set_timestamps ON public.job_event_assignments;
CREATE TRIGGER job_event_assignments_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_event_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();
