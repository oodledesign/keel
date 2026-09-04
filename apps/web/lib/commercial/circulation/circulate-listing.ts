import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type AccountBrandResolved,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import {
  type CirculationConsentStatus,
  isCirculationAutoEligible,
  isCirculationBlocked,
  normalizeCirculationEmail,
} from '~/lib/commercial/circulation/circulation-eligibility';
import {
  type CirculationEmailBrand,
  buildCirculationEmailHtml,
} from '~/lib/commercial/circulation/circulation-email';
import {
  createCirculationUnsubscribeToken,
  createCommercialCirculationService,
  sendCirculationEmailViaSes,
} from '~/lib/commercial/circulation/circulation.service';
import { loadListingCoverUrlsForDigest } from '~/lib/commercial/commercial-match-digest';
import { resolveSiteUrlForPublicMedia } from '~/lib/commercial/listing-media-public-url';
import { isPublicListingPageUrl } from '~/lib/commercial/listing-website-url';
import {
  type MatchListingSnapshot,
  type MatchRequirementSnapshot,
  scoreListingRequirementMatch,
} from '~/lib/commercial/match-scoring';
import {
  getPlatformSesFrom,
  loadAccountSendingDomain,
  resolveWorkspaceMailFrom,
} from '~/lib/sending-domains/server';

export type CirculationCandidate = {
  requirementId: string;
  email: string;
  contactName: string | null;
  companyName: string | null;
  score: number;
  reasons: string[];
  subscribed: boolean;
  blocked: boolean;
  consentStatus: CirculationConsentStatus;
};

export type CirculationIdentity = {
  agencyName: string;
  fromName: string;
  fromEmail: string | null;
  replyTo: string | null;
  brand: AccountBrandResolved;
  sesTenantName: string | null;
  sesConfigurationSet: string | null;
};

export type CirculationSendTrigger = 'manual' | 'auto' | 'dry_run';

export type CirculationSendLog = {
  id: string;
  subject: string;
  sendTrigger: CirculationSendTrigger;
  fromEmail: string | null;
  fromName: string | null;
  recipientCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  complaintCount: number;
  createdAt: string;
  recipients: Array<{
    id: string;
    email: string;
    status: string;
    skipReason: string | null;
    errorMessage: string | null;
    sesMessageId: string | null;
    deliveredAt: string | null;
    openedAt: string | null;
    openCount: number;
    clickedAt: string | null;
    clickCount: number;
    bouncedAt: string | null;
    bounceType: string | null;
    complaintAt: string | null;
    createdAt: string;
  }>;
};

function asListingSnapshot(row: Record<string, unknown>): MatchListingSnapshot {
  return {
    id: row.id as string,
    name: (row.name as string) ?? 'Property',
    sector: (row.sector as string | null) ?? null,
    disposalType:
      (row.disposal_type as MatchListingSnapshot['disposalType']) ?? 'to_let',
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    sizeMinSqft: row.size_min_sqft != null ? Number(row.size_min_sqft) : null,
    sizeMaxSqft: row.size_max_sqft != null ? Number(row.size_max_sqft) : null,
    askingRentPence:
      row.asking_rent_pence != null ? Number(row.asking_rent_pence) : null,
    askingRentToPence:
      row.asking_rent_to_pence != null
        ? Number(row.asking_rent_to_pence)
        : null,
    askingPricePence:
      row.asking_price_pence != null ? Number(row.asking_price_pence) : null,
    status: (row.status as string) ?? 'draft',
  };
}

