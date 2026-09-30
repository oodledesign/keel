import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type ConsentRowInput,
  type ContactCommsSummary,
  type ContactLastEmailKind,
  pickCirculationStatus,
  pickNewsletterStatus,
  resolveNotEmailedReason,
} from '~/lib/commercial/circulation/contact-comms';
import {
  chunk,
  isMissingRelation,
  loadLastCirculatedAt,
  loadMinGapDays,
  normalize,
} from '~/lib/commercial/circulation/contact-comms-summary';
import {
  listContactMatches,
  loadRequirementRecipients,
} from '~/lib/commercial/circulation/contact-matches';
import { ACTIVE_REQUIREMENT_STAGES_FOR_MATCH } from '~/lib/commercial/match-scoring';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const HISTORY_LIMIT = 60;

export type ContactConsentRecord = {
  email: string;
  status: string;
  autoSendEnabled: boolean | null;
  lawfulBasis: string;
  consentSource: string | null;
  consentedAt: string | null;
  unsubscribedAt: string | null;
  suppressedAt: string | null;
  suppressionReason: string | null;
};

export type ContactHistoryItem = {
  id: string;
  kind: ContactLastEmailKind;
  at: string;
  email: string;
  subject: string;
  status: string;
  reason: string | null;
  automatic: boolean;
  listings: Array<{ id: string; name: string }>;
  listingCount: number;
};

export type ContactRequirementComms = {
  requirementId: string;
  title: string;
  stage: string;
  active: boolean;
  recipientEmail: string | null;
  matchCount: number;
  sentCount: number;
};

export type ContactCommunications = {
  /** Address circulation and opt-in use: the first requirement recipient, else the contact email. */
  primaryEmail: string | null;
  circulation: ContactConsentRecord[];
  newsletter: ContactConsentRecord[];
  summary: ContactCommsSummary;
  history: ContactHistoryItem[];
  requirements: ContactRequirementComms[];
};

type ConsentDbRow = {
  email: string;
  client_id: string | null;
  marketing_status: string;
  auto_send_enabled?: boolean | null;
  lawful_basis: string;
  consent_source: string | null;
  consented_at: string | null;
  unsubscribed_at: string | null;
  suppressed_at: string | null;
  suppression_reason?: string | null;
};

async function loadConsentRows(
  db: Db,
  table: 'commercial_marketing_preferences' | 'workspace_mailing_preferences',
  accountId: string,
  clientId: string,
  emails: string[],
): Promise<ConsentDbRow[]> {
  const select =
    table === 'commercial_marketing_preferences'
      ? 'email, client_id, marketing_status, auto_send_enabled, lawful_basis, consent_source, consented_at, unsubscribed_at, suppressed_at, suppression_reason'
      : 'email, client_id, marketing_status, lawful_basis, consent_source, consented_at, unsubscribed_at, suppressed_at';
  const purpose =
    table === 'commercial_marketing_preferences'
      ? 'matching_disposals'
      : 'workspace_mailing_list';
  const base = () =>
    db
      .from(table)
      .select(select)
      .eq('account_id', accountId)
      .eq('purpose', purpose);

  const byKey = new Map<string, ConsentDbRow>();
  const collect = (result: {
    data: unknown;
    error: { code?: string; message?: string } | null;
  }) => {
    if (result.error) {
      if (isMissingRelation(result.error)) return;
      throw new Error(result.error.message);
    }
    for (const row of (result.data ?? []) as ConsentDbRow[]) {
      byKey.set(normalize(row.email) ?? row.email, row);
    }
  };

  collect(await base().eq('client_id', clientId));
  for (const part of chunk(emails)) {
    collect(await base().in('email', part));
  }
  return [...byKey.values()];
}

function toRecord(row: ConsentDbRow): ContactConsentRecord {
  return {
    email: normalize(row.email) ?? row.email,
    status: row.marketing_status,
    autoSendEnabled:
      row.auto_send_enabled === undefined ? null : row.auto_send_enabled,
    lawfulBasis: row.lawful_basis,
    consentSource: row.consent_source,
    consentedAt: row.consented_at,
    unsubscribedAt: row.unsubscribed_at,
    suppressedAt: row.suppressed_at,
    suppressionReason: row.suppression_reason ?? null,
  };
}

function toConsentInput(row: ConsentDbRow): ConsentRowInput {
  return {
    email: normalize(row.email) ?? '',
    clientId: row.client_id,
    marketingStatus: row.marketing_status,
    autoSendEnabled: row.auto_send_enabled ?? null,
  };
}

