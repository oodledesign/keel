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

/** Guests with canvas editing may add files to the project; nothing else. */
async function requireGuestCanvasEditor(
  userId: string,
  input: { accountId: string; projectId: string },
) {
  const access = await requireGuestAccess(userId, input);
  if (!access.permissions.edit_canvas) throw new Error('Permission denied');
  return access;
}

const MAX_GUEST_FILE_BYTES = 50 * 1024 * 1024;

function guestFilePrefix(input: { accountId: string; projectId: string }) {
  return `${input.accountId}/projects/${input.projectId}/`;
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

/** A one-off signed URL to upload a project file straight to storage. */
export const prepareGuestFileUploadAction = enhanceAction(
  async (input, user) => {
    await requireGuestCanvasEditor(user.id, input);
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${guestFilePrefix(input)}${Date.now()}_${safeName}`;
    const { data, error } = await getSupabaseServerAdminClient()
      .storage.from(ACCOUNT_DOCS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error('Could not start the upload');
    return { path, token: data.token };
  },
  {
    schema: GuestProjectSchema.extend({
      fileName: z.string().trim().min(1).max(300),
    }),
  },
);

/** Records an uploaded file as a doc on the guest's project. */
export const registerGuestFileAction = enhanceAction(
  async (input, user) => {
    await requireGuestCanvasEditor(user.id, input);
    const prefix = guestFilePrefix(input);
    const name = input.path.slice(prefix.length);
    if (
      !input.path.startsWith(prefix) ||
      !/^\d+_[a-zA-Z0-9._-]{1,300}$/.test(name)
    ) {
      throw new Error('Invalid file location');
    }

    // Trust the stored object, not the client: it must exist, and its real
    // size is what we record.
    const admin = getSupabaseServerAdminClient();
    const { data: listed, error: listError } = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .list(prefix.slice(0, -1), { search: name, limit: 5 });
    if (listError) throw new Error('Could not check the upload');
    const stored = listed?.find((entry) => entry.name === name);
    if (!stored) throw new Error('The upload did not finish');
    const size = Number(
      (stored.metadata as { size?: number } | null)?.size ?? 0,
    );
    if (size > MAX_GUEST_FILE_BYTES) {
      await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([input.path]);
      throw new Error('Files can be up to 50MB');
    }

    const { data, error } = await admin
      .from('docs')
      .insert({
        account_id: input.accountId,
        project_id: input.projectId,
        title: input.title.trim() || 'Uploaded file',
        kind: 'uploaded',
        doc_type: 'general',
        category: 'idea',
        tags: [],
        storage_bucket: ACCOUNT_DOCS_BUCKET,
        file_path: input.path,
        storage_path: input.path,
        mime_type: input.mimeType ?? null,
        file_size_bytes: size,
        file_url: null,
        user_id: user.id,
        created_by: user.id,
        photo_role: 'archive',
      } as never)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { docId: data.id as string };
  },
  {
    schema: GuestProjectSchema.extend({
      path: z.string().min(1).max(600),
      title: z.string().trim().max(500),
      mimeType: z.string().max(200).nullable().optional(),
    }),
  },
);
