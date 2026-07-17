'use server';

import { revalidatePath } from 'next/cache';

import { randomBytes } from 'crypto';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

const ItemTypeSchema = z.enum(['note', 'file']);

function generatePublicToken() {
  return randomBytes(32).toString('hex');
}

export const setWorkspaceItemPublicAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const table = data.itemType === 'note' ? 'notes' : 'docs';

    const { data: existing, error: fetchError } = await client
      .from(table)
      .select('id, is_public, public_token')
      .eq('id', data.itemId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) throw new Error('Item not found');

    let publicToken = existing.public_token as string | null;
    if (data.isPublic && !publicToken) {
      publicToken = generatePublicToken();
    }

    const { error } = await client
      .from(table)
      .update({
        is_public: data.isPublic,
        public_token: data.isPublic ? publicToken : publicToken,
        public_enabled_at: data.isPublic ? new Date().toISOString() : null,
      })
      .eq('id', data.itemId)
      .eq('account_id', data.accountId);

    if (error) throw error;

    revalidateNotesAndFilesPaths(data.accountSlug);

    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
    const publicUrl =
      data.isPublic && publicToken
        ? `${origin}/portal/shared/${encodeURIComponent(publicToken)}`
        : null;
    const embedUrl =
      data.isPublic && publicToken
        ? `${origin}/portal/shared/${encodeURIComponent(publicToken)}?embed=1`
        : null;

    return { publicToken, publicUrl, embedUrl };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      accountSlug: z.string().min(1),
      itemType: ItemTypeSchema,
      itemId: z.string().uuid(),
      isPublic: z.boolean(),
    }),
  },
);

export const getWorkspaceItemPublicLinkAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const table = data.itemType === 'note' ? 'notes' : 'docs';

    const { data: row, error } = await client
      .from(table)
      .select('is_public, public_token')
      .eq('id', data.itemId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (error) throw error;
    if (!row?.is_public || !row.public_token) {
      return { publicUrl: null, embedUrl: null, publicToken: null };
    }

    const token = row.public_token as string;
    const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
    return {
      publicToken: token,
      publicUrl: `${origin}/portal/shared/${encodeURIComponent(token)}`,
      embedUrl: `${origin}/portal/shared/${encodeURIComponent(token)}?embed=1`,
    };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      itemType: ItemTypeSchema,
      itemId: z.string().uuid(),
    }),
  },
);

function revalidateNotesAndFilesPaths(accountSlug: string) {
  const notesBase = pathsConfig.app.accountNotes.replace(
    '[account]',
    accountSlug,
  );
  const docsBase = pathsConfig.app.accountDocs.replace(
    '[account]',
    accountSlug,
  );
  revalidatePath(notesBase);
  revalidatePath(docsBase);
  revalidatePath(`/home/${accountSlug}`);
}
