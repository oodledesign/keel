import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'crypto';

import { getLogger } from '@kit/shared/logger';

import { isUsableMailingListUnsubscribeToken } from '~/lib/campaigns/campaign-test-send';
import {
  listWorkspaceMailingListSubscribers,
  type PublicMailingPreferenceResult,
} from '~/lib/workspace-forms/workspace-mailing-list';

import {
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  normalizeAudienceEmails,
  parseCampaignAudienceConfig,
  parseCampaignAudienceType,
} from './campaign-audience';
import {
  type AudienceFilterSubject,
  applyAudienceFilters,
  parseAudienceListFilters,
} from './campaign-audience-filters';

export type ResolvedCampaignRecipient = {
  email: string;
  displayName: string | null;
  clientId: string | null;
  contactId: string | null;
  preferenceId: string | null;
  unsubscribeToken: string | null;
};

function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

function newUnsubscribeToken() {
  return randomBytes(24).toString('hex');
}

type ListedPerson = {
  id: string;
  email: string;
  displayName: string | null;
  clientType?: string | null;
  companyName?: string | null;
  industry?: string | null;
  createdAt?: string | null;
  consentedAt?: string | null;
};

type PrefRow = {
  id: string;
  email: string;
  marketing_status: string;
  unsubscribe_token: string;
  client_id: string | null;
};

async function loadPreferenceMap(
  client: SupabaseClient,
  accountId: string,
  emails: string[],
): Promise<Map<string, PrefRow>> {
  const map = new Map<string, PrefRow>();
  if (emails.length === 0) return map;

  const { data, error } = await fromTable(
    client,
    'workspace_mailing_preferences',
  )
    .select('id, email, marketing_status, unsubscribe_token, client_id')
    .eq('account_id', accountId)
    .eq('purpose', 'workspace_mailing_list')
    .in('email', emails);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as PrefRow[]) {
    map.set(String(row.email).toLowerCase(), row);
  }
  return map;
}

function mergeRecipient(
  byEmail: Map<string, ResolvedCampaignRecipient>,
  candidate: Omit<
    ResolvedCampaignRecipient,
    'preferenceId' | 'unsubscribeToken'
  > & {
    preferenceId?: string | null;
    unsubscribeToken?: string | null;
  },
) {
  const email = candidate.email.trim().toLowerCase();
  if (!email.includes('@')) return;
  const existing = byEmail.get(email);
  if (!existing) {
    byEmail.set(email, {
      email,
      displayName: candidate.displayName,
      clientId: candidate.clientId,
      contactId: candidate.contactId,
      preferenceId: candidate.preferenceId ?? null,
      unsubscribeToken: candidate.unsubscribeToken ?? null,
    });
    return;
  }
  byEmail.set(email, {
    email,
    displayName: existing.displayName || candidate.displayName,
    clientId: existing.clientId || candidate.clientId,
    contactId: existing.contactId || candidate.contactId,
    preferenceId: existing.preferenceId || candidate.preferenceId || null,
    unsubscribeToken:
      existing.unsubscribeToken || candidate.unsubscribeToken || null,
  });
}

