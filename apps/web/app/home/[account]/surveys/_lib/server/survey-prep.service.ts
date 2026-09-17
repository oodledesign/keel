import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  extractUkPostcode,
  normalizeUkPostcode,
} from '~/lib/building-surveyor/epc/parse';
import type {
  SurveyEpcRecord,
  SurveyPropertyLookup,
} from '~/lib/building-surveyor/epc/types';
import { fetchPlanningFloodZones } from '~/lib/building-surveyor/flood/client';
import {
  isFloodRiskBand,
  mapSurveyFloodRow,
} from '~/lib/building-surveyor/flood/parse';
import {
  FloodApiError,
  type SurveyFloodRecord,
} from '~/lib/building-surveyor/flood/types';
import {
  type SurveyLevel,
  normalizeSurveyLevel,
  surveyTypeForLevel,
} from '~/lib/building-surveyor/survey-types';
import type { Database } from '~/lib/database.types';

import type {
  ConfirmSurveyAddressInput,
  PullSurveyFloodInput,
  UpdateSurveyFloodInput,
  UpdateSurveyLevelInput,
} from '../schema/survey-prep.schema';
import { createSurveyCaptureService } from './survey-capture.service';
import {
  type SurveyEpcSearchResult,
  createSurveyEpcService,
} from './survey-epc.service';

export function createSurveyPrepService(client: SupabaseClient<Database>) {
  return new SurveyPrepService(client);
}

class SurveyPrepService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag survey_level / flood columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private surveys() {
    return createSurveyCaptureService(this.client);
  }

  private epc() {
    return createSurveyEpcService(this.client);
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

  async getFlood(
    accountId: string,
    proposalId: string,
  ): Promise<SurveyFloodRecord> {
    const survey = await this.surveys().getSurvey(accountId, proposalId);
    return mapSurveyFloodRow(survey);
  }

  async getLevel(accountId: string, proposalId: string): Promise<SurveyLevel> {
    const survey = await this.surveys().getSurvey(accountId, proposalId);
    const row = survey as {
      survey_level?: number | string | null;
      survey_type?: string | null;
    };
    if (row.survey_level === 2 || row.survey_level === 3) {
      return row.survey_level;
    }
    return normalizeSurveyLevel(
      row.survey_type === 'rics_hss_l3' ? 3 : row.survey_level,
    );
  }

  async pullFlood(input: PullSurveyFloodInput): Promise<SurveyFloodRecord> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(input.accountId);
    await surveys.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const survey = await surveys.getSurvey(input.accountId, input.proposalId);
    const existing = survey as {
      survey_property_address?: string | null;
      survey_property_postcode?: string | null;
      survey_flood_source?: string | null;
      survey_flood_risk_band?: string | null;
      survey_flood_risk_summary?: string | null;
      survey_flood_raw_json?: unknown;
    };

    const assessment = await fetchPlanningFloodZones({
      latitude: input.latitude,
      longitude: input.longitude,
      postcode:
        input.postcode ?? existing.survey_property_postcode ?? undefined,
      address: input.address ?? existing.survey_property_address ?? undefined,
    });

    const keepManual =
      existing.survey_flood_source === 'manual' &&
      (existing.survey_flood_risk_band || existing.survey_flood_risk_summary);

    const nextBand = keepManual
      ? isFloodRiskBand(existing.survey_flood_risk_band)
        ? existing.survey_flood_risk_band
        : assessment.band
      : assessment.band;
    const nextSummary = keepManual
      ? (existing.survey_flood_risk_summary ?? assessment.summary)
      : assessment.summary;
    const fetchedAt = new Date().toISOString();
    const raw = {
      pulled: assessment,
      endpoint: assessment.endpoint,
    };

    const { error } = await this.db
      .from('proposals')
      .update({
        survey_flood_risk_band: nextBand,
        survey_flood_risk_summary: nextSummary,
        survey_flood_source: keepManual ? 'manual' : 'gov_uk',
        survey_flood_raw_json: raw,
        survey_flood_fetched_at: fetchedAt,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    return {
      band: nextBand,
      summary: nextSummary,
      source: keepManual ? 'manual' : 'gov_uk',
      fetchedAt,
      overridden: Boolean(keepManual),
      pulledBand: assessment.band,
      planningZone: assessment.planningZone,
      coverage: assessment.coverage,
      country: assessment.country,
      raw,
    };
  }

  async updateFlood(input: UpdateSurveyFloodInput): Promise<SurveyFloodRecord> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(input.accountId);
    await surveys.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const current = await this.getFlood(input.accountId, input.proposalId);

    const { error } = await this.db
      .from('proposals')
      .update({
        survey_flood_risk_band: input.band,
        survey_flood_risk_summary: input.summary,
        survey_flood_source: 'manual',
        survey_flood_fetched_at: new Date().toISOString(),
        survey_flood_raw_json: current.raw,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    return {
      ...current,
      band: input.band,
      summary: input.summary,
      source: 'manual',
      overridden: true,
      fetchedAt: new Date().toISOString(),
    };
  }

  async updateLevel(input: UpdateSurveyLevelInput): Promise<{
    surveyLevel: SurveyLevel;
    surveyType: ReturnType<typeof surveyTypeForLevel>;
  }> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(input.accountId);
    await surveys.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await surveys.getSurvey(input.accountId, input.proposalId);

    const surveyLevel = normalizeSurveyLevel(input.surveyLevel);
    const surveyType = surveyTypeForLevel(surveyLevel);

    const { error } = await this.db
      .from('proposals')
      .update({
        survey_level: surveyLevel,
        survey_type: surveyType,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    return { surveyLevel, surveyType };
  }

  async confirmAddress(input: ConfirmSurveyAddressInput): Promise<{
    lookup: SurveyPropertyLookup;
    flood: SurveyFloodRecord;
    suggestions: SurveyEpcSearchResult | null;
    attached: SurveyEpcRecord | null;
    autoAttached: boolean;
  }> {
    const epc = this.epc();
    const saved = await epc.saveLookup({
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      proposalId: input.proposalId,
      address: input.address,
      postcode: input.postcode,
      uprn: input.uprn,
      suggest: true,
    });

    if (input.titleFromAddress) {
      const title =
        input.address?.trim() ||
        normalizeUkPostcode(input.postcode) ||
        extractUkPostcode(input.address) ||
        '';
      if (title) {
        await this.db
          .from('proposals')
          .update({ title })
          .eq('id', input.proposalId)
          .eq('account_id', input.accountId)
          .eq('kind', 'survey_report');
      }
    }

    let flood: SurveyFloodRecord;
    try {
      flood = await this.pullFlood({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        proposalId: input.proposalId,
        address: saved.lookup.address,
        postcode: saved.lookup.postcode,
        latitude: input.latitude,
        longitude: input.longitude,
      });
    } catch (error) {
      if (error instanceof FloodApiError) {
        flood = await this.getFlood(input.accountId, input.proposalId);
      } else {
        throw error;
      }
    }

    return {
      lookup: saved.lookup,
      flood,
      suggestions: saved.suggestions,
      attached: saved.attached,
      autoAttached: saved.autoAttached,
    };
  }
}
