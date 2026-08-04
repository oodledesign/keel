import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export const GET = enhanceRouteHandler(
  async ({ params, user, request }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const accountId = new URL(request.url).searchParams.get('accountId');
    if (!accountId || !z.string().uuid().safeParse(accountId).success) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const isMember =
      accountId === user.id ||
      (await userIsAccountMember(client, user.id, accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // RLS scopes to member accounts — viewing stays available when module disabled.
    const { data: job, error } = await client
      .from('media_generation_jobs')
      .select('*')
      .eq('id', parsedParams.data.id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  },
  { auth: true },
);