async function listClientsWithEmail(
  client: SupabaseClient,
  accountId: string,
  clientIds?: string[],
): Promise<ListedPerson[]> {
  let query = fromTable(client, 'clients')
    .select(
      'id, email, display_name, company_name, first_name, last_name, client_type, created_at',
    )
    .eq('account_id', accountId)
    .not('email', 'is', null)
    .is('archived_at', null);

  if (clientIds && clientIds.length > 0) {
    query = query.in('id', clientIds);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);

  const people: ListedPerson[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const email = String(row.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    const displayName =
      String(row.display_name ?? '').trim() ||
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
      String(row.company_name ?? '').trim() ||
      null;
    people.push({
      id: String(row.id),
      email,
      displayName: displayName || null,
      clientType: (row.client_type as string | null) ?? null,
      companyName: (row.company_name as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    });
  }
  return people;
}

async function listContactsWithEmail(
  client: SupabaseClient,
  accountId: string,
  contactIds?: string[],
): Promise<ListedPerson[]> {
  let query = fromTable(client, 'contacts')
    .select(
      'id, email, full_name, first_name, last_name, company_name, industry, created_at',
    )
    .eq('account_id', accountId)
    .not('email', 'is', null);

  if (contactIds && contactIds.length > 0) {
    query = query.in('id', contactIds);
  }

  const { data, error } = await query.limit(5000);
  if (error) {
    // Older workspaces may lack account_id on contacts; fail soft for estimate.
    const logger = await getLogger();
    logger.warn(
      { name: 'campaigns.audience', error: error.message },
      'List contacts failed',
    );
    return [];
  }

  const people: ListedPerson[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const email = String(row.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    const displayName =
      String(row.full_name ?? '').trim() ||
      [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
      null;
    people.push({
      id: String(row.id),
      email,
      displayName: displayName || null,
      companyName: (row.company_name as string | null) ?? null,
      industry: (row.industry as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    });
  }
  return people;
}

async function loadAudienceList(
  client: SupabaseClient,
  accountId: string,
  listId: string,
) {
  const { data, error } = await fromTable(client, 'campaign_audience_lists')
    .select('id, source, match_mode, filters')
    .eq('account_id', accountId)
    .eq('id', listId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Saved audience list not found');
  return data as {
    id: string;
    source: 'subscribers' | 'clients' | 'contacts' | 'manual';
    match_mode: 'all' | 'any';
    filters: unknown;
  };
}

async function listManualListContacts(
  client: SupabaseClient,
  accountId: string,
  listId: string,
): Promise<ListedPerson[]> {
  const { data, error } = await fromTable(
    client,
    'campaign_audience_list_members',
  )
    .select(
      'contact_id, contacts ( id, email, full_name, first_name, last_name, company_name, industry, created_at )',
    )
    .eq('account_id', accountId)
    .eq('list_id', listId)
    .limit(5000);

  if (error) throw new Error(error.message);

  const people: ListedPerson[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const contact = (row.contacts ?? {}) as Record<string, unknown>;
    const email = String(contact.email ?? '')
      .trim()
      .toLowerCase();
    if (!email) continue;
    const displayName =
      String(contact.full_name ?? '').trim() ||
      [contact.first_name, contact.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      null;
    people.push({
      id: String(contact.id ?? row.contact_id),
      email,
      displayName: displayName || null,
      companyName: (contact.company_name as string | null) ?? null,
      industry: (contact.industry as string | null) ?? null,
      createdAt: (contact.created_at as string | null) ?? null,
    });
  }
  return people;
}

async function loadContactCategoryMap(
  client: SupabaseClient,
  accountId: string,
  contactIds: string[],
): Promise<Map<string, { ids: string[]; names: string[] }>> {
  const map = new Map<string, { ids: string[]; names: string[] }>();
  if (contactIds.length === 0) return map;

  const { data, error } = await fromTable(
    client,
    'campaign_contact_category_assignments',
  )
    .select(
      'contact_id, category_id, campaign_contact_categories ( id, name, archived_at )',
    )
    .eq('account_id', accountId)
    .in('contact_id', contactIds);

  if (error) {
    const logger = await getLogger();
    logger.warn(
      { name: 'campaigns.audience', error: error.message },
      'List contact categories failed',
    );
    return map;
  }

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const category = (row.campaign_contact_categories ?? {}) as Record<
      string,
      unknown
    >;
    if (category.archived_at) continue;
    const contactId = String(row.contact_id);
    const current = map.get(contactId) ?? { ids: [], names: [] };
    current.ids.push(String(row.category_id));
    if (category.name) current.names.push(String(category.name));
    map.set(contactId, current);
  }
  return map;
}

/**
 * Resolve the campaign audience into unique sendable recipients.
 * Excludes unsubscribed/suppressed mailing preferences.
 * Ensures every remaining recipient has an unsubscribe token (preference or generated).
 */
export async function resolveCampaignAudience(
  client: SupabaseClient,
  accountId: string,
  audienceType: CampaignAudienceType | string,
  audienceConfig: CampaignAudienceConfig | unknown,
): Promise<ResolvedCampaignRecipient[]> {
  const type = parseCampaignAudienceType(audienceType);
  const config = parseCampaignAudienceConfig(audienceConfig);
  const byEmail = new Map<string, ResolvedCampaignRecipient>();

  if (type === 'subscribers' || type === 'custom') {
    if (type === 'subscribers') {
      const subscribers = await listWorkspaceMailingListSubscribers(
        client,
        accountId,
      );
      for (const subscriber of subscribers) {
        mergeRecipient(byEmail, {
          email: subscriber.email,
          displayName: subscriber.displayName,
          clientId: subscriber.clientId,
          contactId: null,
          preferenceId: subscriber.preferenceId,
        });
      }
    }
  }

  if (type === 'clients') {
    const clients = await listClientsWithEmail(client, accountId);
    for (const row of clients) {
      mergeRecipient(byEmail, {
        email: row.email,
        displayName: row.displayName,
        clientId: row.id,
        contactId: null,
      });
    }
  }

  if (type === 'contacts') {
    const contacts = await listContactsWithEmail(client, accountId);
    for (const row of contacts) {
      mergeRecipient(byEmail, {
        email: row.email,
        displayName: row.displayName,
        clientId: null,
        contactId: row.id,
      });
    }
  }

  if (type === 'list') {
    // Incomplete drafts are valid: list type with no list chosen yet.
    // Count/render must not throw; send/schedule assert separately.
    if (!config.listId) {
      return [];
    }
    const list = await loadAudienceList(client, accountId, config.listId);
    const filters = parseAudienceListFilters({
      source: list.source,
      matchMode: list.match_mode,
      rules: Array.isArray(list.filters) ? list.filters : [],
    });

    const subjects: Array<
      AudienceFilterSubject & {
        clientId: string | null;
        contactId: string | null;
        preferenceId: string | null;
      }
    > = [];

    if (list.source === 'manual') {
      const members = await listManualListContacts(client, accountId, list.id);
      for (const row of members) {
        mergeRecipient(byEmail, {
          email: row.email,
          displayName: row.displayName,
          clientId: null,
          contactId: row.id,
        });
      }
    } else if (list.source === 'subscribers') {
      const subscribers = await listWorkspaceMailingListSubscribers(
        client,
        accountId,
      );
      for (const subscriber of subscribers) {
        subjects.push({
          email: subscriber.email,
          displayName: subscriber.displayName,
          consentedAt: subscriber.consentedAt,
          clientId: subscriber.clientId,
          contactId: null,
          preferenceId: subscriber.preferenceId,
        });
      }
    } else if (list.source === 'clients') {
      const clients = await listClientsWithEmail(client, accountId);
      for (const row of clients) {
        subjects.push({
          email: row.email,
          displayName: row.displayName,
          createdAt: row.createdAt,
          clientType: row.clientType,
          companyName: row.companyName,
          clientId: row.id,
          contactId: null,
          preferenceId: null,
        });
      }
    } else if (list.source === 'contacts') {
      const contacts = await listContactsWithEmail(client, accountId);
      const categoryMap = await loadContactCategoryMap(
        client,
        accountId,
        contacts.map((row) => row.id),
      );
      for (const row of contacts) {
        const categories = categoryMap.get(row.id);
        subjects.push({
          email: row.email,
          displayName: row.displayName,
          createdAt: row.createdAt,
          companyName: row.companyName,
          industry: row.industry,
          categoryIds: categories?.ids,
          categoryNames: categories?.names,
          clientId: null,
          contactId: row.id,
          preferenceId: null,
        });
      }
    }

    if (list.source !== 'manual') {
      const matched = applyAudienceFilters(subjects, filters);
      for (const row of matched) {
        const extra = row as (typeof subjects)[number];
        mergeRecipient(byEmail, {
          email: extra.email,
          displayName: extra.displayName,
          clientId: extra.clientId,
          contactId: extra.contactId,
          preferenceId: extra.preferenceId,
        });
      }
    }
  }

  if (type === 'custom') {
    for (const email of normalizeAudienceEmails(config.emails ?? [])) {
      mergeRecipient(byEmail, {
        email,
        displayName: null,
        clientId: null,
        contactId: null,
      });
    }
    if ((config.clientIds ?? []).length > 0) {
      const clients = await listClientsWithEmail(
        client,
        accountId,
        config.clientIds,
      );
      for (const row of clients) {
        mergeRecipient(byEmail, {
          email: row.email,
          displayName: row.displayName,
          clientId: row.id,
          contactId: null,
        });
      }
    }
    if ((config.contactIds ?? []).length > 0) {
      const contacts = await listContactsWithEmail(
        client,
        accountId,
        config.contactIds,
      );
      for (const row of contacts) {
        mergeRecipient(byEmail, {
          email: row.email,
          displayName: row.displayName,
          clientId: null,
          contactId: row.id,
        });
      }
    }
  }

  const emails = [...byEmail.keys()];
  const prefs = await loadPreferenceMap(client, accountId, emails);
  const resolved: ResolvedCampaignRecipient[] = [];

  for (const recipient of byEmail.values()) {
    const pref = prefs.get(recipient.email);
    if (
      pref &&
      (pref.marketing_status === 'unsubscribed' ||
        pref.marketing_status === 'suppressed')
    ) {
      continue;
    }

    resolved.push({
      ...recipient,
      preferenceId: pref?.id ?? recipient.preferenceId,
      clientId: recipient.clientId || pref?.client_id || null,
      unsubscribeToken:
        pref?.unsubscribe_token ??
        recipient.unsubscribeToken ??
        newUnsubscribeToken(),
    });
  }

  return resolved;
}

export async function estimateCampaignAudienceCount(
  client: SupabaseClient,
  accountId: string,
  audienceType: CampaignAudienceType | string,
  audienceConfig: CampaignAudienceConfig | unknown,
): Promise<number> {
  const recipients = await resolveCampaignAudience(
    client,
    accountId,
    audienceType,
    audienceConfig,
  );
  return recipients.length;
}

export async function listAudiencePickerOptions(
  client: SupabaseClient,
  accountId: string,
): Promise<{
  clients: Array<{ id: string; email: string; displayName: string }>;
  contacts: Array<{ id: string; email: string; displayName: string }>;
  subscriberCount: number;
  clientCount: number;
  contactCount: number;
}> {
  const [clients, contacts, subscribers] = await Promise.all([
    listClientsWithEmail(client, accountId),
    listContactsWithEmail(client, accountId),
    listWorkspaceMailingListSubscribers(client, accountId),
  ]);

  return {
    clients: clients.slice(0, 200).map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName || row.email,
    })),
    contacts: contacts.slice(0, 200).map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName || row.email,
    })),
    subscriberCount: subscribers.length,
    clientCount: clients.length,
    contactCount: contacts.length,
  };
}

