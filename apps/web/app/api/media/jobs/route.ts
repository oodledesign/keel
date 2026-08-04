import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  type: z.enum(['image', 'video']).optional(),
  status: z.string().optional(),
});

/** List generation jobs. Not gated on media_generate module — reads stay available when disabled. */
export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      accountId: url.searchParams.get('accountId'),
      projectId: url.searchParams.get('projectId') ?? undefined,
      clientId: url.searchParams.get('clientId') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const isMember =
      parsed.data.accountId === user.id ||
      (await userIsAccountMember(client, user.id, parsed.data.accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = client
      .from('media_generation_jobs')
      .select('*')
      .eq('account_id', parsed.data.accountId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (parsed.data.projectId) {
      query = query.eq('project_id', parsed.data.projectId);
    }
    if (parsed.data.clientId) {
      query = query.eq('client_id', parsed.data.clientId);
    }
    if (parsed.data.type) {
      query = query.eq('type', parsed.data.type);
    }
    if (parsed.data.status) {
      query = query.eq('status', parsed.data.status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: data ?? [] });
  },
  { auth: true },
);
