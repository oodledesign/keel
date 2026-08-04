import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

import {
  isMediaGenerateEnabled,
  setMediaGenerateEnabled,
} from '~/lib/media-generation/module-access';
import { userIsAccountMember } from '~/lib/rankly/account-membership';

export const runtime = 'nodejs';

const querySchema = z.object({
  accountId: z.string().uuid(),
});

const bodySchema = z.object({
  accountId: z.string().uuid(),
  enabled: z.boolean(),
});

export const GET = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = querySchema.safeParse({
      accountId: new URL(request.url).searchParams.get('accountId'),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const isMember =
      parsed.data.accountId === user.id ||
      (await userIsAccountMember(client, user.id, parsed.data.accountId));

    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const enabled = await isMediaGenerateEnabled(parsed.data.accountId);
    return NextResponse.json({
      appKey: 'media_generate',
      enabled,
    });
  },
  { auth: true },
);

export const PATCH = enhanceRouteHandler(
  async ({ request, user }) => {
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const api = createTeamAccountsApi(client);
    const allowed = await api.hasPermission({
      userId: user.id,
      accountId: parsed.data.accountId,
      permission: 'settings.manage',
    });

    if (!allowed && parsed.data.accountId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await setMediaGenerateEnabled({
      accountId: parsed.data.accountId,
      enabled: parsed.data.enabled,
    });

    return NextResponse.json({
      appKey: 'media_generate',
      enabled: parsed.data.enabled,
    });
  },
  { auth: true },
);
