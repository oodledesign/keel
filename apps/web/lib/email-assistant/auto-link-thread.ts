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

type ClientMatch = {
  id: string;
  account_id: string;
};

type ThreadLinkRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: unknown;
  client_id: string | null;
  project_id: string | null;
  link_source: string | null;
};

const AUTO_LINK_CONFIDENCE_THRESHOLD = 0.75;

type LinkCandidate = ClientMatch & {
  confidence: number;
  projectId: string | null;
  clientName: string | null;
  projectName: string | null;
};

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function keywordInText(keyword: string, haystack: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (normalized.length < 3) {
    return false;
  }
  return haystack.includes(normalized);
}

async function findContactEmailAddressMatches(
  admin: SupabaseClient,
  accountIds: string[],
  emails: string[],
): Promise<ClientMatch[]> {
  if (accountIds.length === 0 || emails.length === 0) {
    return [];
  }

  const normalizedEmails = emails.map((email) => email.toLowerCase());
  const { data: addressRows, error } = await admin
    .from('contact_email_addresses')
    .select('email, account_id, contact_id')
    .in('account_id', accountIds);

  if (error) {
    if (!error.message.includes('contact_email_addresses')) {
      throw new Error(error.message);
    }
    return [];
  }

  const contactIds = [
    ...new Set(
      (addressRows ?? [])
        .filter((row) =>
          normalizedEmails.includes(
            String(row.email ?? '')
              .trim()
              .toLowerCase(),
          ),
        )
        .map((row) => row.contact_id as string),
    ),
  ];

  if (contactIds.length === 0) {
    return [];
  }

  const { data: links, error: linksError } = await admin
    .from('client_contacts')
    .select('client_id, clients ( id, account_id )')
    .in('contact_id', contactIds);

  if (linksError) {
    return [];
  }

  const matches = new Map<string, ClientMatch>();

  for (const row of links ?? []) {
    const client = row.clients as { id?: string; account_id?: string } | null;
    if (!client?.id || !client.account_id) {
      continue;
    }

    matches.set(client.id, {
      id: client.id,
      account_id: client.account_id,
    });
  }

  return [...matches.values()];
}

async function findKeywordMatches(
  admin: SupabaseClient,
  accountIds: string[],
  subject: string | null,
  snippet: string | null,
): Promise<LinkCandidate[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const haystack = `${normalizeSearchText(subject)} ${normalizeSearchText(snippet)}`;
  if (!haystack.trim()) {
    return [];
  }

  const { data: clients, error: clientsError } = await admin
    .from('clients')
    .select('id, account_id, name')
    .in('account_id', accountIds);

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  const candidates: LinkCandidate[] = [];

  for (const row of clients ?? []) {
    const name = String(row.name ?? '').trim();
    if (!keywordInText(name, haystack)) {
      continue;
    }

    const clientId = row.id as string;
    const accountId = row.account_id as string;
    const projectId = await inferProjectId(admin, accountId, clientId, subject);

    let projectName: string | null = null;
    if (projectId) {
      const { data: project } = await admin
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .maybeSingle();
      projectName = (project?.name as string | null) ?? null;
    }

    candidates.push({
      id: clientId,
      account_id: accountId,
      confidence: 0.72,
      projectId,
      clientName: name,
      projectName,
    });
  }

  const { data: projects, error: projectsError } = await admin
    .from('projects')
    .select('id, account_id, client_id, name')
    .in('account_id', accountIds);

  if (!projectsError) {
    for (const row of projects ?? []) {
      const name = String(row.name ?? '').trim();
      if (!keywordInText(name, haystack)) {
        continue;
      }

      const clientId = row.client_id as string | null;
      const accountId = row.account_id as string;
      if (!clientId) {
        continue;
      }

      candidates.push({
        id: clientId,
        account_id: accountId,
        confidence: 0.78,
        projectId: row.id as string,
        clientName: null,
        projectName: name,
      });
    }
  }

  return candidates;
}

