import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { buildZoomAuthUrl, isZoomConfigured } from '~/lib/integrations/zoom/oauth';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function accountsPath(accountSlug: string, query?: Record<string, string>) {
  const base = pathsConfig.app.accountSchedulingAccounts.replace(
    '[account]',
    accountSlug,
  );
  if (!query) return base;
  return `${base}?${new URLSearchParams(query).toString()}`;
}

export async function GET(request: NextRequest) {
  const accountSlug = request.nextUrl.searchParams.get('account')?.trim();
  if (!accountSlug) {
    return NextResponse.json({ error: 'Missing account' }, { status: 400 });
  }

  if (!isZoomConfigured()) {
    return NextResponse.redirect(
      absoluteUrl(
        accountsPath(accountSlug, {
          conferencing_error: 'Zoom is not configured on this server yet',
        }),
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

  const returnPath = pathsConfig.app.accountSchedulingAccounts.replace(
    '[account]',
    accountSlug,
  );

  try {
    return NextResponse.redirect(
      buildZoomAuthUrl({
        userId: user.id,
        accountId: account.id,
        accountSlug,
        returnPath,
      }),
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not start Zoom OAuth';
    return NextResponse.redirect(
      absoluteUrl(accountsPath(accountSlug, { conferencing_error: message })),
    );
  }
}
