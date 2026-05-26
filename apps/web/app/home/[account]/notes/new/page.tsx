import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  ACCOUNT_NOTES_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';

interface NewNotePageProps {
  params: Promise<{ account: string }>;
}

async function NewNotePage({ params }: NewNotePageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ACCOUNT_NOTES_SPACE_TYPES);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('notes')
    .insert({
      account_id: accountId,
      title: '',
      content: '',
    })
    .select('id')
    .single();

  if (error || !data) {
    redirect(pathsConfig.app.accountNotes.replace('[account]', accountSlug));
  }

  redirect(
    pathsConfig.app.accountNoteDetail
      .replace('[account]', accountSlug)
      .replace('[noteId]', data.id as string),
  );
}

export default NewNotePage;
