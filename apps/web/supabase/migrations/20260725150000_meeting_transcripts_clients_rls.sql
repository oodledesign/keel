-- Meeting transcripts belong to the clients module, not invoicing.
-- SELECT: clients.view OR clients.edit (owner/admin/staff only have clients.edit in role_permissions).

DROP POLICY IF EXISTS meeting_transcripts_select ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_select ON public.meeting_transcripts FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

DROP POLICY IF EXISTS meeting_transcripts_insert ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_insert ON public.meeting_transcripts FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

DROP POLICY IF EXISTS meeting_transcripts_update ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_update ON public.meeting_transcripts FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

DROP POLICY IF EXISTS meeting_transcripts_delete ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_delete ON public.meeting_transcripts FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

DROP POLICY IF EXISTS meeting_summaries_select ON public.meeting_summaries;
CREATE POLICY meeting_summaries_select ON public.meeting_summaries FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

DROP POLICY IF EXISTS meeting_summaries_insert ON public.meeting_summaries;
CREATE POLICY meeting_summaries_insert ON public.meeting_summaries FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

DROP POLICY IF EXISTS meeting_summaries_update ON public.meeting_summaries;
CREATE POLICY meeting_summaries_update ON public.meeting_summaries FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

DROP POLICY IF EXISTS meeting_summaries_delete ON public.meeting_summaries;
CREATE POLICY meeting_summaries_delete ON public.meeting_summaries FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions));

NOTIFY pgrst, 'reload schema';
