import 'server-only';

import { normalizeCirculationEmail } from '~/lib/commercial/circulation/circulation-eligibility';
import {
  CIRCULATION_CONTACT_STATE_TABLE,
  DEFAULT_CIRCULATION_MIN_GAP_DAYS,
} from '~/lib/commercial/circulation/circulation.service';
import {
  type ConsentRowInput,
  type ContactCirculationFilter,
  type ContactCirculationStatus,
  type ContactCommsSummary,
  type ContactLastEmail,
  type ContactNewsletterStatus,
  matchesCirculationFilter,
  needsAttention,
  pickCirculationStatus,
  pickNewsletterStatus,
  resolveNotEmailedReason,
} from '~/lib/commercial/circulation/contact-comms';
import { loadRequirementRecipients } from '~/lib/commercial/circulation/contact-matches';
import { ACTIVE_REQUIREMENT_STAGES_FOR_MATCH } from '~/lib/commercial/match-scoring';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const PAGE = 1000;
const IN_CHUNK = 150;
const FAILURE_LOOKBACK_DAYS = 30;

export type ContactAudienceEntry = {
  clientId: string;
  requirementCount: number;
  activeRequirementCount: number;
  recipientEmails: string[];
  circulationStatus: ContactCirculationStatus;
  newsletterStatus: ContactNewsletterStatus;
  lastFailedAt: string | null;
  needsAttention: boolean;
};

export type ContactAudienceIndex = {
  clientIds: Set<string>;
  entries: Map<string, ContactAudienceEntry>;
  /** Email → the latest failed circulation send with no later successful send. */
  failedAtByEmail: Map<string, string>;
};

export type ContactAudienceView =
  | 'all'
  | 'requirements'
  | 'newsletter'
  | 'attention';

export type ContactAudienceCounts = {
  all: number;
  requirements: number;
  newsletter: number;
  attention: number;
  circulation: Record<ContactCirculationFilter, number>;
};

export function isMissingRelation(error: { code?: string; message?: string }) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(error?.message ?? '')
  );
}

async function fetchAllRows<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      if (isMissingRelation(error)) return rows;
      throw new Error(error.message);
    }
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** Latest-row lookups per address stay exact however many sends each address has. */
export async function forEachLimited<T>(
  items: T[],
  run: (item: T) => Promise<void>,
  concurrency = 8,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++]!;
        await run(item);
      }
    },
  );
  await Promise.all(workers);
}

export function chunk<T>(items: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function normalize(email: string | null | undefined): string | null {
  if (!email) return null;
  const value = normalizeCirculationEmail(email);
  return value.includes('@') ? value : null;
}

function toConsentRows(
  rows: Array<{
    email: string;
    client_id: string | null;
    marketing_status: string;
    auto_send_enabled?: boolean | null;
  }>,
): ConsentRowInput[] {
  return rows
    .map((row) => ({
      email: normalize(row.email) ?? '',
      clientId: row.client_id,
      marketingStatus: row.marketing_status,
      autoSendEnabled: row.auto_send_enabled ?? null,
    }))
    .filter((row) => row.email);
}

function groupConsent(rows: ConsentRowInput[]) {
  const byEmail = new Map<string, ConsentRowInput[]>();
  const byClient = new Map<string, ConsentRowInput[]>();
  for (const row of rows) {
    byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row]);
    if (row.clientId) {
      byClient.set(row.clientId, [...(byClient.get(row.clientId) ?? []), row]);
    }
  }
  return { byEmail, byClient };
}

function consentFor(
  grouped: ReturnType<typeof groupConsent>,
  clientId: string,
  emails: string[],
): ConsentRowInput[] {
  const seen = new Set<ConsentRowInput>();
  for (const row of grouped.byClient.get(clientId) ?? []) seen.add(row);
  for (const email of emails) {
    for (const row of grouped.byEmail.get(email) ?? []) seen.add(row);
  }
  return [...seen];
}

