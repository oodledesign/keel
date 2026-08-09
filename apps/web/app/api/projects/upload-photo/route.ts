import { NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import { isMissingColumnError } from '~/home/[account]/_lib/server/supabase-errors';
import {
  storagePathFromProjectPictureUrl,
  storeProjectPhotoBytes,
} from '~/lib/projects/store-project-photo';

export const runtime = 'nodejs';

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

async function ensureProjectsEditPermission(
  userId: string,
  accountId: string,
): Promise<boolean> {
  if (userId === accountId) return true;

  const client = getSupabaseServerClient();
  const api = createTeamAccountsApi(client);
  const hasJobsEdit = await api.hasPermission({
    userId,
    accountId,
    permission: 'jobs.edit',
  });
  if (hasJobsEdit) return true;

  const hasProjectsEdit = await api.hasPermission({
    userId,
    accountId,
    permission: 'projects.edit',
  });
  if (hasProjectsEdit) return true;

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  const role = membership?.account_role;
  return role === 'owner' || role === 'admin' || role === 'staff';
}

async function loadProject(
  accountId: string,
  projectId: string,
): Promise<{
  id: string;
  account_id: string;
  picture_url: string | null;
  pictureUrlAvailable: boolean;
} | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('projects')
    .select('id, account_id, picture_url')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!error && data) {
    return {
      id: data.id as string,
      account_id: data.account_id as string,
      picture_url: (data.picture_url as string | null) ?? null,
      pictureUrlAvailable: true,
    };
  }

  if (error && isMissingColumnError(error)) {
    const { data: fallback, error: fallbackError } = await admin
      .from('projects')
      .select('id, account_id')
      .eq('id', projectId)
      .eq('account_id', accountId)
      .maybeSingle();

    if (fallbackError) throw new Error(fallbackError.message);
    if (!fallback) return null;

    return {
      id: fallback.id as string,
      account_id: fallback.account_id as string,
      picture_url: null,
      pictureUrlAvailable: false,
    };
  }

  if (error) throw new Error(error.message);
  return null;
}

export async function POST(request: Request) {
  try {
    const userClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const accountId = formData.get('accountId');
    const projectId = formData.get('projectId');
    const remove = formData.get('remove') === '1';
    const file = formData.get('file');

    if (typeof accountId !== 'string' || !accountId.trim()) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 },
      );
    }

    if (typeof projectId !== 'string' || !projectId.trim()) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 },
      );
    }

    const canEdit = await ensureProjectsEditPermission(
      user.id,
      accountId.trim(),
    );
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const project = await loadProject(accountId.trim(), projectId.trim());
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.pictureUrlAvailable) {
      return NextResponse.json(
        {
          error:
            'The projects.picture_url column is missing on this database. Apply migration 20260913200000_projects_picture_url_and_portal_phases.',
        },
        { status: 503 },
      );
    }

    const admin = getSupabaseServerAdminClient();
    const existingPath = storagePathFromProjectPictureUrl(project.picture_url);

    if (remove) {
      if (existingPath) {
        await admin.storage.from('account_image').remove([existingPath]);
      }

      const { error: updateError } = await admin
        .from('projects')
        .update({
          picture_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)
        .eq('account_id', project.account_id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ pictureUrl: null });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are allowed.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Max size is 5MB.' },
        { status: 400 },
      );
    }

    try {
      const pictureUrl = await storeProjectPhotoBytes({
        accountId: project.account_id,
        projectId: project.id,
        existingPictureUrl: project.picture_url,
        bytes: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || 'image/jpeg',
      });

      return NextResponse.json({ pictureUrl });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to upload project photo.',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('[projects] upload-photo unhandled:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to upload project photo.',
      },
      { status: 500 },
    );
  }
}
