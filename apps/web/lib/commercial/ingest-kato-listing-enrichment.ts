import type { SupabaseClient } from '@supabase/supabase-js';

import {
  parseKatoFeedEpcBands,
  parseKatoFeedListingAttrs,
  parseKatoFeedUnits,
} from '~/lib/commercial/kato-feed-files';

export type IngestKatoListingEnrichmentSummary = {
  unitsInFeed: number;
  unitsInserted: number;
  unitsSkippedExisting: number;
  unitsUnmatched: number;
  epcBandsInFeed: number;
  epcBandsUpdated: number;
  epcBandsSkippedExisting: number;
  epcBandsUnmatched: number;
  attrsUnmatched: number;
  hideRentSet: number;
  hidePriceSet: number;
  ratesUpdated: number;
  measurementUpdated: number;
  namesUpdated: number;
  specsUpdated: number;
  insuranceUpdated: number;
  tenancyUpdated: number;
  landUpdated: number;
  onMarketUpdated: number;
  streetViewUpdated: number;
  fittedUpdated: number;
  unitsFittedUpdated: number;
  disposalUpdated: number;
};

type ListingEnrichmentRow = {
  id: string;
  external_id: string | null;
  name: string | null;
  address_line_1: string | null;
  town: string | null;
  postcode: string | null;
  epc_band: string | null;
  epc_rating: number | null;
  hide_rent_from_marketing: boolean | null;
  hide_price_from_marketing: boolean | null;
  rates_payable_per_sqft: number | null;
  measurement_standard: string | null;
  marketing_sections: unknown;
  insurance_type: string | null;
  possession: string | null;
  land_size_min: number | null;
  on_market_at: string | null;
  street_view_pano_id: string | null;
  fitted_space: boolean | null;
  disposal_type: string | null;
};

type MarketingSection = {
  id: string;
  kind: string;
  title: string;
  body: string;
};

function asMarketingSections(value: unknown): MarketingSection[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MarketingSection => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.kind === 'string' &&
      typeof row.title === 'string' &&
      typeof row.body === 'string'
    );
  });
}

