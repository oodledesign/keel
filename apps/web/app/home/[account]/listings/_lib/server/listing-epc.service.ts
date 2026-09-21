import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isHighConfidenceEpcMatch,
  rankEpcHits,
} from '~/lib/building-surveyor/epc/address-match';
import {
  fetchGovUkEpcCertificate,
  searchGovUkEpcCertificates,
} from '~/lib/building-surveyor/epc/client';
import { isGovUkEpcConfigured } from '~/lib/building-surveyor/epc/env';
import {
  extractUkPostcode,
  formatEpcAddress,
  normalizeCertificateNumber,
  normalizeUkPostcode,
} from '~/lib/building-surveyor/epc/parse';
import type { EpcSearchHit } from '~/lib/building-surveyor/epc/types';
import {
  type ListingEpcAttachment,
  type ListingEpcLookup,
  type ListingEpcSearchResult,
  type RankedListingEpcHit,
  listingEpcFieldsFromCertificate,
  listingEpcLookupFromAddress,
  mergeListingEpcOnRefresh,
  parseListingEpcPulledSnapshot,
  snapshotListingEpcFields,
} from '~/lib/commercial/listing-epc';
import type { Database } from '~/lib/database.types';

import type {
  AttachListingEpcInput,
  RefreshListingEpcInput,
  SearchListingEpcInput,
} from '../schema/listing-epc.schema';

export type {
  ListingEpcAttachment,
  ListingEpcSearchResult,
  RankedListingEpcHit,
} from '~/lib/commercial/listing-epc';

const LISTING_EPC_SELECT =
  'id, account_id, name, address_line_1, address_line_2, town, postcode, epc_band, epc_rating, epc_certificate_number, epc_fetched_at, epc_pulled_json';

function hitLabel(hit: EpcSearchHit): string {
  return (
    formatEpcAddress({
      addressLine1: hit.addressLine1,
      addressLine2: hit.addressLine2,
      addressLine3: hit.addressLine3,
      addressLine4: hit.addressLine4,
      postTown: hit.postTown,
      postcode: hit.postcode,
    }) || hit.certificateNumber
  );
}

function mapAttachment(row: Record<string, unknown>): ListingEpcAttachment {
  return {
    epcBand: (row.epc_band as string | null) ?? null,
    epcRating:
      row.epc_rating == null || !Number.isFinite(Number(row.epc_rating))
        ? null
        : Number(row.epc_rating),
    certificateNumber: (row.epc_certificate_number as string | null) ?? null,
    fetchedAt: (row.epc_fetched_at as string | null) ?? null,
    pulled: parseListingEpcPulledSnapshot(row.epc_pulled_json),
  };
}

