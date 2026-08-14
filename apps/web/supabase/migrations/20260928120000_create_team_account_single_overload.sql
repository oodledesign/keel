-- Fix PostgREST PGRST203 / HTTP 300 when calling create_team_account with
-- five named params: both the 5-arg and 6-arg (defaulted) overloads match.
-- Keep a single 6-arg function; drop thinner overloads.

DROP FUNCTION IF EXISTS public.create_team_account(text, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.create_team_account(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.create_team_account(text, uuid, text);

-- Ensure the canonical 6-arg function is granted (body already from prior migrations).
REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text, text, boolean)
  FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text, text, boolean)
  TO service_role;

NOTIFY pgrst, 'reload schema';
