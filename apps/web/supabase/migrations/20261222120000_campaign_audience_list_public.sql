-- Public audience lists + per-contact opt-outs for the subscriber preference page.

ALTER TABLE public.campaign_audience_lists
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaign_audience_lists.is_public IS
  'When true, the list appears on the public subscriber preference page so contacts can opt in or out.';

CREATE INDEX IF NOT EXISTS ix_campaign_audience_lists_public
  ON public.campaign_audience_lists (account_id, created_at DESC)
  WHERE is_public;

CREATE TABLE IF NOT EXISTS public.campaign_audience_list_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.campaign_audience_lists (id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_audience_list_opt_outs_email_len
    CHECK (char_length(email) BETWEEN 3 AND 320),
  CONSTRAINT campaign_audience_list_opt_outs_unique UNIQUE (list_id, email)
);

COMMENT ON TABLE public.campaign_audience_list_opt_outs IS
  'Public-token opt-outs for a campaign audience list. Excludes the address at send time.';

CREATE INDEX IF NOT EXISTS ix_campaign_audience_list_opt_outs_account_email
  ON public.campaign_audience_list_opt_outs (account_id, email);

CREATE INDEX IF NOT EXISTS ix_campaign_audience_list_opt_outs_list
  ON public.campaign_audience_list_opt_outs (list_id);

ALTER TABLE public.campaign_audience_list_opt_outs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_audience_list_opt_outs
  FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_audience_list_opt_outs
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_audience_list_opt_outs_select
  ON public.campaign_audience_list_opt_outs;
CREATE POLICY campaign_audience_list_opt_outs_select
  ON public.campaign_audience_list_opt_outs
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_opt_outs_insert
  ON public.campaign_audience_list_opt_outs;
CREATE POLICY campaign_audience_list_opt_outs_insert
  ON public.campaign_audience_list_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_opt_outs_update
  ON public.campaign_audience_list_opt_outs;
CREATE POLICY campaign_audience_list_opt_outs_update
  ON public.campaign_audience_list_opt_outs
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_opt_outs_delete
  ON public.campaign_audience_list_opt_outs;
CREATE POLICY campaign_audience_list_opt_outs_delete
  ON public.campaign_audience_list_opt_outs
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_opt_outs_service_role
  ON public.campaign_audience_list_opt_outs;
CREATE POLICY campaign_audience_list_opt_outs_service_role
  ON public.campaign_audience_list_opt_outs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
