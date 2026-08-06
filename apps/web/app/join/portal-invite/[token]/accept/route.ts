import { NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import type { Database } from '~/lib/database.types';
import { getClientPortalInviteByToken } from '~/lib/clients/client-portal-invites.service';

/**
 * Invite / magic-link auth for portal contacts (mirrors project-guest accept).
 *
 * Flow:
 * 1. Email link: /join/portal-invite/[token]/accept
 * 2. Validate pending/accepted invite
 * 3. If already signed in as invited email → join page
 * 4. Else generate Supabase invite (set password) or magiclink
 * 5. /auth/confirm → /join/portal-invite/[token]
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const logger = await getLogger();
  const { token } = await context.params;

  const ctx = {
    name: 'join.portal-invite.accept',
    tokenPrefix: token?.slice(0, 8),
  };

  if (!token || token.length < 16) {
    logger.warn(ctx, 'Missing or short portal invite token');
    return redirectToJoinError(token, 'Invalid invitation link');
  }

  try {
    const invite = await getClientPortalInviteByToken(token);

    if (!invite) {
      logger.warn(ctx, 'Portal invite not found');
      return redirectToJoinError(token, 'Invitation not found');
    }

    if (invite.status === 'revoked') {
      return redirectToJoinError(token, 'This invite was revoked');
    }

    const joinPath = pathsConfig.app.joinPortalInvite.replace('[token]', token);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';

    const sessionClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (user?.email) {
      const email = user.email.trim().toLowerCase();
      if (email === invite.invitedEmail.toLowerCase()) {
        return NextResponse.redirect(new URL(joinPath, siteUrl || undefined));
      }

      logger.warn(
        { ...ctx, signedInEmail: email, invitedEmail: invite.invitedEmail },
        'Signing out mismatched user before portal invite auth',
      );
      await sessionClient.auth.signOut();
    }

    const adminClient = getSupabaseServerAdminClient();
    const emailLinkType = await determineEmailLinkType(
      adminClient,
      invite.invitedEmail,
    );

    logger.info(
      {
        ...ctx,
        emailLinkType,
        invitedEmail: invite.invitedEmail,
      },
      'Generating auth link for portal invite',
    );

    const generateLinkResponse = await adminClient.auth.admin.generateLink({
      email: invite.invitedEmail,
      type: emailLinkType,
    });

    if (generateLinkResponse.error) {
      logger.error(
        { ...ctx, error: generateLinkResponse.error },
        'Failed to generate auth link for portal invite',
      );
      throw generateLinkResponse.error;
    }

    const verifyLink = generateLinkResponse.data.properties?.action_link;
    const authToken = verifyLink
      ? new URL(verifyLink).searchParams.get('token')
      : null;

    if (!authToken) {
      logger.error(ctx, 'Token not found in generated auth link');
      throw new Error('Token in verify link from Supabase Auth was not found');
    }

    const authCallbackUrl = new URL(
      '/auth/confirm',
      siteUrl || 'http://localhost:3000',
    );
    authCallbackUrl.searchParams.set('token_hash', authToken);
    authCallbackUrl.searchParams.set('type', emailLinkType);
    authCallbackUrl.searchParams.set('next', joinPath);

    return NextResponse.redirect(authCallbackUrl);
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to process portal invite accept');
    return redirectToJoinError(
      token,
      'An error occurred processing your invitation',
    );
  }
}

async function determineEmailLinkType(
  adminClient: SupabaseClient<Database>,
  email: string,
): Promise<'invite' | 'magiclink'> {
  const { data, error } = await adminClient
    .from('accounts')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return 'invite';
  }

  return 'magiclink';
}

function redirectToJoinError(token: string | undefined, message: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  const path = token
    ? pathsConfig.app.joinPortalInvite.replace('[token]', token)
    : pathsConfig.app.home;
  const url = new URL(path, siteUrl || 'http://localhost:3000');
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}
