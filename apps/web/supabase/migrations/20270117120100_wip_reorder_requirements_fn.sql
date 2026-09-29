-- Atomic manual reorder for WIP requirements: one statement, so a failure can
-- never leave a stage half-renumbered. Runs as the caller, so RLS still
-- decides which rows they may change. Only board_position is written;
-- updated_at is left alone because reordering is not an edit.
CREATE OR REPLACE FUNCTION public.reorder_wip_requirements (
  p_account_id uuid,
  p_ids uuid[]
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  UPDATE public.commercial_requirements AS r
  SET board_position = o.pos::integer
  FROM unnest(p_ids) WITH ORDINALITY AS o (id, pos)
  WHERE r.id = o.id
    AND r.account_id = p_account_id;
$$;

REVOKE ALL ON FUNCTION public.reorder_wip_requirements (uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_wip_requirements (uuid, uuid[]) TO authenticated;

-- Internal backup for the position sync; nobody needs API access to it.
REVOKE ALL ON public.wip_position_backup_20270117 FROM anon, authenticated;