async function findCampaignRecipientByToken(
  client: SupabaseClient,
  token: string,
): Promise<{ email: string; accountId: string } | null> {
  if (!isUsableMailingListUnsubscribeToken(token)) return null;

  const { data: recipient } = await fromTable(
    client,
    'workspace_email_campaign_recipients',
  )
    .select('id, account_id, email')
    .eq('unsubscribe_token', token)
    .limit(1)
    .maybeSingle();

  if (!recipient) return null;

  return {
    email: String(recipient.email).trim().toLowerCase(),
    accountId: String(recipient.account_id),
  };
}

async function findPreferenceForRecipient(
  client: SupabaseClient,
  accountId: string,
  email: string,
): Promise<{ id: string; marketingStatus: string } | null> {
  const { data: existing } = await fromTable(
    client,
    'workspace_mailing_preferences',
  )
    .select('id, marketing_status')
    .eq('account_id', accountId)
    .eq('email', email)
    .eq('purpose', 'workspace_mailing_list')
    .maybeSingle();

  if (!existing) return null;

  return {
    id: String(existing.id),
    marketingStatus: String(existing.marketing_status),
  };
}

/**
 * Look up a campaign recipient token without mutating preference state.
 */
export async function lookupCampaignRecipientByToken(
  client: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  const recipient = await findCampaignRecipientByToken(client, token);
  if (!recipient) return null;

  const preference = await findPreferenceForRecipient(
    client,
    recipient.accountId,
    recipient.email,
  );

  return {
    email: recipient.email,
    accountId: recipient.accountId,
    marketingStatus:
      preference?.marketingStatus === 'unsubscribed' ||
      preference?.marketingStatus === 'suppressed'
        ? preference.marketingStatus
        : 'subscribed',
  };
}

