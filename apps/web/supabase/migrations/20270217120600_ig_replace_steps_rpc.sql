-- Replace an automation's steps in one transaction (the builder saves the
-- whole sequence). SECURITY INVOKER: RLS on ig_automation_steps still
-- requires settings.manage on the account.

CREATE OR REPLACE FUNCTION public.replace_ig_automation_steps(
  p_trigger_id uuid,
  p_steps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'p_steps must be a JSON array';
  END IF;

  SELECT t.account_id INTO v_account_id
  FROM public.ig_triggers AS t
  WHERE t.id = p_trigger_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Automation not found';
  END IF;

  DELETE FROM public.ig_automation_steps WHERE trigger_id = p_trigger_id;

  INSERT INTO public.ig_automation_steps
    (account_id, trigger_id, position, step_type, config, asset_id)
  SELECT
    v_account_id,
    p_trigger_id,
    (s.ord - 1)::integer,
    s.value ->> 'step_type',
    coalesce(s.value -> 'config', '{}'::jsonb),
    nullif(s.value ->> 'asset_id', '')::uuid
  FROM jsonb_array_elements(p_steps) WITH ORDINALITY AS s(value, ord);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_ig_automation_steps(uuid, jsonb) TO authenticated, service_role;
