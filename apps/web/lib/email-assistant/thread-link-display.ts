import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { EmailThreadLink, EmailThreadSummary } from '~/home/(user)/email/_lib/types';

type LinkRow = {
  id: string;
  account_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  link_source?: string | null;
};

export const EMAIL_THREAD_LINK_SELECT =
  'account_id, client_id, project_id, link_source';

export function mapThreadLinkFields(row: Record<string, unknown>): EmailThreadLink {
  const linkSource = row.link_source;
  const clientId = (row.client_id as string | null) ?? null;
  const projectId = (row.project_id as string | null) ?? null;
  const accountId = (row.account_id as string | null) ?? null;
  const linked = Boolean(clientId || projectId);

  return {
    accountId,
    clientId,
    projectId,
    linkSource:
      linkSource === 'auto' || linkSource === 'manual' ? linkSource : null,
    linked,
    accountName: null,
    clientName: null,
    projectName: null,
  };
}

export async function enrichEmailThreadLinks(
  client: SupabaseClient,
  threads: EmailThreadSummary[],
): Promise<EmailThreadSummary[]> {
  if (threads.length === 0) {
    return threads;
  }

  const clientIds = [
    ...new Set(
      threads.map((thread) => thread.link.clientId).filter(Boolean) as string[],
    ),
  ];
  const projectIds = [
    ...new Set(
      threads.map((thread) => thread.link.projectId).filter(Boolean) as string[],
    ),
  ];
  const accountIds = [
    ...new Set(
      threads.map((thread) => thread.link.accountId).filter(Boolean) as string[],
    ),
  ];

  const [clientsResult, projectsResult, accountsResult] = await Promise.all([
    clientIds.length > 0
      ? client
          .from('clients')
          .select('id, display_name, first_name, last_name, company_name')
          .in('id', clientIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length > 0
      ? client.from('projects').select('id, name').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    accountIds.length > 0
      ? client.from('accounts').select('id, name').in('id', accountIds)
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

  const accountNames = new Map<string, string>();
  for (const row of accountsResult.data ?? []) {
    accountNames.set(row.id as string, String(row.name ?? 'Workspace'));
  }

  return threads.map((thread) => ({
    ...thread,
    link: {
      ...thread.link,
      clientName: thread.link.clientId
        ? (clientNames.get(thread.link.clientId) ?? null)
        : null,
      projectName: thread.link.projectId
        ? (projectNames.get(thread.link.projectId) ?? null)
        : null,
      accountName: thread.link.accountId
        ? (accountNames.get(thread.link.accountId) ?? null)
        : null,
    },
  }));
}

export function applyLinkRowToSummary(
  summary: EmailThreadSummary,
  row: LinkRow,
): EmailThreadSummary {
  return {
    ...summary,
    link: mapThreadLinkFields(row as Record<string, unknown>),
  };
}
