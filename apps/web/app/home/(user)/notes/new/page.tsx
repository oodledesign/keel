import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { requirePersonalAccountId } from '../_lib/server/personal-notes.loader';

async function PersonalNewNotePage() {
  const { accountId, userId } = await requirePersonalAccountId();
  const client = getSupabaseServerClient();

  const { data, error } = await client
    .from('notes')
    .insert({
      account_id: accountId,
      title: '',
      content: '',
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    redirect(pathsConfig.app.personalNotes);
  }

  redirect(
    pathsConfig.app.personalNoteDetail.replace('[noteId]', data.id as string),
  );
}

export default PersonalNewNotePage;