async function loadCirculationHistory(
  db: Db,
  accountId: string,
  emails: string[],
): Promise<ContactHistoryItem[]> {
  const recipients: Array<{
    id: string;
    email: string;
    send_id: string;
    status: string;
    skip_reason: string | null;
    error_message: string | null;
    created_at: string;
  }> = [];
  for (const part of chunk(emails)) {
    const { data, error } = await db
      .from('commercial_circulation_recipients')
      .select(
        'id, email, send_id, status, skip_reason, error_message, created_at',
      )
      .eq('account_id', accountId)
      .in('email', part)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT * 2);
    if (error) {
      if (isMissingRelation(error)) return [];
      throw new Error(error.message);
    }
    recipients.push(...(data ?? []));
  }
  const visible = recipients.filter((row) => row.skip_reason !== 'dry_run');
  if (visible.length === 0) return [];

  const sends = new Map<
    string,
    {
      subject: string;
      send_kind: string;
      send_trigger: string;
      listing_id: string | null;
      listing_ids: string[] | null;
    }
  >();
  for (const part of chunk([...new Set(visible.map((row) => row.send_id))])) {
    const { data, error } = await db
      .from('commercial_circulation_sends')
      .select('id, subject, send_kind, send_trigger, listing_id, listing_ids')
      .eq('account_id', accountId)
      .in('id', part);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) sends.set(row.id, row);
  }

  const listingIdsFor = (sendId: string) => {
    const send = sends.get(sendId);
    if (!send) return [] as string[];
    return send.listing_ids?.length
      ? send.listing_ids
      : send.listing_id
        ? [send.listing_id]
        : [];
  };

  const listingNames = new Map<string, string>();
  const allListingIds = [
    ...new Set(visible.flatMap((row) => listingIdsFor(row.send_id))),
  ];
  for (const part of chunk(allListingIds)) {
    const { data, error } = await db
      .from('commercial_listings')
      .select('id, name')
      .eq('account_id', accountId)
      .in('id', part);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{
      id: string;
      name: string | null;
    }>) {
      listingNames.set(row.id, row.name?.trim() || 'Property');
    }
  }

  return visible.flatMap((row) => {
    const send = sends.get(row.send_id);
    if (!send || send.send_trigger === 'dry_run') return [];
    const ids = listingIdsFor(row.send_id);
    return [
      {
        id: row.id,
        kind:
          send.send_kind === 'digest'
            ? ('circulation_digest' as const)
            : ('circulation_listing' as const),
        at: row.created_at,
        email: normalize(row.email) ?? row.email,
        subject: send.subject,
        status: row.status,
        reason: row.skip_reason ?? row.error_message ?? null,
        automatic: send.send_trigger === 'auto',
        listings: ids.map((id) => ({
          id,
          name: listingNames.get(id) ?? 'Property',
        })),
        listingCount: ids.length,
      },
    ];
  });
}

async function loadCampaignHistory(
  db: Db,
  accountId: string,
  clientId: string,
  emails: string[],
): Promise<ContactHistoryItem[]> {
  type Row = {
    id: string;
    email: string;
    campaign_id: string;
    status: string;
    skip_reason: string | null;
    error_message: string | null;
    sent_at: string | null;
    created_at: string;
  };
  const select =
    'id, email, campaign_id, status, skip_reason, error_message, sent_at, created_at';
  const byId = new Map<string, Row>();
  const collect = (result: {
    data: unknown;
    error: { code?: string; message?: string } | null;
  }) => {
    if (result.error) {
      if (isMissingRelation(result.error)) return false;
      throw new Error(result.error.message);
    }
    for (const row of (result.data ?? []) as Row[]) byId.set(row.id, row);
    return true;
  };
  const base = () =>
    db
      .from('workspace_email_campaign_recipients')
      .select(select)
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

  if (!collect(await base().eq('client_id', clientId))) return [];
  for (const part of chunk(emails)) {
    collect(await base().in('email', part));
  }
  if (byId.size === 0) return [];

  const subjects = new Map<string, string>();
  const campaignIds = [
    ...new Set([...byId.values()].map((r) => r.campaign_id)),
  ];
  for (const part of chunk(campaignIds)) {
    const { data, error } = await db
      .from('workspace_email_campaigns')
      .select('id, name, subject')
      .eq('account_id', accountId)
      .in('id', part);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as Array<{
      id: string;
      name: string;
      subject: string;
    }>) {
      subjects.set(row.id, row.subject?.trim() || row.name);
    }
  }

  return [...byId.values()].map((row) => ({
    id: row.id,
    kind: 'campaign' as const,
    at: row.sent_at ?? row.created_at,
    email: normalize(row.email) ?? row.email,
    subject: subjects.get(row.campaign_id) ?? 'Campaign',
    status: row.status,
    reason: row.skip_reason ?? row.error_message ?? null,
    automatic: false,
    listings: [],
    listingCount: 0,
  }));
}

