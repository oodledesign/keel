-- Performance indexes for tasks, projects, and pipeline_deals
-- Applied 2026-06-15

-- Tasks: core query patterns
CREATE INDEX IF NOT EXISTS ix_tasks_user_id ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS ix_tasks_status ON public.tasks (status);
CREATE INDEX IF NOT EXISTS ix_tasks_area_id ON public.tasks (area_id);
CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS ix_tasks_due_date ON public.tasks (due_date);

-- Tasks: composite index for the most common query pattern (my active tasks)
CREATE INDEX IF NOT EXISTS ix_tasks_user_status ON public.tasks (user_id, status);

-- Tasks: composite for planner / day view (user's tasks by due date)
CREATE INDEX IF NOT EXISTS ix_tasks_user_due_date ON public.tasks (user_id, due_date);

-- Projects: missing indexes
CREATE INDEX IF NOT EXISTS ix_projects_client_org_id ON public.projects (client_org_id);
CREATE INDEX IF NOT EXISTS ix_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS ix_projects_area_id ON public.projects (area_id);

-- Projects: composite for workspace project lists
CREATE INDEX IF NOT EXISTS ix_projects_business_status ON public.projects (business_id, status);

-- Pipeline deals: missing client_org link
CREATE INDEX IF NOT EXISTS ix_pipeline_deals_client_org_id ON public.pipeline_deals (client_org_id);
