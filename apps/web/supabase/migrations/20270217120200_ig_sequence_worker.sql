-- Instagram sequence worker: per-run execution counter (send idempotency) and
-- a SKIP LOCKED claim function for the per-minute cron.

ALTER TABLE public.ig_automation_runs
  ADD COLUMN IF NOT EXISTS steps_executed integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ig_automation_runs.steps_executed IS
  'Monotonic step counter. Outbound idempotency keys are run:{id}:exec:{n}, so a step is never sent twice even when a branch revisits it.';

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
    WHERE c.status IN ('active', 'waiting_delay')
      AND c.next_step_at IS NOT NULL
      AND c.next_step_at <= now()
      AND (c.locked_until IS NULL OR c.locked_until < now())
    ORDER BY c.next_step_at
    LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.id;
$$;

REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_ig_automation_runs(integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_automation_runs(integer, integer) TO service_role;

-- Single-run lock used by webhook-triggered advances.
CREATE OR REPLACE FUNCTION public.lock_ig_automation_run(
  p_run_id uuid,
  p_lock_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH locked AS (
    UPDATE public.ig_automation_runs
    SET locked_until = now() + make_interval(secs => p_lock_seconds)
    WHERE id = p_run_id
      AND (locked_until IS NULL OR locked_until < now())
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM locked);
$$;

REVOKE ALL ON FUNCTION public.lock_ig_automation_run(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_ig_automation_run(uuid, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_ig_automation_run(uuid, integer) TO service_role;
