import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CirculationConsentStatus,
  isCirculationAutoEligible,
  isCirculationBlocked,
  normalizeCirculationEmail,
} from '~/lib/commercial/circulation/circulation-eligibility';
import type { ListingChange } from '~/lib/commercial/circulation/circulation-rematch';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import {
  type RecipientPerson,
  type RequirementRecipient,
  resolveRequirementRecipient,
} from '~/lib/commercial/circulation/requirement-recipient';
import { DISPOSAL_TYPE_LABELS } from '~/lib/commercial/commercial-constants';
import { loadListingCoverUrlsForDigest } from '~/lib/commercial/commercial-match-digest';
import { resolveSiteUrlForPublicMedia } from '~/lib/commercial/listing-media-public-url';
import { isPublicListingPageUrl } from '~/lib/commercial/listing-website-url';
import {
  ACTIVE_LISTING_STATUSES_FOR_MATCH,
  ACTIVE_REQUIREMENT_STAGES_FOR_MATCH,
  DEFAULT_MATCH_SUGGESTION_MIN_SCORE,
  type MatchListingSnapshot,
  type MatchRequirementSnapshot,
  scoreListingRequirementMatch,
} from '~/lib/commercial/match-scoring';

export type ContactMatchListing = {
  listingId: string;
  name: string;
  summary: string;
  address: string;
  town: string | null;
  sector: string | null;
  disposalTypeLabel: string;
  sizeLabel: string | null;
  score: number;
  reasons: string[];
  /** Primary CTA URL (website listing preferred, else brochure share). */
  viewUrl: string | null;
  /** Label for viewUrl — "View on website" or "View details". */
  viewUrlLabel: string | null;
  /** Agency website / Property Hive permalink when available (never brochure). */
  websiteListingUrl: string | null;
  /** Stable public cover image URL for email + share page. */
  coverImageUrl: string | null;
  brochureShareToken: string | null;
  autoCirculate: boolean;
  /** Price drop / relist stamps on the listing, if any. */
  changes: ListingChange[];
  /** This contact's requirements that match the listing at or above minScore. */
  requirementIds: string[];
};

export type ContactMatchRow = {
  email: string;
  /** Contacts page record behind this address, when a requirement links one. */
  clientId: string | null;
  contactName: string | null;
  companyName: string | null;
  requirementIds: string[];
  consentStatus: CirculationConsentStatus;
  autoSendEnabled: boolean;
  lastDigestFingerprint: string | null;
  lastDigestSentAt: string | null;
  lastCirculatedAt: string | null;
  publicAccessToken: string | null;
  listings: ContactMatchListing[];
};

const LISTING_ROW_CAP = 500;
const REQUIREMENT_ROW_CAP = 3000;
const PAGE_SIZE = 1000;

async function fetchCappedPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  cap: number,
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < cap) {
    const from = rows.length;
    const to = Math.min(from + PAGE_SIZE, cap) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < to - from + 1) break;
  }
  return rows;
}

type ListingRow = {
  id: string;
  name: string | null;
  sector: string | null;
  disposal_type: string | null;
  town: string | null;
  postcode: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  asking_rent_pence: number | null;
  asking_rent_to_pence: number | null;
  asking_price_pence: number | null;
  status: string;
  summary: string | null;
  description: string | null;
  brochure_share_token: string | null;
  brochure_share_enabled: boolean | null;
  auto_circulate_matches: boolean | null;
  website_url: string | null;
  price_dropped_at: string | null;
  relisted_at: string | null;
};

