-- Instagram Automation v2: funnel analytics per automation. Counts runs
-- triggered/completed, steps sent, taps and collected answers since a date,
-- excluding "Send to me" test runs, plus counts retained from erased contacts.
-- SECURITY INVOKER so RLS limits results to the caller's accounts.

CREATE OR REPLACE FUNCTION public.ig_automation_funnel(
  p_account_id uuid,
  p_since timestamptz
)
RETURNS TABLE (
  trigger_id uuid,
  metric text,
  step_position integer,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH test_runs AS (
    SELECT r.id
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id AND r.source = 'test'
  ),
  live AS (
    SELECT r.trigger_id, 'triggered'::text AS metric, -1 AS step_position
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id
      AND r.source <> 'test'
      AND r.created_at >= p_since

    UNION ALL
    SELECT r.trigger_id, 'completed', -1
    FROM public.ig_automation_runs r
    WHERE r.account_id = p_account_id
      AND r.source <> 'test'
      AND r.status = 'completed'
      AND r.created_at >= p_since

    UNION ALL
    SELECT e.trigger_id,
      CASE
        WHEN e.direction = 'outbound' THEN 'sent'
        WHEN e.step_type = 'collect_data' THEN 'collected'
        ELSE 'tapped'
      END,
      coalesce(e.step_position, -1)
    FROM public.ig_message_events e
    WHERE e.account_id = p_account_id
      AND e.created_at >= p_since
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
      AND (e.run_id IS NULL OR e.run_id NOT IN (SELECT id FROM test_runs))
  )
  SELECT l.trigger_id, l.metric, l.step_position, count(*)::bigint
  FROM live l
  GROUP BY l.trigger_id, l.metric, l.step_position

  UNION ALL
  SELECT s.trigger_id, s.metric, s.step_position, sum(s.count)::bigint
  FROM public.ig_automation_stats_erased s
  WHERE s.account_id = p_account_id
    AND s.day >= (p_since AT TIME ZONE 'UTC')::date
  GROUP BY s.trigger_id, s.metric, s.step_position;
$$;

REVOKE ALL ON FUNCTION public.ig_automation_funnel(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ig_automation_funnel(uuid, timestamptz)
  TO authenticated, service_role;
