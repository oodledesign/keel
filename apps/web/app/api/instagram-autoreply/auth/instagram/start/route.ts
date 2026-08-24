import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getOptionalMetaInstagram } from '~/lib/instagram-autoreply/env';
import { buildInstagramAutoreplyAuthUrl } from '~/lib/instagram-autoreply/instagram-oauth';
import { isSafeOAuthReturnPath, signIgAutoreplyOAuthState } from '~/lib/instagram-autoreply/oauth-state';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function resolveAccountSlug(client: ReturnType<typeof getSupabaseServerClient>, accountId: string) {
  const { data } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();
  return (data as { slug?: string } | null)?.slug ?? null;
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id');
  const returnParam = request.nextUrl.searchParams.get('return');

  if (!accountId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json(
      { error: 'account_id (uuid) is required' },
      { status: 400 },
    );
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(
      absoluteUrl(`${pathsConfig.auth.signIn}?next=${next}`),
    );
  }

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?instagram_error=${encodeURIComponent('Forbidden')}`,
      ),
    );
  }

  if (!getOptionalMetaInstagram()) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?instagram_error=${encodeURIComponent('Instagram is not configured')}`,
      ),
    );
  }

  const slug = await resolveAccountSlug(client, accountId);
  const defaultReturn = slug
    ? pathsConfig.app.accountInstagramAutoreply.replace('[account]', slug)
    : pathsConfig.app.home;
  const returnPath =
    returnParam && isSafeOAuthReturnPath(returnParam)
      ? returnParam
      : defaultReturn;

  const state = signIgAutoreplyOAuthState({
    accountId,
    userId: user.id,
    exp: Date.now() + 10 * 60 * 1000,
    returnPath,
  });

  try {
    const url = buildInstagramAutoreplyAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth start failed';
    return NextResponse.redirect(
      absoluteUrl(`${returnPath}?instagram_error=${encodeURIComponent(msg)}`),
    );
  }
}
