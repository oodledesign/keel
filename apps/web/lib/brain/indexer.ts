import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { htmlToMarkdown } from '~/lib/markdown';

import { brainChunksNeedRefresh } from './brain-index-refresh';
import { splitIntoChunks } from './chunking';
import {
  listEmailThreadIndexableRefs,
  loadEmailThreadIndexables,
  mapEmailThreadToIndexable,
} from './email-thread-index';
import {
  type MeetingTranscriptEnrichment,
  buildMeetingTranscriptIndexText,
  loadMeetingTranscriptEnrichmentByIds,
  meetingTranscriptIndexUpdatedAt,
} from './meeting-transcript-index';
import {
  type BrainChunkMetadata,
  type BrainSourceType,
  buildBrainSourceUrl,
  buildPhaseSourceUrl,
} from './paths';
import { embedTexts, isVoyageConfigured } from './voyage';

type AdminClient = SupabaseClient;

export type IndexableRecord = {
  sourceType: BrainSourceType;
  sourceId: string;
  accountId: string;
  accountSlug: string;
  title: string;
  text: string;
  updatedAt: string;
  jobId?: string | null;
  clientId?: string | null;
  phaseJobId?: string | null;
  meetingDate?: string | null;
};

export type IndexableRef = {
  sourceType: BrainSourceType;
  sourceId: string;
  title: string;
};

async function loadAccountSlug(admin: AdminClient, accountId: string) {
  const { data } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? accountId;
}

const MEETING_TRANSCRIPT_CLIENT_SELECT =
  'clients(display_name, company_name, first_name, last_name)';

