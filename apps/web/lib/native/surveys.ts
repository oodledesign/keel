import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { groupSurveyObservations } from '~/lib/ai/survey-observation-group';
import { queueBrainIndexSource } from '~/lib/brain/sync';
import { extractUkPostcode } from '~/lib/building-surveyor/epc/parse';
import { buildingSurveyBlankHtml } from '~/lib/building-surveyor/report-sections';
import {
  normalizeSurveyLevel,
  surveyLevelFromType,
  surveyTypeForLevel,
} from '~/lib/building-surveyor/survey-types';
import { parseTranscriptContent } from '~/lib/recorder/transcript-speakers';

import { NativeHttpError } from './http';
import {
  parseNativeMeetingDate,
  parseNativeMeetingSource,
} from './meetings-shared';
import {
  appendSurveySectionNote,
  mapNativeOnSiteSections,
  requireOnSiteSurveySection,
  resolveOnSiteSurveySection,
} from './survey-sections';
import {
  type NativeSurvey,
  type NativeSurveyDetail,
  type NativeSurveyPhoto,
  type NativeSurveyRow,
  type NativeSurveySession,
  mapNativeSurvey,
  parseNativeSurveyId,
  parseNativeSurveyType,
  workspaceShowsNativeSurveys,
} from './surveys-shared';
import type { NativeTaskClientRow } from './task-map';
import { nativeClientName, parseOptionalClientId } from './task-map';
import { type NativeWorkspace } from './workspace-shared';

export type {
  NativeOnSiteSection,
  NativeSurvey,
  NativeSurveyDetail,
  NativeSurveyPhoto,
  NativeSurveySession,
} from './surveys-shared';
export {
  mapNativeSurvey,
  NATIVE_SURVEY_TYPES,
  parseNativeSurveyType,
  workspaceShowsNativeSurveys,
} from './surveys-shared';
export {
  appendSurveySectionNote,
  mapNativeOnSiteSections,
  requireOnSiteSurveySection,
} from './survey-sections';

const LIST_LIMIT = 80;
const SURVEY_SELECT =
  'id, title, status, survey_type, survey_level, survey_property_address, survey_property_postcode, survey_uprn, survey_flood_risk_band, survey_flood_risk_summary, client_id, created_at, updated_at';

function requireSurveyWorkspace(workspace: NativeWorkspace) {
  if (!workspaceShowsNativeSurveys(workspace.profile)) {
    throw new NativeHttpError(
      400,
      'Surveys are only available on building surveyor workspaces',
    );
  }
}

async function loadClientRows(
  client: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, NativeTaskClientRow>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .in('id', unique);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, NativeTaskClientRow>();
  for (const row of (data ?? []) as NativeTaskClientRow[]) {
    map.set(row.id, row);
  }
  return map;
}

async function requireClientInWorkspace(
  client: SupabaseClient,
  clientId: string,
  accountId: string,
): Promise<NativeTaskClientRow> {
  const { data, error } = await client
    .from('clients')
    .select(
      'id, display_name, first_name, last_name, company_name, client_type',
    )
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new NativeHttpError(400, 'client_id must belong to this workspace');
  }
  return data as NativeTaskClientRow;
}

function surveyFailed(
  error: { message?: string; code?: string } | null,
  fallback: string,
): never {
  const message = error?.message ?? fallback;
  if (
    error?.code === '42501' ||
    /row-level security|permission denied|policy/i.test(message)
  ) {
    throw new NativeHttpError(403, 'You cannot save surveys in this workspace');
  }
  throw new NativeHttpError(400, message);
}

async function loadSurveyRow(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  surveyId: string,
): Promise<NativeSurveyRow> {
  const id = parseNativeSurveyId(surveyId);
  const { data, error } = await client
    .from('proposals')
    .select(SURVEY_SELECT)
    .eq('id', id)
    .eq('account_id', workspace.id)
    .eq('kind', 'survey_report')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new NativeHttpError(404, 'Survey not found');
  }
  return data as NativeSurveyRow;
}