type RequirementRow = {
  id: string;
  client_id: string | null;
  contact_id: string | null;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  sector: string | null;
  tenure: MatchRequirementSnapshot['tenure'];
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  search_radius_miles: number | null;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  budget_min_pence: number | null;
  budget_max_pence: number | null;
  notes: string | null;
  stage: string;
  updated_at: string;
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asListingSnapshot(row: ListingRow): MatchListingSnapshot {
  return {
    id: row.id,
    name: row.name ?? 'Property',
    sector: row.sector,
    disposalType:
      (row.disposal_type as MatchListingSnapshot['disposalType']) ?? 'to_let',
    town: row.town,
    postcode: row.postcode,
    addressLine1: row.address_line_1,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    askingRentPence: num(row.asking_rent_pence),
    askingRentToPence: num(row.asking_rent_to_pence),
    askingPricePence: num(row.asking_price_pence),
    status: row.status,
  };
}

function asRequirementSnapshot(row: RequirementRow): MatchRequirementSnapshot {
  return {
    id: row.id,
    companyName: row.company_name,
    contactName: row.contact_name,
    sector: row.sector,
    tenure: row.tenure ?? null,
    locationText: row.location_text,
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    searchRadiusMiles: num(row.search_radius_miles),
    sizeMinSqft: num(row.size_min_sqft),
    sizeMaxSqft: num(row.size_max_sqft),
    budgetMinPence: num(row.budget_min_pence),
    budgetMaxPence: num(row.budget_max_pence),
    notes: row.notes,
    stage: row.stage ?? 'new',
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Changes worth re-notifying about. Not for a listing that is under offer:
 * "Price reduced" on a property that is already spoken for would mislead.
 */
function listingChanges(row: ListingRow): ListingChange[] {
  if (row.status === 'under_offer') return [];
  const changes: ListingChange[] = [];
  if (row.price_dropped_at) {
    changes.push({ kind: 'price_drop', changedAt: row.price_dropped_at });
  }
  if (row.relisted_at) {
    changes.push({ kind: 'relisted', changedAt: row.relisted_at });
  }
  return changes;
}

function formatAddress(row: ListingRow): string {
  return [
    row.address_line_1,
    row.address_line_2,
    row.town,
    row.county,
    row.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatSize(row: ListingRow): string | null {
  const min = num(row.size_min_sqft);
  const max = num(row.size_max_sqft);
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);
  if (min != null && max != null && min !== max) {
    return `${fmt(min)} – ${fmt(max)} sq ft`;
  }
  return `${fmt(min ?? max!)} sq ft`;
}

function brochureShareUrl(
  row: ListingRow,
  siteUrl: string | null,
): string | null {
  if (!row.brochure_share_enabled || !row.brochure_share_token || !siteUrl) {
    return null;
  }
  try {
    return new URL(
      `/share/brochure/${row.brochure_share_token}`,
      siteUrl,
    ).toString();
  } catch {
    return null;
  }
}

function pickWebsiteListingUrl(
  websiteUrl: string | null | undefined,
  portalUrl: string | null | undefined,
): string | null {
  const website = websiteUrl?.trim() ?? '';
  if (website && isPublicListingPageUrl(website)) return website;
  const portal = portalUrl?.trim() ?? '';
  if (portal && isPublicListingPageUrl(portal)) return portal;
  return null;
}

function resolveListingCta(input: {
  websiteListingUrl: string | null;
  brochureUrl: string | null;
}): { viewUrl: string | null; viewUrlLabel: string | null } {
  if (input.websiteListingUrl) {
    return {
      viewUrl: input.websiteListingUrl,
      viewUrlLabel: 'View on website',
    };
  }
  if (input.brochureUrl) {
    return { viewUrl: input.brochureUrl, viewUrlLabel: 'View details' };
  }
  return { viewUrl: null, viewUrlLabel: null };
}

const LIVE_PORTAL_STATUSES = new Set(['published', 'live', 'synced']);

async function loadPropertyHiveListingUrls(
  client: SupabaseClient,
  accountId: string,
  listingIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniqueIds = [...new Set(listingIds.filter(Boolean))];
  if (uniqueIds.length === 0) return map;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;
  const { data, error } = await db
    .from('commercial_portal_publications')
    .select('listing_id, external_url, status')
    .eq('account_id', accountId)
    .eq('portal', 'property_hive')
    .in('listing_id', uniqueIds);

  if (error) {
    console.error('[circulation] property hive urls', error.message);
    return map;
  }

  for (const row of (data ?? []) as Array<{
    listing_id?: string | null;
    external_url?: string | null;
    status?: string | null;
  }>) {
    const listingId = row.listing_id?.trim();
    const url = row.external_url?.trim() ?? '';
    const status = (row.status ?? '').trim().toLowerCase();
    if (!listingId || map.has(listingId)) continue;
    if (!LIVE_PORTAL_STATUSES.has(status)) continue;
    if (!url || !isPublicListingPageUrl(url)) continue;
    map.set(listingId, url);
  }

  return map;
}

const LISTING_SELECT = [
  'id',
  'name',
  'sector',
  'disposal_type',
  'town',
  'postcode',
  'address_line_1',
  'address_line_2',
  'county',
  'latitude',
  'longitude',
  'size_min_sqft',
  'size_max_sqft',
  'asking_rent_pence',
  'asking_rent_to_pence',
  'asking_price_pence',
  'status',
  'summary',
  'description',
  'brochure_share_token',
  'brochure_share_enabled',
  'auto_circulate_matches',
  'website_url',
  'price_dropped_at',
  'relisted_at',
].join(', ');

const REQUIREMENT_SELECT = [
  'id',
  'client_id',
  'contact_id',
  'company_name',
  'contact_name',
  'contact_email',
  'sector',
  'tenure',
  'location_text',
  'latitude',
  'longitude',
  'search_radius_miles',
  'size_min_sqft',
  'size_max_sqft',
  'budget_min_pence',
  'budget_max_pence',
  'notes',
  'stage',
  'updated_at',
].join(', ');

const ID_CHUNK = 200;

async function selectByIds<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: 'contacts' | 'clients',
  columns: string,
  accountId: string,
  ids: string[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    let query = db
      .from(table)
      .select(columns)
      .in('id', ids.slice(i, i + ID_CHUNK));
    // Older contacts rows can predate contacts.account_id; the ids already
    // come from this account's requirements.
    if (table === 'clients') query = query.eq('account_id', accountId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

/**
 * Resolved circulation recipient per requirement id: linked person, then
 * linked contact, then the address typed on the requirement.
 */
export async function loadRequirementRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  accountId: string,
  requirements: Array<{
    id: string;
    client_id: string | null;
    contact_id: string | null;
    contact_email: string | null;
    contact_name: string | null;
  }>,
): Promise<Map<string, RequirementRecipient>> {
  const personIds = [
    ...new Set(requirements.map((r) => r.contact_id).filter(Boolean)),
  ] as string[];
  const clientIds = [
    ...new Set(requirements.map((r) => r.client_id).filter(Boolean)),
  ] as string[];

  const [people, clients] = await Promise.all([
    selectByIds<{
      id: string;
      email: string | null;
      first_name: string | null;
      full_name: string | null;
    }>(
      db,
      'contacts',
      'id, email, first_name, full_name',
      accountId,
      personIds,
    ),
    selectByIds<{
      id: string;
      email: string | null;
      first_name: string | null;
      display_name: string | null;
    }>(
      db,
      'clients',
      'id, email, first_name, display_name',
      accountId,
      clientIds,
    ),
  ]);

  const personById = new Map<string, RecipientPerson>(
    people.map((p) => [
      p.id,
      { email: p.email, firstName: p.first_name, fullName: p.full_name },
    ]),
  );
  const clientById = new Map<string, RecipientPerson>(
    clients.map((c) => [
      c.id,
      { email: c.email, firstName: c.first_name, fullName: c.display_name },
    ]),
  );

  const out = new Map<string, RequirementRecipient>();
  for (const req of requirements) {
    const recipient = resolveRequirementRecipient({
      contactEmail: req.contact_email,
      contactName: req.contact_name,
      person: req.contact_id ? (personById.get(req.contact_id) ?? null) : null,
      client: req.client_id ? (clientById.get(req.client_id) ?? null) : null,
    });
    if (recipient) out.set(req.id, recipient);
  }
  return out;
}

export async function listContactMatches(
  client: SupabaseClient,
  input: {
    accountId: string;
    email?: string;
    minScore?: number;
    siteUrl?: string | null;
    /** Only return contacts who match this listing (email still lists all their fits). */
    requireListingId?: string;
  },
): Promise<ContactMatchRow[]> {
  const minScore = input.minScore ?? DEFAULT_MATCH_SUGGESTION_MIN_SCORE;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const [listings, reqRows] = await Promise.all([
    fetchCappedPages<ListingRow>(
      (from, to) =>
        db
          .from('commercial_listings')
          .select(LISTING_SELECT)
          .eq('account_id', input.accountId)
          .in('status', [...ACTIVE_LISTING_STATUSES_FOR_MATCH])
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      LISTING_ROW_CAP,
    ),
    // Requirements never sent details first, so a cap drops recently
    // contacted ones rather than silently starving older active searches.
    fetchCappedPages<RequirementRow>(
      (from, to) =>
        db
          .from('commercial_requirements')
          .select(REQUIREMENT_SELECT)
          .eq('account_id', input.accountId)
          .is('archived_at', null)
          .or(
            'contact_email.not.is.null,client_id.not.is.null,contact_id.not.is.null',
          )
          .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
          .order('details_sent', { ascending: true, nullsFirst: true })
          .order('updated_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to),
      REQUIREMENT_ROW_CAP,
    ),
  ]);

  if (listings.length >= LISTING_ROW_CAP) {
    console.warn(
      `[circulation] listing match set hit the ${LISTING_ROW_CAP}-row cap`,
      input.accountId,
    );
  }
  if (reqRows.length >= REQUIREMENT_ROW_CAP) {
    console.warn(
      `[circulation] requirement match set hit the ${REQUIREMENT_ROW_CAP}-row cap`,
      input.accountId,
    );
  }
  const recipients = await loadRequirementRecipients(
    db,
    input.accountId,
    reqRows,
  );
  const wantedEmail = input.email
    ? normalizeCirculationEmail(input.email)
    : null;
  const requirements = reqRows.filter((row) => {
    const recipient = recipients.get(row.id);
    if (!recipient) return false;
    return !wantedEmail || recipient.email === wantedEmail;
  });

  if (listings.length === 0 || requirements.length === 0) return [];

  const emails = [
    ...new Set(requirements.map((row) => recipients.get(row.id)!.email)),
  ];

  const circulation = createCommercialCirculationService(client);
  const [preferenceRows, lastCirculatedByEmail] = await Promise.all([
    circulation.listPreferences(input.accountId, emails),
    circulation.listLastCirculatedAt(input.accountId, emails),
  ]);

  const byEmail = new Map<string, ContactMatchRow>();

  for (const req of requirements) {
    const recipient = recipients.get(req.id);
    if (!recipient) continue;
    const email = recipient.email;
    const reqSnap = asRequirementSnapshot(req);
    const preference = preferenceRows.get(email);
    const consentStatus: CirculationConsentStatus =
      preference?.marketingStatus ?? 'unknown';

    let row = byEmail.get(email);
    if (!row) {
      row = {
        email,
        clientId: req.client_id,
        contactName: recipient.name,
        companyName: req.company_name,
        requirementIds: [],
        consentStatus,
        autoSendEnabled: preference?.autoSendEnabled ?? true,
        lastDigestFingerprint: preference?.lastDigestFingerprint ?? null,
        lastDigestSentAt: preference?.lastDigestSentAt ?? null,
        lastCirculatedAt: lastCirculatedByEmail.get(email) ?? null,
        publicAccessToken: preference?.publicAccessToken ?? null,
        listings: [],
      };
      byEmail.set(email, row);
    } else {
      if (!row.clientId && req.client_id) row.clientId = req.client_id;
      if (!row.contactName && recipient.name) row.contactName = recipient.name;
      if (!row.companyName && req.company_name)
        row.companyName = req.company_name;
    }
    if (!row.requirementIds.includes(req.id)) {
      row.requirementIds.push(req.id);
    }

    for (const listing of listings) {
      const result = scoreListingRequirementMatch(
        asListingSnapshot(listing),
        reqSnap,
      );
      if (result.score < minScore) continue;

      const existing = row.listings.find(
        (item) => item.listingId === listing.id,
      );
      if (existing) {
        if (!existing.requirementIds.includes(req.id)) {
          existing.requirementIds.push(req.id);
        }
        if (result.score > existing.score) {
          existing.score = result.score;
          existing.reasons = result.reasons;
        }
        continue;
      }

      const summary =
        listing.summary?.trim() ||
        listing.description?.trim()?.slice(0, 600) ||
        '';

      row.listings.push({
        listingId: listing.id,
        name: listing.name?.trim() || 'Property',
        summary,
        address: formatAddress(listing),
        town: listing.town,
        sector: listing.sector,
        disposalTypeLabel:
          DISPOSAL_TYPE_LABELS[
            listing.disposal_type as keyof typeof DISPOSAL_TYPE_LABELS
          ] ??
          listing.disposal_type ??
          'To let',
        sizeLabel: formatSize(listing),
        score: result.score,
        reasons: result.reasons,
        viewUrl: null,
        viewUrlLabel: null,
        websiteListingUrl: null,
        coverImageUrl: null,
        brochureShareToken: listing.brochure_share_token,
        autoCirculate: Boolean(listing.auto_circulate_matches),
        changes: listingChanges(listing),
        requirementIds: [req.id],
      });
    }
  }

  const contacts = [...byEmail.values()]
    .map((row) => ({
      ...row,
      listings: row.listings.sort((a, b) => b.score - a.score),
    }))
    .filter((row) => row.listings.length > 0);

  const matchedListingIds = [
    ...new Set(
      contacts.flatMap((row) =>
        row.listings.map((listing) => listing.listingId),
      ),
    ),
  ];
  const mediaOrigin =
    resolveSiteUrlForPublicMedia() ??
    (input.siteUrl?.trim() ? input.siteUrl.trim().replace(/\/+$/, '') : null);

  const [coverByListing, phUrlByListing] = await Promise.all([
    mediaOrigin
      ? loadListingCoverUrlsForDigest(client, matchedListingIds, mediaOrigin)
      : Promise.resolve(new Map<string, string>()),
    loadPropertyHiveListingUrls(client, input.accountId, matchedListingIds),
  ]);

  const listingById = new Map(listings.map((row) => [row.id, row]));

  for (const contact of contacts) {
    for (const item of contact.listings) {
      const listing = listingById.get(item.listingId);
      const websiteListingUrl = pickWebsiteListingUrl(
        listing?.website_url,
        phUrlByListing.get(item.listingId),
      );
      const brochureUrl = listing
        ? brochureShareUrl(listing, input.siteUrl ?? null)
        : null;
      const cta = resolveListingCta({ websiteListingUrl, brochureUrl });
      item.websiteListingUrl = websiteListingUrl;
      item.viewUrl = cta.viewUrl;
      item.viewUrlLabel = cta.viewUrlLabel;
      item.coverImageUrl = coverByListing.get(item.listingId) ?? null;
    }
  }

  if (input.requireListingId) {
    return contacts.filter((row) =>
      row.listings.some(
        (listing) => listing.listingId === input.requireListingId,
      ),
    );
  }

  return contacts.sort((a, b) => a.email.localeCompare(b.email));
}

export function isContactAutoMailEligible(row: ContactMatchRow): boolean {
  return (
    isCirculationAutoEligible(row.consentStatus) &&
    row.autoSendEnabled &&
    !isCirculationBlocked(row.consentStatus)
  );
}