function transcriptClientName(
  client:
    | {
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | {
        display_name?: string | null;
        company_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }[]
    | null,
): string | null {
  const row = Array.isArray(client) ? client[0] : client;
  if (!row) return null;
  return (
    row.display_name?.trim() ||
    row.company_name?.trim() ||
    [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
    null
  );
}

function mapMeetingTranscriptRowToIndexable(
  row: {
    id: string;
    title: string | null;
    content: string | null;
    updated_at: string;
    client_id: string | null;
    meeting_date: string | null;
    clients: Parameters<typeof transcriptClientName>[0];
  },
  accountId: string,
  accountSlug: string,
  enrichment?: MeetingTranscriptEnrichment,
): IndexableRecord | null {
  const content = (row.content as string | null)?.trim();
  const title = ((row.title as string) || 'Meeting transcript').trim();
  const clientName = transcriptClientName(row.clients);
  const meetingDate = (row.meeting_date as string | null) ?? null;
  const hasSummary = Boolean(enrichment?.summaryText?.trim());
  const hasActionItems = Boolean(enrichment?.actionItems?.length);

  if (!content && !hasSummary && !hasActionItems) {
    return null;
  }

  return {
    sourceType: 'transcript',
    sourceId: row.id,
    accountId,
    accountSlug,
    title,
    text: buildMeetingTranscriptIndexText({
      title,
      content:
        content ||
        '(Transcript text not stored — see summary and action items below.)',
      meetingDate,
      clientName,
      summaryText: enrichment?.summaryText ?? null,
      attendeeEmails: enrichment?.attendeeEmails ?? [],
      actionItems: enrichment?.actionItems ?? [],
    }),
    updatedAt: meetingTranscriptIndexUpdatedAt(row.updated_at, enrichment),
    clientId: row.client_id,
    meetingDate,
  };
}

async function loadTranscriptIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const { data: row, error } = await admin
    .from('meeting_transcripts')
    .select(
      `id, title, content, updated_at, client_id, meeting_date, ${MEETING_TRANSCRIPT_CLIENT_SELECT}`,
    )
    .eq('account_id', accountId)
    .eq('id', sourceId)
    .maybeSingle();

  if (error) {
    throw new Error(`meeting_transcripts: ${error.message}`);
  }

  if (!row) {
    return null;
  }

  const enrichmentByTranscriptId = await loadMeetingTranscriptEnrichmentByIds(
    admin,
    accountId,
    [sourceId],
  );

  return mapMeetingTranscriptRowToIndexable(
    row as Parameters<typeof mapMeetingTranscriptRowToIndexable>[0],
    accountId,
    accountSlug,
    enrichmentByTranscriptId.get(sourceId),
  );
}

export async function loadAccountIndexables(
  admin: AdminClient,
  accountId: string,
): Promise<IndexableRecord[]> {
  const accountSlug = await loadAccountSlug(admin, accountId);
  const records: IndexableRecord[] = [];

  const { data: notes } = await admin
    .from('notes')
    .select('id, title, content, updated_at, job_id, client_id')
    .eq('account_id', accountId);

  for (const row of notes ?? []) {
    const content = (row.content as string)?.trim();
    if (!content) continue;
    records.push({
      sourceType: 'note',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: ((row.title as string) || 'Note').trim(),
      text: content,
      updatedAt: row.updated_at as string,
      jobId: (row.job_id as string | null) ?? null,
      clientId: (row.client_id as string | null) ?? null,
    });
  }

  const { data: docs } = await admin
    .from('docs')
    .select(
      'id, title, content, updated_at, job_id, client_id, phase_id, kind, doc_type',
    )
    .eq('account_id', accountId)
    .eq('kind', 'written');

  for (const row of docs ?? []) {
    const content = (row.content as string)?.trim();
    if (!content) continue;

    const phaseId = row.phase_id as string | null;
    const jobId = row.job_id as string | null;

    if (phaseId && row.doc_type === 'phase_page') {
      records.push({
        sourceType: 'phase',
        sourceId: phaseId,
        accountId,
        accountSlug,
        title: `${((row.title as string) || 'Phase page').trim()} (phase page)`,
        text: content,
        updatedAt: row.updated_at as string,
        jobId,
        clientId: (row.client_id as string | null) ?? null,
        phaseJobId: jobId,
      });
      continue;
    }

    records.push({
      sourceType: 'doc',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: ((row.title as string) || 'Document').trim(),
      text: content,
      updatedAt: row.updated_at as string,
      jobId,
      clientId: (row.client_id as string | null) ?? null,
    });
  }

  const { data: projects } = await admin
    .from('projects')
    .select('id, title, description, updated_at, client_id')
    .eq('account_id', accountId)
    .eq('project_type', 'delivery');

  for (const row of projects ?? []) {
    const title = (row.title as string)?.trim() || 'Job';
    const description = (row.description as string | null)?.trim() ?? '';
    const text = description ? `# ${title}\n\n${description}` : title;
    records.push({
      sourceType: 'job',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title,
      text,
      updatedAt: row.updated_at as string,
      jobId: row.id as string,
      clientId: (row.client_id as string | null) ?? null,
    });
  }

  const { data: deliveryNotes } = await admin
    .from('project_delivery_notes')
    .select('id, note, updated_at, project_id, projects(title, client_id)')
    .eq('account_id', accountId);

  for (const row of deliveryNotes ?? []) {
    const note = (row.note as string)?.trim();
    if (!note) continue;
    const project = row.projects as
      | { title?: string | null; client_id?: string | null }
      | { title?: string | null; client_id?: string | null }[]
      | null;
    const projectRow = Array.isArray(project) ? project[0] : project;
    const projectTitle = projectRow?.title?.trim() || 'Project';
    records.push({
      sourceType: 'job_note',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: `Note on: ${projectTitle}`,
      text: note,
      updatedAt: row.updated_at as string,
      jobId: row.project_id as string,
      clientId: projectRow?.client_id ?? null,
    });
  }

  const { data: phases } = await admin
    .from('project_phases')
    .select('id, name, description, updated_at, project_id')
    .eq('account_id', accountId);

  for (const row of phases ?? []) {
    const description = (row.description as string | null)?.trim();
    if (!description) continue;
    records.push({
      sourceType: 'phase',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: `${(row.name as string).trim()} (phase)`,
      text: description,
      updatedAt: row.updated_at as string,
      jobId: row.project_id as string,
      phaseJobId: row.project_id as string,
    });
  }

  const { data: transcripts, error: transcriptsError } = await admin
    .from('meeting_transcripts')
    .select(
      `id, title, content, updated_at, client_id, meeting_date, ${MEETING_TRANSCRIPT_CLIENT_SELECT}`,
    )
    .eq('account_id', accountId);

  if (transcriptsError) {
    throw new Error(`meeting_transcripts: ${transcriptsError.message}`);
  }

  const transcriptRows = transcripts ?? [];
  const enrichmentByTranscriptId = await loadMeetingTranscriptEnrichmentByIds(
    admin,
    accountId,
    transcriptRows.map((row) => row.id as string),
  );

  for (const row of transcriptRows) {
    const mapped = mapMeetingTranscriptRowToIndexable(
      row as Parameters<typeof mapMeetingTranscriptRowToIndexable>[0],
      accountId,
      accountSlug,
      enrichmentByTranscriptId.get(row.id as string),
    );
    if (mapped) {
      records.push(mapped);
    }
  }

  const { data: proposals } = await admin
    .from('proposals')
    .select('id, title, content_html, updated_at, client_id')
    .eq('account_id', accountId);

  for (const row of proposals ?? []) {
    const html = (row.content_html as string | null)?.trim();
    if (!html) continue;
    records.push({
      sourceType: 'proposal',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: ((row.title as string) || 'Proposal').trim(),
      text: htmlToMarkdown(html),
      updatedAt: row.updated_at as string,
      clientId: (row.client_id as string | null) ?? null,
    });
  }

  const emailThreads = await loadEmailThreadIndexables(
    admin,
    accountId,
    accountSlug,
  );
  records.push(...emailThreads);

  return dedupeIndexablesBySourceId(records);
}

function preferLongerIndexable(
  left: IndexableRecord | null,
  right: IndexableRecord | null,
): IndexableRecord | null {
  if (!left) return right;
  if (!right) return left;

  const preferred = right.text.length >= left.text.length ? right : left;
  const mergedUpdatedAt =
    right.updatedAt > left.updatedAt ? right.updatedAt : left.updatedAt;

  return {
    ...preferred,
    text: right.text.length > left.text.length ? right.text : left.text,
    updatedAt: mergedUpdatedAt,
  };
}

async function loadDocIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const { data: row } = await admin
    .from('docs')
    .select(
      'id, title, content, updated_at, job_id, client_id, phase_id, kind, doc_type',
    )
    .eq('account_id', accountId)
    .eq('id', sourceId)
    .eq('kind', 'written')
    .maybeSingle();

  if (!row) return null;

  const content = (row.content as string)?.trim();
  if (!content) return null;

  const phaseId = row.phase_id as string | null;
  const jobId = row.job_id as string | null;

  if (phaseId && row.doc_type === 'phase_page') {
    return {
      sourceType: 'phase',
      sourceId: phaseId,
      accountId,
      accountSlug,
      title: `${((row.title as string) || 'Phase page').trim()} (phase page)`,
      text: content,
      updatedAt: row.updated_at as string,
      jobId,
      clientId: (row.client_id as string | null) ?? null,
      phaseJobId: jobId,
    };
  }

  return {
    sourceType: 'doc',
    sourceId: row.id as string,
    accountId,
    accountSlug,
    title: ((row.title as string) || 'Document').trim(),
    text: content,
    updatedAt: row.updated_at as string,
    jobId,
    clientId: (row.client_id as string | null) ?? null,
  };
}