async function countByProposal(
  client: SupabaseClient,
  table: 'meeting_transcripts' | 'docs',
  accountId: string,
  proposalIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (proposalIds.length === 0) {
    return counts;
  }

  let query = client
    .from(table)
    .select(table === 'docs' ? 'proposal_id, mime_type' : 'proposal_id')
    .eq('account_id', accountId);

  if (table === 'docs') {
    query = query.eq('kind', 'uploaded');
  }

  const { data, error } = await query.in('proposal_id', proposalIds);
  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as Array<{
    proposal_id?: string | null;
    mime_type?: string | null;
  }>) {
    const id = row.proposal_id?.trim();
    if (!id) continue;
    if (table === 'docs' && isNonImageMime(row.mime_type)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function isNonImageMime(mime: string | null | undefined) {
  const value = mime?.trim().toLowerCase() ?? '';
  return value.length > 0 && !value.startsWith('image/');
}

export async function listNativeSurveys(
  client: SupabaseClient,
  workspace: NativeWorkspace,
): Promise<{ items: NativeSurvey[] }> {
  if (!workspaceShowsNativeSurveys(workspace.profile)) {
    return { items: [] };
  }

  const { data, error } = await client
    .from('proposals')
    .select(SURVEY_SELECT)
    .eq('account_id', workspace.id)
    .eq('kind', 'survey_report')
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as NativeSurveyRow[];
  const ids = rows.map((row) => row.id);
  const [clients, sessions, photos] = await Promise.all([
    loadClientRows(
      client,
      rows.map((row) => row.client_id ?? '').filter(Boolean),
    ),
    countByProposal(client, 'meeting_transcripts', workspace.id, ids),
    countByProposal(client, 'docs', workspace.id, ids),
  ]);

  return {
    items: rows.map((row) =>
      mapNativeSurvey(row, workspace.slug || workspace.id, {
        clientName: row.client_id
          ? nativeClientName(clients.get(row.client_id))
          : null,
        sessionCount: sessions.get(row.id) ?? 0,
        photoCount: photos.get(row.id) ?? 0,
      }),
    ),
  };
}

export async function getNativeSurvey(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  surveyId: string,
): Promise<NativeSurveyDetail> {
  requireSurveyWorkspace(workspace);
  const row = await loadSurveyRow(client, workspace, surveyId);

  const [clients, sessionRows, photoRows, observationRows] = await Promise.all([
    loadClientRows(client, [row.client_id ?? ''].filter(Boolean)),
    client
      .from('meeting_transcripts')
      .select(
        'id, title, content, source, duration_seconds, meeting_date, created_at',
      )
      .eq('account_id', workspace.id)
      .eq('proposal_id', row.id)
      .order('created_at', { ascending: false }),
    client
      .from('docs')
      .select(
        'id, title, mime_type, created_at, file_path, storage_path, storage_bucket, kind, pinned_section_key',
      )
      .eq('account_id', workspace.id)
      .eq('proposal_id', row.id)
      .eq('kind', 'uploaded')
      .order('created_at', { ascending: false }),
    client
      .from('survey_observations')
      .select('transcript_id, section_key, rics_code, body, sort_order')
      .eq('account_id', workspace.id)
      .eq('proposal_id', row.id)
      .order('sort_order', { ascending: true }),
  ]);

  if (sessionRows.error) {
    throw new Error(sessionRows.error.message);
  }
  if (photoRows.error) {
    throw new Error(photoRows.error.message);
  }
  if (observationRows.error) {
    throw new Error(observationRows.error.message);
  }

  const observations = (observationRows.data ?? []) as Array<{
    transcript_id?: string | null;
    section_key?: string | null;
    rics_code?: string | null;
    body?: string | null;
  }>;
  const sessionSection = new Map<
    string,
    { rics_code: string | null; section_key: string | null }
  >();
  const notesByCode = new Map<string, string>();
  for (const observation of observations) {
    const sectionKey = observation.section_key?.trim() || null;
    const ricsCode = observation.rics_code?.trim() || null;
    const transcriptId = observation.transcript_id?.trim();
    if (transcriptId && !sessionSection.has(transcriptId)) {
      sessionSection.set(transcriptId, {
        rics_code: ricsCode,
        section_key: sectionKey,
      });
    }
    const body = observation.body?.trim() ?? '';
    if (!body) continue;
    for (const key of [ricsCode, sectionKey].filter(Boolean) as string[]) {
      notesByCode.set(key, appendSurveySectionNote(notesByCode.get(key), body));
    }
  }

  const sessions: NativeSurveySession[] = (
    (sessionRows.data ?? []) as Array<Record<string, unknown>>
  ).map((item) => {
    const id = String(item.id);
    const linked = sessionSection.get(id);
    return {
      id,
      title: String(item.title ?? 'Site notes').trim() || 'Site notes',
      content: String(item.content ?? ''),
      duration_seconds:
        typeof item.duration_seconds === 'number'
          ? item.duration_seconds
          : null,
      source: (item.source as string | null) ?? null,
      meeting_date: (item.meeting_date as string | null) ?? null,
      created_at: String(item.created_at ?? ''),
      rics_code: linked?.rics_code ?? null,
      section_key: linked?.section_key ?? null,
    };
  });

  const photos = await signSurveyPhotos(
    (photoRows.data ?? []) as Array<Record<string, unknown>>,
  );
  const photoCountByKey = new Map<string, number>();
  for (const photo of photos) {
    for (const key of [photo.section_key, photo.rics_code].filter(
      Boolean,
    ) as string[]) {
      photoCountByKey.set(key, (photoCountByKey.get(key) ?? 0) + 1);
    }
  }

  const mapped = mapNativeSurvey(row, workspace.slug || workspace.id, {
    clientName: row.client_id
      ? nativeClientName(clients.get(row.client_id))
      : null,
    sessionCount: sessions.length,
    photoCount: photos.length,
  });

  return {
    ...mapped,
    sessions,
    photos,
    sections: mapNativeOnSiteSections({
      level: mapped.survey_level,
      notesByCode,
      photoCountByKey,
    }),
  };
}

async function signSurveyPhotos(
  rows: Array<Record<string, unknown>>,
): Promise<NativeSurveyPhoto[]> {
  const admin = getSupabaseServerAdminClient();
  const photos: NativeSurveyPhoto[] = [];

  for (const row of rows) {
    const path = String(row.file_path ?? row.storage_path ?? '');
    const bucket = String(row.storage_bucket ?? ACCOUNT_DOCS_BUCKET);
    let previewUrl: string | null = null;
    const mime = (row.mime_type as string | null) ?? null;
    if (isNonImageMime(mime)) {
      continue;
    }
    if (path && mime?.startsWith('image/')) {
      const { data } = await admin.storage
        .from(bucket)
        .createSignedUrl(path, 3600);
      previewUrl = data?.signedUrl ?? null;
    }
    const sectionKey = String(row.pinned_section_key ?? '').trim() || null;
    const section = sectionKey
      ? resolveOnSiteSurveySection(sectionKey)
      : undefined;
    photos.push({
      id: String(row.id),
      title: String(row.title ?? 'Survey photo'),
      mime_type: mime,
      created_at: (row.created_at as string | null) ?? null,
      preview_url: previewUrl,
      rics_code: section?.ricsCode ?? null,
      section_key: section?.key ?? sectionKey,
    });
  }

  return photos;
}

export async function createNativeSurvey(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  title: string;
  surveyType?: string | null;
  surveyLevel?: number | string | null;
  address?: string | null;
  postcode?: string | null;
  uprn?: string | null;
  clientId?: string | null;
}): Promise<NativeSurvey> {
  requireSurveyWorkspace(input.workspace);

  const title = input.title.trim();
  if (!title) {
    throw new NativeHttpError(400, 'A property address or title is required');
  }

  const clientId = parseOptionalClientId(input.clientId ?? undefined) ?? null;
  let clientRow: NativeTaskClientRow | null = null;
  if (clientId) {
    clientRow = await requireClientInWorkspace(
      input.client,
      clientId,
      input.workspace.id,
    );
  }

  const surveyLevel = input.surveyLevel
    ? normalizeSurveyLevel(input.surveyLevel)
    : surveyLevelFromType(input.surveyType);
  const surveyType = input.surveyLevel
    ? surveyTypeForLevel(surveyLevel)
    : parseNativeSurveyType(input.surveyType);
  const address = input.address?.trim() || title;
  const postcode =
    input.postcode?.trim() ||
    extractUkPostcode(input.postcode) ||
    extractUkPostcode(address);
  const { data, error } = await input.client
    .from('proposals')
    .insert({
      account_id: input.workspace.id,
      client_id: clientId,
      deal_id: null,
      kind: 'survey_report',
      survey_type: surveyType,
      survey_level: surveyLevel,
      survey_property_address: address,
      survey_property_postcode: postcode,
      survey_uprn: input.uprn?.trim() || null,
      title,
      content_html: buildingSurveyBlankHtml(),
      status: 'draft',
      recipient_name: clientRow ? nativeClientName(clientRow) : null,
      currency: 'gbp',
      created_by: input.userId,
    } as never)
    .select(SURVEY_SELECT)
    .single();

  if (error || !data) {
    surveyFailed(error, 'Could not create survey');
  }

  const row = data as NativeSurveyRow;
  queueBrainIndexSource(input.workspace.id, 'proposal', row.id);
  return mapNativeSurvey(row, input.workspace.slug || input.workspace.id, {
    clientName: nativeClientName(clientRow),
    sessionCount: 0,
    photoCount: 0,
  });
}

export async function updateNativeSurveyPrep(input: {
  client: SupabaseClient;
  workspace: NativeWorkspace;
  surveyId: string;
  address?: string | null;
  postcode?: string | null;
  uprn?: string | null;
  surveyLevel?: number | string | null;
}): Promise<NativeSurvey> {
  requireSurveyWorkspace(input.workspace);
  const survey = await loadSurveyRow(
    input.client,
    input.workspace,
    input.surveyId,
  );

  const surveyLevel =
    input.surveyLevel == null
      ? undefined
      : normalizeSurveyLevel(input.surveyLevel);

  const { data, error } = await input.client
    .from('proposals')
    .update({
      ...(input.address !== undefined
        ? { survey_property_address: input.address?.trim() || null }
        : {}),
      ...(input.postcode !== undefined
        ? {
            survey_property_postcode:
              input.postcode?.trim() || extractUkPostcode(input.postcode),
          }
        : {}),
      ...(input.uprn !== undefined
        ? { survey_uprn: input.uprn?.trim() || null }
        : {}),
      ...(surveyLevel
        ? {
            survey_level: surveyLevel,
            survey_type: surveyTypeForLevel(surveyLevel),
          }
        : {}),
    } as never)
    .eq('id', survey.id)
    .eq('account_id', input.workspace.id)
    .eq('kind', 'survey_report')
    .select(SURVEY_SELECT)
    .single();

  if (error || !data) {
    surveyFailed(error, 'Could not update survey prep');
  }

  return mapNativeSurvey(
    data as NativeSurveyRow,
    input.workspace.slug || input.workspace.id,
  );
}

export async function createNativeSurveySession(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  surveyId: string;
  title?: string | null;
  content: string;
  durationSeconds?: number | null;
  meetingDate?: string | null;
  source?: string | null;
  ricsCode?: string | null;
  audio?: {
    bytes: Buffer;
    filename: string;
    mimeType: string;
  } | null;
}): Promise<{
  session: NativeSurveySession;
  grouping_source: 'ai' | 'keyword_fallback' | 'user';
}> {
  requireSurveyWorkspace(input.workspace);
  const chosenSection = input.ricsCode
    ? requireOnSiteSurveySection(input.ricsCode)
    : undefined;
  const survey = await loadSurveyRow(
    input.client,
    input.workspace,
    input.surveyId,
  );

  const rawContent = input.content.trim();
  const placeholder =
    'Site recording saved. Captions were not available on this device — the audio is in the survey library.';
  const content = rawContent || (input.audio ? placeholder : '');
  if (!content) {
    throw new NativeHttpError(400, 'Recording transcript or audio is required');
  }

  const parsed = parseTranscriptContent(content);
  const speakerSegments = parsed.hasSpeakerLabels ? parsed.segments : null;
  const source = parseNativeMeetingSource(input.source ?? 'iphone');
  const meetingDate = parseNativeMeetingDate(input.meetingDate);
  const title = input.title?.trim() || 'Site notes';
  const duration =
    typeof input.durationSeconds === 'number' &&
    Number.isFinite(input.durationSeconds) &&
    input.durationSeconds >= 0
      ? Math.round(input.durationSeconds)
      : null;

  const { data, error } = await input.client
    .from('meeting_transcripts')
    .insert({
      account_id: input.workspace.id,
      client_id: survey.client_id ?? null,
      deal_id: null,
      proposal_id: survey.id,
      title,
      content,
      speaker_segments: speakerSegments,
      source,
      meeting_date: meetingDate,
      created_by: input.userId,
      duration_seconds: duration,
      recorded_at: new Date().toISOString(),
    } as never)
    .select(
      'id, title, content, source, duration_seconds, meeting_date, created_at',
    )
    .single();

  if (error || !data) {
    surveyFailed(error, 'Could not save the site recording');
  }

  const row = data as Record<string, unknown>;
  const transcriptId = String(row.id);
  queueBrainIndexSource(input.workspace.id, 'transcript', transcriptId);

  if (input.audio) {
    try {
      await storeSurveyFile({
        client: input.client,
        userId: input.userId,
        workspace: input.workspace,
        surveyId: survey.id,
        clientId: survey.client_id ?? null,
        bytes: input.audio.bytes,
        filename: input.audio.filename,
        mimeType: input.audio.mimeType || 'audio/mp4',
        title: `${title} audio`,
        tags: ['survey_audio'],
      });
    } catch (audioError) {
      console.warn('[native/surveys] audio doc upload failed', audioError);
    }
  }

  let groupingSource: 'ai' | 'keyword_fallback' | 'user' = chosenSection
    ? 'user'
    : 'keyword_fallback';

  if (chosenSection) {
    try {
      await upsertUserSectionObservation({
        client: input.client,
        userId: input.userId,
        workspaceId: input.workspace.id,
        surveyId: survey.id,
        transcriptId,
        section: chosenSection,
        body: rawContent,
      });
    } catch (observationError) {
      console.warn(
        '[native/surveys] user section observation failed',
        observationError,
      );
    }
  } else {
    try {
      const grouping = await groupSurveyObservations({
        transcript: content,
        accountId: input.workspace.id,
        supabase: input.client,
      });
      groupingSource = grouping.source;

      if (grouping.drafts.length > 0) {
        const { data: maxRow } = await input.client
          .from('survey_observations')
          .select('sort_order')
          .eq('account_id', input.workspace.id)
          .eq('proposal_id', survey.id)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle();
        const startOrder =
          Number((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) +
          1;

        const { error: observationError } = await input.client
          .from('survey_observations')
          .insert(
            grouping.drafts.map((draft, index) => ({
              account_id: input.workspace.id,
              proposal_id: survey.id,
              transcript_id: transcriptId,
              section_key: draft.sectionKey,
              rics_code: draft.ricsCode ?? null,
              body: draft.body,
              sort_order: startOrder + index,
              created_by: input.userId,
            })) as never,
          );
        if (observationError) {
          console.warn(
            '[native/surveys] observation insert failed',
            observationError,
          );
        }
      }
    } catch (groupingError) {
      console.warn('[native/surveys] grouping failed', groupingError);
    }
  }

  return {
    session: {
      id: transcriptId,
      title,
      content,
      duration_seconds: duration,
      source: (row.source as string | null) ?? source,
      meeting_date: (row.meeting_date as string | null) ?? meetingDate,
      created_at: String(row.created_at ?? ''),
      rics_code: chosenSection?.ricsCode ?? null,
      section_key: chosenSection?.key ?? null,
    },
    grouping_source: groupingSource,
  };
}

async function upsertUserSectionObservation(input: {
  client: SupabaseClient;
  userId: string;
  workspaceId: string;
  surveyId: string;
  transcriptId: string;
  section: ReturnType<typeof requireOnSiteSurveySection>;
  body: string;
}) {
  const incoming = input.body.trim();
  if (!incoming) return;

  const existingQuery = await input.client
    .from('survey_observations')
    .select('id, body')
    .eq('account_id', input.workspaceId)
    .eq('proposal_id', input.surveyId)
    // Catalogue codes are alphanumeric / underscore only (F3, water).
    .or(
      `rics_code.eq.${input.section.ricsCode},section_key.eq.${input.section.key}`,
    )
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) {
    throw new Error(existingQuery.error.message);
  }

  const existing = existingQuery.data as {
    id: string;
    body?: string | null;
  } | null;

  if (existing?.id) {
    const { error } = await input.client
      .from('survey_observations')
      .update({
        body: appendSurveySectionNote(existing.body, incoming),
        section_key: input.section.key,
        rics_code: input.section.ricsCode,
      } as never)
      .eq('id', existing.id)
      .eq('account_id', input.workspaceId)
      .eq('proposal_id', input.surveyId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { data: maxRow } = await input.client
    .from('survey_observations')
    .select('sort_order')
    .eq('account_id', input.workspaceId)
    .eq('proposal_id', input.surveyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const startOrder =
    Number((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await input.client.from('survey_observations').insert({
    account_id: input.workspaceId,
    proposal_id: input.surveyId,
    transcript_id: input.transcriptId,
    section_key: input.section.key,
    rics_code: input.section.ricsCode,
    body: incoming,
    sort_order: startOrder,
    created_by: input.userId,
  } as never);
  if (error) {
    throw new Error(error.message);
  }
}

export async function addNativeSurveyPhoto(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  surveyId: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
  title?: string | null;
  ricsCode?: string | null;
}): Promise<NativeSurveyPhoto> {
  requireSurveyWorkspace(input.workspace);
  const survey = await loadSurveyRow(
    input.client,
    input.workspace,
    input.surveyId,
  );
  const mime = input.mimeType.trim() || 'image/jpeg';
  if (!mime.startsWith('image/')) {
    throw new NativeHttpError(
      400,
      'Only image files can be added to the library',
    );
  }

  const section = input.ricsCode
    ? requireOnSiteSurveySection(input.ricsCode)
    : undefined;
  const stored = await storeSurveyFile({
    client: input.client,
    userId: input.userId,
    workspace: input.workspace,
    surveyId: survey.id,
    clientId: survey.client_id ?? null,
    bytes: input.bytes,
    filename: input.filename,
    mimeType: mime,
    title: input.title?.trim() || input.filename || 'Survey photo',
    tags: section
      ? ['survey_photo', `rics:${section.ricsCode}`]
      : ['survey_photo'],
    pinnedSectionKey: section?.key ?? null,
  });

  return stored;
}

async function storeSurveyFile(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  surveyId: string;
  clientId: string | null;
  bytes: Buffer;
  filename: string;
  mimeType: string;
  title: string;
  tags?: string[];
  pinnedSectionKey?: string | null;
}): Promise<NativeSurveyPhoto> {
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  const filePath = `${input.workspace.id}/${input.surveyId}/${Date.now()}_${safeName}`;
  const admin = getSupabaseServerAdminClient();
  const { error: uploadError } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .upload(filePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new NativeHttpError(400, uploadError.message);
  }

  const { data, error } = await input.client
    .from('docs')
    .insert({
      account_id: input.workspace.id,
      title: input.title,
      kind: 'uploaded',
      doc_type: 'general',
      category: 'idea',
      tags: input.tags ?? [],
      storage_bucket: ACCOUNT_DOCS_BUCKET,
      file_path: filePath,
      storage_path: filePath,
      mime_type: input.mimeType,
      file_size_bytes: input.bytes.length,
      user_id: input.userId,
      created_by: input.userId,
      proposal_id: input.surveyId,
      client_id: input.clientId,
      photo_role: 'archive',
      pinned_section_key: input.pinnedSectionKey ?? null,
    } as never)
    .select('id, title, mime_type, created_at, pinned_section_key')
    .single();

  if (error || !data) {
    await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([filePath]);
    surveyFailed(error, 'Could not register the file');
  }

  const row = data as Record<string, unknown>;
  let previewUrl: string | null = null;
  if (input.mimeType.startsWith('image/')) {
    const signed = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .createSignedUrl(filePath, 3600);
    previewUrl = signed.data?.signedUrl ?? null;
  }

  const sectionKey =
    (row.pinned_section_key as string | null)?.trim() ||
    input.pinnedSectionKey ||
    null;
  const section = sectionKey
    ? resolveOnSiteSurveySection(sectionKey)
    : undefined;

  return {
    id: String(row.id),
    title: String(row.title ?? input.title),
    mime_type: (row.mime_type as string | null) ?? input.mimeType,
    created_at: (row.created_at as string | null) ?? null,
    preview_url: previewUrl,
    rics_code: section?.ricsCode ?? null,
    section_key: section?.key ?? sectionKey,
  };
}