async function loadUnresolvedFailures(
  db: Db,
  accountId: string,
): Promise<Map<string, string>> {
  const since = new Date(
    Date.now() - FAILURE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const rows = await fetchAllRows<{
    email: string;
    status: string;
    created_at: string;
  }>((from, to) =>
    db
      .from('commercial_circulation_recipients')
      .select('email, status, created_at')
      .eq('account_id', accountId)
      .in('status', ['sent', 'failed'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(from, to),
  );

  const latestByEmail = new Map<string, { status: string; at: string }>();
  for (const row of rows) {
    const email = normalize(row.email);
    if (!email || latestByEmail.has(email)) continue;
    latestByEmail.set(email, { status: row.status, at: row.created_at });
  }

  const failed = new Map<string, string>();
  for (const [email, latest] of latestByEmail) {
    if (latest.status === 'failed') failed.set(email, latest.at);
  }
  return failed;
}

/**
 * Account-wide consent and requirement state per contact. Drives the Contacts
 * filters and their counts, so it reads every row rather than a page.
 */
export async function loadContactAudienceIndex(
  db: Db,
  accountId: string,
  options: { commercial: boolean },
): Promise<ContactAudienceIndex> {
  const [clients, requirements, circulationRows, newsletterRows, failures] =
    await Promise.all([
      fetchAllRows<{ id: string; email: string | null }>((from, to) =>
        db
          .from('clients')
          .select('id, email')
          .eq('account_id', accountId)
          .is('archived_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      ),
      options.commercial
        ? fetchAllRows<{
            id: string;
            client_id: string;
            contact_id: string | null;
            contact_email: string | null;
            contact_name: string | null;
            stage: string;
          }>((from, to) =>
            db
              .from('commercial_requirements')
              .select(
                'id, client_id, contact_id, contact_email, contact_name, stage',
              )
              .eq('account_id', accountId)
              .is('archived_at', null)
              .not('client_id', 'is', null)
              .order('id', { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([]),
      options.commercial
        ? fetchAllRows<{
            email: string;
            client_id: string | null;
            marketing_status: string;
            auto_send_enabled: boolean | null;
          }>((from, to) =>
            db
              .from('commercial_marketing_preferences')
              .select('email, client_id, marketing_status, auto_send_enabled')
              .eq('account_id', accountId)
              .eq('purpose', 'matching_disposals')
              .order('id', { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([]),
      fetchAllRows<{
        email: string;
        client_id: string | null;
        marketing_status: string;
      }>((from, to) =>
        db
          .from('workspace_mailing_preferences')
          .select('email, client_id, marketing_status')
          .eq('account_id', accountId)
          .eq('purpose', 'workspace_mailing_list')
          .order('id', { ascending: true })
          .range(from, to),
      ),
      options.commercial
        ? loadUnresolvedFailures(db, accountId)
        : Promise.resolve(new Map<string, string>()),
    ]);

  const recipients = options.commercial
    ? await loadRequirementRecipients(db, accountId, requirements)
    : new Map();

  const circulation = groupConsent(toConsentRows(circulationRows));
  const newsletter = groupConsent(toConsentRows(newsletterRows));
  const activeStages = new Set<string>(ACTIVE_REQUIREMENT_STAGES_FOR_MATCH);

  const reqsByClient = new Map<string, typeof requirements>();
  for (const req of requirements) {
    reqsByClient.set(req.client_id, [
      ...(reqsByClient.get(req.client_id) ?? []),
      req,
    ]);
  }

  const entries = new Map<string, ContactAudienceEntry>();
  for (const client of clients) {
    const reqs = reqsByClient.get(client.id) ?? [];
    const activeReqs = reqs.filter((req) => activeStages.has(req.stage));
    const recipientEmails = [
      ...new Set(
        activeReqs
          .map((req) => recipients.get(req.id)?.email as string | undefined)
          .filter((email): email is string => Boolean(email)),
      ),
    ];
    const clientEmail = normalize(client.email);
    const circulationPrimary = new Set(
      recipientEmails.length > 0
        ? recipientEmails
        : clientEmail
          ? [clientEmail]
          : [],
    );
    const lookupEmails = [
      ...new Set([...recipientEmails, ...(clientEmail ? [clientEmail] : [])]),
    ];

    const circulationStatus = pickCirculationStatus(
      consentFor(circulation, client.id, lookupEmails),
      circulationPrimary,
    );
    const newsletterStatus = pickNewsletterStatus(
      consentFor(newsletter, client.id, clientEmail ? [clientEmail] : []),
      new Set(clientEmail ? [clientEmail] : []),
    );
    const lastFailedAt =
      recipientEmails
        .map((email) => failures.get(email))
        .filter((at): at is string => Boolean(at))
        .sort()
        .at(-1) ?? null;

    entries.set(client.id, {
      clientId: client.id,
      requirementCount: reqs.length,
      activeRequirementCount: activeReqs.length,
      recipientEmails,
      circulationStatus,
      newsletterStatus,
      lastFailedAt,
      needsAttention: needsAttention({
        activeRequirementCount: activeReqs.length,
        hasRecipientEmail: recipientEmails.length > 0,
        circulationStatus,
        hasUnresolvedFailure: lastFailedAt !== null,
      }),
    });
  }

  return {
    clientIds: new Set(clients.map((client) => client.id)),
    entries,
    failedAtByEmail: failures,
  };
}

export function contactMatchesAudience(
  entry: ContactAudienceEntry | undefined,
  view: ContactAudienceView,
  circulationFilter?: ContactCirculationFilter,
): boolean {
  if (view === 'all') return true;
  if (!entry) return false;
  if (view === 'newsletter') return entry.newsletterStatus === 'subscribed';
  if (view === 'attention') return entry.needsAttention;
  if (entry.requirementCount === 0) return false;
  return circulationFilter
    ? matchesCirculationFilter(entry.circulationStatus, circulationFilter)
    : true;
}

export function countContactAudiences(
  index: ContactAudienceIndex,
): ContactAudienceCounts {
  const counts: ContactAudienceCounts = {
    all: index.clientIds.size,
    requirements: 0,
    newsletter: 0,
    attention: 0,
    circulation: {
      subscribed: 0,
      paused: 0,
      not_subscribed: 0,
      unsubscribed: 0,
    },
  };
  for (const entry of index.entries.values()) {
    if (entry.newsletterStatus === 'subscribed') counts.newsletter += 1;
    if (entry.needsAttention) counts.attention += 1;
    if (entry.requirementCount === 0) continue;
    counts.requirements += 1;
    for (const filter of Object.keys(
      counts.circulation,
    ) as ContactCirculationFilter[]) {
      if (matchesCirculationFilter(entry.circulationStatus, filter)) {
        counts.circulation[filter] += 1;
      }
    }
  }
  return counts;
}

type CirculationSentRow = {
  email: string;
  send_id: string;
  created_at: string;
};

type SendRow = {
  id: string;
  subject: string;
  send_kind: string;
  send_trigger: string;
  listing_id: string | null;
  listing_ids: string[] | null;
};

async function loadLatestCirculationSends(
  db: Db,
  accountId: string,
  emails: string[],
): Promise<Map<string, ContactLastEmail>> {
  const latestByEmail = new Map<string, CirculationSentRow>();
  let missingTable = false;
  await forEachLimited(emails, async (email) => {
    if (missingTable) return;
    const { data, error } = await db
      .from('commercial_circulation_recipients')
      .select('email, send_id, created_at')
      .eq('account_id', accountId)
      .eq('email', email)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) {
        missingTable = true;
        return;
      }
      throw new Error(error.message);
    }
    if (data) latestByEmail.set(email, data as CirculationSentRow);
  });
  if (latestByEmail.size === 0) return new Map();

  const sendIds = [
    ...new Set([...latestByEmail.values()].map((r) => r.send_id)),
  ];
  const sends = new Map<string, SendRow>();
  for (const part of chunk(sendIds)) {
    const { data, error } = await db
      .from('commercial_circulation_sends')
      .select('id, subject, send_kind, send_trigger, listing_id, listing_ids')
      .eq('account_id', accountId)
      .in('id', part);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as SendRow[]) sends.set(row.id, row);
  }

  const listingIdsFor = (send: SendRow) =>
    send.listing_ids?.length
      ? send.listing_ids
      : send.listing_id
        ? [send.listing_id]
        : [];

  const wantedListingIds = [
    ...new Set(
      [...sends.values()].flatMap((send) => listingIdsFor(send).slice(0, 1)),
    ),
  ];
  const listingNames = new Map<string, string>();
  for (const part of chunk(wantedListingIds)) {
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

  const result = new Map<string, ContactLastEmail>();
  for (const [email, row] of latestByEmail) {
    const send = sends.get(row.send_id);
    if (!send) continue;
    const ids = listingIdsFor(send);
    result.set(email, {
      kind:
        send.send_kind === 'digest'
          ? 'circulation_digest'
          : 'circulation_listing',
      sentAt: row.created_at,
      subject: send.subject,
      listingCount: ids.length,
      listingNames: ids
        .map((id) => listingNames.get(id))
        .filter((name): name is string => Boolean(name)),
      automatic: send.send_trigger === 'auto',
    });
  }
  return result;
}

type CampaignSentRow = {
  email: string;
  client_id: string | null;
  campaign_id: string;
  sent_at: string;
};

async function loadLatestCampaignSends(
  db: Db,
  accountId: string,
  clientIds: string[],
  emails: string[],
): Promise<{
  byClient: Map<string, ContactLastEmail>;
  byEmail: Map<string, ContactLastEmail>;
}> {
  const empty = { byClient: new Map(), byEmail: new Map() };
  const latest = async (column: 'client_id' | 'email', value: string) => {
    const { data, error } = await db
      .from('workspace_email_campaign_recipients')
      .select('email, client_id, campaign_id, sent_at')
      .eq('account_id', accountId)
      .eq(column, value)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return 'missing' as const;
      throw new Error(error.message);
    }
    return (data as CampaignSentRow | null) ?? null;
  };

  const latestByClient = new Map<string, CampaignSentRow>();
  const latestByEmail = new Map<string, CampaignSentRow>();
  let missingTable = false;
  await forEachLimited(clientIds, async (clientId) => {
    if (missingTable) return;
    const row = await latest('client_id', clientId);
    if (row === 'missing') missingTable = true;
    else if (row) latestByClient.set(clientId, row);
  });
  if (missingTable) return empty;
  await forEachLimited(emails, async (email) => {
    const row = await latest('email', email);
    if (row && row !== 'missing') latestByEmail.set(email, row);
  });
  if (latestByClient.size === 0 && latestByEmail.size === 0) return empty;

  const campaignIds = [
    ...new Set(
      [...latestByClient.values(), ...latestByEmail.values()].map(
        (row) => row.campaign_id,
      ),
    ),
  ];
  const subjects = new Map<string, string>();
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

  const toEmail = (row: CampaignSentRow): ContactLastEmail => ({
    kind: 'campaign',
    sentAt: row.sent_at,
    subject: subjects.get(row.campaign_id) ?? 'Campaign',
    listingCount: 0,
    listingNames: [],
    automatic: false,
  });

  return {
    byClient: new Map(
      [...latestByClient].map(([id, row]) => [id, toEmail(row)]),
    ),
    byEmail: new Map(
      [...latestByEmail].map(([email, row]) => [email, toEmail(row)]),
    ),
  };
}

export async function loadLastCirculatedAt(
  db: Db,
  accountId: string,
  emails: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const part of chunk(emails)) {
    const { data, error } = await db
      .from(CIRCULATION_CONTACT_STATE_TABLE)
      .select('email, last_circulated_at')
      .eq('account_id', accountId)
      .in('email', part)
      .not('last_circulated_at', 'is', null);
    if (error) {
      if (isMissingRelation(error)) return map;
      throw new Error(error.message);
    }
    for (const row of (data ?? []) as Array<{
      email: string;
      last_circulated_at: string;
    }>) {
      const email = normalize(row.email);
      if (email) map.set(email, row.last_circulated_at);
    }
  }
  return map;
}

export async function loadMinGapDays(
  db: Db,
  accountId: string,
): Promise<number> {
  const { data, error } = await db
    .from('commercial_circulation_settings')
    .select('min_gap_days')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) return DEFAULT_CIRCULATION_MIN_GAP_DAYS;
  return (
    (data as { min_gap_days?: number | null } | null)?.min_gap_days ??
    DEFAULT_CIRCULATION_MIN_GAP_DAYS
  );
}

function latest(
  ...emails: Array<ContactLastEmail | null | undefined>
): ContactLastEmail | null {
  return (
    emails
      .filter((email): email is ContactLastEmail => Boolean(email))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] ?? null
  );
}

export type RequirementCirculationState = {
  status: ContactCirculationStatus;
  email: string | null;
  lastCirculatedAt: string | null;
};

/** Circulation status and last send date for every live requirement, keyed by requirement id. */
export async function loadRequirementCirculationStates(
  db: Db,
  accountId: string,
): Promise<Record<string, RequirementCirculationState>> {
  const [requirements, prefRows] = await Promise.all([
    fetchAllRows<{
      id: string;
      client_id: string | null;
      contact_id: string | null;
      contact_email: string | null;
      contact_name: string | null;
    }>((from, to) =>
      db
        .from('commercial_requirements')
        .select('id, client_id, contact_id, contact_email, contact_name')
        .eq('account_id', accountId)
        .is('archived_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<{
      email: string;
      client_id: string | null;
      marketing_status: string;
      auto_send_enabled: boolean | null;
    }>((from, to) =>
      db
        .from('commercial_marketing_preferences')
        .select('email, client_id, marketing_status, auto_send_enabled')
        .eq('account_id', accountId)
        .eq('purpose', 'matching_disposals')
        .order('id', { ascending: true })
        .range(from, to),
    ),
  ]);

  const recipients = await loadRequirementRecipients(
    db,
    accountId,
    requirements,
  );
  const consent = groupConsent(toConsentRows(prefRows));
  const emails = [
    ...new Set([...recipients.values()].map((recipient) => recipient.email)),
  ];
  const lastCirculated = await loadLastCirculatedAt(db, accountId, emails);

  const result: Record<string, RequirementCirculationState> = {};
  for (const req of requirements) {
    const email = recipients.get(req.id)?.email ?? null;
    const rows = email ? (consent.byEmail.get(email) ?? []) : [];
    result[req.id] = {
      status: pickCirculationStatus(rows, new Set(email ? [email] : [])),
      email,
      lastCirculatedAt: email ? (lastCirculated.get(email) ?? null) : null,
    };
  }
  return result;
}

/** Per-page comms summary: consent, last Ozer email, and why they were not emailed. */
export async function loadContactCommsSummaries(
  db: Db,
  accountId: string,
  clients: Array<{ id: string; email: string | null }>,
  index: ContactAudienceIndex,
  options: { commercial: boolean },
): Promise<Map<string, ContactCommsSummary>> {
  if (clients.length === 0) return new Map();

  const emailsByClient = new Map<string, string[]>();
  for (const client of clients) {
    const entry = index.entries.get(client.id);
    const clientEmail = normalize(client.email);
    emailsByClient.set(client.id, [
      ...new Set([
        ...(entry?.recipientEmails ?? []),
        ...(clientEmail ? [clientEmail] : []),
      ]),
    ]);
  }
  const allEmails = [...new Set([...emailsByClient.values()].flat())];

  const [circulationSends, campaignSends, lastCirculated, minGapDays] =
    await Promise.all([
      options.commercial
        ? loadLatestCirculationSends(db, accountId, allEmails)
        : Promise.resolve(new Map<string, ContactLastEmail>()),
      loadLatestCampaignSends(
        db,
        accountId,
        clients.map((client) => client.id),
        allEmails,
      ),
      options.commercial
        ? loadLastCirculatedAt(db, accountId, allEmails)
        : Promise.resolve(new Map<string, string>()),
      options.commercial
        ? loadMinGapDays(db, accountId)
        : Promise.resolve(DEFAULT_CIRCULATION_MIN_GAP_DAYS),
    ]);

  const result = new Map<string, ContactCommsSummary>();
  for (const client of clients) {
    const entry = index.entries.get(client.id);
    const emails = emailsByClient.get(client.id) ?? [];
    const lastCirculation = latest(
      ...emails.map((email) => circulationSends.get(email)),
    );
    const lastEmail = latest(
      lastCirculation,
      campaignSends.byClient.get(client.id),
      ...emails.map((email) => campaignSends.byEmail.get(email)),
    );
    const recipientEmails = entry?.recipientEmails ?? [];
    const lastCirculatedAt =
      recipientEmails
        .map((email) => lastCirculated.get(email))
        .filter((at): at is string => Boolean(at))
        .sort()
        .at(-1) ?? null;

    result.set(client.id, {
      circulationStatus: entry?.circulationStatus ?? 'none',
      newsletterStatus: entry?.newsletterStatus ?? 'none',
      activeRequirementCount: entry?.activeRequirementCount ?? 0,
      lastEmail,
      notEmailedReason: options.commercial
        ? resolveNotEmailedReason({
            activeRequirementCount: entry?.activeRequirementCount ?? 0,
            hasRecipientEmail: recipientEmails.length > 0,
            circulationStatus: entry?.circulationStatus ?? 'none',
            lastCirculatedAt,
            lastFailedAt: entry?.lastFailedAt ?? null,
            lastSentAt: lastCirculation?.sentAt ?? null,
            minGapDays,
          })
        : null,
    });
  }
  return result;
}