function participantDisplayNames(
  participants: unknown,
  ownerEmail: string,
): string[] {
  if (!Array.isArray(participants)) {
    return [];
  }

  const owner = extractEmailAddress(ownerEmail);
  const names = new Set<string>();

  for (const entry of participants) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const row = entry as Participant;
    const email = extractEmailAddress(row.email);
    if (!email || (owner && email === owner)) {
      continue;
    }

    const name = row.name?.trim();
    if (name && name.length >= 2) {
      names.add(name.toLowerCase());
    }
  }

  return [...names];
}

async function findDisplayNameMatches(
  admin: SupabaseClient,
  accountIds: string[],
  displayNames: string[],
): Promise<LinkCandidate[]> {
  if (accountIds.length === 0 || displayNames.length === 0) {
    return [];
  }

  const { data: contacts, error } = await admin
    .from('contacts')
    .select('id, account_id, name')
    .in('account_id', accountIds);

  if (error) {
    return [];
  }

  const matchedContactIds: string[] = [];

  for (const row of contacts ?? []) {
    const name = normalizeSearchText(row.name as string | null);
    if (!name) {
      continue;
    }

    if (displayNames.some((candidate) => name.includes(candidate) || candidate.includes(name))) {
      matchedContactIds.push(row.id as string);
    }
  }

  if (matchedContactIds.length === 0) {
    return [];
  }

  const { data: links } = await admin
    .from('client_contacts')
    .select('client_id, clients ( id, account_id, name )')
    .in('contact_id', matchedContactIds);

  const candidates: LinkCandidate[] = [];

  for (const row of links ?? []) {
    const client = row.clients as {
      id?: string;
      account_id?: string;
      name?: string | null;
    } | null;
    if (!client?.id || !client.account_id) {
      continue;
    }

    candidates.push({
      id: client.id,
      account_id: client.account_id,
      confidence: 0.68,
      projectId: null,
      clientName: (client.name as string | null) ?? null,
      projectName: null,
    });
  }

  return candidates;
}

async function loadClientName(
  admin: SupabaseClient,
  clientId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();

  return (data?.name as string | null) ?? null;
}

async function resolveEmailThreadLinkCandidates(
  admin: SupabaseClient,
  userId: string,
  row: ThreadLinkRow,
  ownerEmail: string,
  preferredAccountId: string | null,
): Promise<LinkCandidate[]> {
  const emails = participantEmails(row.participants, ownerEmail);
  if (emails.length === 0) {
    return [];
  }

  const accountIds = await loadAccountIds(admin, userId);
  const candidates: LinkCandidate[] = [];

  const exactMatches = await findExactEmailMatches(admin, accountIds, emails);
  for (const match of exactMatches) {
    const projectId = await inferProjectId(
      admin,
      match.account_id,
      match.id,
      row.subject,
    );
    candidates.push({
      ...match,
      confidence: 0.95,
      projectId,
      clientName: await loadClientName(admin, match.id),
      projectName: null,
    });
  }

  const contactMatches = await findContactEmailAddressMatches(
    admin,
    accountIds,
    emails,
  );
  for (const match of contactMatches) {
    if (candidates.some((candidate) => candidate.id === match.id)) {
      continue;
    }
    const projectId = await inferProjectId(
      admin,
      match.account_id,
      match.id,
      row.subject,
    );
    candidates.push({
      ...match,
      confidence: 0.92,
      projectId,
      clientName: await loadClientName(admin, match.id),
      projectName: null,
    });
  }

  if (candidates.length === 0) {
    const domains = domainsFromEmails(emails);
    const domainMatches = await findDomainMatches(admin, accountIds, domains);
    for (const match of domainMatches) {
      const projectId = await inferProjectId(
        admin,
        match.account_id,
        match.id,
        row.subject,
      );
      candidates.push({
        ...match,
        confidence: 0.82,
        projectId,
        clientName: await loadClientName(admin, match.id),
        projectName: null,
      });
    }
  }

  const keywordMatches = await findKeywordMatches(
    admin,
    accountIds,
    row.subject,
    row.snippet,
  );
  for (const match of keywordMatches) {
    if (!candidates.some((candidate) => candidate.id === match.id)) {
      candidates.push(match);
    }
  }

  const displayNames = participantDisplayNames(row.participants, ownerEmail);
  const nameMatches = await findDisplayNameMatches(
    admin,
    accountIds,
    displayNames,
  );
  for (const match of nameMatches) {
    if (!candidates.some((candidate) => candidate.id === match.id)) {
      candidates.push(match);
    }
  }

  if (preferredAccountId) {
    candidates.sort((a, b) => {
      const aPreferred = a.account_id === preferredAccountId ? 1 : 0;
      const bPreferred = b.account_id === preferredAccountId ? 1 : 0;
      if (aPreferred !== bPreferred) {
        return bPreferred - aPreferred;
      }
      return b.confidence - a.confidence;
    });
  } else {
    candidates.sort((a, b) => b.confidence - a.confidence);
  }

  return candidates;
}

