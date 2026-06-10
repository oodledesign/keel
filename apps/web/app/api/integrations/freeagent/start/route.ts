import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isFreeAgentConfigured } from '~/lib/integrations/freeagent/env';
import { buildFreeAgentAuthUrl } from '~/lib/integrations/freeagent/oauth';

export async function GET(request: Request) {
  if (!isFreeAgentConfigured()) {
    return NextResponse.json({ error: 'FreeAgent not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const accountSlug = url.searchParams.get('account')?.trim();
  if (!accountSlug) {
    return NextResponse.json({ error: 'Missing account' }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/sign-in', url.origin));
  }

  const { data: account } = await client
    .from('accounts')
    .select('id')
    .eq('slug', accountSlug)
    .maybeSingle();

  if (!account?.id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const returnPath = pathsConfig.app.accountFinances.replace(
    '[account]',
    accountSlug,
  );

  const authUrl = buildFreeAgentAuthUrl({
    userId: user.id,
    accountId: account.id,
    accountSlug,
    returnPath,
  });

  redirect(authUrl);
}
