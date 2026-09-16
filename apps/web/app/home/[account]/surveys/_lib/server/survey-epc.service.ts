import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  isHighConfidenceEpcMatch,
  rankEpcHits,
  resolveSurveyLookup,
} from '~/lib/building-surveyor/epc/address-match';
import {
  fetchGovUkEpcCertificate,
  searchGovUkEpcCertificates,
} from '~/lib/building-surveyor/epc/client';
import { isGovUkEpcConfigured } from '~/lib/building-surveyor/epc/env';
import {
  mergeEpcWithOverrides,
  overriddenEpcFields,
  parseOverriddenFields,
  parsePulledSnapshot,
  snapshotEpcFields,
} from '~/lib/building-surveyor/epc/overrides';
import {
  extractUkPostcode,
  normalizeCertificateNumber,
  normalizeUkPostcode,
  normalizeUprn,
} from '~/lib/building-surveyor/epc/parse';
import type {
  EpcSearchHit,
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import { EpcApiError } from '~/lib/building-surveyor/epc/types';
import type { Database } from '~/lib/database.types';

import type {
  AttachSurveyEpcInput,
  ClearSurveyEpcInput,
  RefreshSurveyEpcInput,
  SearchSurveyEpcInput,
  SurveyPropertyLookupInput,
  UpdateSurveyEpcInput,
} from '../schema/survey-epc.schema';
import { createSurveyCaptureService } from './survey-capture.service';

export type RankedEpcHit = EpcSearchHit & {
  matchScore: number;
  addressLabel: string;
};

export type SurveyEpcSearchResult = {
  configured: boolean;
  lookup: SurveyPropertyLookup;
  hits: RankedEpcHit[];
  highConfidenceCertificateNumber: string | null;
};

const EPC_SELECT =
  'id, proposal_id, certificate_number, uprn, current_rating, potential_rating, lodgement_date, floor_area, fuel_type, recommendations_summary, pulled_json, overridden_fields, fetched_at';

function mapEpcRow(row: Record<string, unknown>): SurveyEpcRecord {
  const current = snapshotEpcFields({
    currentRating: (row.current_rating as string | null) ?? null,
    potentialRating: (row.potential_rating as string | null) ?? null,
    lodgementDate: (row.lodgement_date as string | null) ?? null,
    floorArea: row.floor_area == null ? null : Number(row.floor_area),
    fuelType: (row.fuel_type as string | null) ?? null,
    recommendationsSummary:
      (row.recommendations_summary as string | null) ?? null,
  });
  const pulled = parsePulledSnapshot(row.pulled_json);
  const storedOverrides = parseOverriddenFields(row.overridden_fields);

  return {
    id: String(row.id ?? ''),
    proposalId: String(row.proposal_id ?? ''),
    certificateNumber: String(row.certificate_number ?? ''),
    uprn: (row.uprn as string | null) ?? null,
    ...current,
    pulled,
    overriddenFields:
      storedOverrides.length > 0
        ? storedOverrides
        : overriddenEpcFields(pulled, current),
    fetchedAt: row.fetched_at as string,
  };
}

function hitLabel(hit: EpcSearchHit): string {
  return [hit.addressLine1, hit.addressLine2, hit.postTown, hit.postcode]
    .filter(Boolean)
    .join(', ');
}

export function createSurveyEpcService(client: SupabaseClient<Database>) {
  return new SurveyEpcService(client);
}

class SurveyEpcService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag survey_epc / survey_property_* columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private surveys() {
    return createSurveyCaptureService(this.client);
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

  async assertCanEdit(accountId: string, proposalId: string) {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(accountId);
    const user = await surveys.ensureUserAndPermission(
      accountId,
      'invoices.edit',
    );
    const survey = await surveys.getSurvey(accountId, proposalId);
    return { survey, user };
  }

  async getAttached(
    accountId: string,
    proposalId: string,
  ): Promise<SurveyEpcRecord | null> {
    const { data, error } = await this.db
      .from('survey_epc')
      .select(EPC_SELECT)
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) this.throwErr(error);
    return data ? mapEpcRow(data as Record<string, unknown>) : null;
  }

  async getLookup(
    accountId: string,
    proposalId: string,
  ): Promise<SurveyPropertyLookup> {
    const surveys = this.surveys();
    const survey = await surveys.getSurvey(accountId, proposalId);
    const row = survey as {
      title?: string | null;
      survey_property_address?: string | null;
      survey_property_postcode?: string | null;
      survey_uprn?: string | null;
      client_id?: string | null;
    };

    let clientAddress: string | null = null;
    let clientPostcode: string | null = null;
    if (row.client_id) {
      const { data } = await this.db
        .from('clients')
        .select('address_line_1, address_line_2, city, postcode')
        .eq('id', row.client_id)
        .eq('account_id', accountId)
        .maybeSingle();
      const client = data as {
        address_line_1?: string | null;
        address_line_2?: string | null;
        city?: string | null;
        postcode?: string | null;
      } | null;
      clientAddress = [
        client?.address_line_1,
        client?.address_line_2,
        client?.city,
        client?.postcode,
      ]
        .filter(Boolean)
        .join(', ');
      clientPostcode = client?.postcode ?? null;
    }

    return resolveSurveyLookup({
      stored: {
        address: row.survey_property_address ?? null,
        postcode: row.survey_property_postcode ?? null,
        uprn: row.survey_uprn ?? null,
      },
      clientAddress,
      clientPostcode,
      title: row.title ?? null,
    });
  }

  private async searchHits(
    lookup: SurveyPropertyLookup,
  ): Promise<EpcSearchHit[]> {
    if (!lookup.uprn && !lookup.postcode && !lookup.address) {
      throw new Error(
        'Add a postcode, address, or UPRN before fetching an EPC.',
      );
    }

    if (lookup.uprn) {
      const byUprn = await searchGovUkEpcCertificates({
        uprn: lookup.uprn,
      });
      if (byUprn.length > 0) return byUprn;
    }

    if (lookup.postcode) {
      return searchGovUkEpcCertificates({
        postcode: lookup.postcode,
      });
    }

    const domestic = await searchGovUkEpcCertificates({
      address: lookup.address,
    });
    if (domestic.length > 0) return domestic;

    return searchGovUkEpcCertificates(
      { address: lookup.address },
      'non-domestic',
    );
  }

  async search(input: SearchSurveyEpcInput): Promise<SurveyEpcSearchResult> {
    await this.assertCanEdit(input.accountId, input.proposalId);

    const stored = await this.getLookup(input.accountId, input.proposalId);
    const lookup = resolveSurveyLookup({
      stored: {
        address: input.address?.trim() || stored.address,
        postcode: input.postcode?.trim() || stored.postcode,
        uprn: input.uprn?.trim() || stored.uprn,
      },
    });

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
      }),
    );

    const top = ranked[0];
    return {
      configured: true,
      lookup,
      hits: ranked.slice(0, 12),
      highConfidenceCertificateNumber:
        top && isHighConfidenceEpcMatch(top, lookup)
          ? top.certificateNumber
          : null,
    };
  }

  async saveLookup(input: SurveyPropertyLookupInput): Promise<{
    lookup: SurveyPropertyLookup;
    suggestions: SurveyEpcSearchResult | null;
    attached: SurveyEpcRecord | null;
    autoAttached: boolean;
  }> {
    await this.assertCanEdit(input.accountId, input.proposalId);

    const lookup: SurveyPropertyLookup = {
      address: input.address?.trim() || null,
      postcode:
        normalizeUkPostcode(input.postcode) ||
        extractUkPostcode(input.address) ||
        null,
      uprn: normalizeUprn(input.uprn),
    };

    const { error } = await this.db
      .from('proposals')
      .update({
        survey_property_address: lookup.address,
        survey_property_postcode: lookup.postcode,
        survey_uprn: lookup.uprn,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    const existing = await this.getAttached(input.accountId, input.proposalId);

    if (!input.suggest || !isGovUkEpcConfigured()) {
      return {
        lookup,
        suggestions: null,
        attached: existing,
        autoAttached: false,
      };
    }

    try {
      const suggestions = await this.search({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        proposalId: input.proposalId,
        address: lookup.address,
        postcode: lookup.postcode,
        uprn: lookup.uprn,
      });

      if (!existing && suggestions.highConfidenceCertificateNumber) {
        const attached = await this.attach({
          accountId: input.accountId,
          accountSlug: input.accountSlug,
          proposalId: input.proposalId,
          certificateNumber: suggestions.highConfidenceCertificateNumber,
        });
        return {
          lookup,
          suggestions,
          attached,
          autoAttached: true,
        };
      }

      return {
        lookup,
        suggestions,
        attached: existing,
        autoAttached: false,
      };
    } catch (error) {
      if (error instanceof EpcApiError) {
        return {
          lookup,
          suggestions: null,
          attached: existing,
          autoAttached: false,
        };
      }
      throw error;
    }
  }

  async attach(
    input: AttachSurveyEpcInput,
    options?: { preserveOverrides?: boolean },
  ): Promise<SurveyEpcRecord> {
    const { survey, user } = await this.assertCanEdit(
      input.accountId,
      input.proposalId,
    );
    const certificateNumber = normalizeCertificateNumber(
      input.certificateNumber,
    );
    if (!certificateNumber) {
      throw new Error('That certificate number is not valid.');
    }

    const { summary, raw } = await fetchGovUkEpcCertificate(certificateNumber);
    const fetchedAt = new Date().toISOString();
    const pulled = snapshotEpcFields(summary);
    const existing = await this.getAttached(input.accountId, input.proposalId);

    let current = pulled;
    let overriddenFields = [] as ReturnType<typeof overriddenEpcFields>;
    if (
      options?.preserveOverrides &&
      existing &&
      existing.certificateNumber === certificateNumber
    ) {
      current = mergeEpcWithOverrides(
        pulled,
        existing,
        existing.overriddenFields,
      );
      overriddenFields = overriddenEpcFields(pulled, current);
    }

    const payload = {
      account_id: input.accountId,
      proposal_id: input.proposalId,
      certificate_number: certificateNumber,
      uprn: summary.uprn,
      current_rating: current.currentRating,
      potential_rating: current.potentialRating,
      lodgement_date: current.lodgementDate,
      floor_area: current.floorArea,
      fuel_type: current.fuelType,
      recommendations_summary: current.recommendationsSummary,
      raw_json: raw,
      pulled_json: pulled,
      overridden_fields: overriddenFields,
      fetched_at: fetchedAt,
      created_by: user.id,
    };

    const { data, error } = await this.db
      .from('survey_epc')
      .upsert(payload, { onConflict: 'proposal_id' })
      .select(EPC_SELECT)
      .single();
    if (error) this.throwErr(error);

    const existingUprn = (survey as { survey_uprn?: string | null })
      .survey_uprn;
    if (!existingUprn && summary.uprn) {
      await this.db
        .from('proposals')
        .update({
          survey_uprn: summary.uprn,
          survey_property_postcode:
            (survey as { survey_property_postcode?: string | null })
              .survey_property_postcode ?? summary.postcode,
        })
        .eq('id', input.proposalId)
        .eq('account_id', input.accountId);
    }

    return mapEpcRow(data as Record<string, unknown>);
  }

  async refresh(input: RefreshSurveyEpcInput): Promise<SurveyEpcRecord> {
    await this.assertCanEdit(input.accountId, input.proposalId);
    const existing = await this.getAttached(input.accountId, input.proposalId);
    if (!existing) {
      throw new Error(
        'Confirm the property address before refreshing the EPC.',
      );
    }
    return this.attach(
      {
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        proposalId: input.proposalId,
        certificateNumber: existing.certificateNumber,
      },
      { preserveOverrides: true },
    );
  }

  async update(input: UpdateSurveyEpcInput): Promise<SurveyEpcRecord> {
    await this.assertCanEdit(input.accountId, input.proposalId);
    const existing = await this.getAttached(input.accountId, input.proposalId);
    if (!existing) {
      throw new Error('Pull an EPC before editing these fields.');
    }

    const current = snapshotEpcFields({
      currentRating:
        input.currentRating !== undefined
          ? input.currentRating
          : existing.currentRating,
      potentialRating:
        input.potentialRating !== undefined
          ? input.potentialRating
          : existing.potentialRating,
      lodgementDate:
        input.lodgementDate !== undefined
          ? input.lodgementDate
          : existing.lodgementDate,
      floorArea:
        input.floorArea !== undefined ? input.floorArea : existing.floorArea,
      fuelType:
        input.fuelType !== undefined ? input.fuelType : existing.fuelType,
      recommendationsSummary:
        input.recommendationsSummary !== undefined
          ? input.recommendationsSummary
          : existing.recommendationsSummary,
    });
    const overriddenFields = overriddenEpcFields(existing.pulled, current);

    const { data, error } = await this.db
      .from('survey_epc')
      .update({
        current_rating: current.currentRating,
        potential_rating: current.potentialRating,
        lodgement_date: current.lodgementDate,
        floor_area: current.floorArea,
        fuel_type: current.fuelType,
        recommendations_summary: current.recommendationsSummary,
        overridden_fields: overriddenFields,
      })
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .select(EPC_SELECT)
      .single();
    if (error) this.throwErr(error);
    return mapEpcRow(data as Record<string, unknown>);
  }

  async clear(input: ClearSurveyEpcInput): Promise<{ cleared: true }> {
    await this.assertCanEdit(input.accountId, input.proposalId);
    const { error } = await this.db
      .from('survey_epc')
      .delete()
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId);
    if (error) this.throwErr(error);
    return { cleared: true };
  }
}