export async function ingestKatoListingEnrichment(
  client: SupabaseClient,
  input: {
    accountId: string;
    xml: string;
    onProgress?: (message: string) => void;
  },
): Promise<IngestKatoListingEnrichmentSummary> {
  const { data: listings, error: listingError } = await client
    .from('commercial_listings')
    .select(
      'id, external_id, name, address_line_1, town, postcode, epc_band, epc_rating, hide_rent_from_marketing, hide_price_from_marketing, rates_payable_per_sqft, measurement_standard, marketing_sections, insurance_type, possession, land_size_min, on_market_at, street_view_pano_id, fitted_space, disposal_type',
    )
    .eq('account_id', input.accountId)
    .not('external_id', 'is', null);

  if (listingError) throw new Error(listingError.message);

  const listingByExternal = new Map(
    ((listings ?? []) as ListingEnrichmentRow[]).map(
      (row) => [row.external_id!.trim(), row] as const,
    ),
  );

  const { data: existingUnits, error: unitError } = await client
    .from('commercial_listing_units')
    .select('id, external_id, fitted_space')
    .eq('account_id', input.accountId)
    .not('external_id', 'is', null);

  if (unitError) throw new Error(unitError.message);

  const existingUnitsByExternal = new Map(
    (
      (existingUnits ?? []) as Array<{
        id: string;
        external_id: string | null;
        fitted_space: boolean | null;
      }>
    )
      .filter((row) => Boolean(row.external_id?.trim()))
      .map((row) => [row.external_id!.trim(), row] as const),
  );

  const feedUnits = parseKatoFeedUnits(input.xml);
  let unitsInserted = 0;
  let unitsSkippedExisting = 0;
  let unitsUnmatched = 0;
  let unitsFittedUpdated = 0;

  for (const unit of feedUnits) {
    const listing = listingByExternal.get(unit.listingExternalId);
    if (!listing) {
      unitsUnmatched += 1;
      continue;
    }
    const existing = existingUnitsByExternal.get(unit.unitExternalId);
    if (existing) {
      unitsSkippedExisting += 1;
      if (unit.fittedSpace != null && existing.fitted_space == null) {
        const { error } = await client
          .from('commercial_listing_units')
          .update({
            fitted_space: unit.fittedSpace,
          })
          .eq('id', existing.id)
          .eq('account_id', input.accountId)
          .is('fitted_space', null);
        if (!error) {
          existing.fitted_space = unit.fittedSpace;
          unitsFittedUpdated += 1;
          input.onProgress?.(`unit fitted → ${unit.unitExternalId}`);
        }
      }
      continue;
    }

    const { error } = await client.from('commercial_listing_units').insert({
      account_id: input.accountId,
      listing_id: listing.id,
      external_id: unit.unitExternalId,
      label: unit.label,
      floor_or_unit: unit.floorOrUnit,
      description: unit.description,
      size_sqft: unit.sizeSqft,
      asking_rent_pence: unit.askingRentPence,
      rent_per_sqft: unit.rentPerSqft,
      fitted_space: unit.fittedSpace,
      status: unit.status,
      sort_order: unit.sortOrder,
      part_floor: false,
    });

    if (error) {
      input.onProgress?.(
        `unit insert failed ${unit.unitExternalId}: ${error.message}`,
      );
      continue;
    }

    existingUnitsByExternal.set(unit.unitExternalId, {
      id: '',
      external_id: unit.unitExternalId,
      fitted_space: unit.fittedSpace,
    });
    unitsInserted += 1;
    input.onProgress?.(`unit ${unit.label} → ${unit.listingExternalId}`);
  }

  const feedBands = parseKatoFeedEpcBands(input.xml);
  let epcBandsUpdated = 0;
  let epcBandsSkippedExisting = 0;
  let epcBandsUnmatched = 0;

  for (const row of feedBands) {
    const listing = listingByExternal.get(row.listingExternalId);
    if (!listing) {
      epcBandsUnmatched += 1;
      continue;
    }
    if (listing.epc_band?.trim()) {
      epcBandsSkippedExisting += 1;
      continue;
    }

    const { error } = await client
      .from('commercial_listings')
      .update({
        epc_band: row.epcBand,
        epc_rating: row.epcRating,
      })
      .eq('id', listing.id)
      .eq('account_id', input.accountId)
      .is('epc_band', null);

    if (error) {
      input.onProgress?.(
        `epc update failed ${row.listingExternalId}: ${error.message}`,
      );
      continue;
    }

    listing.epc_band = row.epcBand;
    listing.epc_rating = row.epcRating;
    epcBandsUpdated += 1;
    input.onProgress?.(`epc ${row.epcBand} → ${row.listingExternalId}`);
  }

  const summary: IngestKatoListingEnrichmentSummary = {
    unitsInFeed: feedUnits.length,
    unitsInserted,
    unitsSkippedExisting,
    unitsUnmatched,
    epcBandsInFeed: feedBands.length,
    epcBandsUpdated,
    epcBandsSkippedExisting,
    epcBandsUnmatched,
    attrsUnmatched: 0,
    hideRentSet: 0,
    hidePriceSet: 0,
    ratesUpdated: 0,
    measurementUpdated: 0,
    namesUpdated: 0,
    specsUpdated: 0,
    insuranceUpdated: 0,
    tenancyUpdated: 0,
    landUpdated: 0,
    onMarketUpdated: 0,
    streetViewUpdated: 0,
    fittedUpdated: 0,
    unitsFittedUpdated,
    disposalUpdated: 0,
  };

  for (const row of parseKatoFeedListingAttrs(input.xml)) {
    const listing = listingByExternal.get(row.listingExternalId);
    if (!listing) {
      summary.attrsUnmatched += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};
    const notes: string[] = [];

    if (row.hideRentFromMarketing && !listing.hide_rent_from_marketing) {
      patch.hide_rent_from_marketing = true;
      listing.hide_rent_from_marketing = true;
      summary.hideRentSet += 1;
      notes.push('ROA');
    }
    if (row.hidePriceFromMarketing && !listing.hide_price_from_marketing) {
      patch.hide_price_from_marketing = true;
      listing.hide_price_from_marketing = true;
      summary.hidePriceSet += 1;
      notes.push('POA');
    }
    if (
      row.ratesPayablePerSqft != null &&
      listing.rates_payable_per_sqft == null
    ) {
      patch.rates_payable_per_sqft = row.ratesPayablePerSqft;
      listing.rates_payable_per_sqft = row.ratesPayablePerSqft;
      summary.ratesUpdated += 1;
      notes.push('rates');
    }
    if (
      row.measurementStandard &&
      listing.measurement_standard !== row.measurementStandard
    ) {
      patch.measurement_standard = row.measurementStandard;
      listing.measurement_standard = row.measurementStandard;
      summary.measurementUpdated += 1;
      notes.push(row.measurementStandard);
    }
    if (row.displayName) {
      if (listing.name !== row.displayName) {
        patch.name = row.displayName;
        listing.name = row.displayName;
        summary.namesUpdated += 1;
        notes.push('name');
      }
    } else {
      const addressName = [
        listing.address_line_1,
        listing.town,
        listing.postcode,
      ]
        .filter(Boolean)
        .join(', ');
      const looksWrong =
        Boolean(addressName) &&
        Boolean(listing.name) &&
        listing.address_line_1 &&
        !listing.name.includes(listing.address_line_1);
      if (looksWrong && addressName !== listing.name) {
        patch.name = addressName;
        listing.name = addressName;
        summary.namesUpdated += 1;
        notes.push('name-repair');
      }
    }

    const sections = asMarketingSections(listing.marketing_sections);
    if (
      row.specificationsBody &&
      !sections.some((section) => section.kind === 'specifications')
    ) {
      const next = [
        ...sections,
        {
          id: 'kato-specifications',
          kind: 'specifications',
          title: row.specificationsTitle || 'Specifications',
          body: row.specificationsBody,
        },
      ];
      patch.marketing_sections = next;
      listing.marketing_sections = next;
      summary.specsUpdated += 1;
      notes.push('specs');
    }

    if (row.insuranceType && !listing.insurance_type?.trim()) {
      patch.insurance_type = row.insuranceType;
      listing.insurance_type = row.insuranceType;
      summary.insuranceUpdated += 1;
      notes.push('insurance');
    }

    const tenancy = row.tenancyStatus?.trim() ?? '';
    if (
      tenancy &&
      tenancy.toLowerCase() !== 'unknown' &&
      !listing.possession?.trim()
    ) {
      patch.possession = tenancy;
      listing.possession = tenancy;
      summary.tenancyUpdated += 1;
      notes.push('tenancy');
    }

    if (
      row.landSizeMin != null &&
      row.landSizeMetric &&
      listing.land_size_min == null
    ) {
      patch.land_size_min = row.landSizeMin;
      patch.land_size_max = row.landSizeMax ?? row.landSizeMin;
      patch.land_size_metric = row.landSizeMetric;
      listing.land_size_min = row.landSizeMin;
      summary.landUpdated += 1;
      notes.push('land');
    }

    if (row.onMarketAt && !listing.on_market_at) {
      patch.on_market_at = row.onMarketAt;
      listing.on_market_at = row.onMarketAt;
      summary.onMarketUpdated += 1;
      notes.push('on-market');
    }

    if (row.streetViewPanoId && !listing.street_view_pano_id?.trim()) {
      patch.street_view_pano_id = row.streetViewPanoId;
      patch.street_view_heading = row.streetViewHeading;
      patch.street_view_pitch = row.streetViewPitch;
      patch.street_view_zoom = row.streetViewZoom;
      listing.street_view_pano_id = row.streetViewPanoId;
      summary.streetViewUpdated += 1;
      notes.push('street-view');
    }

    if (row.fittedSpace != null && listing.fitted_space == null) {
      patch.fitted_space = row.fittedSpace;
      listing.fitted_space = row.fittedSpace;
      summary.fittedUpdated += 1;
      notes.push(row.fittedSpace ? 'fitted' : 'unfitted');
    }

    // Kato availabilities are source of truth for matched external listings.
    if (row.disposalType && listing.disposal_type !== row.disposalType) {
      patch.disposal_type = row.disposalType;
      listing.disposal_type = row.disposalType;
      summary.disposalUpdated += 1;
      notes.push(row.disposalType);
    }

    if (Object.keys(patch).length === 0) continue;

    const { error } = await client
      .from('commercial_listings')
      .update(patch)
      .eq('id', listing.id)
      .eq('account_id', input.accountId);

    if (error) {
      input.onProgress?.(
        `attrs update failed ${row.listingExternalId}: ${error.message}`,
      );
      continue;
    }

    input.onProgress?.(`${notes.join(', ')} → ${row.listingExternalId}`);
  }

  return summary;
}
