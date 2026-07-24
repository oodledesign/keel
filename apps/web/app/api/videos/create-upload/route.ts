import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { createVideoUploadForAccount } from '~/lib/videos/server/create-video-upload';
import { requireVideoAccountAccess } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  accountId: z.string().uuid(),
  title: z.string().min(1).max(500),
  folderId: z.string().uuid().nullable().optional(),
  originalFilename: z.string().max(500).optional(),
  libraryId: z.string().optional(),
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

    const created = await createVideoUploadForAccount(access.client, {
      accountId: parsed.data.accountId,
      title: parsed.data.title,
      folderId: parsed.data.folderId,
      originalFilename: parsed.data.originalFilename,
      source: 'upload',
    });

    if (!created.ok) {
      if (created.code === 'PLAN_LIMIT') {
        return jsonErr('PLAN_LIMIT', created.message, 402);
      }
      return jsonErr('DB_ERROR', created.message, 500);
    }

    return jsonOk(created.data);
  } catch (error) {
    console.error('[videos] create-upload', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to start upload',
      500,
    );
  }
}
