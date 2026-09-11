-- Account members can remove individual form submissions / RSVPs.
GRANT DELETE ON public.workspace_form_submissions TO authenticated;

DROP POLICY IF EXISTS workspace_form_submissions_delete
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_delete
  ON public.workspace_form_submissions
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));
