import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { indexAccount } from '~/lib/brain/indexer';
import { isVoyageConfigured } from '~/lib/brain/voyage';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BodySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
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
    const result = await indexAccount(admin, parsed.data.accountId, {
      force: true,
    });

    revalidatePath(
      pathsConfig.app.accountBrainKnowledge.replace(
        '[account]',
        parsed.data.accountSlug,
      ),
    );

    return Response.json(result);
  },
  { auth: true },
);
