import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';
import { triggerPagespeedRun } from '~/lib/pagespeed/trigger-run';

import { assertRanklyModuleEnabled } from '../module-access';
import type { PagespeedActionData } from '../types';

export async function executePagespeedScan(
  client: SupabaseClient,
  userId: string,
  data: PagespeedActionData,
): Promise<{ entityId: string; link: string; message: string }> {
  const isMember = await userIsAccountMember(client, userId, data.accountId);
  if (!isMember) {
    throw new Error('You are not a member of that workspace');
  }

  await assertRanklyModuleEnabled(client, data.accountId, userId);

  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('id, name, account_id')
    .eq('id', data.projectId)
    .eq('account_id', data.accountId)
    .maybeSingle();

  if (!project) {
    throw new Error('Rankly project not found');
  }

  const { data: runningJob } = await supabaseCustomSchema(client, 'rankly')
    .from('pagespeed_check_jobs')
    .select('id, status')
    .eq('project_id', data.projectId)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let jobId: string;

  if (runningJob) {
    jobId = (runningJob as { id: string }).id;
    triggerPagespeedRun(jobId);
  } else {
    const { data: job, error } = await supabaseCustomSchema(client, 'rankly')
      .from('pagespeed_check_jobs')
      .insert({
        project_id: data.projectId,
        user_id: userId,
        status: 'pending',
        trigger_source: 'manual',
      })
      .select('id')
      .single();

    if (error || !job) {
      throw new Error(error?.message ?? 'Failed to create PageSpeed job');
    }

    jobId = (job as { id: string }).id;
    triggerPagespeedRun(jobId);
  }

  const { data: account } = await client
    .from('accounts')
    .select('slug')
    .eq('id', data.accountId)
    .maybeSingle();

  const slug = (account as { slug?: string | null } | null)?.slug ?? '';
  const link = pathsConfig.app.accountRanklyProjectPagespeed
    .replace('[account]', slug)
    .replace('[projectId]', data.projectId);

  const projectName = (project as { name: string }).name;

  return {
    entityId: jobId,
    link,
    message: `PageSpeed scan started for ${projectName}`,
  };
}
