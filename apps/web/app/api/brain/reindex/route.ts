import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { indexAccountBatch } from '~/lib/brain/indexer';
import { isVoyageConfigured } from '~/lib/brain/voyage';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';
export const maxDuration = 60;

const REINDEX_BATCH_SIZE = 4;

const SourceRefSchema = z.object({
  sourceType: z.enum([
    'note',
    'doc',
    'job',
    'job_note',
    'phase',
    'transcript',
    'proposal',
    'task',
    'email_thread',
  ]),
  sourceId: z.string().uuid(),
  title: z.string(),
});

const BodySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
  offset: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(20).optional(),
  sources: z.array(SourceRefSchema).max(20).optional(),
  total: z.number().int().min(0).optional(),
});

export const POST = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isVoyageConfigured()) {
      return Response.json(
        { error: 'VOYAGE_API_KEY is not configured' },
        { status: 503 },
      );
    }

    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const isMember = await userIsAccountMember(
      client,
      user.id,
      parsed.data.accountId,
    );

    if (!isMember) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = getSupabaseServerAdminClient();
    const result = await indexAccountBatch(admin, parsed.data.accountId, {
      force: true,
      offset: parsed.data.offset,
      limit: parsed.data.limit ?? REINDEX_BATCH_SIZE,
      sources: parsed.data.sources,
      total: parsed.data.total,
    });

    if (result.done) {
      const { data: account } = await admin
        .from('accounts')
        .select('slug')
        .eq('id', parsed.data.accountId)
        .maybeSingle();

      const slug = (account?.slug as string | undefined)?.trim();
      if (slug) {
        revalidatePath(
          pathsConfig.app.accountBrainKnowledge.replace('[account]', slug),
        );
      }
    }

    return Response.json(result);
  },
  { auth: true },
);
