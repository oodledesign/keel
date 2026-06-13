'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { queueBrainIndexSource } from '~/lib/brain/sync';

const SaveDocSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  docId: z.string().uuid(),
  title: z.string().max(500),
  content: z.string().optional(),
  docType: z.string().max(100).nullable().optional(),
});

export const saveWorkDocAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('docs')
      .update({
        title: data.title.trim() || 'Untitled document',
        // Content MUST be a Markdown string — see lib/markdown.ts contract.
        content: data.content ?? '',
        doc_type: data.docType ?? null,
      })
      .eq('id', data.docId)
      .eq('account_id', data.accountId);

    if (error) throw error;

    queueBrainIndexSource(data.accountId, 'doc', data.docId);

    const base = pathsConfig.app.accountDocs.replace(
      '[account]',
      data.accountSlug,
    );
    revalidatePath(base);
    revalidatePath(
      pathsConfig.app.accountDocDetail
        .replace('[account]', data.accountSlug)
        .replace('[docId]', data.docId),
    );

    return { ok: true };
  },
  { schema: SaveDocSchema },
);
