-- Planner schedule push reminders: subscriptions, user settings, and a due queue.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

COMMENT ON TABLE public.push_subscriptions IS
  'Web Push subscriptions for PWA schedule reminders (one row per browser/device).';

CREATE TABLE IF NOT EXISTS public.planner_push_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  lead_minutes integer NOT NULL DEFAULT 10
    CHECK (lead_minutes >= 0 AND lead_minutes <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.planner_push_settings IS
  'Per-user planner push reminder preferences (lead time before each block).';

CREATE TABLE IF NOT EXISTS public.planner_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  plan_date date NOT NULL,
  block_start timestamptz NOT NULL,
  block_end timestamptz NOT NULL,
  block_title text NOT NULL,
  is_break boolean NOT NULL DEFAULT false,
  notify_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planner_reminders_scope_key_check
    CHECK (scope_key ~ '^(personal|workspace:.+)$'),
  CONSTRAINT planner_reminders_user_scope_date_block_key
    UNIQUE (user_id, scope_key, plan_date, block_start)
);

CREATE INDEX IF NOT EXISTS ix_planner_reminders_due
  ON public.planner_reminders(notify_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_planner_reminders_user_plan_date
  ON public.planner_reminders(user_id, plan_date);

COMMENT ON TABLE public.planner_reminders IS
  'Queued planner block reminders. Populated when a day plan is saved; dispatched by cron.';

DROP TRIGGER IF EXISTS push_subscriptions_set_timestamps ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_timestamps
  BEFORE INSERT OR UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS planner_push_settings_set_timestamps ON public.planner_push_settings;
CREATE TRIGGER planner_push_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.planner_push_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS planner_reminders_set_timestamps ON public.planner_reminders;
CREATE TRIGGER planner_reminders_set_timestamps
  BEFORE INSERT OR UPDATE ON public.planner_reminders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_push_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_reminders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_push_settings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_reminders TO authenticated, service_role;

-- push_subscriptions
DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- planner_push_settings
DROP POLICY IF EXISTS planner_push_settings_select ON public.planner_push_settings;
CREATE POLICY planner_push_settings_select ON public.planner_push_settings
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_push_settings_insert ON public.planner_push_settings;
CREATE POLICY planner_push_settings_insert ON public.planner_push_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_push_settings_update ON public.planner_push_settings;
CREATE POLICY planner_push_settings_update ON public.planner_push_settings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_push_settings_delete ON public.planner_push_settings;
CREATE POLICY planner_push_settings_delete ON public.planner_push_settings
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- planner_reminders
DROP POLICY IF EXISTS planner_reminders_select ON public.planner_reminders;
CREATE POLICY planner_reminders_select ON public.planner_reminders
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_reminders_insert ON public.planner_reminders;
CREATE POLICY planner_reminders_insert ON public.planner_reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_reminders_update ON public.planner_reminders;
CREATE POLICY planner_reminders_update ON public.planner_reminders
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_reminders_delete ON public.planner_reminders;
CREATE POLICY planner_reminders_delete ON public.planner_reminders
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS planner_reminders_service ON public.planner_reminders;
CREATE POLICY planner_reminders_service ON public.planner_reminders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS push_subscriptions_service ON public.push_subscriptions;
CREATE POLICY push_subscriptions_service ON public.push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
