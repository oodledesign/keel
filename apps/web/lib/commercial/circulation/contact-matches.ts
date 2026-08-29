import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CirculationConsentStatus,
  isCirculationAutoEligible,
  isCirculationBlocked,
  normalizeCirculationEmail,
} from '~/lib/commercial/circulation/circulation-eligibility';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { DISPOSAL_TYPE_LABELS } from '~/lib/commercial/commercial-constants';
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
  viewUrl: string | null;
  brochureShareToken: string | null;
  autoCirculate: boolean;
};

export type ContactMatchRow = {
  email: string;
  contactName: string | null;
  companyName: string | null;
  requirementIds: string[];
  consentStatus: CirculationConsentStatus;
  autoSendEnabled: boolean;
  lastDigestFingerprint: string | null;
  lastDigestSentAt: string | null;
  publicAccessToken: string | null;
  listings: ContactMatchListing[];
};

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
};

type RequirementRow = {
  id: string;
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

function listingViewUrl(
  row: ListingRow,
  siteUrl: string | null,
): string | null {
  if (!row.brochure_share_enabled || !row.brochure_share_token || !siteUrl) {
    return null;
  }
  return new URL(
    `/share/brochure/${row.brochure_share_token}`,
    siteUrl,
  ).toString();
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
].join(', ');

const REQUIREMENT_SELECT = [
  'id',
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

  const listingQuery = db
    .from('commercial_listings')
    .select(LISTING_SELECT)
    .eq('account_id', input.accountId)
    .in('status', [...ACTIVE_LISTING_STATUSES_FOR_MATCH])
    .order('updated_at', { ascending: false })
    .limit(250);

  const requirementQuery = db
    .from('commercial_requirements')
    .select(REQUIREMENT_SELECT)
    .eq('account_id', input.accountId)
    .not('contact_email', 'is', null)
    .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
    .order('updated_at', { ascending: false })
    .limit(250);

  const [
    { data: listingRows, error: listingError },
    { data: reqRows, error: reqError },
  ] = await Promise.all([listingQuery, requirementQuery]);

  if (listingError) throw new Error(listingError.message);
  if (reqError) throw new Error(reqError.message);

  const listings = (listingRows ?? []) as ListingRow[];
  const requirements = ((reqRows ?? []) as RequirementRow[]).filter((row) => {
    const email = normalizeCirculationEmail(String(row.contact_email ?? ''));
    if (!email) return false;
    if (input.email && email !== normalizeCirculationEmail(input.email)) {
      return false;
    }
    return true;
  });

  if (listings.length === 0 || requirements.length === 0) return [];

  const emails = [
    ...new Set(
      requirements.map((row) =>
        normalizeCirculationEmail(String(row.contact_email ?? '')),
      ),
    ),
  ];

  const circulation = createCommercialCirculationService(client);
  const [statuses, preferenceRows] = await Promise.all([
    circulation.getPreferenceStatuses(input.accountId, emails),
    circulation.listPreferences(input.accountId, emails),
  ]);

  const byEmail = new Map<string, ContactMatchRow>();

  for (const req of requirements) {
    const email = normalizeCirculationEmail(String(req.contact_email ?? ''));
    if (!email) continue;
    const reqSnap = asRequirementSnapshot(req);
    const preference = preferenceRows.get(email);
    const consentStatus = statuses.get(email) ?? 'unknown';

    let row = byEmail.get(email);
    if (!row) {
      row = {
        email,
        contactName: req.contact_name,
        companyName: req.company_name,
        requirementIds: [],
        consentStatus,
        autoSendEnabled: preference?.autoSendEnabled ?? true,
        lastDigestFingerprint: preference?.lastDigestFingerprint ?? null,
        lastDigestSentAt: preference?.lastDigestSentAt ?? null,
        publicAccessToken: preference?.publicAccessToken ?? null,
        listings: [],
      };
      byEmail.set(email, row);
    } else {
      if (!row.contactName && req.contact_name)
        row.contactName = req.contact_name;
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
        viewUrl: listingViewUrl(listing, input.siteUrl ?? null),
        brochureShareToken: listing.brochure_share_token,
        autoCirculate: Boolean(listing.auto_circulate_matches),
      });
    }
  }

  const contacts = [...byEmail.values()]
    .map((row) => ({
      ...row,
      listings: row.listings.sort((a, b) => b.score - a.score),
    }))
    .filter((row) => row.listings.length > 0);

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