async function applyThreadLink(
  admin: SupabaseClient,
  userId: string,
  threadId: string,
  candidate: LinkCandidate,
) {
  const { error: updateError } = await admin
    .from('email_threads')
    .update({
      account_id: candidate.account_id,
      client_id: candidate.id,
      project_id: candidate.projectId,
      link_source: 'auto',
      link_confidence: candidate.confidence,
      link_suggestion: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await syncSuggestedActionItemsFromThreadLink(admin, userId, threadId, {
    accountId: candidate.account_id,
    clientId: candidate.id,
    projectId: candidate.projectId,
  });

  queueEmailThreadBrainSync(threadId);
}

async function storeThreadLinkSuggestion(
  admin: SupabaseClient,
  userId: string,
  threadId: string,
  candidate: LinkCandidate,
) {
  const { error } = await admin
    .from('email_threads')
    .update({
      link_confidence: candidate.confidence,
      link_suggestion: {
        accountId: candidate.account_id,
        clientId: candidate.id,
        projectId: candidate.projectId,
        clientName: candidate.clientName,
        projectName: candidate.projectName,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', threadId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

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

export async function suggestEmailThreadLink(
  admin: SupabaseClient,
  userId: string,
  threadId: string,
  ownerEmail: string,
  options?: { preferredAccountId?: string | null },
): Promise<LinkCandidate | null> {
  const { data: thread, error: threadError } = await admin
    .from('email_threads')
    .select(
      'id, subject, snippet, participants, client_id, project_id, link_source',
    )
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (threadError) {
    throw new Error(threadError.message);
  }

  if (!thread) {
    return null;
  }

  const row = thread as ThreadLinkRow;
  const candidates = await resolveEmailThreadLinkCandidates(
    admin,
    userId,
    row,
    ownerEmail,
    options?.preferredAccountId ?? null,
  );

  const unique = pickUniqueClientMatch(candidates, options?.preferredAccountId);
  const best = unique ?? candidates[0] ?? null;

  if (!best) {
    await admin
      .from('email_threads')
      .update({
        link_confidence: null,
        link_suggestion: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', userId);
    return null;
  }

  if (
    best.confidence >= AUTO_LINK_CONFIDENCE_THRESHOLD &&
    unique &&
    row.link_source !== 'manual'
  ) {
    await applyThreadLink(admin, userId, threadId, best);
    return best;
  }

  await storeThreadLinkSuggestion(admin, userId, threadId, best);
  return best;
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
    .select(
      'id, subject, snippet, participants, client_id, project_id, link_source',
    )
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

  const result = await suggestEmailThreadLink(
    admin,
    userId,
    threadId,
    ownerEmail,
    options,
  );

  return Boolean(result && result.confidence >= AUTO_LINK_CONFIDENCE_THRESHOLD);
}
