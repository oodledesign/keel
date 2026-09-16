import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'node:crypto';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { groupSurveyObservations } from '~/lib/ai/survey-observation-group';
import { curateSurveyPhotos } from '~/lib/ai/survey-photo-curate';
import { generateSurveyReportHtml } from '~/lib/ai/survey-report-generate';
import { combineSurveyStyleGuidance } from '~/lib/ai/survey-style-distill';
import { buildingSurveySectionByKey } from '~/lib/building-surveyor/report-sections';
import { signSurveyPhotoUrls } from '~/lib/building-surveyor/survey-photo-urls';
import {
  type BuildingSurveyTypeKey,
  DEFAULT_BUILDING_SURVEY_TYPE,
  normalizeBuildingSurveyType,
} from '~/lib/building-surveyor/survey-types';
import type { Database } from '~/lib/database.types';

import type {
  AddSurveyTranscriptInput,
  CreateSurveyObservationInput,
  DeleteSurveyObservationInput,
  GenerateSurveyDraftInput,
  ProposeSurveyPhotoCurationInput,
  ReorderSurveyPhotosInput,
  SetSurveyPhotoShareInput,
  SurveyObservation,
  SurveyPhotoShare,
  SurveyStyleExample,
  SurveyTranscriptSummary,
  UpdateSurveyObservationInput,
  UpdateSurveyPhotoCurationInput,
  UpdateSurveyTypeInput,
} from '../schema/survey-capture.schema';

type SurveyRow = {
  id: string;
  account_id: string;
  kind?: string | null;
  title?: string | null;
  status?: string | null;
  content_html?: string | null;
  body_document?: unknown;
  client_id?: string | null;
  deal_id?: string | null;
  recipient_name?: string | null;
  survey_type?: string | null;
  photo_share_token?: string | null;
  photo_share_enabled?: boolean | null;
};

