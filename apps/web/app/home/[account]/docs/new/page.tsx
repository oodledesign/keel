import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

interface NewDocPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ kind?: string }>;
}

async function NewDocPage({ params, searchParams }: NewDocPageProps) {
  const accountSlug = (await params).account;
  const kindParam = (await searchParams).kind;
  const kind = kindParam === 'uploaded' ? 'uploaded' : 'written';

  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('docs')
    .insert({
      account_id: accountId,
      title: '',
      kind,
      content: kind === 'written' ? '' : null,
    })
    .select('id')
    .single();

  if (error || !data) {
    redirect(pathsConfig.app.accountDocs.replace('[account]', accountSlug));
  }

  redirect(
    pathsConfig.app.accountDocDetail
      .replace('[account]', accountSlug)
      .replace('[docId]', data.id as string),
  );
}

export default NewDocPage;
