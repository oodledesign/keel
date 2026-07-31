import { NextRequest, NextResponse } from 'next/server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import type { Database } from '~/lib/database.types';
import { getProjectGuestByToken } from '~/lib/projects/project-guests.service';

/**
 * Magic-link / invite auth for project guests (mirrors /join/accept for team invites).
 *
 * Flow:
 * 1. Email link: /join/project-guest/[token]/accept
 * 2. Validate pending/accepted guest invite
 * 3. If already signed in as the invited email → join page
 * 4. Else generate fresh Supabase auth link for invited_email
 * 5. /auth/confirm → /join/project-guest/[token]
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const logger = await getLogger();
  const { token } = await context.params;

  const ctx = {
    name: 'join.project-guest.accept',
    tokenPrefix: token?.slice(0, 8),
  };

  if (!token || token.length < 16) {
    logger.warn(ctx, 'Missing or short project guest token');
    return redirectToJoinError(token, 'Invalid invitation link');
  }

  try {
    const guest = await getProjectGuestByToken(token);

    if (!guest) {
      logger.warn(ctx, 'Project guest invite not found');
      return redirectToJoinError(token, 'Invitation not found');
    }

    if (guest.status === 'revoked') {
      return redirectToJoinError(token, 'This invite was revoked');
    }

    const joinPath = pathsConfig.app.joinProjectGuest.replace('[token]', token);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';

    // Already signed in as the invited address — skip magic link.
    const sessionClient = getSupabaseServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (user?.email) {
      const email = user.email.trim().toLowerCase();
      if (email === guest.invitedEmail.toLowerCase()) {
        return NextResponse.redirect(new URL(joinPath, siteUrl || undefined));
      }

      // Wrong account signed in — clear session so we can auth as the invitee.
      logger.warn(
        { ...ctx, signedInEmail: email, invitedEmail: guest.invitedEmail },
        'Signing out mismatched user before project guest magic link',
      );
      await sessionClient.auth.signOut();
    }

    const adminClient = getSupabaseServerAdminClient();
    const emailLinkType = await determineEmailLinkType(
      adminClient,
      guest.invitedEmail,
    );

    logger.info(
      {
        ...ctx,
        emailLinkType,
        invitedEmail: guest.invitedEmail,
      },
      'Generating auth link for project guest invite',
    );

    const generateLinkResponse = await adminClient.auth.admin.generateLink({
      email: guest.invitedEmail,
      type: emailLinkType,
    });

    if (generateLinkResponse.error) {
      logger.error(
        { ...ctx, error: generateLinkResponse.error },
        'Failed to generate auth link for project guest',
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
    logger.error({ ...ctx, error }, 'Failed to process project guest accept');
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
    ? pathsConfig.app.joinProjectGuest.replace('[token]', token)
    : pathsConfig.app.home;
  const url = new URL(path, siteUrl || 'http://localhost:3000');
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}