async function loadSentListingIds(
  db: Db,
  accountId: string,
  emails: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const part of chunk(emails)) {
    const { data, error } = await db
      .from('commercial_circulation_sent_listings')
      .select('email, listing_id')
      .eq('account_id', accountId)
      .in('email', part)
      .limit(5000);
    if (error) {
      if (isMissingRelation(error)) return map;
      throw new Error(error.message);
    }
    for (const row of (data ?? []) as Array<{
      email: string;
      listing_id: string;
    }>) {
      const email = normalize(row.email);
      if (!email) continue;
      const set = map.get(email) ?? new Set<string>();
      set.add(row.listing_id);
      map.set(email, set);
    }
  }
  return map;
}

/**
 * Addresses that belong to a contact: their own email, linked people, and
 * what their requirements resolve to. Guards consent changes from the
 * contact page against editing someone else's address.
 */
export async function loadContactEmailSet(
  client: SupabaseClient,
  input: { accountId: string; clientId: string },
): Promise<Set<string>> {
  const db = client as Db;
  const [{ data: contact }, { data: links }, { data: reqRows }] =
    await Promise.all([
      db
        .from('clients')
        .select('email')
        .eq('id', input.clientId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
      db
        .from('client_contacts')
        .select('contacts(email)')
        .eq('client_id', input.clientId),
      db
        .from('commercial_requirements')
        .select('id, client_id, contact_id, contact_email, contact_name')
        .eq('account_id', input.accountId)
        .eq('client_id', input.clientId)
        .is('archived_at', null),
    ]);
  if (!contact) return new Set();

  const recipients = await loadRequirementRecipients(
    db,
    input.accountId,
    reqRows ?? [],
  );
  const emails = new Set<string>();
  const add = (email: string | null | undefined) => {
    const value = normalize(email);
    if (value) emails.add(value);
  };
  add(contact.email);
  for (const row of (links ?? []) as Array<{ contacts: unknown }>) {
    for (const person of Array.isArray(row.contacts)
      ? row.contacts
      : [row.contacts]) {
      add((person as { email?: string | null } | null)?.email);
    }
  }
  for (const recipient of recipients.values()) add(recipient.email);
  return emails;
}

/** Everything the contact page Emails tab shows for one contact. */
export async function loadContactCommunications(
  client: SupabaseClient,
  input: { accountId: string; clientId: string },
): Promise<ContactCommunications | null> {
  const db = client as Db;
  const { data: contact, error: contactError } = await db
    .from('clients')
    .select('id, email')
    .eq('id', input.clientId)
    .eq('account_id', input.accountId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);
  if (!contact) return null;

  const [{ data: reqRows, error: reqError }, { data: links }] =
    await Promise.all([
      db
        .from('commercial_requirements')
        .select(
          'id, client_id, contact_id, contact_email, contact_name, company_name, stage, updated_at',
        )
        .eq('account_id', input.accountId)
        .eq('client_id', input.clientId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false }),
      db
        .from('client_contacts')
        .select('contacts(email)')
        .eq('client_id', input.clientId),
    ]);
  if (reqError) throw new Error(reqError.message);

  const requirements = (reqRows ?? []) as Array<{
    id: string;
    client_id: string | null;
    contact_id: string | null;
    contact_email: string | null;
    contact_name: string | null;
    company_name: string | null;
    stage: string;
  }>;
  const recipients = await loadRequirementRecipients(
    db,
    input.accountId,
    requirements,
  );
  const activeStages = new Set<string>(ACTIVE_REQUIREMENT_STAGES_FOR_MATCH);
  const activeReqs = requirements.filter((req) => activeStages.has(req.stage));
  const recipientEmails = [
    ...new Set(
      activeReqs
        .map((req) => recipients.get(req.id)?.email)
        .filter((email): email is string => Boolean(email)),
    ),
  ];
  const clientEmail = normalize(contact.email);
  const linkedEmails = ((links ?? []) as Array<{ contacts: unknown }>)
    .flatMap((row) =>
      Array.isArray(row.contacts) ? row.contacts : [row.contacts],
    )
    .map((person) => normalize((person as { email?: string | null })?.email))
    .filter((email): email is string => Boolean(email));
  const allEmails = [
    ...new Set([
      ...recipientEmails,
      ...(clientEmail ? [clientEmail] : []),
      ...linkedEmails,
    ]),
  ];
  const primaryEmail = recipientEmails[0] ?? clientEmail ?? null;

  const [
    circulationRows,
    newsletterRows,
    circulationHistory,
    campaignHistory,
    lastCirculated,
    minGapDays,
    sentListings,
    matchRows,
  ] = await Promise.all([
    loadConsentRows(
      db,
      'commercial_marketing_preferences',
      input.accountId,
      input.clientId,
      allEmails,
    ),
    loadConsentRows(
      db,
      'workspace_mailing_preferences',
      input.accountId,
      input.clientId,
      allEmails,
    ),
    loadCirculationHistory(db, input.accountId, allEmails),
    loadCampaignHistory(db, input.accountId, input.clientId, allEmails),
    loadLastCirculatedAt(db, input.accountId, recipientEmails),
    loadMinGapDays(db, input.accountId),
    loadSentListingIds(db, input.accountId, recipientEmails),
    Promise.all(
      recipientEmails.map((email) =>
        listContactMatches(client, { accountId: input.accountId, email }),
      ),
    ),
  ]);

  const history = [...circulationHistory, ...campaignHistory]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, HISTORY_LIMIT);

  const circulationPrimary = new Set(
    recipientEmails.length > 0
      ? recipientEmails
      : primaryEmail
        ? [primaryEmail]
        : [],
  );
  const circulationStatus = pickCirculationStatus(
    circulationRows.map(toConsentInput),
    circulationPrimary,
  );
  const newsletterStatus = pickNewsletterStatus(
    newsletterRows.map(toConsentInput),
    new Set(clientEmail ? [clientEmail] : []),
  );

  const sentHistory = history.filter((item) => item.status === 'sent');
  const lastCirculationSent = sentHistory.find(
    (item) => item.kind !== 'campaign',
  );
  const lastCirculationFailed = history.find(
    (item) => item.kind !== 'campaign' && item.status === 'failed',
  );
  const lastCirculatedAt =
    recipientEmails
      .map((email) => lastCirculated.get(email))
      .filter((at): at is string => Boolean(at))
      .sort()
      .at(-1) ?? null;
  const lastSent = sentHistory[0] ?? null;

  const summary: ContactCommsSummary = {
    circulationStatus,
    newsletterStatus,
    activeRequirementCount: activeReqs.length,
    lastEmail: lastSent
      ? {
          kind: lastSent.kind,
          sentAt: lastSent.at,
          subject: lastSent.subject,
          listingCount: lastSent.listingCount,
          listingNames: lastSent.listings.map((listing) => listing.name),
          automatic: lastSent.automatic,
        }
      : null,
    notEmailedReason: resolveNotEmailedReason({
      activeRequirementCount: activeReqs.length,
      hasRecipientEmail: recipientEmails.length > 0,
      circulationStatus,
      lastCirculatedAt,
      lastFailedAt: lastCirculationFailed?.at ?? null,
      lastSentAt: lastCirculationSent?.at ?? null,
      minGapDays,
    }),
  };

  const matchesByRequirement = new Map<string, Set<string>>();
  for (const row of matchRows.flat()) {
    for (const listing of row.listings) {
      for (const reqId of listing.requirementIds) {
        const set = matchesByRequirement.get(reqId) ?? new Set<string>();
        set.add(listing.listingId);
        matchesByRequirement.set(reqId, set);
      }
    }
  }

  return {
    primaryEmail,
    circulation: circulationRows.map(toRecord),
    newsletter: newsletterRows.map(toRecord),
    summary,
    history,
    requirements: requirements.map((req) => {
      const recipientEmail = recipients.get(req.id)?.email ?? null;
      const matches = matchesByRequirement.get(req.id) ?? new Set<string>();
      const sent = recipientEmail
        ? (sentListings.get(recipientEmail) ?? new Set<string>())
        : new Set<string>();
      return {
        requirementId: req.id,
        title:
          req.company_name?.trim() || req.contact_name?.trim() || 'Requirement',
        stage: req.stage,
        active: activeStages.has(req.stage),
        recipientEmail,
        matchCount: matches.size,
        sentCount: [...matches].filter((id) => sent.has(id)).length,
      };
    }),
  };
}