function mapObservation(row: Record<string, unknown>): SurveyObservation {
  return {
    id: row.id as string,
    proposalId: row.proposal_id as string,
    transcriptId: (row.transcript_id as string | null) ?? null,
    sectionKey: row.section_key as string,
    body: (row.body as string | null) ?? '',
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createSurveyCaptureService(client: SupabaseClient<Database>) {
  return new SurveyCaptureService(client);
}

class SurveyCaptureService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  // Database types lag survey_type / survey_observations / transcript.proposal_id.
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

  async ensureUserAndPermission(
    accountId: string,
    permission: 'invoices.view' | 'invoices.edit',
  ) {
    const { data: user } = await requireUser(this.client);
    if (!user) throw new Error('Authentication required');

    const api = createTeamAccountsApi(this.client);
    const hasPermission = await api.hasPermission({
      userId: user.id,
      accountId,
      permission,
    });
    if (!hasPermission) throw new Error('Permission denied');
    return user;
  }

  async assertBuildingSurveyorAccount(accountId: string) {
    const { data, error } = await this.db
      .from('accounts')
      .select('id, space_type')
      .eq('id', accountId)
      .maybeSingle();
    if (error) this.throwErr(error);
    if (
      (data as { space_type?: string } | null)?.space_type !==
      'building-surveyor'
    ) {
      throw new Error(
        'This action is only available in a building-surveyor workspace',
      );
    }
  }

  async getSurvey(accountId: string, proposalId: string): Promise<SurveyRow> {
    const { data, error } = await this.db
      .from('proposals')
      .select(
        'id, account_id, kind, title, status, content_html, body_document, client_id, deal_id, recipient_name, survey_type, photo_share_token, photo_share_enabled',
      )
      .eq('id', proposalId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (error) this.throwErr(error);
    if (!data || (data as SurveyRow).kind !== 'survey_report') {
      throw new Error('Survey not found');
    }
    return data as SurveyRow;
  }

  async listObservations(
    accountId: string,
    proposalId: string,
  ): Promise<SurveyObservation[]> {
    const { data, error } = await this.db
      .from('survey_observations')
      .select(
        'id, proposal_id, transcript_id, section_key, body, sort_order, created_at, updated_at',
      )
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) this.throwErr(error);
    return ((data ?? []) as Array<Record<string, unknown>>).map(mapObservation);
  }

  async listLinkedTranscripts(
    accountId: string,
    proposalId: string,
    clientId?: string | null,
    dealId?: string | null,
  ): Promise<SurveyTranscriptSummary[]> {
    let query = this.db
      .from('meeting_transcripts')
      .select(
        'id, title, content, source, meeting_date, created_at, proposal_id, client_id, deal_id',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (clientId && dealId) {
      query = query.or(
        `proposal_id.eq.${proposalId},and(proposal_id.is.null,client_id.eq.${clientId}),and(proposal_id.is.null,deal_id.eq.${dealId})`,
      );
    } else if (clientId) {
      query = query.or(
        `proposal_id.eq.${proposalId},and(proposal_id.is.null,client_id.eq.${clientId})`,
      );
    } else if (dealId) {
      query = query.or(
        `proposal_id.eq.${proposalId},and(proposal_id.is.null,deal_id.eq.${dealId})`,
      );
    } else {
      query = query.eq('proposal_id', proposalId);
    }

    const { data, error } = await query;
    if (error) this.throwErr(error);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      title: ((row.title as string | null) ?? 'Site transcript').trim(),
      content: (row.content as string | null) ?? '',
      source: (row.source as string | null) ?? 'paste',
      meetingDate: (row.meeting_date as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  }

  async listPinnedPhotos(accountId: string, proposalId: string) {
    const { data, error } = await this.db
      .from('docs')
      .select(
        'id, title, pinned_section_key, photo_role, caption, curated_sort_order, created_at, mime_type, file_path, storage_path, storage_bucket',
      )
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .not('pinned_section_key', 'is', null)
      .eq('kind', 'uploaded')
      .order('curated_sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error) this.throwErr(error);

    return ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => typeof row.pinned_section_key === 'string')
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string | null) ?? 'Survey photo',
        documentId: row.id as string,
        sectionKey: row.pinned_section_key as string,
        photoRole: (row.photo_role as string | null) ?? 'archive',
        caption: (row.caption as string | null) ?? null,
        filePath: (row.file_path as string | null) ?? null,
        storagePath: (row.storage_path as string | null) ?? null,
        storageBucket: (row.storage_bucket as string | null) ?? null,
        curatedSortOrder:
          row.curated_sort_order === null ||
          row.curated_sort_order === undefined
            ? null
            : Number(row.curated_sort_order),
      }));
  }

  getPhotoShare(survey: SurveyRow): SurveyPhotoShare {
    return {
      enabled: Boolean(survey.photo_share_enabled),
      token: (survey.photo_share_token as string | null) ?? null,
    };
  }

  async listStyleExamples(accountId: string): Promise<SurveyStyleExample[]> {
    const { data, error } = await this.db
      .from('survey_style_examples')
      .select(
        'id, title, original_filename, mime_type, style_notes, extracted_text, created_at',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) this.throwErr(error);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      title: (row.title as string | null) ?? 'Past report',
      originalFilename: (row.original_filename as string | null) ?? null,
      mimeType: (row.mime_type as string | null) ?? null,
      styleNotes: (row.style_notes as string | null) ?? null,
      extractedPreview: ((row.extracted_text as string | null) ?? '')
        .replace(/\s+/g, ' ')
        .slice(0, 220),
      createdAt: row.created_at as string,
    }));
  }

  async addTranscript(input: AddSurveyTranscriptInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    const survey = await this.getSurvey(input.accountId, input.proposalId);

    const content = input.content.trim();
    const grouping = await groupSurveyObservations({
      transcript: content,
      accountId: input.accountId,
      supabase: this.client,
    });
    const drafts = grouping.drafts;
    if (drafts.length === 0) {
      throw new Error(
        'Could not find usable observations in that transcript. Add more complete sentences.',
      );
    }

    const { data: transcript, error } = await this.db
      .from('meeting_transcripts')
      .insert({
        account_id: input.accountId,
        client_id: survey.client_id ?? null,
        deal_id: survey.deal_id ?? null,
        proposal_id: survey.id,
        title: input.title?.trim() || 'Site transcript',
        content,
        source: 'paste',
        meeting_date: input.meetingDate?.trim() || null,
        created_by: user.id,
      })
      .select('id, title, content, source, meeting_date, created_at')
      .single();
    if (error || !transcript) {
      this.throwErr(error, 'Could not save transcript');
    }

    const { data: maxRow } = await this.db
      .from('survey_observations')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('proposal_id', survey.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const startOrder = Number(maxRow?.sort_order ?? -1) + 1;

    const rows = drafts.map((draft, index) => ({
      account_id: input.accountId,
      proposal_id: survey.id,
      transcript_id: transcript.id,
      section_key: draft.sectionKey,
      body: draft.body,
      sort_order: startOrder + index,
      created_by: user.id,
    }));

    const { data: inserted, error: insertError } = await this.db
      .from('survey_observations')
      .insert(rows)
      .select(
        'id, proposal_id, transcript_id, section_key, body, sort_order, created_at, updated_at',
      );
    if (insertError) this.throwErr(insertError);

    return {
      transcript: {
        id: transcript.id as string,
        title: (transcript.title as string | null) ?? 'Site transcript',
        content: (transcript.content as string | null) ?? content,
        source: (transcript.source as string | null) ?? 'paste',
        meetingDate: (transcript.meeting_date as string | null) ?? null,
        createdAt: transcript.created_at as string,
      },
      observations: ((inserted ?? []) as Array<Record<string, unknown>>).map(
        mapObservation,
      ),
      groupingSource: grouping.source,
      groupingFallbackReason: grouping.fallbackReason,
    };
  }

  async createObservation(input: CreateSurveyObservationInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    await this.getSurvey(input.accountId, input.proposalId);

    if (!buildingSurveySectionByKey(input.sectionKey)) {
      throw new Error('Unknown survey section');
    }

    const { data: maxRow } = await this.db
      .from('survey_observations')
      .select('sort_order')
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await this.db
      .from('survey_observations')
      .insert({
        account_id: input.accountId,
        proposal_id: input.proposalId,
        section_key: input.sectionKey,
        body: input.body.trim(),
        sort_order: Number(maxRow?.sort_order ?? -1) + 1,
        created_by: user.id,
      })
      .select(
        'id, proposal_id, transcript_id, section_key, body, sort_order, created_at, updated_at',
      )
      .single();
    if (error || !data) this.throwErr(error, 'Could not add observation');
    return mapObservation(data as Record<string, unknown>);
  }

  async updateObservation(input: UpdateSurveyObservationInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    const payload: Record<string, unknown> = {};
    if (input.sectionKey !== undefined) {
      if (!buildingSurveySectionByKey(input.sectionKey)) {
        throw new Error('Unknown survey section');
      }
      payload.section_key = input.sectionKey;
    }
    if (input.body !== undefined) {
      payload.body = input.body.trim();
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('Nothing to update');
    }

    const { data, error } = await this.db
      .from('survey_observations')
      .update(payload)
      .eq('id', input.observationId)
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .select(
        'id, proposal_id, transcript_id, section_key, body, sort_order, created_at, updated_at',
      )
      .single();
    if (error || !data) this.throwErr(error, 'Could not update observation');
    return mapObservation(data as Record<string, unknown>);
  }

  async deleteObservation(input: DeleteSurveyObservationInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    const { error } = await this.db
      .from('survey_observations')
      .delete()
      .eq('id', input.observationId)
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId);
    if (error) this.throwErr(error);
    return { ok: true };
  }

  async updateSurveyType(input: UpdateSurveyTypeInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    const { error } = await this.db
      .from('proposals')
      .update({ survey_type: input.surveyType })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);
    return { surveyType: input.surveyType };
  }

  async generateDraft(input: GenerateSurveyDraftInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const survey = await this.getSurvey(input.accountId, input.proposalId);
    if (survey.status !== 'draft') {
      throw new Error('Sent or finalised surveys can no longer be redrafted');
    }

    const [observations, transcripts, photos, styleExamples] =
      await Promise.all([
        this.listObservations(input.accountId, input.proposalId),
        this.listLinkedTranscripts(
          input.accountId,
          input.proposalId,
          survey.client_id,
          survey.deal_id,
        ),
        this.listPinnedPhotos(input.accountId, input.proposalId),
        this.listStyleExamples(input.accountId),
      ]);

    if (observations.length === 0 && transcripts.length === 0) {
      throw new Error(
        'Add a site meeting or observation before drafting the report',
      );
    }

    const photoUrls = await signSurveyPhotoUrls(
      getSupabaseServerAdminClient(),
      photos.map((photo) => ({
        id: photo.documentId,
        filePath: photo.filePath,
        storagePath: photo.storagePath,
        storageBucket: photo.storageBucket,
      })),
    );

    const result = await generateSurveyReportHtml(
      {
        propertyLabel:
          survey.title?.trim() ||
          survey.recipient_name?.trim() ||
          'Survey property',
        clientName: survey.recipient_name,
        accountName: input.accountName,
        surveyorName: input.surveyorName,
        transcripts: transcripts.map((item) => ({
          title: item.title,
          content: item.content,
        })),
        observations: observations.map((item) => ({
          sectionKey: item.sectionKey,
          body: item.body,
        })),
        pinnedPhotos: photos.map((photo) => ({
          sectionKey: photo.sectionKey,
          title: photo.title,
          caption: photo.caption,
          documentId: photo.documentId,
          url: photoUrls[photo.documentId] ?? null,
        })),
        surveyType: normalizeBuildingSurveyType(survey.survey_type),
        styleGuidance: combineSurveyStyleGuidance(
          styleExamples.map((example) => ({
            title: example.title,
            styleNotes: example.styleNotes,
          })),
        ),
      },
      { accountId: input.accountId, supabase: this.client },
    );

    const { error } = await this.db
      .from('proposals')
      .update({
        content_html: result.contentHtml,
        body_document: result.document,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    return {
      ...result,
      surveyType:
        (survey.survey_type as BuildingSurveyTypeKey | null) ??
        DEFAULT_BUILDING_SURVEY_TYPE,
    };
  }

  async proposePhotoCuration(input: ProposeSurveyPhotoCurationInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    const [observations, photos] = await Promise.all([
      this.listObservations(input.accountId, input.proposalId),
      this.listLibraryPhotos(input.accountId, input.proposalId),
    ]);

    const imagePhotos = photos.filter(
      (photo) => !photo.mimeType || photo.mimeType.startsWith('image/'),
    );

    const result = await curateSurveyPhotos({
      photos: imagePhotos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        createdAt: photo.createdAt,
      })),
      observations: observations.map((item) => ({
        sectionKey: item.sectionKey,
        body: item.body,
      })),
      accountId: input.accountId,
      supabase: this.client,
    });

    const curatedIds = new Set(result.items.map((item) => item.docId));

    for (const photo of imagePhotos) {
      const proposal = result.items.find((item) => item.docId === photo.id);
      if (proposal) {
        const { error } = await this.db
          .from('docs')
          .update({
            photo_role: 'curated',
            pinned_section_key: proposal.sectionKey,
            caption: proposal.caption,
            curated_sort_order: proposal.sortOrder,
          })
          .eq('id', photo.id)
          .eq('account_id', input.accountId)
          .eq('proposal_id', input.proposalId)
          .eq('kind', 'uploaded');
        if (error) this.throwErr(error);
        continue;
      }

      if (photo.photoRole === 'curated' || photo.pinnedSectionKey) {
        const { error } = await this.db
          .from('docs')
          .update({
            photo_role: 'archive',
            pinned_section_key: null,
            caption: null,
            curated_sort_order: null,
          })
          .eq('id', photo.id)
          .eq('account_id', input.accountId)
          .eq('proposal_id', input.proposalId)
          .eq('kind', 'uploaded');
        if (error) this.throwErr(error);
      }
    }

    return {
      ...result,
      curatedCount: curatedIds.size,
    };
  }

  async updatePhotoCuration(input: UpdateSurveyPhotoCurationInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    const payload: Record<string, unknown> = {};
    if (input.sectionKey !== undefined) {
      if (input.sectionKey && !buildingSurveySectionByKey(input.sectionKey)) {
        throw new Error('Unknown survey section');
      }
      payload.pinned_section_key = input.sectionKey;
      payload.photo_role = input.sectionKey ? 'curated' : 'archive';
      if (!input.sectionKey) {
        payload.curated_sort_order = null;
      }
    }
    if (input.caption !== undefined) {
      payload.caption = input.caption?.trim() || null;
    }
    if (input.photoRole !== undefined) {
      payload.photo_role = input.photoRole;
      if (input.photoRole === 'archive') {
        payload.pinned_section_key = null;
        payload.curated_sort_order = null;
      }
    }
    if (input.curatedSortOrder !== undefined) {
      payload.curated_sort_order = input.curatedSortOrder;
    }
    if (Object.keys(payload).length === 0) {
      throw new Error('Nothing to update');
    }

    const { error } = await this.db
      .from('docs')
      .update(payload)
      .eq('id', input.docId)
      .eq('account_id', input.accountId)
      .eq('proposal_id', input.proposalId)
      .eq('kind', 'uploaded');
    if (error) this.throwErr(error);
    return { ok: true };
  }

  async reorderCuratedPhotos(input: ReorderSurveyPhotosInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    await this.getSurvey(input.accountId, input.proposalId);

    if (!buildingSurveySectionByKey(input.sectionKey)) {
      throw new Error('Unknown survey section');
    }

    for (const [index, docId] of input.orderedDocIds.entries()) {
      const { error } = await this.db
        .from('docs')
        .update({
          curated_sort_order: index,
          photo_role: 'curated',
          pinned_section_key: input.sectionKey,
        })
        .eq('id', docId)
        .eq('account_id', input.accountId)
        .eq('proposal_id', input.proposalId)
        .eq('pinned_section_key', input.sectionKey)
        .eq('kind', 'uploaded');
      if (error) this.throwErr(error);
    }

    return { ok: true };
  }

  async setPhotoShare(input: SetSurveyPhotoShareInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    await this.ensureUserAndPermission(input.accountId, 'invoices.edit');
    const survey = await this.getSurvey(input.accountId, input.proposalId);

    const token =
      input.enabled && !survey.photo_share_token
        ? randomBytes(24).toString('hex')
        : (survey.photo_share_token ?? null);

    const { error } = await this.db
      .from('proposals')
      .update({
        photo_share_enabled: input.enabled,
        photo_share_token: token,
      })
      .eq('id', input.proposalId)
      .eq('account_id', input.accountId)
      .eq('kind', 'survey_report');
    if (error) this.throwErr(error);

    return { enabled: input.enabled, token };
  }

  private async listLibraryPhotos(accountId: string, proposalId: string) {
    const { data, error } = await this.db
      .from('docs')
      .select(
        'id, title, mime_type, created_at, pinned_section_key, photo_role, caption',
      )
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .eq('kind', 'uploaded')
      .order('created_at', { ascending: true });
    if (error) this.throwErr(error);

    return ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => {
        const mime = String(row.mime_type ?? '')
          .trim()
          .toLowerCase();
        return !mime || mime.startsWith('image/');
      })
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string | null) ?? 'Survey photo',
        mimeType: (row.mime_type as string | null) ?? null,
        createdAt: (row.created_at as string | null) ?? null,
        pinnedSectionKey: (row.pinned_section_key as string | null) ?? null,
        photoRole: (row.photo_role as string | null) ?? 'archive',
        caption: (row.caption as string | null) ?? null,
      }));
  }
}
