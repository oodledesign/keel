-- Link suggested email to-dos to the thread's workspace client/project.

ALTER TABLE public.email_action_items
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_action_items_thread_status
  ON public.email_action_items (thread_id, status)
  WHERE status = 'suggested';

COMMENT ON COLUMN public.email_action_items.account_id IS
  'Workspace account when this suggestion is linked to a client/project.';

COMMENT ON COLUMN public.email_action_items.client_id IS
  'Linked workspace client for this suggested to-do.';

COMMENT ON COLUMN public.email_action_items.project_id IS
  'Linked workspace project for this suggested to-do.';
