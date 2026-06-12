-- Saved AI planner plans, per user, scope (personal or workspace:slug), and date.
-- Powers the Today day view across devices.

CREATE TABLE IF NOT EXISTS public.planner_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  plan_date date NOT NULL,
  mode text NOT NULL DEFAULT 'day' CHECK (mode IN ('day', 'week')),
  markdown text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_plans_scope_key_check
    CHECK (scope_key ~ '^(personal|workspace:.+)$'),
  CONSTRAINT planner_plans_user_scope_date_key
    UNIQUE (user_id, scope_key, plan_date)
);

COMMENT ON TABLE public.planner_plans IS
  'AI-generated day/week plans saved from the planner. scope_key is "personal" or "workspace:<slug>".';

ALTER TABLE public.planner_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planner_plans_select ON public.planner_plans;
CREATE POLICY planner_plans_select
  ON public.planner_plans
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_plans_insert ON public.planner_plans;
CREATE POLICY planner_plans_insert
  ON public.planner_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_plans_update ON public.planner_plans;
CREATE POLICY planner_plans_update
  ON public.planner_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_plans_delete ON public.planner_plans;
CREATE POLICY planner_plans_delete
  ON public.planner_plans
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS planner_plans_set_updated_at ON public.planner_plans;
CREATE TRIGGER planner_plans_set_updated_at
  BEFORE UPDATE ON public.planner_plans
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_plans TO authenticated;
GRANT ALL ON public.planner_plans TO postgres, service_role;
