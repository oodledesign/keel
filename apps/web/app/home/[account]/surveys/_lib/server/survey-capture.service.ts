import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { requireUser } from '@kit/supabase/require-user';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { generateSurveyReportHtml } from '~/lib/ai/survey-report-generate';
import {
  buildingSurveySectionByKey,
  observationsFromTranscript,
} from '~/lib/building-surveyor/report-sections';
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
  SurveyObservation,
  SurveyTranscriptSummary,
  UpdateSurveyObservationInput,
  UpdateSurveyTypeInput,
} from '../schema/survey-capture.schema';

type SurveyRow = {
  id: string;
  account_id: string;
  kind?: string | null;
  title?: string | null;
  status?: string | null;
  content_html?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  recipient_name?: string | null;
  survey_type?: string | null;
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

  private async ensureUserAndPermission(
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
        'id, account_id, kind, title, status, content_html, client_id, deal_id, recipient_name, survey_type',
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
      .select('id, title, pinned_section_key, photo_role')
      .eq('account_id', accountId)
      .eq('proposal_id', proposalId)
      .not('pinned_section_key', 'is', null)
      .order('created_at', { ascending: true });
    if (error) this.throwErr(error);

    return ((data ?? []) as Array<Record<string, unknown>>)
      .filter((row) => typeof row.pinned_section_key === 'string')
      .map((row) => ({
        id: row.id as string,
        title: (row.title as string | null) ?? 'Survey photo',
        sectionKey: row.pinned_section_key as string,
        photoRole: (row.photo_role as string | null) ?? 'archive',
      }));
  }

  async addTranscript(input: AddSurveyTranscriptInput) {
    await this.assertBuildingSurveyorAccount(input.accountId);
    const user = await this.ensureUserAndPermission(
      input.accountId,
      'invoices.edit',
    );
    const survey = await this.getSurvey(input.accountId, input.proposalId);

    if (!survey.client_id && !survey.deal_id) {
      throw new Error(
        'This survey needs a client or enquiry before transcripts can be added',
      );
    }

    const content = input.content.trim();
    const drafts = observationsFromTranscript(content);
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

    const [observations, transcripts, photos] = await Promise.all([
      this.listObservations(input.accountId, input.proposalId),
      this.listLinkedTranscripts(
        input.accountId,
        input.proposalId,
        survey.client_id,
        survey.deal_id,
      ),
      this.listPinnedPhotos(input.accountId, input.proposalId),
    ]);

    if (observations.length === 0 && transcripts.length === 0) {
      throw new Error(
        'Add a site transcript or observation before drafting the report',
      );
    }

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
        })),
        surveyType: normalizeBuildingSurveyType(survey.survey_type),
      },
      { accountId: input.accountId, supabase: this.client },
    );

    const { error } = await this.db
      .from('proposals')
      .update({ content_html: result.contentHtml })
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
}