async function loadJobIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const { data: row } = await admin
    .from('projects')
    .select('id, title, description, updated_at, client_id')
    .eq('account_id', accountId)
    .eq('id', sourceId)
    .eq('project_type', 'delivery')
    .maybeSingle();

  if (!row) return null;

  const title = (row.title as string)?.trim() || 'Job';
  const description = (row.description as string | null)?.trim() ?? '';
  const text = description ? `# ${title}\n\n${description}` : title;

  return {
    sourceType: 'job',
    sourceId: row.id as string,
    accountId,
    accountSlug,
    title,
    text,
    updatedAt: row.updated_at as string,
    jobId: row.id as string,
    clientId: (row.client_id as string | null) ?? null,
  };
}

async function loadJobNoteIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const { data: row } = await admin
    .from('project_delivery_notes')
    .select('id, note, updated_at, project_id, projects(title, client_id)')
    .eq('account_id', accountId)
    .eq('id', sourceId)
    .maybeSingle();

  if (!row) return null;

  const note = (row.note as string)?.trim();
  if (!note) return null;

  const project = row.projects as
    | { title?: string | null; client_id?: string | null }
    | { title?: string | null; client_id?: string | null }[]
    | null;
  const projectRow = Array.isArray(project) ? project[0] : project;
  const projectTitle = projectRow?.title?.trim() || 'Project';

  return {
    sourceType: 'job_note',
    sourceId: row.id as string,
    accountId,
    accountSlug,
    title: `Note on: ${projectTitle}`,
    text: note,
    updatedAt: row.updated_at as string,
    jobId: row.project_id as string,
    clientId: projectRow?.client_id ?? null,
  };
}

