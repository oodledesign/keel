-- Per-user silenced notification tracking + muted flag on notifications.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notifications.muted IS
  'True when suppressed for the recipient due to workspace focus silencing.';

CREATE TABLE IF NOT EXISTS public.notification_user_mutes (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  notification_id bigint NOT NULL REFERENCES public.notifications (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);

COMMENT ON TABLE public.notification_user_mutes IS
  'Per-user suppression of in-app notifications during workspace focus silencing.';

CREATE INDEX IF NOT EXISTS idx_notification_user_mutes_user_id
  ON public.notification_user_mutes (user_id);

ALTER TABLE public.notification_user_mutes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.notification_user_mutes TO authenticated;
GRANT ALL ON public.notification_user_mutes TO service_role;

DROP POLICY IF EXISTS notification_user_mutes_self_all
  ON public.notification_user_mutes;

CREATE POLICY notification_user_mutes_self_all
  ON public.notification_user_mutes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update muted alongside dismissed.
CREATE OR REPLACE FUNCTION kit.update_notification_dismissed_status()
RETURNS trigger
SET search_path TO ''
LANGUAGE plpgsql AS $$
BEGIN
  IF new.dismissed IS DISTINCT FROM old.dismissed THEN
    old.dismissed := new.dismissed;
  END IF;

  IF new.muted IS DISTINCT FROM old.muted THEN
    old.muted := new.muted;
  END IF;

  IF new IS DISTINCT FROM old THEN
    RAISE EXCEPTION 'UPDATE of columns other than "dismissed" or "muted" is forbidden';
  END IF;

  RETURN old;
END;
$$;

NOTIFY pgrst, 'reload schema';
