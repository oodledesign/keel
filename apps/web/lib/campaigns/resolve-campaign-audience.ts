import 'server-only';

import { randomBytes } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { listWorkspaceMailingListSubscribers } from '~/lib/workspace-forms/workspace-mailing-list';

import {
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  normalizeAudienceEmails,
  parseCampaignAudienceConfig,
  parseCampaignAudienceType,
} from './campaign-audience';

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

  const { data, error } = await fromTable(client, 'workspace_mailing_preferences')
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
  candidate: Omit<ResolvedCampaignRecipient, 'preferenceId' | 'unsubscribeToken'> & {
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
): Promise<Array<{ id: string; email: string; displayName: string | null }>> {
  let query = fromTable(client, 'clients')
    .select('id, email, display_name, company_name, first_name, last_name')
    .eq('account_id', accountId)
    .not('email', 'is', null)
    .is('archived_at', null);

  if (clientIds && clientIds.length > 0) {
    query = query.in('id', clientIds);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const email = String(row.email ?? '')
        .trim()
        .toLowerCase();
      if (!email) return null;
      const displayName =
        String(row.display_name ?? '').trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        String(row.company_name ?? '').trim() ||
        null;
      return {
        id: String(row.id),
        email,
        displayName: displayName || null,
      };
    })
    .filter((row): row is { id: string; email: string; displayName: string | null } =>
      Boolean(row),
    );
}

async function listContactsWithEmail(
  client: SupabaseClient,
  accountId: string,
  contactIds?: string[],
): Promise<Array<{ id: string; email: string; displayName: string | null }>> {
  let query = fromTable(client, 'contacts')
    .select('id, email, full_name, first_name, last_name')
    .eq('account_id', accountId)
    .not('email', 'is', null);

  if (contactIds && contactIds.length > 0) {
    query = query.in('id', contactIds);
  }

  const { data, error } = await query.limit(5000);
  if (error) {
    // Older workspaces may lack account_id on contacts; fail soft for estimate.
    console.warn('[campaigns] list contacts failed', error.message);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const email = String(row.email ?? '')
        .trim()
        .toLowerCase();
      if (!email) return null;
      const displayName =
        String(row.full_name ?? '').trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        null;
      return {
        id: String(row.id),
        email,
        displayName: displayName || null,
      };
    })
    .filter((row): row is { id: string; email: string; displayName: string | null } =>
      Boolean(row),
    );
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

/**
 * Unsubscribe via a campaign recipient token (clients/custom without preference).
 * Creates/updates a mailing preference as unsubscribed so future sends skip them.
 */
export async function unsubscribeCampaignRecipientByToken(
  client: SupabaseClient,
  token: string,
): Promise<{ email: string; accountId: string } | null> {
  if (!token || token.length < 16 || token === 'campaign-test-preview') {
    return null;
  }

  const { data: recipient } = await fromTable(
    client,
    'workspace_email_campaign_recipients',
  )
    .select('id, account_id, email')
    .eq('unsubscribe_token', token)
    .limit(1)
    .maybeSingle();

  if (!recipient) return null;

  const email = String(recipient.email).trim().toLowerCase();
  const accountId = String(recipient.account_id);

  await fromTable(client, 'workspace_email_campaign_recipients')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null);

  const prefs = fromTable(client, 'workspace_mailing_preferences');
  const { data: existing } = await prefs
    .select('id')
    .eq('account_id', accountId)
    .eq('email', email)
    .eq('purpose', 'workspace_mailing_list')
    .maybeSingle();

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

  return { email, accountId };
}
