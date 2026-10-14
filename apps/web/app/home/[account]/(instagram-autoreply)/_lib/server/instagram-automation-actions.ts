'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import { assertInstagramAutoreplyAccess } from '~/lib/instagram-autoreply/assert-access';
import type { IgAssetListItem } from '~/lib/instagram-autoreply/audio/upload-asset.client';

const listAssetsSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(['audio', 'image', 'video', 'pdf']).optional(),
});

export const listIgAssets = enhanceAction(
  async (input, user) => {
    const { client } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    let query = client
      .from('ig_automation_assets')
      .select(
        'id, label, kind, source, mime_type, size_bytes, duration_ms, waveform, transcode_status, transcode_error, created_at',
      )
      .eq('account_id', input.accountId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (input.kind) {
      query = query.eq('kind', input.kind);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []) as IgAssetListItem[];
  },
  { schema: listAssetsSchema },
);
