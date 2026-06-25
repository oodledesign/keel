-- Backfill tasks.account_id from project/client links and stamp Oodle workspace scope.

-- 1) From delivery/campaign projects (account_id on projects)
UPDATE public.tasks AS t
SET account_id = p.account_id
FROM public.projects AS p
WHERE t.project_id = p.id
  AND p.account_id IS NOT NULL
  AND t.account_id IS DISTINCT FROM p.account_id;

-- 2) Legacy projects.business_id → businesses.account_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'business_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'account_id'
  ) THEN
    UPDATE public.tasks AS t
    SET account_id = b.account_id
    FROM public.projects AS p
    JOIN public.businesses AS b ON b.id = p.business_id
    WHERE t.project_id = p.id
      AND p.account_id IS NULL
      AND b.account_id IS NOT NULL
      AND t.account_id IS DISTINCT FROM b.account_id;
  END IF;
END $$;

-- 3) From CRM clients on the task row
UPDATE public.tasks AS t
SET account_id = c.account_id
FROM public.clients AS c
WHERE t.client_id = c.id
  AND c.account_id IS NOT NULL
  AND t.account_id IS DISTINCT FROM c.account_id;

-- 4) From the project's primary client when the task has no direct client link
UPDATE public.tasks AS t
SET account_id = c.account_id
FROM public.projects AS p
JOIN public.clients AS c ON c.id = p.client_id
WHERE t.project_id = p.id
  AND t.client_id IS NULL
  AND c.account_id IS NOT NULL
  AND t.account_id IS DISTINCT FROM c.account_id;

-- 5) Legacy jobs table (skip when already unified into projects)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
  ) THEN
    UPDATE public.tasks AS t
    SET account_id = j.account_id
    FROM public.jobs AS j
    WHERE t.project_id = j.id
      AND j.account_id IS NOT NULL
      AND t.account_id IS DISTINCT FROM j.account_id;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'job_id'
    ) THEN
      UPDATE public.tasks AS t
      SET account_id = j.account_id
      FROM public.jobs AS j
      WHERE t.job_id = j.id
        AND j.account_id IS NOT NULL
        AND t.account_id IS DISTINCT FROM j.account_id;
    END IF;
  END IF;
END $$;

-- 6) Orphan tasks for dan@oodle.design → explicit Oodle workspace (slug oodle)
UPDATE public.tasks AS t
SET account_id = a.id
FROM auth.users AS u
CROSS JOIN public.accounts AS a
WHERE u.email = 'dan@oodle.design'
  AND t.user_id = u.id
  AND a.slug = 'oodle'
  AND COALESCE(a.is_personal_account, false) = false
  AND t.account_id IS NULL;

NOTIFY pgrst, 'reload schema';
