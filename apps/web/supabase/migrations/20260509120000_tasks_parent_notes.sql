-- Subtasks (parent_task_id) and optional notes (e.g. AI / transcript context).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tasks'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks (id) ON DELETE CASCADE;

  ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS notes text;

  CREATE INDEX IF NOT EXISTS ix_tasks_parent_task_id ON public.tasks (parent_task_id)
    WHERE parent_task_id IS NOT NULL;
END $$;

NOTIFY pgrst, 'reload schema';
