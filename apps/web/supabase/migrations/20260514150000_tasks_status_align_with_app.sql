-- Align public.tasks.status CHECK with the app: support a "Client review" stage
-- alongside the existing todo / in_progress / done / cancelled values used by
-- `uiStatusToDb` and the Kanban board.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

    UPDATE public.tasks
    SET status = CASE
      WHEN status IS NULL THEN 'todo'
      WHEN lower(trim(status::text)) IN (
        'todo', 'in_progress', 'client_review', 'done', 'cancelled'
      ) THEN lower(trim(status::text))
      WHEN lower(trim(status::text)) IN ('pending', 'not_started', 'open') THEN 'todo'
      WHEN lower(trim(status::text)) IN ('completed', 'complete') THEN 'done'
      WHEN lower(trim(status::text)) IN ('review', 'in_review', 'awaiting_client') THEN 'client_review'
      ELSE 'todo'
    END;

    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'client_review', 'done', 'cancelled'));
  END IF;
END $$;