async function loadPhaseIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const [{ data: phase }, { data: page }] = await Promise.all([
    admin
      .from('project_phases')
      .select('id, name, description, updated_at, project_id')
      .eq('account_id', accountId)
      .eq('id', sourceId)
      .maybeSingle(),
    admin
      .from('docs')
      .select(
        'id, title, content, updated_at, job_id, client_id, phase_id, kind, doc_type',
      )
      .eq('account_id', accountId)
      .eq('phase_id', sourceId)
      .eq('kind', 'written')
      .eq('doc_type', 'phase_page')
      .maybeSingle(),
  ]);

  const fromPhase: IndexableRecord | null =
    phase && (phase.description as string | null)?.trim()
      ? {
          sourceType: 'phase',
          sourceId: phase.id as string,
          accountId,
          accountSlug,
          title: `${(phase.name as string).trim()} (phase)`,
          text: (phase.description as string).trim(),
          updatedAt: phase.updated_at as string,
          jobId: phase.project_id as string,
          phaseJobId: phase.project_id as string,
        }
      : null;

  const pageContent = (page?.content as string | null)?.trim();
  const fromPage: IndexableRecord | null =
    page && pageContent
      ? {
          sourceType: 'phase',
          sourceId: sourceId,
          accountId,
          accountSlug,
          title: `${((page.title as string) || 'Phase page').trim()} (phase page)`,
          text: pageContent,
          updatedAt: page.updated_at as string,
          jobId: (page.job_id as string | null) ?? null,
          clientId: (page.client_id as string | null) ?? null,
          phaseJobId: (page.job_id as string | null) ?? null,
        }
      : null;

  return preferLongerIndexable(fromPhase, fromPage);
}

async function loadProposalIndexable(
  admin: AdminClient,
  accountId: string,
  accountSlug: string,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const { data: row } = await admin
    .from('proposals')
    .select('id, title, content_html, updated_at, client_id')
    .eq('account_id', accountId)
    .eq('id', sourceId)
    .maybeSingle();

  if (!row) return null;

  const html = (row.content_html as string | null)?.trim();
  if (!html) return null;

  return {
    sourceType: 'proposal',
    sourceId: row.id as string,
    accountId,
    accountSlug,
    title: ((row.title as string) || 'Proposal').trim(),
    text: htmlToMarkdown(html),
    updatedAt: row.updated_at as string,
    clientId: (row.client_id as string | null) ?? null,
  };
}

