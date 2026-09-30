/*
 * Ladder rows show "<date> <latest update text>" for every instruction.
 * Extends latest_wip_update_by_deal to also return the newest note's text
 * (capped, so the payload stays small). Return type changes, so drop first.
 */
DROP FUNCTION IF EXISTS public.latest_wip_update_by_deal (uuid);

CREATE FUNCTION public.latest_wip_update_by_deal (p_account_id uuid)
RETURNS TABLE (
  pipeline_deal_id uuid,
  latest_at timestamptz,
  latest_content text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT ON (n.pipeline_deal_id)
    n.pipeline_deal_id,
    n.created_at AS latest_at,
    left(coalesce(n.content, ''), 400) AS latest_content
  FROM public.notes AS n
  WHERE n.account_id = p_account_id
    AND n.pipeline_deal_id IS NOT NULL
  ORDER BY n.pipeline_deal_id, n.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.latest_wip_update_by_deal (uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.latest_wip_update_by_deal (uuid) TO authenticated;
