-- Repair: owner/admin/staff have clients.edit but not clients.view in role_permissions.
-- SELECT policies that only checked clients.view hid all meeting transcripts for those roles.

DROP POLICY IF EXISTS meeting_transcripts_select ON public.meeting_transcripts;
CREATE POLICY meeting_transcripts_select ON public.meeting_transcripts FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

DROP POLICY IF EXISTS meeting_summaries_select ON public.meeting_summaries;
CREATE POLICY meeting_summaries_select ON public.meeting_summaries FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
);

NOTIFY pgrst, 'reload schema';