export async function loadIndexableSource(
  admin: AdminClient,
  accountId: string,
  sourceType: BrainSourceType,
  sourceId: string,
): Promise<IndexableRecord | null> {
  const accountSlug = await loadAccountSlug(admin, accountId);

  switch (sourceType) {
    case 'note': {
      const { data: row } = await admin
        .from('notes')
        .select('id, title, content, updated_at, job_id, client_id')
        .eq('account_id', accountId)
        .eq('id', sourceId)
        .maybeSingle();

      if (!row) return null;

      const content = (row.content as string)?.trim();
      if (!content) return null;

      return {
        sourceType: 'note',
        sourceId: row.id as string,
        accountId,
        accountSlug,
        title: ((row.title as string) || 'Note').trim(),
        text: content,
        updatedAt: row.updated_at as string,
        jobId: (row.job_id as string | null) ?? null,
        clientId: (row.client_id as string | null) ?? null,
      };
    }
    case 'doc':
      return loadDocIndexable(admin, accountId, accountSlug, sourceId);
    case 'job':
      return loadJobIndexable(admin, accountId, accountSlug, sourceId);
    case 'job_note':
      return loadJobNoteIndexable(admin, accountId, accountSlug, sourceId);
    case 'phase':
      return loadPhaseIndexable(admin, accountId, accountSlug, sourceId);
    case 'transcript':
      return loadTranscriptIndexable(admin, accountId, accountSlug, sourceId);
    case 'proposal':
      return loadProposalIndexable(admin, accountId, accountSlug, sourceId);
    case 'email_thread':
      return mapEmailThreadToIndexable(admin, accountId, accountSlug, sourceId);
    case 'task':
      return null;
    default:
      return null;
  }
}

/** `brain_chunks` is unique on (source_id, chunk_index) only — merge duplicate sources. */
function dedupeIndexablesBySourceId(
  records: IndexableRecord[],
): IndexableRecord[] {
  const bySourceId = new Map<string, IndexableRecord>();

  for (const record of records) {
    const existing = bySourceId.get(record.sourceId);
    if (!existing) {
      bySourceId.set(record.sourceId, record);
      continue;
    }

    const mergedText =
      record.text.length > existing.text.length ? record.text : existing.text;
    const mergedUpdatedAt =
      record.updatedAt > existing.updatedAt
        ? record.updatedAt
        : existing.updatedAt;
    const preferred =
      record.text.length >= existing.text.length ? record : existing;

    bySourceId.set(record.sourceId, {
      ...preferred,
      text: mergedText,
      updatedAt: mergedUpdatedAt,
    });
  }

  return [...bySourceId.values()];
}

function dedupeIndexableRefs(refs: IndexableRef[]): IndexableRef[] {
  const seen = new Set<string>();
  const unique: IndexableRef[] = [];

  for (const ref of refs) {
    if (seen.has(ref.sourceId)) continue;
    seen.add(ref.sourceId);
    unique.push(ref);
  }

  return unique;
}