function asRequirementSnapshot(
  row: Record<string, unknown>,
): MatchRequirementSnapshot {
  return {
    id: row.id as string,
    companyName: (row.company_name as string | null) ?? null,
    contactName: (row.contact_name as string | null) ?? null,
    sector: (row.sector as string | null) ?? null,
    tenure: (row.tenure as MatchRequirementSnapshot['tenure']) ?? null,
    locationText: (row.location_text as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    searchRadiusMiles:
      row.search_radius_miles != null ? Number(row.search_radius_miles) : null,
    sizeMinSqft: row.size_min_sqft != null ? Number(row.size_min_sqft) : null,
    sizeMaxSqft: row.size_max_sqft != null ? Number(row.size_max_sqft) : null,
    budgetMinPence:
      row.budget_min_pence != null ? Number(row.budget_min_pence) : null,
    budgetMaxPence:
      row.budget_max_pence != null ? Number(row.budget_max_pence) : null,
    notes: (row.notes as string | null) ?? null,
    stage: (row.stage as string) ?? 'new',
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export async function listCirculationCandidates(
  client: SupabaseClient,
  input: { accountId: string; listingId: string; minScore?: number },
): Promise<CirculationCandidate[]> {
  const minScore = input.minScore ?? 35;

  const { data: listing, error: listingError } = await client
    .from('commercial_listings')
    .select(
      'id, name, sector, disposal_type, town, postcode, address_line_1, latitude, longitude, size_min_sqft, size_max_sqft, asking_rent_pence, asking_rent_to_pence, asking_price_pence, status, summary, description, account_id',
    )
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }

  const { data: requirements, error: reqError } = await client
    .from('commercial_requirements')
    .select('*')
    .eq('account_id', input.accountId)
    .not('contact_email', 'is', null)
    .in('stage', [
      'new',
      'actively_searching',
      'search',
      'prospect',
      'unactioned',
    ]);

  if (reqError) throw new Error(reqError.message);

  const listingSnap = asListingSnapshot(listing as Record<string, unknown>);
  const circulation = createCommercialCirculationService(client);
  const rows = (requirements ?? []) as Array<Record<string, unknown>>;
  const emails = rows
    .map((row) => normalizeCirculationEmail(String(row.contact_email ?? '')))
    .filter(Boolean);
  const statuses = await circulation.getPreferenceStatuses(
    input.accountId,
    emails,
  );
  const candidates: CirculationCandidate[] = [];

  for (const row of rows) {
    const email = normalizeCirculationEmail(String(row.contact_email ?? ''));
    if (!email) continue;

    const score = scoreListingRequirementMatch(
      listingSnap,
      asRequirementSnapshot(row),
    );
    if (score.score < minScore) continue;

    const consentStatus = statuses.get(email) ?? 'unknown';
    candidates.push({
      requirementId: row.id as string,
      email,
      contactName: (row.contact_name as string | null) ?? null,
      companyName: (row.company_name as string | null) ?? null,
      score: score.score,
      reasons: score.reasons,
      subscribed: consentStatus === 'subscribed',
      blocked: isCirculationBlocked(consentStatus),
      consentStatus,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function resolveCirculationIdentity(
  client: SupabaseClient,
  accountId: string,
): Promise<CirculationIdentity> {
  const { data: account } = await client
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();

  const agencyName =
    (account as { name?: string | null } | null)?.name?.trim() || 'Agency';
  const [brand, sendingDomain] = await Promise.all([
    loadAccountBrandResolved(accountId),
    loadAccountSendingDomain(client, accountId),
  ]);
  const resolved = resolveWorkspaceMailFrom({
    accountName: agencyName,
    brandContactEmail: brand.contact_email,
    sendingDomain,
    platformFrom: getPlatformSesFrom(),
  });

  return {
    agencyName,
    fromName: resolved.fromName,
    fromEmail: resolved.fromEmail,
    replyTo: resolved.replyTo,
    brand,
    sesTenantName: resolved.sesTenantName,
    sesConfigurationSet: resolved.sesConfigurationSet,
  };
}

function toEmailBrand(identity: CirculationIdentity): CirculationEmailBrand {
  return {
    agencyName: identity.agencyName,
    logoUrl: identity.brand.logo_url,
    primaryColor: identity.brand.primary_color,
    secondaryColor: identity.brand.secondary_color,
    accentColor: identity.brand.accent_color,
    websiteUrl: identity.brand.website_url,
    address: identity.brand.address,
    phone: identity.brand.phone,
  };
}

export async function listAlreadySentEmails(
  client: SupabaseClient,
  input: { accountId: string; listingId: string },
): Promise<Set<string>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data, error } = await db
    .from('commercial_circulation_recipients')
    .select('email, status, commercial_circulation_sends!inner(listing_id)')
    .eq('account_id', input.accountId)
    .eq('status', 'sent')
    .eq('commercial_circulation_sends.listing_id', input.listingId);

  if (error) {
    const { data: sends } = await db
      .from('commercial_circulation_sends')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('listing_id', input.listingId);

    const sendIds = ((sends ?? []) as Array<{ id: string }>).map((s) => s.id);
    if (sendIds.length === 0) return new Set();

    const { data: recipients, error: recError } = await db
      .from('commercial_circulation_recipients')
      .select('email')
      .eq('account_id', input.accountId)
      .eq('status', 'sent')
      .in('send_id', sendIds);

    if (recError) throw new Error(recError.message);
    return new Set(
      ((recipients ?? []) as Array<{ email: string }>).map((r) =>
        normalizeCirculationEmail(r.email),
      ),
    );
  }

  return new Set(
    ((data ?? []) as Array<{ email: string }>).map((r) =>
      normalizeCirculationEmail(r.email),
    ),
  );
}

export async function listCirculationSends(
  client: SupabaseClient,
  input: { accountId: string; listingId: string; limit?: number },
): Promise<CirculationSendLog[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data: sends, error } = await db
    .from('commercial_circulation_sends')
    .select(
      'id, subject, send_trigger, from_email, from_name, recipient_count, delivered_count, open_count, click_count, bounce_count, complaint_count, created_at',
    )
    .eq('account_id', input.accountId)
    .eq('listing_id', input.listingId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 12);

  if (error) throw new Error(error.message);
  const sendRows = (sends ?? []) as Array<Record<string, unknown>>;
  if (sendRows.length === 0) return [];

  const sendIds = sendRows.map((row) => row.id as string);
  const { data: recipients, error: recError } = await db
    .from('commercial_circulation_recipients')
    .select(
      'id, send_id, email, status, skip_reason, error_message, ses_message_id, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, complaint_at, created_at',
    )
    .eq('account_id', input.accountId)
    .in('send_id', sendIds)
    .order('created_at', { ascending: true });

  if (recError) throw new Error(recError.message);

  const bySend = new Map<string, CirculationSendLog['recipients']>();
  for (const row of (recipients ?? []) as Array<Record<string, unknown>>) {
    const sendId = row.send_id as string;
    const list = bySend.get(sendId) ?? [];
    list.push({
      id: row.id as string,
      email: row.email as string,
      status: row.status as string,
      skipReason: (row.skip_reason as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      sesMessageId: (row.ses_message_id as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      openedAt: (row.opened_at as string | null) ?? null,
      openCount: Number(row.open_count ?? 0),
      clickedAt: (row.clicked_at as string | null) ?? null,
      clickCount: Number(row.click_count ?? 0),
      bouncedAt: (row.bounced_at as string | null) ?? null,
      bounceType: (row.bounce_type as string | null) ?? null,
      complaintAt: (row.complaint_at as string | null) ?? null,
      createdAt: row.created_at as string,
    });
    bySend.set(sendId, list);
  }

  return sendRows.map((row) => ({
    id: row.id as string,
    subject: row.subject as string,
    sendTrigger: (row.send_trigger as CirculationSendTrigger) ?? 'manual',
    fromEmail: (row.from_email as string | null) ?? null,
    fromName: (row.from_name as string | null) ?? null,
    recipientCount: Number(row.recipient_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    openCount: Number(row.open_count ?? 0),
    clickCount: Number(row.click_count ?? 0),
    bounceCount: Number(row.bounce_count ?? 0),
    complaintCount: Number(row.complaint_count ?? 0),
    createdAt: row.created_at as string,
    recipients: bySend.get(row.id as string) ?? [],
  }));
}

export type AccountCirculationSendLog = CirculationSendLog & {
  sendKind: 'listing' | 'digest';
  listingId: string | null;
  listingIds: string[];
};

export async function listAccountCirculationSends(
  client: SupabaseClient,
  input: { accountId: string; limit?: number },
): Promise<AccountCirculationSendLog[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data: sends, error } = await db
    .from('commercial_circulation_sends')
    .select(
      'id, listing_id, listing_ids, send_kind, subject, send_trigger, from_email, from_name, recipient_count, delivered_count, open_count, click_count, bounce_count, complaint_count, created_at',
    )
    .eq('account_id', input.accountId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 30);

  if (error) throw new Error(error.message);
  const sendRows = (sends ?? []) as Array<Record<string, unknown>>;
  if (sendRows.length === 0) return [];

  const sendIds = sendRows.map((row) => row.id as string);
  const { data: recipients, error: recError } = await db
    .from('commercial_circulation_recipients')
    .select(
      'id, send_id, email, status, skip_reason, error_message, ses_message_id, delivered_at, opened_at, open_count, clicked_at, click_count, bounced_at, bounce_type, complaint_at, created_at',
    )
    .eq('account_id', input.accountId)
    .in('send_id', sendIds)
    .order('created_at', { ascending: true });

  if (recError) throw new Error(recError.message);

  const bySend = new Map<string, CirculationSendLog['recipients']>();
  for (const row of (recipients ?? []) as Array<Record<string, unknown>>) {
    const sendId = row.send_id as string;
    const list = bySend.get(sendId) ?? [];
    list.push({
      id: row.id as string,
      email: row.email as string,
      status: row.status as string,
      skipReason: (row.skip_reason as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      sesMessageId: (row.ses_message_id as string | null) ?? null,
      deliveredAt: (row.delivered_at as string | null) ?? null,
      openedAt: (row.opened_at as string | null) ?? null,
      openCount: Number(row.open_count ?? 0),
      clickedAt: (row.clicked_at as string | null) ?? null,
      clickCount: Number(row.click_count ?? 0),
      bouncedAt: (row.bounced_at as string | null) ?? null,
      bounceType: (row.bounce_type as string | null) ?? null,
      complaintAt: (row.complaint_at as string | null) ?? null,
      createdAt: row.created_at as string,
    });
    bySend.set(sendId, list);
  }

  return sendRows.map((row) => ({
    id: row.id as string,
    listingId: (row.listing_id as string | null) ?? null,
    listingIds: Array.isArray(row.listing_ids)
      ? (row.listing_ids as string[])
      : [],
    sendKind: (row.send_kind as 'listing' | 'digest') ?? 'listing',
    subject: row.subject as string,
    sendTrigger: (row.send_trigger as CirculationSendTrigger) ?? 'manual',
    fromEmail: (row.from_email as string | null) ?? null,
    fromName: (row.from_name as string | null) ?? null,
    recipientCount: Number(row.recipient_count ?? 0),
    deliveredCount: Number(row.delivered_count ?? 0),
    openCount: Number(row.open_count ?? 0),
    clickCount: Number(row.click_count ?? 0),
    bounceCount: Number(row.bounce_count ?? 0),
    complaintCount: Number(row.complaint_count ?? 0),
    createdAt: row.created_at as string,
    recipients: bySend.get(row.id as string) ?? [],
  }));
}

export async function circulateListing(
  client: SupabaseClient,
  input: {
    accountId: string;
    listingId: string;
    requirementIds: string[];
    sentBy: string | null;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    siteUrl: string;
    dryRun?: boolean;
    sendTrigger?: CirculationSendTrigger;
    skipAlreadySent?: boolean;
  },
): Promise<{
  sendId: string;
  sent: number;
  skipped: number;
  failed: number;
  dryRunEligible: number;
}> {
  if (input.requirementIds.length === 0) {
    throw new Error('Select at least one recipient');
  }
  if (input.requirementIds.length > 200) {
    throw new Error('Too many recipients (max 200 per send)');
  }

  const { data: listing, error: listingError } = await client
    .from('commercial_listings')
    .select(
      'id, name, summary, description, address_line_1, address_line_2, town, county, postcode, account_id, brochure_share_token, brochure_share_enabled, website_url',
    )
    .eq('id', input.listingId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  if (listingError || !listing) {
    throw new Error(listingError?.message ?? 'Listing not found');
  }

  const identity = await resolveCirculationIdentity(client, input.accountId);
  const sendingDomain = await loadAccountSendingDomain(client, input.accountId);
  const resolved = resolveWorkspaceMailFrom({
    accountName: identity.agencyName,
    brandContactEmail: identity.brand.contact_email,
    proposedFromEmail: input.fromEmail,
    proposedFromName: input.fromName,
    sendingDomain,
    platformFrom: getPlatformSesFrom(),
  });
  const fromEmail = resolved.fromEmail;
  if (!fromEmail) {
    throw new Error(
      'Add a verified sending domain in workspace settings, or set a contact email that can send from Ozer.',
    );
  }
  const fromName = resolved.fromName;
  const replyTo =
    input.replyTo?.trim() ||
    resolved.replyTo ||
    identity.brand.contact_email?.trim() ||
    fromEmail;
  const sendTrigger: CirculationSendTrigger = input.dryRun
    ? 'dry_run'
    : (input.sendTrigger ?? 'manual');

  const { data: requirements, error: reqError } = await client
    .from('commercial_requirements')
    .select('id, contact_email, contact_name, company_name')
    .eq('account_id', input.accountId)
    .in('id', input.requirementIds);

  if (reqError) throw new Error(reqError.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const subject = `Matching opportunity: ${(listing as { name: string }).name}`;

  const { data: sendRow, error: sendError } = await db
    .from('commercial_circulation_sends')
    .insert({
      account_id: input.accountId,
      listing_id: input.listingId,
      sent_by: input.sentBy,
      subject,
      template_version: 'v2-brand',
      recipient_count: 0,
      send_trigger: sendTrigger,
      from_email: fromEmail,
      from_name: fromName,
      reply_to: replyTo,
    })
    .select('id')
    .single();

  if (sendError) throw new Error(sendError.message);
  const sendId = sendRow.id as string;

  const circulation = createCommercialCirculationService(client);
  const reqRows = (requirements ?? []) as Array<{
    id: string;
    contact_email?: string | null;
    contact_name?: string | null;
    company_name?: string | null;
  }>;
  const preferenceStatuses = await circulation.getPreferenceStatuses(
    input.accountId,
    reqRows.map((r) => String(r.contact_email ?? '')),
  );
  const alreadySent = input.skipAlreadySent
    ? await listAlreadySentEmails(client, {
        accountId: input.accountId,
        listingId: input.listingId,
      })
    : new Set<string>();
  const emailBrand = toEmailBrand(identity);

  const listingAddr = [
    (listing as { address_line_1?: string | null }).address_line_1,
    (listing as { address_line_2?: string | null }).address_line_2,
    (listing as { town?: string | null }).town,
    (listing as { county?: string | null }).county,
    (listing as { postcode?: string | null }).postcode,
  ]
    .filter(Boolean)
    .join(', ');

  const summary =
    (listing as { summary?: string | null }).summary?.trim() ||
    (listing as { description?: string | null }).description
      ?.trim()
      ?.slice(0, 600) ||
    '';

  const brochureToken = (listing as { brochure_share_token?: string | null })
    .brochure_share_token;
  const brochureEnabled = Boolean(
    (listing as { brochure_share_enabled?: boolean }).brochure_share_enabled,
  );
  const brochureUrl =
    brochureEnabled && brochureToken
      ? new URL(`/share/brochure/${brochureToken}`, input.siteUrl).toString()
      : null;

  const listingWebsiteUrl = (
    listing as { website_url?: string | null }
  ).website_url?.trim();
  let propertyHiveUrl: string | null = null;
  {
    const { data: phRow } = await db
      .from('commercial_portal_publications')
      .select('external_url, status')
      .eq('account_id', input.accountId)
      .eq('listing_id', input.listingId)
      .eq('portal', 'property_hive')
      .maybeSingle();
    const status = String(
      (phRow as { status?: string | null } | null)?.status ?? '',
    )
      .trim()
      .toLowerCase();
    const url = (
      phRow as { external_url?: string | null } | null
    )?.external_url?.trim();
    if (
      url &&
      isPublicListingPageUrl(url) &&
      ['published', 'live', 'synced'].includes(status)
    ) {
      propertyHiveUrl = url;
    }
  }

  const websiteListingUrl =
    listingWebsiteUrl && isPublicListingPageUrl(listingWebsiteUrl)
      ? listingWebsiteUrl
      : propertyHiveUrl;
  const viewUrl = websiteListingUrl ?? brochureUrl;
  const viewUrlLabel = websiteListingUrl
    ? 'View on website'
    : brochureUrl
      ? 'View details'
      : null;

  const mediaOrigin =
    resolveSiteUrlForPublicMedia() ?? input.siteUrl.trim().replace(/\/+$/, '');
  const coverByListing = mediaOrigin
    ? await loadListingCoverUrlsForDigest(
        client,
        [input.listingId],
        mediaOrigin,
      )
    : new Map<string, string>();
  const coverImageUrl = coverByListing.get(input.listingId) ?? null;

  const fromHeader = resolved.fromHeader ?? fromEmail;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let dryRunEligible = 0;

  for (const req of reqRows) {
    const email = String(req.contact_email ?? '')
      .trim()
      .toLowerCase();
    const requirementId = req.id;

    if (!email) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email: 'unknown',
        status: 'skipped',
        skip_reason: 'missing_email',
      });
      continue;
    }

    const consentStatus = preferenceStatuses.get(email) ?? 'unknown';
    if (isCirculationBlocked(consentStatus)) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'skipped',
        skip_reason:
          consentStatus === 'suppressed' ? 'suppressed' : 'unsubscribed',
      });
      continue;
    }

    if (sendTrigger === 'auto' && !isCirculationAutoEligible(consentStatus)) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'skipped',
        skip_reason: 'not_subscribed',
      });
      continue;
    }

    if (alreadySent.has(email)) {
      skipped += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'skipped',
        skip_reason: 'already_sent',
      });
      continue;
    }

    const unsubToken = createCirculationUnsubscribeToken({
      accountId: input.accountId,
      email,
    });
    const unsubscribeUrl = new URL(
      `/unsubscribe/circulation?token=${encodeURIComponent(unsubToken)}`,
      input.siteUrl,
    ).toString();

    try {
      const publicToken = await circulation.ensurePublicAccessToken(
        input.accountId,
        email,
      );
      const manageUrl = publicToken
        ? new URL(`/share/matches/${publicToken}`, input.siteUrl).toString()
        : null;

      const html = buildCirculationEmailHtml({
        brand: emailBrand,
        listingName: (listing as { name: string }).name,
        listingSummary: summary,
        address: listingAddr,
        unsubscribeUrl,
        viewUrl,
        viewUrlLabel,
        coverImageUrl,
        manageUrl,
        contactName: req.contact_name,
      });

      if (input.dryRun) {
        skipped += 1;
        dryRunEligible += 1;
        await db.from('commercial_circulation_recipients').insert({
          send_id: sendId,
          account_id: input.accountId,
          requirement_id: requirementId,
          email,
          status: 'skipped',
          skip_reason: 'dry_run',
        });
        continue;
      }

      const { messageId } = await sendCirculationEmailViaSes({
        to: email,
        from: fromHeader,
        replyTo,
        subject,
        html,
        listUnsubscribeUrl: unsubscribeUrl,
        accountId: input.accountId,
        sesTenant: resolved.sesTenantName ?? undefined,
        sesConfigurationSet: resolved.sesConfigurationSet ?? undefined,
        metadata: {
          listing_id: (listing as { id: string }).id,
          requirement_id: requirementId,
          send_id: sendId,
        },
      });

      sent += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'sent',
        ses_message_id: messageId,
      });

      await client
        .from('commercial_requirements')
        .update({ details_sent: true })
        .eq('id', requirementId)
        .eq('account_id', input.accountId);

      // Upsert interest schedule row
      await db.from('commercial_matches').upsert(
        {
          account_id: input.accountId,
          listing_id: input.listingId,
          requirement_id: requirementId,
          status: 'new',
          notes: 'Created from circulation send',
          created_by: input.sentBy,
        },
        { onConflict: 'listing_id,requirement_id', ignoreDuplicates: true },
      );
    } catch (err) {
      failed += 1;
      await db.from('commercial_circulation_recipients').insert({
        send_id: sendId,
        account_id: input.accountId,
        requirement_id: requirementId,
        email,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Send failed',
      });
    }
  }

  await db
    .from('commercial_circulation_sends')
    .update({
      recipient_count: input.dryRun ? dryRunEligible : sent,
    })
    .eq('id', sendId);

  if (!input.dryRun && sent > 0) {
    try {
      const { recordCommercialAccountEvent } =
        await import('~/lib/commercial/account-events');
      await recordCommercialAccountEvent(client, {
        accountId: input.accountId,
        entityType: 'listing',
        entityId: input.listingId,
        eventType: 'circulation_sent',
        summary: `Circulation emailed to ${sent} contact${sent === 1 ? '' : 's'}`,
        actorUserId: input.sentBy ?? null,
        metadata: {
          sendId,
          sent,
          skipped,
          failed,
          sendKind: 'listing',
        },
      });
    } catch {
      /* best-effort */
    }
  }

  return { sendId, sent, skipped, failed, dryRunEligible };
}
