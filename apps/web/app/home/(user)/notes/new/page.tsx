import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { requirePersonalAccountId } from '../_lib/server/personal-notes.loader';

async function PersonalNewNotePage() {
  const { accountId, userId } = await requirePersonalAccountId();
  const client = getSupabaseServerClient();

  const { data: inserted, error } = await client
    .from('notes')
    .insert({
      account_id: accountId,
      title: '',
      content: '',
      is_pinned: false,
      category: 'idea',
      tags: [],
      user_id: userId,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !inserted?.id) {
    redirect(`${pathsConfig.app.personalNotes}?new=1`);
  }

  redirect(
    pathsConfig.app.personalNoteDetail.replace(
      '[noteId]',
      inserted.id as string,
    ),
  );
}

export default PersonalNewNotePage;
