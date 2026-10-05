import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { jsonErr, jsonOk } from '~/lib/rankly/api-response';
import { requireVideoById } from '~/lib/videos/server/videos-access';

export const runtime = 'nodejs';

const bodySchema = z.object({
  /** Every video in the folder, in the order they should appear. */
  videoIds: z.array(z.string().uuid()).min(1).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonErr('VALIDATION', 'Invalid body', 400, parsed.error.flatten());
    }

    const ids = [...new Set(parsed.data.videoIds)];

    // Membership check on the first video; RLS still guards every write below.
    const access = await requireVideoById(ids[0]!);
    if (access.error === 'UNAUTHORIZED') {
      return jsonErr('UNAUTHORIZED', 'Sign in required', 401);
    }
    if (access.error === 'NOT_FOUND') {
      return jsonErr('NOT_FOUND', 'Video not found', 404);
    }
    if (access.error === 'FORBIDDEN') {
      return jsonErr('FORBIDDEN', 'Not a member of this account', 403);
    }

    const accountId = access.video!.account_id as string;
    const results = await Promise.all(
      ids.map((id, index) =>
        access.client
          .from('videos')
          .update({ sort_order: index })
          .eq('id', id)
          // Scoped to the account so ids from elsewhere are ignored.
          .eq('account_id', accountId),
      ),
    );

    const failed = results.find((result) => result.error);
    if (failed?.error) {
      return jsonErr('DB_ERROR', failed.error.message, 500);
    }

    return jsonOk({ count: ids.length });
  } catch (error) {
    console.error('[videos] reorder', error);
    return jsonErr(
      'INTERNAL',
      error instanceof Error ? error.message : 'Failed to reorder videos',
      500,
    );
  }
}
