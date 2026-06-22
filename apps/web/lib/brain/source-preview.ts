import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { htmlToMarkdown } from '~/lib/markdown';

import {
  buildMeetingTranscriptIndexText,
  loadMeetingTranscriptEnrichmentByIds,
} from './meeting-transcript-index';
import {
  buildBrainSourceUrl,
  buildPhaseSourceUrl,
  type BrainSourceType,
} from './paths';

export type BrainSourcePreview = {
  title: string;
  sourceType: BrainSourceType;
  updatedAt: string | null;
  content: string;
  sourceUrl: string;
};

export async function loadBrainSourcePreview(
  client: SupabaseClient,
  params: {
    accountId: string;
    accountSlug: string;
    sourceType: BrainSourceType;
    sourceId: string;
  },
): Promise<BrainSourcePreview | null> {
  const { accountId, accountSlug, sourceType, sourceId } = params;

  switch (sourceType) {
    case 'note': {
      const { data } = await client
        .from('notes')
        .select('title, content, updated_at')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;
      return {
        title: ((data.title as string) || 'Note').trim(),
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: (data.content as string) ?? '',
        sourceUrl: buildBrainSourceUrl(accountSlug, 'note', sourceId),
      };
    }
    case 'doc': {
      const { data } = await client
        .from('docs')
        .select('title, content, updated_at')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;
      return {
        title: ((data.title as string) || 'Document').trim(),
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: (data.content as string) ?? '',
        sourceUrl: buildBrainSourceUrl(accountSlug, 'doc', sourceId),
      };
    }
    case 'job': {
      const { data } = await client
        .from('jobs')
        .select('title, description, updated_at')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;
      const title = ((data.title as string) || 'Job').trim();
      const description = (data.description as string | null)?.trim() ?? '';
      return {
        title,
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: description ? `# ${title}\n\n${description}` : title,
        sourceUrl: buildBrainSourceUrl(accountSlug, 'job', sourceId),
      };
    }
    case 'job_note': {
      const { data } = await client
        .from('job_notes')
        .select('note, updated_at, job_id')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;
      const jobId = data.job_id as string;
      const { data: job } = await client
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .maybeSingle();
      const jobTitle = ((job?.title as string | undefined) || 'Job').trim();
      return {
        title: `Note on: ${jobTitle}`,
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: (data.note as string) ?? '',
        sourceUrl: buildBrainSourceUrl(accountSlug, 'job', jobId),
      };
    }
    case 'phase': {
      const { data: phase } = await client
        .from('project_phases')
        .select('name, description, updated_at, job_id')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();

      const { data: pageDoc } = await client
        .from('docs')
        .select('title, content, updated_at')
        .eq('phase_id', sourceId)
        .eq('account_id', accountId)
        .eq('doc_type', 'phase_page')
        .maybeSingle();

      if (!phase && !pageDoc) return null;

      const jobId = (phase?.job_id as string | undefined) ?? '';
      const name = ((phase?.name as string) || 'Phase').trim();
      const description = (phase?.description as string | null)?.trim() ?? '';
      const pageContent = (pageDoc?.content as string | null)?.trim() ?? '';
      const parts = [
        description ? `## ${name}\n\n${description}` : null,
        pageContent ? `## Phase page\n\n${pageContent}` : null,
      ].filter(Boolean);

      return {
        title: `${name} (phase)`,
        sourceType,
        updatedAt:
          (pageDoc?.updated_at as string | null) ??
          (phase?.updated_at as string | null) ??
          null,
        content: parts.join('\n\n') || name,
        sourceUrl: jobId
          ? buildPhaseSourceUrl(accountSlug, jobId, sourceId)
          : buildBrainSourceUrl(accountSlug, 'phase', sourceId),
      };
    }
    case 'transcript': {
      const { data } = await client
        .from('meeting_transcripts')
        .select(
          'title, content, updated_at, meeting_date, client_id, clients(display_name, company_name, first_name, last_name, name)',
        )
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;

      const enrichment = await loadMeetingTranscriptEnrichmentByIds(
        client,
        accountId,
        [sourceId],
      );
      const bundle = enrichment.get(sourceId);
      const clientRow = data.clients as
        | {
            display_name?: string | null;
            company_name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            name?: string | null;
          }
        | {
            display_name?: string | null;
            company_name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
            name?: string | null;
          }[]
        | null;
      const clientRecord = Array.isArray(clientRow) ? clientRow[0] : clientRow;
      const clientName =
        clientRecord?.display_name?.trim() ||
        clientRecord?.company_name?.trim() ||
        [clientRecord?.first_name, clientRecord?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        clientRecord?.name?.trim() ||
        null;

      const title = ((data.title as string) || 'Meeting transcript').trim();
      const content = (data.content as string) ?? '';

      return {
        title,
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: buildMeetingTranscriptIndexText({
          title,
          content,
          meetingDate: (data.meeting_date as string | null) ?? null,
          clientName,
          summaryText: bundle?.summaryText ?? null,
          attendeeEmails: bundle?.attendeeEmails ?? [],
          actionItems: bundle?.actionItems ?? [],
        }),
        sourceUrl: buildBrainSourceUrl(accountSlug, 'transcript', sourceId),
      };
    }
    case 'proposal': {
      const { data } = await client
        .from('proposals')
        .select('title, content_html, updated_at')
        .eq('id', sourceId)
        .eq('account_id', accountId)
        .maybeSingle();
      if (!data) return null;
      return {
        title: ((data.title as string) || 'Proposal').trim(),
        sourceType,
        updatedAt: (data.updated_at as string | null) ?? null,
        content: htmlToMarkdown((data.content_html as string) ?? ''),
        sourceUrl: buildBrainSourceUrl(accountSlug, 'proposal', sourceId),
      };
    }
    default:
      return null;
  }
}
