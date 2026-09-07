/* eslint-disable @typescript-eslint/no-explicit-any -- admin query builder is untyped */
import 'server-only';

import { deliveryProjectTitle } from '~/lib/projects/project-types';

export type LinkedWorkItem = {
  id: string;
  title: string;
  clientId: string | null;
  source: 'project' | 'job';
};

export async function loadLinkedWorkItem(
  admin: any,
  params: { accountId: string; workItemId: string },
): Promise<LinkedWorkItem | null> {
  const { data: project } = await admin
    .from('projects')
    .select('id, name, title, client_id, account_id')
    .eq('id', params.workItemId)
    .maybeSingle();

  if (project && project.account_id === params.accountId) {
    return {
      id: project.id as string,
      title: deliveryProjectTitle(project),
      clientId: (project.client_id as string | null) ?? null,
      source: 'project',
    };
  }

  const { data: job } = await admin
    .from('jobs')
    .select('id, title, client_id, account_id')
    .eq('id', params.workItemId)
    .maybeSingle();

  if (job && job.account_id === params.accountId) {
    return {
      id: job.id as string,
      title: (job.title as string | null)?.trim() || 'Untitled job',
      clientId: (job.client_id as string | null) ?? null,
      source: 'job',
    };
  }

  return null;
}

export async function loadWorkItemTitleById(admin: any, workItemId: string) {
  const { data: project } = await admin
    .from('projects')
    .select('name, title')
    .eq('id', workItemId)
    .maybeSingle();

  if (project) return deliveryProjectTitle(project);

  const { data: job } = await admin
    .from('jobs')
    .select('title')
    .eq('id', workItemId)
    .maybeSingle();

  return (job?.title as string | null)?.trim() || null;
}
