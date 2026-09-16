import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { createAudienceListsService } from '~/lib/campaigns/audience-lists.service';

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
  accountSlug: string,
) {
  const client = getSupabaseServerClient();
  const service = createWorkspaceFormsService(client);
  const [form, submissions, listings, members, audienceLists, brand] =
    await Promise.all([
      service.getForm(accountId, formId),
      service.listSubmissions(accountId, formId),
      service.listListingOptions(accountId),
      service.listNotifyMembers(accountSlug),
      createAudienceListsService(client)
        .list(accountId)
        .catch(() => []),
      loadAccountBrandResolved(accountId),
    ]);

  return { form, submissions, listings, members, audienceLists, brand };
}
