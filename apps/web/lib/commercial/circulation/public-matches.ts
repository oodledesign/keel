import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type AccountBrandResolved,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { listContactMatches } from '~/lib/commercial/circulation/contact-matches';
import { COMMERCIAL_PROPERTY_TYPES } from '~/lib/commercial/commercial-constants';
import { geocodeListingAddress } from '~/lib/commercial/geocode-listing';
import { ACTIVE_REQUIREMENT_STAGES_FOR_MATCH } from '~/lib/commercial/match-scoring';
import { inferRequirementUseClass } from '~/lib/commercial/requirement-use-class';

export type PublicMatchRequirement = {
  id: string;
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
};

export type PublicMatchesPage = {
  token: string;
  email: string;
  contactName: string | null;
  agencyName: string;
  brand: AccountBrandResolved;
  unsubscribed: boolean;
  notifyOnNewMatch: boolean;
  requirement: PublicMatchRequirement | null;
  listings: Array<{
    listingId: string;
    name: string;
    summary: string;
    address: string;
    town: string | null;
    sector: string | null;
    disposalTypeLabel: string;
    sizeLabel: string | null;
    viewUrl: string | null;
    viewUrlLabel: string | null;
    websiteListingUrl: string | null;
    coverImageUrl: string | null;
  }>;
};

export type PublicMatchRequirementUpdate = {
  sector: string | null;
  tenure: 'rent' | 'buy' | 'both' | null;
  locationText: string | null;
  searchRadiusMiles: number | null;
  sizeMinSqft: number | null;
  sizeMaxSqft: number | null;
  budgetMinPence: number | null;
  budgetMaxPence: number | null;
};

const PROPERTY_TYPE_SET = new Set<string>(COMMERCIAL_PROPERTY_TYPES);

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asTenure(value: unknown): 'rent' | 'buy' | 'both' | null {
  if (value === 'rent' || value === 'buy' || value === 'both') return value;
  return null;
}

function mapRequirementRow(row: {
  id: string;
  sector?: string | null;
  tenure?: string | null;
  location_text?: string | null;
  search_radius_miles?: number | null;
  size_min_sqft?: number | null;
  size_max_sqft?: number | null;
  budget_min_pence?: number | null;
  budget_max_pence?: number | null;
}): PublicMatchRequirement {
  return {
    id: row.id,
    sector: row.sector?.trim() || null,
    tenure: asTenure(row.tenure),
    locationText: row.location_text?.trim() || null,
    searchRadiusMiles: asNumber(row.search_radius_miles),
    sizeMinSqft: asNumber(row.size_min_sqft),
    sizeMaxSqft: asNumber(row.size_max_sqft),
    budgetMinPence: asNumber(row.budget_min_pence),
    budgetMaxPence: asNumber(row.budget_max_pence),
  };
}

/**
 * Resolve the contact's primary requirement for this preference token.
 * Prefer an active matching-stage row; fall back to the most recently updated.
 * Scoped strictly to preference.accountId + preference.email.
 */
export async function loadPublicRequirementForPreference(
  admin: SupabaseClient,
  preference: { accountId: string; email: string },
): Promise<PublicMatchRequirement | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const email = preference.email.trim().toLowerCase();
  if (!email) return null;

  const selectCols =
    'id, sector, tenure, location_text, search_radius_miles, size_min_sqft, size_max_sqft, budget_min_pence, budget_max_pence, stage, updated_at';

  const { data: activeRows, error: activeError } = await db
    .from('commercial_requirements')
    .select(selectCols)
    .eq('account_id', preference.accountId)
    .ilike('contact_email', email)
    .in('stage', [...ACTIVE_REQUIREMENT_STAGES_FOR_MATCH])
    .order('updated_at', { ascending: false })
    .limit(1);

  if (activeError) throw new Error(activeError.message);
  const active = (activeRows as Array<Record<string, unknown>> | null)?.[0];
  if (active?.id) {
    return mapRequirementRow(active as Parameters<typeof mapRequirementRow>[0]);
  }

  const { data: anyRows, error: anyError } = await db
    .from('commercial_requirements')
    .select(selectCols)
    .eq('account_id', preference.accountId)
    .ilike('contact_email', email)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (anyError) throw new Error(anyError.message);
  const row = (anyRows as Array<Record<string, unknown>> | null)?.[0];
  if (!row?.id) return null;
  return mapRequirementRow(row as Parameters<typeof mapRequirementRow>[0]);
}

