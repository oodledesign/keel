-- Jobs V1: jobs, job_assignments, job_notes. No RLS (add in a later migration).
-- Naming follows repo: account_id (org scope), UUID PKs, ix_ indexes, trigger_set_timestamps.

-- 1) jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL,
  priority text NOT NULL,
  start_date date,
  due_date date,
  estimated_minutes integer,
  actual_minutes integer,
  value_pence integer,
  cost_pence integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT jobs_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

COMMENT ON TABLE public.jobs IS 'Jobs V1: operational core; org-scoped by account_id. RLS to be added later.';
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_status ON public.jobs(account_id, status);
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_due_date ON public.jobs(account_id, due_date);
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_client_id ON public.jobs(account_id, client_id);

DROP TRIGGER IF EXISTS jobs_set_timestamps ON public.jobs;
CREATE TRIGGER jobs_set_timestamps
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 2) job_assignments
CREATE TABLE IF NOT EXISTS public.job_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_on_job text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (job_id, user_id)
);

COMMENT ON TABLE public.job_assignments IS 'Assigns users to jobs (e.g. Lead, Support). RLS to be added later.';
CREATE INDEX IF NOT EXISTS ix_job_assignments_account_id_user_id ON public.job_assignments(account_id, user_id);
CREATE INDEX IF NOT EXISTS ix_job_assignments_account_id_job_id ON public.job_assignments(account_id, job_id);

DROP TRIGGER IF EXISTS job_assignments_set_timestamps ON public.job_assignments;
CREATE TRIGGER job_assignments_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 3) job_notes
CREATE TABLE IF NOT EXISTS public.job_notes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.job_notes IS 'Internal notes on jobs. RLS to be added later.';
CREATE INDEX IF NOT EXISTS ix_job_notes_account_id_job_id ON public.job_notes(account_id, job_id);

DROP TRIGGER IF EXISTS job_notes_set_timestamps ON public.job_notes;
CREATE TRIGGER job_notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();
