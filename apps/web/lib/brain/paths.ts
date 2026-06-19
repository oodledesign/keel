import 'server-only';

import pathsConfig from '~/config/paths.config';

export type BrainSourceType =
  | 'note'
  | 'doc'
  | 'job'
  | 'job_note'
  | 'phase'
  | 'transcript'
  | 'proposal'
  | 'task';

export type BrainChunkMetadata = {
  title: string;
  source_url: string;
  updated_at: string;
  account_slug: string;
  job_id?: string | null;
  client_id?: string | null;
  meeting_date?: string | null;
};

export function buildBrainSourceUrl(
  accountSlug: string,
  sourceType: BrainSourceType,
  sourceId: string,
): string {
  const account = accountSlug;

  switch (sourceType) {
    case 'note':
      return pathsConfig.app.accountNoteDetail
        .replace('[account]', account)
        .replace('[noteId]', sourceId);
    case 'doc':
      return pathsConfig.app.accountDocDetail
        .replace('[account]', account)
        .replace('[docId]', sourceId);
    case 'job':
      return pathsConfig.app.accountJobDetail
        .replace('[account]', account)
        .replace('[id]', sourceId);
    case 'job_note':
      return pathsConfig.app.accountJobDetail
        .replace('[account]', account)
        .replace('[id]', sourceId);
    case 'phase':
      return pathsConfig.app.accountJobPhaseDetail
        .replace('[account]', account)
        .replace('[id]', '') // filled by metadata job_id when known
        .replace('[phaseId]', sourceId);
    case 'transcript':
      return pathsConfig.app.accountMeetingDetail
        .replace('[account]', account)
        .replace('[transcriptId]', sourceId);
    case 'proposal':
      return pathsConfig.app.accountProposalEdit
        .replace('[account]', account)
        .replace('[id]', sourceId);
    case 'task':
      return pathsConfig.app.accountTasks.replace('[account]', account);
    default:
      return pathsConfig.app.accountHome.replace('[account]', account);
  }
}

export function buildPhaseSourceUrl(
  accountSlug: string,
  jobId: string,
  phaseId: string,
) {
  return pathsConfig.app.accountJobPhaseDetail
    .replace('[account]', accountSlug)
    .replace('[id]', jobId)
    .replace('[phaseId]', phaseId);
}
