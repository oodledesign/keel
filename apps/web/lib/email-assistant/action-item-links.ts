import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { EmailActionItemRow } from '~/home/(user)/email/_lib/types';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type EmailActionItemLinkFields = {
  accountId: string | null;
  clientId: string | null;
  projectId: string | null;
};

export function linkFieldsFromThread(row: {
  account_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
}): EmailActionItemLinkFields {
  return {
    accountId: row.account_id ?? null,
    clientId: row.client_id ?? null,
    projectId: row.project_id ?? null,
  };
}

export function actionItemLinkLabel(item: {
  projectName?: string | null;
  clientName?: string | null;
}): string | null {
  if (item.projectName) {
    return item.projectName;
  }

  if (item.clientName) {
    return item.clientName;
  }

  return null;
}

export async function syncSuggestedActionItemsFromThreadLink(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  link: EmailActionItemLinkFields,
) {
  const { error } = await client
    .from('email_action_items')
    .update({
      account_id: link.accountId,
      client_id: link.clientId,
      project_id: link.projectId,
    })
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .eq('status', 'suggested');

  if (error) {
    throw new Error(error.message);
  }
}

export async function enrichEmailActionItemLinks(
  items: EmailActionItemRow[],
): Promise<EmailActionItemRow[]> {
  if (items.length === 0) {
    return items;
  }

  const clientIds = [
    ...new Set(items.map((item) => item.client_id).filter(Boolean) as string[]),
  ];
  const projectIds = [
    ...new Set(items.map((item) => item.project_id).filter(Boolean) as string[]),
  ];

  const nameClient = getSupabaseServerAdminClient() as unknown as SupabaseClient;

  const [clientsResult, projectsResult] = await Promise.all([
    clientIds.length > 0
      ? nameClient
          .from('clients')
          .select('id, display_name, first_name, last_name, company_name')
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? nameClient.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const clientNames = new Map<string, string>();
  for (const row of clientsResult.data ?? []) {
    const displayName = String(row.display_name ?? '').trim();
    const parts = [row.first_name, row.last_name]
      .filter((value): value is string => Boolean(value && String(value).trim()))
      .map((value) => String(value).trim())
      .join(' ');
    const company = String(row.company_name ?? '').trim();
    clientNames.set(
      row.id as string,
      displayName || parts || company || 'Client',
    );
  }

  const projectNames = new Map<string, string>();
  for (const row of projectsResult.data ?? []) {
    projectNames.set(row.id as string, String(row.name ?? 'Project'));
  }

  return items.map((item) => {
    const clientName = item.client_id
      ? (clientNames.get(item.client_id) ?? null)
      : null;
    const projectName = item.project_id
      ? (projectNames.get(item.project_id) ?? null)
      : null;

    return {
      ...item,
      clientName,
      projectName,
      linkLabel: actionItemLinkLabel({ clientName, projectName }),
    };
  });
}