export async function listAccountIndexableRefs(
  admin: AdminClient,
  accountId: string,
): Promise<IndexableRef[]> {
  const refs: IndexableRef[] = [];

  const { data: notes } = await admin
    .from('notes')
    .select('id, title')
    .eq('account_id', accountId)
    .not('content', 'is', null);

  for (const row of notes ?? []) {
    refs.push({
      sourceType: 'note',
      sourceId: row.id as string,
      title: ((row.title as string) || 'Note').trim(),
    });
  }

  const { data: docs } = await admin
    .from('docs')
    .select('id, title, phase_id, doc_type')
    .eq('account_id', accountId)
    .eq('kind', 'written')
    .not('content', 'is', null);

  for (const row of docs ?? []) {
    const phaseId = row.phase_id as string | null;
    if (phaseId && row.doc_type === 'phase_page') {
      refs.push({
        sourceType: 'phase',
        sourceId: phaseId,
        title: `${((row.title as string) || 'Phase page').trim()} (phase page)`,
      });
      continue;
    }

    refs.push({
      sourceType: 'doc',
      sourceId: row.id as string,
      title: ((row.title as string) || 'Document').trim(),
    });
  }

  const { data: projects } = await admin
    .from('projects')
    .select('id, title')
    .eq('account_id', accountId)
    .eq('project_type', 'delivery');

  for (const row of projects ?? []) {
    refs.push({
      sourceType: 'job',
      sourceId: row.id as string,
      title: (row.title as string)?.trim() || 'Job',
    });
  }

  const { data: deliveryNotes } = await admin
    .from('project_delivery_notes')
    .select('id, projects(title)')
    .eq('account_id', accountId)
    .not('note', 'is', null);

  for (const row of deliveryNotes ?? []) {
    const project = row.projects as
      | { title?: string | null }
      | { title?: string | null }[]
      | null;
    const projectRow = Array.isArray(project) ? project[0] : project;
    refs.push({
      sourceType: 'job_note',
      sourceId: row.id as string,
      title: `Note on: ${projectRow?.title?.trim() || 'Project'}`,
    });
  }

  const { data: phases } = await admin
    .from('project_phases')
    .select('id, name')
    .eq('account_id', accountId)
    .not('description', 'is', null);

  for (const row of phases ?? []) {
    refs.push({
      sourceType: 'phase',
      sourceId: row.id as string,
      title: `${(row.name as string).trim()} (phase)`,
    });
  }

  const { data: transcripts, error: transcriptsError } = await admin
    .from('meeting_transcripts')
    .select('id, title')
    .eq('account_id', accountId);

  if (transcriptsError) {
    throw new Error(`meeting_transcripts: ${transcriptsError.message}`);
  }

  for (const row of transcripts ?? []) {
    refs.push({
      sourceType: 'transcript',
      sourceId: row.id as string,
      title: ((row.title as string) || 'Meeting transcript').trim(),
    });
  }

  const { data: proposals } = await admin
    .from('proposals')
    .select('id, title')
    .eq('account_id', accountId)
    .not('content_html', 'is', null);

  for (const row of proposals ?? []) {
    refs.push({
      sourceType: 'proposal',
      sourceId: row.id as string,
      title: ((row.title as string) || 'Proposal').trim(),
    });
  }

  const emailRefs = await listEmailThreadIndexableRefs(admin, accountId);
  for (const row of emailRefs) {
    refs.push({
      sourceType: 'email_thread',
      sourceId: row.sourceId,
      title: row.title,
    });
  }

  return dedupeIndexableRefs(refs);
}

async function indexRefs(
  admin: AdminClient,
  accountId: string,
  refs: IndexableRef[],
  forceReindex: boolean,
) {
  let chunkTotal = 0;
  let indexed = 0;
  const errors: string[] = [];

  for (const ref of refs) {
    try {
      const record = await loadIndexableSource(
        admin,
        accountId,
        ref.sourceType,
        ref.sourceId,
      );

      if (!record) {
        await deleteSourceChunks(admin, ref.sourceId, accountId);
        indexed += 1;
        continue;
      }

      chunkTotal += await upsertRecordChunks(admin, record, forceReindex, true);
      indexed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const label = `${ref.sourceType}:${ref.title}`;
      console.error('[brain] index source failed', {
        accountId,
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        title: ref.title,
        error: message,
      });
      errors.push(`${label}: failed to index`);
    }
  }

  return { chunkTotal, indexed, errors };
}

function buildMetadata(record: IndexableRecord): BrainChunkMetadata {
  const sourceUrl =
    record.sourceType === 'phase' && record.phaseJobId
      ? buildPhaseSourceUrl(
          record.accountSlug,
          record.phaseJobId,
          record.sourceId,
        )
      : buildBrainSourceUrl(
          record.accountSlug,
          record.sourceType,
          record.sourceId,
        );

  return {
    title: record.title,
    source_url: sourceUrl,
    updated_at: record.updatedAt,
    account_slug: record.accountSlug,
    job_id: record.jobId ?? null,
    client_id: record.clientId ?? null,
    meeting_date: record.meetingDate ?? null,
  };
}

