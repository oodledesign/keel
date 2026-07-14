import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireVideoAccountAccess } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  parentFolderId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const access = await requireVideoAccountAccess(parsed.data.accountId);
    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const parentFolderId = parsed.data.parentFolderId ?? null;

    if (parentFolderId) {
      const { data: parent, error: parentError } = await access.client
        .from('video_folders')
        .select('id')
        .eq('id', parentFolderId)
        .eq('account_id', parsed.data.accountId)
        .maybeSingle();

      if (parentError) {
        return jsonErr('DB_ERROR', parentError.message, 500);
      }
      if (!parent) {
        return jsonErr('NOT_FOUND', 'Parent folder not found', 404);
      }
    }

    const { data, error } = await access.client
      .from('video_folders')
      .insert({
        account_id: parsed.data.accountId,
        name: parsed.data.name,
        parent_folder_id: parentFolderId,
      })
      .select('*')
      .single();

    if (error) {
      return jsonErr('DB_ERROR', error.message, 500);
    }

    return jsonOk({ folder: data });
  } catch (error) {
    console.error('[videos] folders POST', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to create folder',
      500,
    );
  }
}
