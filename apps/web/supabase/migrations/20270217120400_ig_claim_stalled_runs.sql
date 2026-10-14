-- Also claim 'active' runs with no next_step_at whose lock has expired (a
-- worker was killed mid-pass), so no run is ever stranded.

CREATE OR REPLACE FUNCTION public.claim_ig_automation_runs(
  p_limit integer DEFAULT 25,
  p_lock_seconds integer DEFAULT 120
)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.ig_automation_runs AS r
  SET locked_until = now() + make_interval(secs => p_lock_seconds)
  WHERE r.id IN (
    SELECT c.id
    FROM public.ig_automation_runs AS c
    WHERE (
        (c.status IN ('active', 'waiting_delay')
          AND c.next_step_at IS NOT NULL
          AND c.next_step_at <= now())
        OR (c.status = 'active'
          AND c.next_step_at IS NULL
          AND c.updated_at < now() - interval '2 minutes')
      )
      AND (c.locked_until IS NULL OR c.locked_until < now())
    ORDER BY coalesce(c.next_step_at, c.updated_at)
    LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id;
$$;

REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_automation_runs(integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS ig_automation_runs_due_idx
  ON public.ig_automation_runs (status, next_step_at)
  WHERE status IN ('active', 'waiting_delay');