async function upsertRecordChunks(
  admin: AdminClient,
  record: IndexableRecord,
  forceReindex = false,
  alreadyLoaded = false,
) {
  const fresh = alreadyLoaded
    ? record
    : await loadIndexableSource(
        admin,
        record.accountId,
        record.sourceType,
        record.sourceId,
      );

  if (!fresh) {
    await deleteSourceChunks(admin, record.sourceId, record.accountId);
    return 0;
  }

  record = fresh;
  const chunks = splitIntoChunks(record.text);
  if (chunks.length === 0) {
    await deleteSourceChunks(admin, record.sourceId, record.accountId);
    return 0;
  }

  const { data: existingRows } = await admin
    .from('brain_chunks')
    .select('chunk_index, indexed_at, embedding')
    .eq('source_id', record.sourceId)
    .order('chunk_index', { ascending: true });

  const needsReembed = brainChunksNeedRefresh({
    sourceUpdatedAt: record.updatedAt,
    existingRows: existingRows ?? [],
    chunkCount: chunks.length,
  });

  if (!needsReembed && !forceReindex) {
    return existingRows?.length ?? 0;
  }

  let embeddings: number[][] = [];
  if (isVoyageConfigured()) {
    embeddings = await embedTexts(chunks);
  }

  const metadata = buildMetadata(record);
  const now = new Date().toISOString();

  for (let index = 0; index < chunks.length; index += 1) {
    const payload: Record<string, unknown> = {
      account_id: record.accountId,
      source_type: record.sourceType,
      source_id: record.sourceId,
      chunk_index: index,
      content_text: chunks[index],
      metadata,
      indexed_at: now,
    };

    if (embeddings[index]) {
      payload.embedding = embeddings[index];
    }

    const { error } = await admin.from('brain_chunks').upsert(payload, {
      onConflict: 'source_id,chunk_index',
    });

    if (error) throw new Error(error.message);
  }

  await admin
    .from('brain_chunks')
    .delete()
    .eq('account_id', record.accountId)
    .eq('source_id', record.sourceId)
    .gte('chunk_index', chunks.length);

  return chunks.length;
}

export async function deleteSourceChunks(
  admin: AdminClient,
  sourceId: string,
  accountId?: string,
) {
  let query = admin.from('brain_chunks').delete().eq('source_id', sourceId);
  if (accountId) {
    query = query.eq('account_id', accountId);
  }
  await query;
}

export async function indexSource(
  admin: AdminClient,
  accountId: string,
  sourceType: BrainSourceType,
  sourceId: string,
) {
  if (!isVoyageConfigured())
    return { skipped: true as const, reason: 'no_voyage_key' };

  const record = await loadIndexableSource(
    admin,
    accountId,
    sourceType,
    sourceId,
  );

  if (!record) {
    await deleteSourceChunks(admin, sourceId);
    return { deleted: true as const };
  }

  const chunkCount = await upsertRecordChunks(admin, record, false);
  return { chunkCount };
}

export async function indexAccount(
  admin: AdminClient,
  accountId: string,
  options?: { force?: boolean },
) {
  if (!isVoyageConfigured()) {
    return {
      indexed: 0,
      chunks: 0,
      chunksWritten: 0,
      totalChunks: 0,
      byType: {},
      skipped: true as const,
      errors: [] as string[],
    };
  }

  const refs = await listAccountIndexableRefs(admin, accountId);
  const forceReindex = options?.force ?? false;

  console.log(`[brain] indexing account ${accountId}: ${refs.length} sources`);

  const { chunkTotal, indexed, errors } = await indexRefs(
    admin,
    accountId,
    refs,
    forceReindex,
  );

  const stats = await getBrainIndexStats(admin, accountId);

  console.log(
    `[brain] indexed account ${accountId}: ${indexed}/${refs.length} sources, ${stats.totalChunks} chunks in db (${chunkTotal} written this run), ${errors.length} errors`,
  );

  if (indexed === 0 && errors.length > 0) {
    throw new Error(errors[0] ?? 'Indexing failed');
  }

  return {
    indexed,
    /** Chunks upserted during this run (can exceed net DB total when source_ids overlap). */
    chunksWritten: chunkTotal,
    /** Authoritative chunk count in the database after indexing. */
    chunks: stats.totalChunks,
    totalChunks: stats.totalChunks,
    byType: stats.byType,
    errors,
  };
}

