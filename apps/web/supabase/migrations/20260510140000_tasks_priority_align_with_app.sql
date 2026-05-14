-- Align public.tasks.priority CHECK with the app (low | medium | high | urgent).
-- Fixes inserts that fail with: violates check constraint "tasks_priority_check"
-- when the DB still used legacy values (e.g. "normal" instead of "medium").

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
  ) THEN
    ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

    UPDATE public.tasks
    SET priority = CASE
      WHEN priority IS NULL THEN 'medium'
      WHEN lower(trim(priority::text)) = 'normal' THEN 'medium'
      WHEN lower(trim(priority::text)) = 'default' THEN 'medium'
      WHEN lower(trim(priority::text)) IN ('low', 'medium', 'high', 'urgent')
        THEN lower(trim(priority::text))
      ELSE 'medium'
    END;

    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;
