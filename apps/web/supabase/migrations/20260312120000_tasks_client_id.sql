-- Link tasks to clients so tasks can be associated with a client and shown on client detail.
-- Tasks remain user-scoped (user_id); client_id is optional.
-- Only runs if public.tasks exists (e.g. local may not have tasks table).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS ix_tasks_client_id ON public.tasks(client_id);
    COMMENT ON COLUMN public.tasks.client_id IS 'Optional link to client; tasks for this client show on client detail.';
  END IF;
END $$;
