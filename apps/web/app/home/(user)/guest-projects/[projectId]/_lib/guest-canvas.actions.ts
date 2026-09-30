'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { createProjectPhasesService } from '~/home/[account]/projects/_lib/server/project-phases.service';
import { listAcceptedGuestsForUser } from '~/lib/projects/project-guests.service';

const GuestProjectSchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid(),
});

async function requireGuestAccess(
  userId: string,
  input: { accountId: string; projectId: string },
) {
  const guests = await listAcceptedGuestsForUser(userId);
  const access = guests.find(
    (guest) =>
      guest.projectId === input.projectId &&
      guest.accountId === input.accountId,
  );
  if (!access) throw new Error('Permission denied');
  return access;
}

export const loadGuestProjectBoardAction = enhanceAction(
  async (input, user) => {
    await requireGuestAccess(user.id, input);
    return createProjectPhasesService(
      getSupabaseServerClient(),
    ).listGuestJobBoard({ accountId: input.accountId, jobId: input.projectId });
  },
  { schema: GuestProjectSchema },
);

/** A project doc for a guest: written docs as markdown, files as a link. */
export const openGuestProjectDocAction = enhanceAction(
  async (input, user) => {
    await requireGuestAccess(user.id, input);

    // Guest RLS limits this to docs on the guest's project or its phases.
    const { data, error } = await getSupabaseServerClient()
      .from('docs')
      .select('title, kind, content, file_path, storage_path, storage_bucket')
      .eq('id', input.docId)
      .eq('account_id', input.accountId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('This file is no longer available');

    if (data.kind !== 'uploaded') {
      return {
        kind: 'written' as const,
        title: data.title || 'Untitled',
        content: data.content ?? '',
      };
    }

    const path = data.file_path ?? data.storage_path;
    if (!path) throw new Error('This file is no longer available');
    const { data: signed, error: signError } =
      await getSupabaseServerAdminClient()
        .storage.from(data.storage_bucket ?? ACCOUNT_DOCS_BUCKET)
        .createSignedUrl(path, 3600);
    if (signError || !signed?.signedUrl) {
      throw new Error('This file is no longer available');
    }
    return { kind: 'uploaded' as const, url: signed.signedUrl };
  },
  { schema: GuestProjectSchema.extend({ docId: z.string().uuid() }) },
);
