import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { isFreeAgentConfigured } from '~/lib/integrations/freeagent/env';
import { buildFreeAgentAuthUrl } from '~/lib/integrations/freeagent/oauth';

function financesPath(accountSlug: string, query?: Record<string, string>) {
  const base = pathsConfig.app.accountFinances.replace('[account]', accountSlug);
  if (!query || Object.keys(query).length === 0) return base;
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get('account')?.trim();

  if (!accountSlug) {
    return NextResponse.json({ error: 'Missing account' }, { status: 400 });
  }

  if (!isFreeAgentConfigured()) {
    return NextResponse.redirect(
      new URL(
        financesPath(accountSlug, {
          finance_error: 'FreeAgent is not configured on this deployment',
        }),
        url.origin,
      ),
    );
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

  try {
    const authUrl = buildFreeAgentAuthUrl({
      userId: user.id,
      accountId: account.id,
      accountSlug,
      returnPath,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not start FreeAgent OAuth';
    console.error('[freeagent/start]', err);

    return NextResponse.redirect(
      new URL(
        financesPath(accountSlug, { finance_error: message }),
        url.origin,
      ),
    );
  }
}
