import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import {
  COVER_IMAGE_MAX_BYTES,
  isCoverImagePath,
  looksLikeImage,
  normalizeCoverFocus,
} from '~/lib/building-surveyor/survey-cover';
import {
  DEFAULT_DRONE_FEE_PENCE,
  type SurveyDrone,
} from '~/lib/building-surveyor/survey-drone';
import { signSurveyPhotoUrls } from '~/lib/building-surveyor/survey-photo-urls';
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
  SaveCoverDefaultImageInput,
  SaveDroneDefaultFeeInput,
  SaveSurveyorProfileInput,
  UpdateSurveyAccommodationInput,
  UpdateSurveyCoverInput,
  UpdateSurveyDroneInput,
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

  async updateDrone(input: UpdateSurveyDroneInput): Promise<SurveyDrone> {
    await this.assertEditableDraft(input.accountId, input.proposalId);
    const payload: Record<string, unknown> = {};
    if (input.used !== undefined) payload.survey_drone_used = input.used;
    if (input.billing !== undefined)
      payload.survey_drone_billing = input.billing;
    if (input.feePence !== undefined) {
      payload.survey_drone_fee_pence = input.feePence;
    }
    if (Object.keys(payload).length > 0) {
      await this.updateSurvey(input.accountId, input.proposalId, payload);
    }
    return (await this.getDetails(input.accountId, input.proposalId)).drone;
  }

  /** Workspace default drone fee in pence; falls back to the built-in one. */
  async getDroneDefaultFee(accountId: string): Promise<number> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(accountId);
    await surveys.ensureUserAndPermission(accountId, 'invoices.view');
    const { data, error } = await this.db
      .from('survey_account_settings')
      .select('drone_fee_pence')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message ?? 'Could not load drone fee');
    const fee = (data as { drone_fee_pence?: unknown } | null)?.drone_fee_pence;
    return typeof fee === 'number' ? fee : DEFAULT_DRONE_FEE_PENCE;
  }

  async saveDroneDefaultFee(input: SaveDroneDefaultFeeInput): Promise<number> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(input.accountId);
    await surveys.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const { error } = await this.db
      .from('survey_account_settings')
      .upsert(
        { account_id: input.accountId, drone_fee_pence: input.feePence },
        { onConflict: 'account_id' },
      );
    if (error) throw new Error(error.message ?? 'Could not save drone fee');
    return input.feePence;
  }

  /**
   * Update the front cover: choose or clear the photo, and/or set the crop
   * and position. Choosing a different photo resets the crop unless one is
   * supplied.
   */
  async updateCover(input: UpdateSurveyCoverInput) {
    await this.assertEditableDraft(input.accountId, input.proposalId);
    const payload: Record<string, unknown> = {};

    if (input.photoDocId !== undefined) {
      if (input.photoDocId) {
        const { data: doc, error } = await this.db
          .from('docs')
          .select('id, mime_type, kind')
          .eq('id', input.photoDocId)
          .eq('account_id', input.accountId)
          .eq('proposal_id', input.proposalId)
          .maybeSingle();
        if (error) throw new Error(error.message ?? 'Could not load photo');
        const row = doc as { mime_type?: string | null; kind?: string } | null;
        if (!row || row.kind !== 'uploaded') {
          throw new Error('That photo does not belong to this survey');
        }
        if (!row.mime_type?.startsWith('image/')) {
          throw new Error('The cover must be an image');
        }
      }
      payload.survey_cover_photo_doc_id = input.photoDocId;
      if (input.focus === undefined) payload.survey_cover_focus = null;
    }

    if (input.focus !== undefined) {
      payload.survey_cover_focus = input.focus
        ? normalizeCoverFocus(input.focus)
        : null;
    }

    if (Object.keys(payload).length > 0) {
      await this.updateSurvey(input.accountId, input.proposalId, payload);
    }
    const details = await this.getDetails(input.accountId, input.proposalId);
    return {
      photoDocId: details.coverPhotoDocId,
      focus: details.coverFocus,
    };
  }

  /** Signed URL for previewing the survey's chosen cover photo. */
  async getCoverPhotoUrl(
    accountId: string,
    photoDocId: string | null,
  ): Promise<string | null> {
    if (!photoDocId) return null;
    const { data, error } = await this.db
      .from('docs')
      .select('id, file_path, storage_path, storage_bucket')
      .eq('id', photoDocId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      id: string;
      file_path: string | null;
      storage_path: string | null;
      storage_bucket: string | null;
    };
    const urls = await signSurveyPhotoUrls(getSupabaseServerAdminClient(), [
      {
        id: row.id,
        filePath: row.file_path,
        storagePath: row.storage_path,
        storageBucket: row.storage_bucket,
      },
    ]);
    return urls[row.id] ?? null;
  }

  /** Storage path of the workspace default cover image, if one is set. */
  async getCoverDefaultPath(accountId: string): Promise<string | null> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(accountId);
    await surveys.ensureUserAndPermission(accountId, 'invoices.view');
    const { data, error } = await this.db
      .from('survey_account_settings')
      .select('cover_image_path')
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) throw new Error(error.message ?? 'Could not load cover image');
    const path = (data as { cover_image_path?: unknown } | null)
      ?.cover_image_path;
    // Never trust a stored path outside this account's cover folder: the
    // admin client signs and deletes whatever it is given.
    return typeof path === 'string' && isCoverImagePath(accountId, path)
      ? path
      : null;
  }

  /** Signed URL for previewing the workspace default cover image. */
  async getCoverDefaultUrl(accountId: string): Promise<string | null> {
    const path = await this.getCoverDefaultPath(accountId);
    if (!path) return null;
    const { data } = await getSupabaseServerAdminClient()
      .storage.from(ACCOUNT_DOCS_BUCKET)
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  /**
   * Save (or remove) the workspace default cover image. The file is uploaded
   * by the browser first; here we validate it and retire the previous one.
   */
  async saveCoverDefaultImage(
    input: SaveCoverDefaultImageInput,
  ): Promise<string | null> {
    const surveys = this.surveys();
    await surveys.assertBuildingSurveyorAccount(input.accountId);
    await surveys.ensureUserAndPermission(input.accountId, 'invoices.edit');

    const admin = getSupabaseServerAdminClient();
    const previous = await this.getCoverDefaultPath(input.accountId);

    if (input.filePath) {
      if (!isCoverImagePath(input.accountId, input.filePath)) {
        throw new Error('Invalid file path');
      }
      const { data: file, error: downloadError } = await admin.storage
        .from(ACCOUNT_DOCS_BUCKET)
        .download(input.filePath);
      if (downloadError || !file) {
        throw new Error(
          downloadError?.message ?? 'Could not read the uploaded image',
        );
      }
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (!looksLikeImage(header)) {
        await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([input.filePath]);
        throw new Error('Use a JPEG, PNG or WebP image');
      }
      if (file.size > COVER_IMAGE_MAX_BYTES) {
        await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([input.filePath]);
        throw new Error('The cover image must be 10 MB or smaller');
      }
    }

    const { error } = await this.db
      .from('survey_account_settings')
      .upsert(
        { account_id: input.accountId, cover_image_path: input.filePath },
        { onConflict: 'account_id' },
      );
    if (error) throw new Error(error.message ?? 'Could not save cover image');

    if (previous && previous !== input.filePath) {
      await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([previous]);
    }
    return input.filePath;
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
