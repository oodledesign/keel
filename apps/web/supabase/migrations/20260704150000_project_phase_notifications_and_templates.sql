-- Prompt 6: phase due reminder dedupe log + account phase templates.

CREATE TABLE IF NOT EXISTS public.project_phase_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.project_phases (id) ON DELETE CASCADE,
  due_date date NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_phase_reminder_log_phase_due_key UNIQUE (phase_id, due_date)
);

COMMENT ON TABLE public.project_phase_reminder_log IS
  'Dedupes in-app notifications for project phases due within 48 hours.';

CREATE INDEX IF NOT EXISTS ix_project_phase_reminder_log_account_id
  ON public.project_phase_reminder_log (account_id);

ALTER TABLE public.project_phase_reminder_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.project_phase_reminder_log TO service_role;

DROP POLICY IF EXISTS project_phase_reminder_log_service ON public.project_phase_reminder_log;
CREATE POLICY project_phase_reminder_log_service ON public.project_phase_reminder_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.project_phase_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_phase_templates_name_account_key UNIQUE (account_id, name)
);

COMMENT ON TABLE public.project_phase_templates IS
  'Reusable delivery phase blueprints for seeding job project boards.';

CREATE INDEX IF NOT EXISTS ix_project_phase_templates_account_id
  ON public.project_phase_templates (account_id);

DROP TRIGGER IF EXISTS project_phase_templates_set_timestamps ON public.project_phase_templates;
CREATE TRIGGER project_phase_templates_set_timestamps
  BEFORE INSERT OR UPDATE ON public.project_phase_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.project_phase_templates ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phase_templates TO authenticated, service_role;

DROP POLICY IF EXISTS project_phase_templates_select ON public.project_phase_templates;
CREATE POLICY project_phase_templates_select ON public.project_phase_templates
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    AND NOT public.is_client_on_account (account_id)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_phase_templates_insert ON public.project_phase_templates;
CREATE POLICY project_phase_templates_insert ON public.project_phase_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_phase_templates_update ON public.project_phase_templates;
CREATE POLICY project_phase_templates_update ON public.project_phase_templates
  FOR UPDATE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  )
  WITH CHECK (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

DROP POLICY IF EXISTS project_phase_templates_delete ON public.project_phase_templates;
CREATE POLICY project_phase_templates_delete ON public.project_phase_templates
  FOR DELETE TO authenticated
  USING (
    public.has_permission (auth.uid (), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account (account_id)
  );

-- Seed the standard Discovery → Care template for every existing account.
INSERT INTO public.project_phase_templates (account_id, name, description, phases)
SELECT
  a.id,
  'Standard delivery',
  'Discovery → Design → Build → Launch → Care',
  '[
    {"name":"Discovery","colour":"#3B82F6","description":"Understand goals, constraints, and success criteria.","is_milestone":false},
    {"name":"Design","colour":"#8B5CF6","description":"UX, visual design, and technical approach.","is_milestone":false},
    {"name":"Build","colour":"#2A9D8F","description":"Implementation and content production.","is_milestone":false},
    {"name":"Launch","colour":"#F97316","description":"Go-live, QA, and handover.","is_milestone":true},
    {"name":"Care","colour":"#64748B","description":"Ongoing support and optimisation.","is_milestone":false}
  ]'::jsonb
FROM public.accounts a
ON CONFLICT (account_id, name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
