import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchEaFloodLookup } from '~/lib/building-surveyor/flood/client';
import {
  overriddenFloodFields,
  parseOverriddenFloodFields,
  parsePulledFloodSnapshot,
  snapshotFloodFields,
} from '~/lib/building-surveyor/flood/overrides';
import { FloodApiError } from '~/lib/building-surveyor/flood/types';
import type { SurveyFloodRecord } from '~/lib/building-surveyor/flood/types';
import type { Database } from '~/lib/database.types';

import type {
  ClearSurveyFloodInput,
  PullSurveyFloodInput,
  UpdateSurveyFloodInput,
} from '../schema/survey-flood.schema';
import { createSurveyCaptureService } from './survey-capture.service';

const FLOOD_SELECT =
  'id, proposal_id, flood_zone, rivers_and_sea, surface_water, summary, active_warning_count, pulled_json, overridden_fields, fetched_at';

function mapFloodRow(row: Record<string, unknown>): SurveyFloodRecord {
  const current = snapshotFloodFields({
    floodZone: (row.flood_zone as SurveyFloodRecord['floodZone']) ?? null,
    riversAndSea: (row.rivers_and_sea as string | null) ?? null,
    surfaceWater: (row.surface_water as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
  });
  const pulled = parsePulledFloodSnapshot(row.pulled_json);
  const storedOverrides = parseOverriddenFloodFields(row.overridden_fields);

  return {
    id: String(row.id ?? ''),
    proposalId: String(row.proposal_id ?? ''),
    ...current,
    activeWarningCount: Number(row.active_warning_count ?? 0),
    pulled,
    overriddenFields:
      storedOverrides.length > 0
        ? storedOverrides
        : overriddenFloodFields(pulled, current),
    fetchedAt: row.fetched_at as string,
  };
}

export function createSurveyFloodService(client: SupabaseClient<Database>) {
  return new SurveyFloodService(client);
}

class SurveyFloodService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag survey_flood / survey_property_* columns.
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
  ): Promise<SurveyFloodRecord | null> {
    const { data, error } = await this.db
      .from('survey_flood')
      .select(FLOOD_SELECT)
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) this.throwErr(error);
    return data ? mapFloodRow(data as Record<string, unknown>) : null;
  }

  async pull(input: PullSurveyFloodInput): Promise<SurveyFloodRecord> {
    const { survey, user } = await this.assertCanEdit(
      input.accountId,
      input.proposalId,
    );

    const row = survey as {
      survey_property_latitude?: number | null;
      survey_property_longitude?: number | null;
    };

    const latitude = input.latitude ?? row.survey_property_latitude ?? null;
    const longitude = input.longitude ?? row.survey_property_longitude ?? null;

    if (latitude == null || longitude == null) {
      throw new Error(
        'Confirm a UK address with a map pin before fetching flood risk.',
      );
    }

    const lookup = await fetchEaFloodLookup({ latitude, longitude });
    const fetchedAt = new Date().toISOString();
    const pulled = snapshotFloodFields(lookup);

    const payload = {
      account_id: input.accountId,
      proposal_id: input.proposalId,
      flood_zone: lookup.floodZone,
      rivers_and_sea: lookup.riversAndSea,
      surface_water: lookup.surfaceWater,
      summary: lookup.summary,
      active_warning_count: lookup.activeWarnings.length,
      raw_json: lookup,
      pulled_json: pulled,
      overridden_fields: [],
      fetched_at: fetchedAt,
      created_by: user.id,
    };

    const { data, error } = await this.db
      .from('survey_flood')
      .upsert(payload, { onConflict: 'proposal_id' })
      .select(FLOOD_SELECT)
      .single();
    if (error) this.throwErr(error);
    return mapFloodRow(data as Record<string, unknown>);
  }

  async update(input: UpdateSurveyFloodInput): Promise<SurveyFloodRecord> {
    await this.assertCanEdit(input.accountId, input.proposalId);
    const existing = await this.getAttached(input.accountId, input.proposalId);
    if (!existing) {
      throw new Error('Pull flood risk before editing these fields.');
    }

    const current = snapshotFloodFields({
      floodZone:
        input.floodZone !== undefined ? input.floodZone : existing.floodZone,
      riversAndSea:
        input.riversAndSea !== undefined
          ? input.riversAndSea
          : existing.riversAndSea,
      surfaceWater:
        input.surfaceWater !== undefined
          ? input.surfaceWater
          : existing.surfaceWater,
      summary: input.summary !== undefined ? input.summary : existing.summary,
    });
    const overriddenFields = overriddenFloodFields(existing.pulled, current);

    const { data, error } = await this.db
      .from('survey_flood')
      .update({
        flood_zone: current.floodZone,
        rivers_and_sea: current.riversAndSea,
        surface_water: current.surfaceWater,
        summary: current.summary,
        overridden_fields: overriddenFields,
      })
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .select(FLOOD_SELECT)
      .single();
    if (error) this.throwErr(error);
    return mapFloodRow(data as Record<string, unknown>);
  }

  async clear(input: ClearSurveyFloodInput): Promise<{ cleared: true }> {
    await this.assertCanEdit(input.accountId, input.proposalId);
    const { error } = await this.db
      .from('survey_flood')
      .delete()
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId);
    if (error) this.throwErr(error);
    return { cleared: true };
  }
}

export { FloodApiError };