export async function loadPublicMatchesByToken(
  admin: SupabaseClient,
  token: string,
  siteUrl: string | null,
): Promise<PublicMatchesPage | null> {
  const circulation = createCommercialCirculationService(admin);
  const preference = await circulation.loadPreferenceByPublicToken(token);
  if (!preference) return null;

  const [{ data: account }, brand, contacts, requirement] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', preference.accountId)
      .maybeSingle(),
    loadAccountBrandResolved(preference.accountId),
    listContactMatches(admin, {
      accountId: preference.accountId,
      email: preference.email,
      siteUrl,
    }),
    loadPublicRequirementForPreference(admin, preference),
  ]);

  const contact = contacts[0] ?? null;
  const agencyName =
    (account as { name?: string | null } | null)?.name?.trim() || 'Agency';

  return {
    token: preference.publicAccessToken,
    email: preference.email,
    contactName: contact?.contactName ?? null,
    agencyName,
    brand,
    unsubscribed:
      preference.marketingStatus === 'unsubscribed' ||
      preference.marketingStatus === 'suppressed',
    notifyOnNewMatch:
      preference.marketingStatus === 'subscribed' && preference.autoSendEnabled,
    requirement,
    listings: (contact?.listings ?? []).map((listing) => ({
      listingId: listing.listingId,
      name: listing.name,
      summary: listing.summary,
      address: listing.address,
      town: listing.town,
      sector: listing.sector,
      disposalTypeLabel: listing.disposalTypeLabel,
      sizeLabel: listing.sizeLabel,
      viewUrl: listing.viewUrl,
      viewUrlLabel: listing.viewUrlLabel,
      websiteListingUrl: listing.websiteListingUrl,
      coverImageUrl: listing.coverImageUrl,
    })),
  };
}

function normalizeSector(sector: string | null): string | null {
  const trimmed = sector?.trim() || null;
  if (!trimmed) return null;
  if (!PROPERTY_TYPE_SET.has(trimmed)) {
    throw new Error('Invalid property type');
  }
  return trimmed;
}

/**
 * Update allowlisted preference fields on the contact's requirement,
 * gated by publicAccessToken → account + email ownership.
 */
export async function updatePublicRequirementByToken(
  admin: SupabaseClient,
  token: string,
  input: PublicMatchRequirementUpdate,
): Promise<PublicMatchRequirement> {
  const circulation = createCommercialCirculationService(admin);
  const preference = await circulation.loadPreferenceByPublicToken(token);
  if (!preference) {
    throw new Error('This link is invalid or has expired.');
  }

  const existing = await loadPublicRequirementForPreference(admin, preference);
  if (!existing) {
    throw new Error('No requirement is linked to this address yet.');
  }

  if (
    input.sizeMinSqft != null &&
    input.sizeMaxSqft != null &&
    input.sizeMinSqft > input.sizeMaxSqft
  ) {
    throw new Error('Minimum size cannot be greater than maximum size.');
  }
  if (
    input.budgetMinPence != null &&
    input.budgetMaxPence != null &&
    input.budgetMinPence > input.budgetMaxPence
  ) {
    throw new Error('Minimum budget cannot be greater than maximum budget.');
  }

  const sector = normalizeSector(input.sector);
  const locationText = input.locationText?.trim() || null;
  const searchRadiusMiles =
    input.searchRadiusMiles == null || !Number.isFinite(input.searchRadiusMiles)
      ? null
      : Math.min(100, Math.max(0, input.searchRadiusMiles));

  const locationChanged =
    (locationText ?? null) !== (existing.locationText ?? null);

  const payload: Record<string, unknown> = {
    sector,
    use_class: inferRequirementUseClass(sector),
    tenure: input.tenure,
    location_text: locationText,
    search_radius_miles: searchRadiusMiles,
    size_min_sqft: input.sizeMinSqft,
    size_max_sqft: input.sizeMaxSqft,
    budget_min_pence: input.budgetMinPence,
    budget_max_pence: input.budgetMaxPence,
    updated_at: new Date().toISOString(),
  };

  if (!locationText) {
    payload.latitude = null;
    payload.longitude = null;
  } else if (locationChanged) {
    try {
      const geo = await geocodeListingAddress({
        addressLine1: locationText,
        town: null,
        county: null,
        postcode: null,
      });
      payload.latitude = geo?.latitude ?? null;
      payload.longitude = geo?.longitude ?? null;
    } catch {
      // geocode optional — keep text even if lookup fails
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from('commercial_requirements')
    .update(payload)
    .eq('id', existing.id)
    .eq('account_id', preference.accountId)
    .ilike('contact_email', preference.email)
    .select(
      'id, sector, tenure, location_text, search_radius_miles, size_min_sqft, size_max_sqft, budget_min_pence, budget_max_pence',
    )
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not update requirement.');

  return mapRequirementRow(data as Parameters<typeof mapRequirementRow>[0]);
}