function lookupFromListingRow(row: Record<string, unknown>): ListingEpcLookup {
  return listingEpcLookupFromAddress({
    name: (row.name as string | null) ?? null,
    addressLine1: (row.address_line_1 as string | null) ?? null,
    addressLine2: (row.address_line_2 as string | null) ?? null,
    town: (row.town as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
  });
}

function dedupeHits(hits: RankedListingEpcHit[]): RankedListingEpcHit[] {
  const seen = new Set<string>();
  const unique: RankedListingEpcHit[] = [];
  for (const hit of hits) {
    if (seen.has(hit.certificateNumber)) continue;
    seen.add(hit.certificateNumber);
    unique.push(hit);
  }
  return unique;
}

export function createListingEpcService(client: SupabaseClient<Database>) {
  return new ListingEpcService(client);
}

class ListingEpcService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag the new EPC register columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private throwErr(err: unknown, fallback = 'Something went wrong'): never {
    if (err instanceof Error) throw err;
    const message =
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : fallback;
    throw new Error(message);
  }

  private async assertCanEdit(accountId: string, listingId: string) {
    const listing = await this.loadListingRow(accountId, listingId);
    if (!listing) {
      throw new Error('Listing not found');
    }
    return listing;
  }

  private async loadListingRow(accountId: string, listingId: string) {
    const { data, error } = await this.db
      .from('commercial_listings')
      .select(LISTING_EPC_SELECT)
      .eq('id', listingId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) this.throwErr(error);
    return (data as Record<string, unknown> | null) ?? null;
  }

  async getAttachment(
    accountId: string,
    listingId: string,
  ): Promise<ListingEpcAttachment | null> {
    const row = await this.loadListingRow(accountId, listingId);
    return row ? mapAttachment(row) : null;
  }

  async getLookup(
    accountId: string,
    listingId: string,
  ): Promise<ListingEpcLookup> {
    const row = await this.loadListingRow(accountId, listingId);
    if (!row) {
      throw new Error('Listing not found');
    }
    return lookupFromListingRow(row);
  }

  private async searchRegister(
    lookup: ListingEpcLookup,
    kind: 'non-domestic' | 'domestic',
  ): Promise<EpcSearchHit[]> {
    if (lookup.uprn) {
      const byUprn = await searchGovUkEpcCertificates(
        { uprn: lookup.uprn },
        kind,
      );
      if (byUprn.length > 0) return byUprn;
    }

    if (lookup.postcode) {
      return searchGovUkEpcCertificates({ postcode: lookup.postcode }, kind);
    }

    if (lookup.address) {
      return searchGovUkEpcCertificates({ address: lookup.address }, kind);
    }

    return [];
  }

  private async searchHits(
    lookup: ListingEpcLookup,
  ): Promise<Array<EpcSearchHit & { register: 'non-domestic' | 'domestic' }>> {
    if (!lookup.uprn && !lookup.postcode && !lookup.address) {
      throw new Error('Add a postcode or address before fetching an EPC.');
    }

    const nonDomestic = await this.searchRegister(lookup, 'non-domestic');
    if (nonDomestic.length > 0) {
      return nonDomestic.map((hit) => ({ ...hit, register: 'non-domestic' }));
    }

    const domestic = await this.searchRegister(lookup, 'domestic');
    return domestic.map((hit) => ({ ...hit, register: 'domestic' }));
  }

  async search(input: SearchListingEpcInput): Promise<ListingEpcSearchResult> {
    const stored = await this.assertCanEdit(input.accountId, input.listingId);
    const storedLookup = lookupFromListingRow(stored);
    const lookup = listingEpcLookupFromAddress({
      addressLine1: input.address?.trim() || storedLookup.address,
      postcode:
        normalizeUkPostcode(input.postcode) ||
        extractUkPostcode(input.address) ||
        storedLookup.postcode,
      uprn: input.uprn || storedLookup.uprn,
    });

    if (!lookup.address && storedLookup.address) {
      lookup.address = storedLookup.address;
    }

    if (!isGovUkEpcConfigured()) {
      return {
        configured: false,
        lookup,
        hits: [],
        highConfidenceCertificateNumber: null,
      };
    }

    const ranked = rankEpcHits(await this.searchHits(lookup), lookup).map(
      (hit) => ({
        ...hit,
        addressLabel: hitLabel(hit),
        register:
          (hit as EpcSearchHit & { register?: 'non-domestic' | 'domestic' })
            .register ?? 'non-domestic',
      }),
    );

    const top = ranked[0];
    return {
      configured: true,
      lookup,
      hits: dedupeHits(ranked).slice(0, 12),
      highConfidenceCertificateNumber:
        top && isHighConfidenceEpcMatch(top, lookup)
          ? top.certificateNumber
          : null,
    };
  }

  async attach(
    input: AttachListingEpcInput,
    options?: { preserveOverrides?: boolean },
  ): Promise<ListingEpcAttachment> {
    const existingRow = await this.assertCanEdit(
      input.accountId,
      input.listingId,
    );
    const certificateNumber = normalizeCertificateNumber(
      input.certificateNumber,
    );
    if (!certificateNumber) {
      throw new Error('That certificate number is not valid.');
    }

    const { summary } = await fetchGovUkEpcCertificate(certificateNumber);
    const pulled = listingEpcFieldsFromCertificate(summary);
    const existing = mapAttachment(existingRow);
    const next = mergeListingEpcOnRefresh({
      pulled,
      current: snapshotListingEpcFields(existing),
      previousPulled: existing.pulled,
      preserveOverrides:
        Boolean(options?.preserveOverrides) &&
        existing.certificateNumber === certificateNumber,
    });
    const fetchedAt = new Date().toISOString();

    const { data, error } = await this.db
      .from('commercial_listings')
      .update({
        epc_band: next.epcBand,
        epc_rating: next.epcRating,
        epc_certificate_number: certificateNumber,
        epc_fetched_at: fetchedAt,
        epc_pulled_json: pulled,
        updated_at: fetchedAt,
      })
      .eq('id', input.listingId)
      .eq('account_id', input.accountId)
      .select(LISTING_EPC_SELECT)
      .single();
    if (error) this.throwErr(error);

    return mapAttachment(data as Record<string, unknown>);
  }

  async refresh(input: RefreshListingEpcInput): Promise<ListingEpcAttachment> {
    const existingRow = await this.assertCanEdit(
      input.accountId,
      input.listingId,
    );
    const existing = mapAttachment(existingRow);
    if (!existing.certificateNumber) {
      throw new Error(
        'Fetch and attach an EPC before refreshing the register data.',
      );
    }

    return this.attach(
      {
        accountId: input.accountId,
        listingId: input.listingId,
        certificateNumber: existing.certificateNumber,
      },
      { preserveOverrides: true },
    );
  }
}
