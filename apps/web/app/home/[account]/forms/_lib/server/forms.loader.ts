import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createWorkspaceFormsService } from './workspace-forms.service';

export async function loadWorkspaceFormsPage(accountId: string) {
  const client = getSupabaseServerClient();
  const service = createWorkspaceFormsService(client);
  const forms = await service.listForms(accountId);
  return { forms };
}

export async function loadWorkspaceFormDetail(
  accountId: string,
  formId: string,
) {
  const client = getSupabaseServerClient();
  const service = createWorkspaceFormsService(client);
  const [form, submissions, listings] = await Promise.all([
    service.getForm(accountId, formId),
    service.listSubmissions(accountId, formId),
    service.listListingOptions(accountId),
  ]);

  return { form, submissions, listings };
}
