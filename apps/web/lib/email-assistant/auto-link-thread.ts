import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { queueEmailThreadBrainSync } from '~/lib/brain/email-thread-brain-sync';

import { syncSuggestedActionItemsFromThreadLink } from './action-item-links';
import { extractEmailAddress } from './address-utils';
import {
  domainsFromEmails,
  extractEmailDomain,
  isPublicEmailDomain,
  normalizeWebsiteDomain,
  pickUniqueClientMatch,
} from './domain-utils';

type Participant = {
  name?: string | null;
  email?: string;
};

type ThreadLinkRow = {
  id: string;
  subject: string | null;
  participants: unknown;
  client_id: string | null;
  project_id: string | null;
  link_source: string | null;
};

type ClientMatch = {
  id: string;
  account_id: string;
};

function participantEmails(
  participants: unknown,
  ownerEmail: string,
): string[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  const owner = extractEmailAddress(ownerEmail);
  const emails = new Set<string>();

  for (const entry of participants) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const row = entry as Participant;
    const email = extractEmailAddress(row.email);

    if (!email || (owner && email === owner)) {
      continue;
    }

    emails.add(email);
  }

  return [...emails];
}

async function loadAccountIds(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('accounts_memberships')
    .select('account_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return [...new Set((data ?? []).map((row) => String(row.account_id)))];
}

async function findExactEmailMatches(
  admin: SupabaseClient,
  accountIds: string[],
  emails: string[],
): Promise<ClientMatch[]> {
  if (accountIds.length === 0 || emails.length === 0) {
    return [];
  }

  const { data: clients, error: clientsError } = await admin
    .from('clients')
    .select('id, account_id, email')
    .in('account_id', accountIds);

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  const clientRows = clients ?? [];
  const clientIds = clientRows.map((row) => row.id as string);
  const matches = new Map<string, ClientMatch>();

  for (const row of clientRows) {
    const email = extractEmailAddress(row.email as string | null);

    if (!email || !emails.includes(email)) {
      continue;
    }

    matches.set(row.id as string, {
      id: row.id as string,
      account_id: row.account_id as string,
    });
  }

  if (clientIds.length === 0) {
    return [...matches.values()];
  }

  const { data: contactLinks, error: contactLinksError } = await admin
    .from('client_contacts')
    .select('client_id, contacts ( email )')
    .in('client_id', clientIds);

  if (contactLinksError) {
    if (
      !contactLinksError.message.includes('client_contacts') &&
      !contactLinksError.message.includes('contacts')
    ) {
      throw new Error(contactLinksError.message);
    }

    return [...matches.values()];
  }

  const clientAccountById = new Map(
    clientRows.map((row) => [row.id as string, row.account_id as string]),
  );

  for (const row of contactLinks ?? []) {
    const contact = row.contacts as { email?: string | null } | null;
    const email = extractEmailAddress(contact?.email ?? null);
    const clientId = row.client_id as string | null;

    if (!email || !clientId || !emails.includes(email)) {
      continue;
    }

    const accountId = clientAccountById.get(clientId);

    if (!accountId) {
      continue;
    }

    matches.set(clientId, {
      id: clientId,
      account_id: accountId,
    });
  }

  return [...matches.values()];
}

async function findDomainMatches(
  admin: SupabaseClient,
  accountIds: string[],
  participantDomains: string[],
): Promise<ClientMatch[]> {
  if (accountIds.length === 0 || participantDomains.length === 0) {
    return [];
  }

  const domainSet = new Set(participantDomains);
  const { data: clients, error: clientsError } = await admin
    .from('clients')
    .select('id, account_id, email, client_org_id')
    .in('account_id', accountIds);

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  const clientRows = clients ?? [];
  const matches = new Map<string, ClientMatch>();

  for (const row of clientRows) {
    const domain = extractEmailDomain(row.email as string | null);

    if (!domain || isPublicEmailDomain(domain) || !domainSet.has(domain)) {
      continue;
    }

    matches.set(row.id as string, {
      id: row.id as string,
      account_id: row.account_id as string,
    });
  }

  const clientIds = clientRows.map((row) => row.id as string);

  if (clientIds.length > 0) {
    const { data: contactLinks, error: contactLinksError } = await admin
      .from('client_contacts')
      .select('client_id, contacts ( email )')
      .in('client_id', clientIds);

    if (contactLinksError) {
      if (
        !contactLinksError.message.includes('client_contacts') &&
        !contactLinksError.message.includes('contacts')
      ) {
        throw new Error(contactLinksError.message);
      }
    } else {
      const clientAccountById = new Map(
        clientRows.map((row) => [row.id as string, row.account_id as string]),
      );

      for (const row of contactLinks ?? []) {
        const contact = row.contacts as { email?: string | null } | null;
        const domain = extractEmailDomain(contact?.email ?? null);
        const clientId = row.client_id as string | null;

        if (
          !domain ||
          isPublicEmailDomain(domain) ||
          !domainSet.has(domain) ||
          !clientId
        ) {
          continue;
        }

        const accountId = clientAccountById.get(clientId);

        if (!accountId) {
          continue;
        }

        matches.set(clientId, {
          id: clientId,
          account_id: accountId,
        });
      }
    }
  }

  const orgIds = [
    ...new Set(
      clientRows
        .map((row) => row.client_org_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (orgIds.length > 0) {
    const { data: websites, error: websitesError } = await admin
      .from('websites')
      .select('domain, client_org_id, business_id')
      .in('client_org_id', orgIds);

    if (!websitesError) {
      const clientsByOrg = new Map<string, typeof clientRows>();

      for (const row of clientRows) {
        const orgId = row.client_org_id as string | null;
        if (!orgId) continue;
        const list = clientsByOrg.get(orgId) ?? [];
        list.push(row);
        clientsByOrg.set(orgId, list);
      }

      for (const site of websites ?? []) {
        const domain = normalizeWebsiteDomain(site.domain as string | null);

        if (!domain || !domainSet.has(domain)) {
          continue;
        }

        const orgId = site.client_org_id as string | null;
        if (!orgId) continue;

        const orgClients = clientsByOrg.get(orgId) ?? [];

        for (const client of orgClients) {
          matches.set(client.id as string, {
            id: client.id as string,
            account_id: client.account_id as string,
          });
        }
      }
    }
  }

  return [...matches.values()];
}

async function inferProjectId(
  admin: SupabaseClient,
  accountId: string,
  clientId: string,
  subject: string | null,
): Promise<string | null> {
  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name, status')
    .eq('account_id', accountId)
    .eq('client_id', clientId);

  if (error) {
    throw new Error(error.message);
  }

  const active = (projects ?? []).filter((row) => {
    const status = String(row.status ?? '').toLowerCase();
    return !['completed', 'cancelled', 'archived'].includes(status);
  });

  if (active.length === 0) {
    return null;
  }

  const normalizedSubject = subject?.trim().toLowerCase() ?? '';

  if (normalizedSubject) {
    const bySubject = active.find((row) => {
      const name = String(row.name ?? '')
        .trim()
        .toLowerCase();
      return name.length >= 3 && normalizedSubject.includes(name);
    });

    if (bySubject) {
      return bySubject.id as string;
    }
  }

  if (active.length === 1) {
    return active[0]?.id as string;
  }

  return null;
}

export async function autoLinkEmailThread(
  admin: SupabaseClient,
  userId: string,
  threadId: string,
  ownerEmail: string,
  options?: { preferredAccountId?: string | null; skip?: boolean },
): Promise<boolean> {
  if (options?.skip) {
    return false;
  }

  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select('id, subject, participants, client_id, project_id, link_source')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return false;
  }

  const row = thread as ThreadLinkRow;

  if (row.link_source === 'manual') {
    return false;
  }

  const emails = participantEmails(row.participants, ownerEmail);

  if (emails.length === 0) {
    return false;
  }

  const accountIds = await loadAccountIds(admin, userId);
  const preferredAccountId = options?.preferredAccountId ?? null;

  const exactMatches = await findExactEmailMatches(admin, accountIds, emails);
  let client = pickUniqueClientMatch(exactMatches, preferredAccountId);

  if (!client) {
    const domains = domainsFromEmails(emails);
    const domainMatches = await findDomainMatches(admin, accountIds, domains);
    client = pickUniqueClientMatch(domainMatches, preferredAccountId);
  }

  if (!client) {
    return false;
  }

  const projectId = await inferProjectId(
    admin,
    client.account_id,
    client.id,
    row.subject,
  );

  const { error: updateError } = await admin
    .from('email_threads')
    .update({
      account_id: client.account_id,
      client_id: client.id,
      project_id: projectId,
      link_source: 'auto',
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await syncSuggestedActionItemsFromThreadLink(admin, userId, threadId, {
    accountId: client.account_id,
    clientId: client.id,
    projectId,
  });

  queueEmailThreadBrainSync(threadId);

  return true;
}