export async function indexAccountBatch(
  admin: AdminClient,
  accountId: string,
  options: {
    force?: boolean;
    offset: number;
    limit: number;
    sources?: IndexableRef[];
    total?: number;
  },
) {
  if (!isVoyageConfigured()) {
    return {
      indexed: 0,
      processed: 0,
      total: 0,
      nextOffset: 0,
      done: true,
      chunks: 0,
      totalChunks: 0,
      byType: {},
      skipped: true as const,
      errors: [] as string[],
      sources: [] as IndexableRef[],
    };
  }

  const offset = Math.max(0, options.offset);
  const limit = Math.max(1, options.limit);
  const forceReindex = options.force ?? false;

  let slice: IndexableRef[];
  let total: number;
  let catalog: IndexableRef[] | undefined;

  if (options.sources) {
    slice = options.sources.slice(0, limit);
    total = options.total ?? offset + slice.length;
  } else {
    catalog = await listAccountIndexableRefs(admin, accountId);
    slice = catalog.slice(offset, offset + limit);
    total = catalog.length;
  }

  console.log(
    `[brain] indexing account ${accountId} batch ${offset}-${offset + slice.length} of ${total}`,
  );

  const { indexed, errors } = await indexRefs(
    admin,
    accountId,
    slice,
    forceReindex,
  );

  const nextOffset = offset + slice.length;
  const done = nextOffset >= total;
  const stats = done ? await getBrainIndexStats(admin, accountId) : null;

  return {
    indexed,
    processed: nextOffset,
    total,
    nextOffset,
    done,
    chunks: stats?.totalChunks ?? 0,
    totalChunks: stats?.totalChunks ?? 0,
    byType: stats?.byType ?? {},
    errors,
    sources: catalog,
  };
}

export async function getBrainIndexStats(
  admin: AdminClient,
  accountId: string,
) {
  const { data, error } = await admin
    .from('brain_chunks')
    .select('source_type, indexed_at')
    .eq('account_id', accountId);

  if (error) throw new Error(error.message);

  const byType = new Map<
    string,
    { count: number; lastIndexedAt: string | null }
  >();
  for (const row of data ?? []) {
    const type = row.source_type as string;
    const current = byType.get(type) ?? { count: 0, lastIndexedAt: null };
    current.count += 1;
    const indexedAt = row.indexed_at as string | null;
    if (
      indexedAt &&
      (!current.lastIndexedAt || indexedAt > current.lastIndexedAt)
    ) {
      current.lastIndexedAt = indexedAt;
    }
    byType.set(type, current);
  }

  return {
    totalChunks: data?.length ?? 0,
    byType: Object.fromEntries(byType.entries()),
  };
}

export async function listActiveAccountIds(admin: AdminClient) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const ids = new Set<string>();

  const tables = [
    'notes',
    'docs',
    'projects',
    'project_delivery_notes',
    'meeting_transcripts',
    'proposals',
    'project_phases',
  ] as const;

  for (const table of tables) {
    const { data } = await admin
      .from(table)
      .select('account_id')
      .gte('updated_at', since);
    for (const row of data ?? []) {
      ids.add(row.account_id as string);
    }
  }

  const { data: summaryAccounts } = await admin
    .from('meeting_summaries')
    .select('account_id')
    .gte('generated_at', since);

  for (const row of summaryAccounts ?? []) {
    ids.add(row.account_id as string);
  }

  const { data: actionItemAccounts } = await admin
    .from('meeting_action_items')
    .select('account_id')
    .gte('created_at', since);

  for (const row of actionItemAccounts ?? []) {
    ids.add(row.account_id as string);
  }

  const { data: emailThreadAccounts } = await admin
    .from('email_threads')
    .select('account_id')
    .not('account_id', 'is', null)
    .gte('updated_at', since);

  for (const row of emailThreadAccounts ?? []) {
    ids.add(row.account_id as string);
  }

  return Array.from(ids);
}
