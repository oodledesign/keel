-- Newest update date per instruction, for the collapsed WIP ladder row.
-- Runs as the caller, so RLS on notes still applies.
CREATE OR REPLACE FUNCTION public.latest_wip_update_by_deal (p_account_id uuid)
RETURNS TABLE (pipeline_deal_id uuid, latest_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT n.pipeline_deal_id, max(n.created_at) AS latest_at
  FROM public.notes AS n
  WHERE n.account_id = p_account_id
    AND n.pipeline_deal_id IS NOT NULL
  GROUP BY n.pipeline_deal_id;
$$;

REVOKE ALL ON FUNCTION public.latest_wip_update_by_deal (uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.latest_wip_update_by_deal (uuid) TO authenticated;
