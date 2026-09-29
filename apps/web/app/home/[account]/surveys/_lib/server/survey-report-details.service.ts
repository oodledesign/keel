import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';

import {
  SURVEYOR_PROFILE_SELECT,
  SURVEY_REPORT_DETAILS_SELECT,
  type SurveyReportDetails,
  type SurveyorProfile,
  mapSurveyReportDetails,
  mapSurveyorProfileRow,
  parseSurveyAccommodation,
} from '~/lib/building-surveyor/survey-report-details';
import type { Database } from '~/lib/database.types';

import type {
  SaveSurveyorProfileInput,
  UpdateSurveyAccommodationInput,
  UpdateSurveyReportDetailsInput,
  UpdateSurveyServicesInput,
} from '../schema/survey-report-details.schema';
import { createSurveyCaptureService } from './survey-capture.service';

export type { SurveyReportDetails };

export function createSurveyReportDetailsService(
  client: SupabaseClient<Database>,
) {
  return new SurveyReportDetailsService(client);
}

class SurveyReportDetailsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag the survey report detail columns and surveyor_profiles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.client;
  }

  private surveys() {
    return createSurveyCaptureService(this.client);
  }

  private async updateSurvey(
    accountId: string,
    proposalId: string,
    payload: Record<string, unknown>,
  ) {
    const { error } = await this.db
      .from('proposals')
      .update(payload)
      .eq('id', proposalId)
      .eq('account_id', accountId)
      .eq('kind', 'survey_report');
    if (error) throw new Error(error.message ?? 'Could not save survey');
  }

  private async assertEditableDraft(accountId: string, proposalId: string) {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(accountId);
    await surveys.ensureUserAndPermission(accountId, 'invoices.edit');
    const survey = await surveys.getSurvey(accountId, proposalId);
    if (survey.status !== 'draft') {
      throw new Error('Sent or finalised surveys can no longer be edited');
    }
  }

  async getDetails(
    accountId: string,
    proposalId: string,
  ): Promise<SurveyReportDetails> {
    const { data, error } = await this.db
      .from('proposals')
      .select(SURVEY_REPORT_DETAILS_SELECT)
      .eq('id', proposalId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message ?? 'Could not load survey');
    return mapSurveyReportDetails((data ?? {}) as Record<string, unknown>);
  }

  async updateDetails(input: UpdateSurveyReportDetailsInput) {
    await this.assertEditableDraft(input.accountId, input.proposalId);
    const payload: Record<string, unknown> = {};
    if (input.inspectionDate !== undefined) {
      payload.survey_inspection_date = input.inspectionDate;
    }
    if (input.termsReceivedDate !== undefined) {
      payload.survey_terms_received_date = input.termsReceivedDate;
    }
    if (input.reportReference !== undefined) {
      payload.survey_report_reference = input.reportReference || null;
    }
    if (Object.keys(payload).length > 0) {
      await this.updateSurvey(input.accountId, input.proposalId, payload);
    }
    return this.getDetails(input.accountId, input.proposalId);
  }

  async updateAccommodation(input: UpdateSurveyAccommodationInput) {
    await this.assertEditableDraft(input.accountId, input.proposalId);
    await this.updateSurvey(input.accountId, input.proposalId, {
      survey_accommodation: input.accommodation,
    });
    return parseSurveyAccommodation(input.accommodation);
  }

  async updateServices(input: UpdateSurveyServicesInput) {
    await this.assertEditableDraft(input.accountId, input.proposalId);
    await this.updateSurvey(input.accountId, input.proposalId, {
      survey_services: input.services,
    });
    return input.services;
  }

  async getProfile(
    accountId: string,
    userId: string,
  ): Promise<SurveyorProfile> {
    const { data, error } = await this.db
      .from('surveyor_profiles')
      .select(SURVEYOR_PROFILE_SELECT)
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message ?? 'Could not load profile');
    return mapSurveyorProfileRow(data as Record<string, unknown> | null);
  }

  async getMyProfile(accountId: string): Promise<SurveyorProfile> {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    return this.getProfile(accountId, user.id);
  }

  async saveMyProfile(input: SaveSurveyorProfileInput) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');
    await this.surveys().assertBuildingSurveyorAccount(input.accountId);

    const { error } = await this.db.from('surveyor_profiles').upsert(
      {
        account_id: input.accountId,
        user_id: user.id,
        display_name: input.displayName || null,
        rics_number: input.ricsNumber || null,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        address: input.address || null,
        qualifications: input.qualifications.filter(
          (item) => item.year || item.establishment || item.qualification,
        ),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,user_id' },
    );
    if (error) throw new Error(error.message ?? 'Could not save profile');
    return this.getProfile(input.accountId, user.id);
  }
}
