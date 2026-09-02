import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { upsertLinkedInOrgConnection } from '~/lib/commercial/linkedin-publishing/connections';
import {
  exchangeLinkedInCode,
  listAdministeredOrganizations,
  organizationIdFromUrn,
  organizationUrn,
} from '~/lib/commercial/linkedin-publishing/linkedin-api';
import {
  isSafeOAuthReturnPath,
  signPendingLinkedInOrgs,
  verifyLinkedInOrgOAuthState,
} from '~/lib/commercial/linkedin-publishing/oauth-state';

export const dynamic = 'force-dynamic';

const PENDING_COOKIE = 'linkedin_org_pending';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function expiresAtIso(expiresIn: number): string {
  return new Date(Date.now() + Math.max(expiresIn, 3600) * 1000).toISOString();
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const oauthError =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const payload = stateToken ? verifyLinkedInOrgOAuthState(stateToken) : null;
  const fallback = absoluteUrl(pathsConfig.app.home);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${fallback}?linkedin_error=${encodeURIComponent('Invalid or expired OAuth state')}`,
    );
  }

  const returnBase = isSafeOAuthReturnPath(payload.returnPath)
    ? absoluteUrl(payload.returnPath)
    : fallback;

  if (oauthError) {
    return NextResponse.redirect(
      `${returnBase}?linkedin_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnBase}?linkedin_error=${encodeURIComponent('Missing authorization code')}`,
    );
  }

  try {
    const tokens = await exchangeLinkedInCode(code);
    const orgs = await listAdministeredOrganizations(tokens.accessToken);

    if (orgs.length === 0) {
      return NextResponse.redirect(
        `${returnBase}?linkedin_error=${encodeURIComponent(
          'No company pages you administer were found. You must be an admin of the LinkedIn Page.',
        )}`,
      );
    }

    if (orgs.length === 1) {
      const org = orgs[0]!;
      await upsertLinkedInOrgConnection(client, {
        accountId: payload.accountId,
        orgId: organizationIdFromUrn(org.urn),
        orgUrn: organizationUrn(org.urn),
        orgName: org.name,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: expiresAtIso(tokens.expiresIn),
        connectedBy: user.id,
      });
      return NextResponse.redirect(`${returnBase}?linkedin_connected=1`);
    }

    const pending = signPendingLinkedInOrgs({
      accountId: payload.accountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: expiresAtIso(tokens.expiresIn),
      orgs,
      exp: Date.now() + 15 * 60 * 1000,
    });

    const response = NextResponse.redirect(`${returnBase}?linkedin_select=1`);
    response.cookies.set(PENDING_COOKIE, pending, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60,
    });
    return response;
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'LinkedIn connect failed';
    return NextResponse.redirect(
      `${returnBase}?linkedin_error=${encodeURIComponent(msg)}`,
    );
  }
}
