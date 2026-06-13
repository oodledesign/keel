'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { requireUser } from '@kit/supabase/require-user';

import pathsConfig from '~/config/paths.config';

import {
  getBrainIndexStats,
  indexAccount,
} from '~/lib/brain/indexer';
import { loadBrainSourcePreview } from '~/lib/brain/source-preview';
import { isVoyageConfigured } from '~/lib/brain/voyage';

const AccountSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
});

const CreateThreadSchema = AccountSchema.extend({
  scope: z
    .object({
      jobId: z.string().uuid().optional(),
      clientId: z.string().uuid().optional(),
      jobTitle: z.string().optional(),
      clientName: z.string().optional(),
    })
    .optional(),
});

export const listBrainThreads = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: user } = await requireUser(client);
    if (!user) throw new Error('Authentication required');

    const { data, error } = await client
      .from('brain_chat_threads')
      .select('id, title, scope, updated_at, created_at')
      .eq('account_id', input.accountId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  },
  { schema: AccountSchema },
);

export const createBrainThread = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data: user } = await requireUser(client);
    if (!user) throw new Error('Authentication required');

    const { data, error } = await client
      .from('brain_chat_threads')
      .insert({
        account_id: input.accountId,
        user_id: user.id,
        title: 'New chat',
        scope: input.scope ?? {},
      })
      .select('id, title, scope, updated_at, created_at')
      .single();

    if (error) throw new Error(error.message);
    revalidatePath(
      pathsConfig.app.accountBrain.replace('[account]', input.accountSlug),
    );
    return data;
  },
  { schema: CreateThreadSchema },
);

export const listBrainThreadMessages = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const { data, error } = await client
      .from('brain_chat_messages')
      .select('id, role, content, context_refs, created_at')
      .eq('account_id', input.accountId)
      .eq('thread_id', input.threadId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  },
  {
    schema: AccountSchema.extend({
      threadId: z.string().uuid(),
    }),
  },
);

export const getBrainKnowledgeStats = enhanceAction(
  async (input) => {
    const admin = getSupabaseServerAdminClient();
    const stats = await getBrainIndexStats(admin, input.accountId);
    return {
      ...stats,
      voyageConfigured: isVoyageConfigured(),
    };
  },
  { schema: AccountSchema },
);

export const reindexBrainAccount = enhanceAction(
  async (input) => {
    const admin = getSupabaseServerAdminClient();
    const result = await indexAccount(admin, input.accountId);
    revalidatePath(
      pathsConfig.app.accountBrainKnowledge.replace('[account]', input.accountSlug),
    );
    return result;
  },
  { schema: AccountSchema },
);

export const getBrainSourcePreviewAction = enhanceAction(
  async (input) => {
    const client = getSupabaseServerClient();
    const preview = await loadBrainSourcePreview(client, {
      accountId: input.accountId,
      accountSlug: input.accountSlug,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (!preview) throw new Error('Source not found');
    return {
      ...preview,
      highlightText: input.highlightText ?? null,
    };
  },
  {
    schema: AccountSchema.extend({
      sourceType: z.enum([
        'note',
        'doc',
        'job',
        'job_note',
        'phase',
        'transcript',
        'proposal',
        'task',
      ]),
      sourceId: z.string().uuid(),
      highlightText: z.string().optional(),
    }),
  },
);
