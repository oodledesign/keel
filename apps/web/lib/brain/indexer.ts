import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { htmlToMarkdown } from '~/lib/markdown';

import { splitIntoChunks } from './chunking';
import {
  buildBrainSourceUrl,
  buildPhaseSourceUrl,
  type BrainChunkMetadata,
  type BrainSourceType,
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
};

async function loadAccountSlug(admin: AdminClient, accountId: string) {
  const { data } = await admin
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();
  return (data?.slug as string | undefined) ?? accountId;
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

  const { data: jobs } = await admin
    .from('jobs')
    .select('id, title, description, updated_at, client_id')
    .eq('account_id', accountId);

  for (const row of jobs ?? []) {
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

  const { data: jobNotes } = await admin
    .from('job_notes')
    .select('id, note, updated_at, job_id, jobs(title, client_id)')
    .eq('account_id', accountId);

  for (const row of jobNotes ?? []) {
    const note = (row.note as string)?.trim();
    if (!note) continue;
    const job = row.jobs as
      | { title?: string | null; client_id?: string | null }
      | { title?: string | null; client_id?: string | null }[]
      | null;
    const jobRow = Array.isArray(job) ? job[0] : job;
    const jobTitle = jobRow?.title?.trim() || 'Job';
    records.push({
      sourceType: 'job_note',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title: `Note on: ${jobTitle}`,
      text: note,
      updatedAt: row.updated_at as string,
      jobId: row.job_id as string,
      clientId: jobRow?.client_id ?? null,
    });
  }

  const { data: phases } = await admin
    .from('project_phases')
    .select('id, name, description, updated_at, job_id')
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
      jobId: row.job_id as string,
      phaseJobId: row.job_id as string,
    });
  }

  const { data: transcripts } = await admin
    .from('meeting_transcripts')
    .select('id, title, content, updated_at, client_id')
    .eq('account_id', accountId);

  for (const row of transcripts ?? []) {
    const content = (row.content as string)?.trim();
    if (!content) continue;
    const title = ((row.title as string) || 'Meeting transcript').trim();
    records.push({
      sourceType: 'transcript',
      sourceId: row.id as string,
      accountId,
      accountSlug,
      title,
      text: `# ${title}\n\n${content}`,
      updatedAt: row.updated_at as string,
      clientId: (row.client_id as string | null) ?? null,
    });
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

  return records;
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
  };
}

async function upsertRecordChunks(
  admin: AdminClient,
  record: IndexableRecord,
) {
  const chunks = splitIntoChunks(record.text);
  if (chunks.length === 0) {
    await admin.from('brain_chunks').delete().eq('source_id', record.sourceId);
    return 0;
  }

  const { data: existingRows } = await admin
    .from('brain_chunks')
    .select('chunk_index, indexed_at, embedding')
    .eq('source_id', record.sourceId)
    .order('chunk_index', { ascending: true });

  const sourceUpdatedMs = new Date(record.updatedAt).getTime();
  const needsReembed =
    !existingRows?.length ||
    existingRows.some((row) => {
      if (!row.embedding) return true;
      const indexedAt = row.indexed_at as string | null;
      if (!indexedAt) return true;
      return new Date(indexedAt).getTime() < sourceUpdatedMs;
    }) ||
    existingRows.length !== chunks.length;

  let embeddings: number[][] = [];
  if (needsReembed && isVoyageConfigured()) {
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
    .eq('source_id', record.sourceId)
    .gte('chunk_index', chunks.length);

  return chunks.length;
}

export async function deleteSourceChunks(
  admin: AdminClient,
  sourceId: string,
) {
  await admin.from('brain_chunks').delete().eq('source_id', sourceId);
}

export async function indexSource(
  admin: AdminClient,
  accountId: string,
  sourceType: BrainSourceType,
  sourceId: string,
) {
  if (!isVoyageConfigured()) return { skipped: true as const, reason: 'no_voyage_key' };

  const records = await loadAccountIndexables(admin, accountId);
  const record = records.find(
    (row) => row.sourceType === sourceType && row.sourceId === sourceId,
  );

  if (!record) {
    await deleteSourceChunks(admin, sourceId);
    return { deleted: true as const };
  }

  const chunkCount = await upsertRecordChunks(admin, record);
  return { chunkCount };
}

export async function indexAccount(admin: AdminClient, accountId: string) {
  if (!isVoyageConfigured()) {
    return { indexed: 0, chunks: 0, skipped: true as const };
  }

  const records = await loadAccountIndexables(admin, accountId);
  let chunkTotal = 0;

  console.log(
    `[brain] indexing account ${accountId}: ${records.length} sources`,
  );

  for (const record of records) {
    chunkTotal += await upsertRecordChunks(admin, record);
  }

  console.log(
    `[brain] indexed account ${accountId}: ${records.length} sources, ${chunkTotal} chunks`,
  );

  return { indexed: records.length, chunks: chunkTotal };
}

export async function getBrainIndexStats(admin: AdminClient, accountId: string) {
  const { data, error } = await admin
    .from('brain_chunks')
    .select('source_type, indexed_at')
    .eq('account_id', accountId);

  if (error) throw new Error(error.message);

  const byType = new Map<string, { count: number; lastIndexedAt: string | null }>();
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

  const tables = ['notes', 'docs', 'jobs', 'job_notes', 'meeting_transcripts', 'proposals', 'project_phases'] as const;

  for (const table of tables) {
    const { data } = await admin
      .from(table)
      .select('account_id')
      .gte('updated_at', since);
    for (const row of data ?? []) {
      ids.add(row.account_id as string);
    }
  }

  return Array.from(ids);
}
