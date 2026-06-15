import { NextRequest, NextResponse } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { Database } from '~/lib/database.types';
import { loadAdminUserInviteByToken } from '~/lib/admin/user-invites.service';

/**
 * Validates a super-admin user invite and generates a fresh Supabase auth link.
 * /join/user-invite/accept?invite_token=xxx
 */
export async function GET(request: NextRequest) {
  const logger = await getLogger();
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get('invite_token');

  const ctx = {
    name: 'join.user-invite.accept',
    inviteToken,
  };

  if (!inviteToken) {
    logger.warn(ctx, 'Missing invite_token parameter');
    return redirectToError('Invalid invitation link');
  }

  try {
    const adminClient = getSupabaseServerAdminClient();
    const invitation = await loadAdminUserInviteByToken(
      adminClient,
      inviteToken,
    );

    if (!invitation || invitation.status !== 'pending') {
      logger.warn(ctx, 'Invitation not found or not pending');
      return redirectToError('Invitation not found or expired');
    }

    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await adminClient
        .from('admin_user_invites')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return redirectToError('Invitation has expired');
    }

    const emailLinkType = await determineEmailLinkType(
      adminClient,
      invitation.email,
    );

    const generateLinkResponse = await adminClient.auth.admin.generateLink({
      email: invitation.email,
      type: emailLinkType,
    });

    if (generateLinkResponse.error) {
      throw generateLinkResponse.error;
    }

    const verifyLink = generateLinkResponse.data.properties?.action_link;
    const token = verifyLink ? new URL(verifyLink).searchParams.get('token') : null;

    if (!token) {
      throw new Error('Token in verify link from Supabase Auth was not found');
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const authCallbackUrl = new URL('/auth/confirm', siteUrl);

    authCallbackUrl.searchParams.set('token_hash', token);
    authCallbackUrl.searchParams.set('type', emailLinkType);

    const joinUrl = new URL(pathsConfig.app.joinUserInvite, siteUrl);
    joinUrl.searchParams.set('invite_token', inviteToken);

    if (emailLinkType === 'invite') {
      joinUrl.searchParams.set('is_new_user', 'true');
    }

    authCallbackUrl.searchParams.set('next', joinUrl.pathname + joinUrl.search);

    return NextResponse.redirect(authCallbackUrl);
  } catch (error) {
    logger.error({ ...ctx, error }, 'Failed to process user invitation');
    return redirectToError('An error occurred processing your invitation');
  }
}

async function determineEmailLinkType(
  adminClient: SupabaseClient<Database>,
  email: string,
): Promise<'invite' | 'magiclink'> {
  const user = await adminClient
    .from('accounts')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (user.error || !user.data) {
    return 'invite';
  }

  return 'magiclink';
}

function redirectToError(message: string): NextResponse {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const errorUrl = new URL(pathsConfig.app.joinUserInvite, siteUrl);
  errorUrl.searchParams.set('error', message);
  return NextResponse.redirect(errorUrl);
}
