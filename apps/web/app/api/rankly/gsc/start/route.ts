import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { userIsAccountMember } from '~/lib/rankly/account-membership';
import { denyUnlessRanklyAddon } from '~/lib/rankly/require-rankly-api-access';
import { isGscConfigured } from '~/lib/rankly-gsc/env';
import { buildGscAuthUrl } from '~/lib/rankly-gsc/oauth';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function keywordsPath(accountSlug: string, projectId: string) {
  return pathsConfig.app.accountRanklyProjectKeywords
    .replace('[account]', accountSlug)
    .replace('[projectId]', projectId);
}

export async function GET(request: NextRequest) {
  const accountSlug = request.nextUrl.searchParams.get('account')?.trim();
  const projectId = request.nextUrl.searchParams.get('projectId')?.trim();

  if (!accountSlug || !projectId) {
    return NextResponse.json(
      { error: 'Missing account or projectId' },
      { status: 400 },
    );
  }

  const returnFallback = keywordsPath(accountSlug, projectId);

  if (!isGscConfigured()) {
    return NextResponse.redirect(
      absoluteUrl(
        `${returnFallback}?gsc_error=${encodeURIComponent('Google Search Console is not configured on this deployment')}`,
      ),
    );
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const { data: account } = await client
    .from('accounts')
    .select('id')
    .eq('slug', accountSlug)
    .maybeSingle();

  if (!account?.id) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const isMember = await userIsAccountMember(client, user.id, account.id);
  if (!isMember) {
    return NextResponse.redirect(
      absoluteUrl(
        `${returnFallback}?gsc_error=${encodeURIComponent('Not a member of this workspace')}`,
      ),
    );
  }

  const addonDenied = await denyUnlessRanklyAddon(client, user.id, account.id);
  if (addonDenied) {
    return NextResponse.redirect(
      absoluteUrl(
        `${returnFallback}?gsc_error=${encodeURIComponent('Rankly addon required')}`,
      ),
    );
  }

  const { data: project } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('account_id', account.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.redirect(
      absoluteUrl(
        `${returnFallback}?gsc_error=${encodeURIComponent('Project not found')}`,
      ),
    );
  }

  const returnPath =
    request.nextUrl.searchParams.get('returnPath')?.trim() || returnFallback;

  try {
    const authUrl = buildGscAuthUrl({
      userId: user.id,
      accountId: account.id,
      accountSlug,
      projectId,
      returnPath: returnPath.startsWith('/') ? returnPath : returnFallback,
    });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not start Google Search Console OAuth';
    return NextResponse.redirect(
      absoluteUrl(
        `${returnFallback}?gsc_error=${encodeURIComponent(message)}`,
      ),
    );
  }
}