/**
 * Unsubscribe via a campaign recipient token (clients/custom without preference).
 * Creates/updates a mailing preference as unsubscribed so future sends skip them.
 */
export async function unsubscribeCampaignRecipientByToken(
  client: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  const recipient = await findCampaignRecipientByToken(client, token);
  if (!recipient) return null;

  const { email, accountId } = recipient;

  await fromTable(client, 'workspace_email_campaign_recipients')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null);

  const prefs = fromTable(client, 'workspace_mailing_preferences');
  const existing = await findPreferenceForRecipient(client, accountId, email);

  if (existing) {
    await prefs
      .update({
        marketing_status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await prefs.insert({
      account_id: accountId,
      email,
      purpose: 'workspace_mailing_list',
      marketing_status: 'unsubscribed',
      lawful_basis: 'legitimate_interest',
      consent_source: 'campaign_unsubscribe',
      consent_copy_version: 'v1',
      unsubscribe_token: token,
      unsubscribed_at: new Date().toISOString(),
    });
  }

  return { email, accountId, marketingStatus: 'unsubscribed' };
}

/**
 * Restore mailing preference so later campaigns include this address again.
 * Does not rewrite historical recipient `unsubscribed_at` rows.
 */
export async function resubscribeCampaignRecipientByToken(
  client: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  const recipient = await findCampaignRecipientByToken(client, token);
  if (!recipient) return null;

  const { email, accountId } = recipient;
  const prefs = fromTable(client, 'workspace_mailing_preferences');
  const existing = await findPreferenceForRecipient(client, accountId, email);

  if (existing?.marketingStatus === 'suppressed') {
    return { email, accountId, marketingStatus: 'suppressed' };
  }

  if (existing) {
    if (existing.marketingStatus !== 'subscribed') {
      const { error } = await prefs
        .update({
          marketing_status: 'subscribed',
          unsubscribed_at: null,
          consented_at: new Date().toISOString(),
          consent_source: 'unsubscribe_page_resubscribe',
        })
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
    }
  } else {
    const { error } = await prefs.insert({
      account_id: accountId,
      email,
      purpose: 'workspace_mailing_list',
      marketing_status: 'subscribed',
      lawful_basis: 'manual_opt_in',
      consent_source: 'unsubscribe_page_resubscribe',
      consent_copy_version: 'v1',
      unsubscribe_token: token,
      consented_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
  }

  return { email, accountId, marketingStatus: 'subscribed' };
}
