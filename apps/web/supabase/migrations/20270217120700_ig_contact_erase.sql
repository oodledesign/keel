-- Instagram Automation v2: per-contact erasure (UK GDPR) that keeps funnel
-- counts. Erasing a contact rolls their run/event counts into
-- ig_automation_stats_erased (no personal data), scrubs their legacy comment
-- log rows, then deletes the contact (runs and events cascade).

CREATE TABLE IF NOT EXISTS public.ig_automation_stats_erased (
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.ig_triggers (id) ON DELETE CASCADE,
  day date NOT NULL,
  metric text NOT NULL CHECK (
    metric IN ('triggered', 'completed', 'sent', 'tapped', 'collected')
  ),
  step_position integer NOT NULL DEFAULT -1,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (trigger_id, day, metric, step_position)
);

COMMENT ON TABLE public.ig_automation_stats_erased IS
  'Funnel counts retained after an Instagram contact is erased. Holds no personal data. step_position -1 = not step-specific.';

CREATE INDEX IF NOT EXISTS ix_ig_automation_stats_erased_account
  ON public.ig_automation_stats_erased (account_id, day);

ALTER TABLE public.ig_automation_stats_erased ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ig_automation_stats_erased_select ON public.ig_automation_stats_erased;
CREATE POLICY ig_automation_stats_erased_select ON public.ig_automation_stats_erased
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

REVOKE ALL ON public.ig_automation_stats_erased FROM anon, authenticated;
GRANT SELECT ON public.ig_automation_stats_erased TO authenticated;
GRANT ALL ON public.ig_automation_stats_erased TO service_role;

CREATE OR REPLACE FUNCTION public.erase_ig_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_contact public.ig_contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_contact FROM public.ig_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_permission(
    auth.uid(),
    v_contact.account_id,
    'settings.manage'::public.app_permissions
  ) THEN
    RAISE EXCEPTION 'You do not have permission to erase this contact';
  END IF;

  INSERT INTO public.ig_automation_stats_erased AS s (
    account_id, trigger_id, day, metric, step_position, count
  )
  SELECT account_id, trigger_id, day, metric, step_position, count(*)::integer
  FROM (
    SELECT r.account_id, r.trigger_id,
      (r.created_at AT TIME ZONE 'UTC')::date AS day,
      'triggered'::text AS metric, -1 AS step_position
    FROM public.ig_automation_runs r
    WHERE r.contact_id = p_contact_id AND r.source <> 'test'

    UNION ALL
    SELECT r.account_id, r.trigger_id,
      (r.created_at AT TIME ZONE 'UTC')::date, 'completed', -1
    FROM public.ig_automation_runs r
    WHERE r.contact_id = p_contact_id
      AND r.source <> 'test'
      AND r.status = 'completed'

    UNION ALL
    SELECT e.account_id, e.trigger_id,
      (e.created_at AT TIME ZONE 'UTC')::date,
      CASE
        WHEN e.direction = 'outbound' THEN 'sent'
        WHEN e.step_type = 'collect_data' THEN 'collected'
        ELSE 'tapped'
      END,
      coalesce(e.step_position, -1)
    FROM public.ig_message_events e
    WHERE e.contact_id = p_contact_id
      AND e.trigger_id IS NOT NULL
      AND (
        (
          e.direction = 'outbound'
          AND e.event_type IN ('step', 'private_reply')
          AND e.send_status = 'sent'
        )
        OR (
          e.direction = 'inbound'
          AND e.step_type IN ('quick_replies', 'buttons', 'collect_data')
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ig_automation_runs r
        WHERE r.id = e.run_id AND r.source = 'test'
      )
  ) rows
  GROUP BY account_id, trigger_id, day, metric, step_position
  ON CONFLICT (trigger_id, day, metric, step_position)
  DO UPDATE SET count = s.count + EXCLUDED.count;

  UPDATE public.ig_comment_events
  SET commenter_username = NULL,
      commenter_ig_id = NULL,
      comment_text = NULL,
      public_reply_content = NULL,
      dm_content = NULL
  WHERE ig_account_id = v_contact.ig_account_id
    AND commenter_ig_id = v_contact.igsid;

  DELETE FROM public.ig_contacts WHERE id = p_contact_id;
END;
$$;

REVOKE ALL ON FUNCTION public.erase_ig_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erase_ig_contact(uuid) TO authenticated;
