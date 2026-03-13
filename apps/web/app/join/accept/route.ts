import { NextRequest, NextResponse } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { Database } from '~/lib/database.types';

/**
 * @name GET
 * @description Middleware route that validates team invitation and generates fresh auth link on-demand.
 *
 * Flow:
 * 1. User clicks email link: /join/accept?invite_token=xxx
 * 2. Validate invitation exists and not expired (7-day window)
 * 3. Generate fresh Supabase auth link (new 24-hour token)
 * 4. Redirect to /auth/confirm with fresh token
 * 5. User authenticated immediately (token consumed right away)
 */
export async function GET(request: NextRequest) {
  const logger = await getLogger();
  const { searchParams } = new URL(request.url);
  const inviteToken = searchParams.get('invite_token');

  const ctx = {
    name: 'join.accept',
    inviteToken,
  };

  // Validate invite token is provided
  if (!inviteToken) {
    logger.warn(ctx, 'Missing invite_token parameter');

    return redirectToError('Invalid invitation link');
  }

  try {
    const adminClient = getSupabaseServerAdminClient();

    // Query invitation from database
    const { data: invitation, error: invitationError } = await adminClient
      .from('invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    // Handle invitation not found or expired
    if (invitationError || !invitation) {
      logger.warn(
        {
          ...ctx,
          error: invitationError,
        },
        'Invitation not found or expired',
      );

      return redirectToError('Invitation not found or expired');
    }

    logger.info(
      {
        ...ctx,
        invitationId: invitation.id,
        email: invitation.email,
      },
      'Valid invitation found. Generating auth link...',
    );

    // Determine email link type based on user existence
    // 'invite' for new users (creates account + authenticates)
    // 'magiclink' for existing users (authenticates only)
    const emailLinkType = await determineEmailLinkType(
      adminClient,
      invitation.email,
    );

    logger.info(
      {
        ...ctx,
        emailLinkType,
        email: invitation.email,
      },
      'Determined email link type for invitation',
    );

    // Generate fresh Supabase auth link
    const generateLinkResponse = await adminClient.auth.admin.generateLink({
      email: invitation.email,
      type: emailLinkType,
    });

    if (generateLinkResponse.error) {
      logger.error(
        {
          ...ctx,
          error: generateLinkResponse.error,
        },
        'Failed to generate auth link',
      );

      throw generateLinkResponse.error;
    }

    // Extract token from generated link
    const verifyLink = generateLinkResponse.data.properties?.action_link;
    const token = new URL(verifyLink).searchParams.get('token');

    if (!token) {
      logger.error(ctx, 'Token not found in generated link');
      throw new Error('Token in verify link from Supabase Auth was not found');
    }

    // Build redirect URL to auth confirmation with fresh token
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const authCallbackUrl = new URL('/auth/confirm', siteUrl);

    // Add auth parameters
    authCallbackUrl.searchParams.set('token_hash', token);
    authCallbackUrl.searchParams.set('type', emailLinkType);

    // Add next parameter to redirect to join page after auth
    const joinUrl = new URL(pathsConfig.app.joinTeam, siteUrl);
    joinUrl.searchParams.set('invite_token', inviteToken);

    // Mark if this is a new user so /join page can redirect to /identities
    if (emailLinkType === 'invite') {
      joinUrl.searchParams.set('is_new_user', 'true');
    }

    // Use pathname + search to create a safe relative path for validation
    authCallbackUrl.searchParams.set('next', joinUrl.pathname + joinUrl.search);

    logger.info(
      {
        ...ctx,
        redirectUrl: authCallbackUrl.pathname,
      },
      'Redirecting to auth confirmation with fresh token',
    );

    // Redirect to auth confirmation
    return NextResponse.redirect(authCallbackUrl);
  } catch (error) {
    logger.error(
      {
        ...ctx,
        error,
      },
      'Failed to process invitation acceptance',
    );

    return redirectToError('An error occurred processing your invitation');
  }
}

/**
 * @name determineEmailLinkType
 * @description Determines whether to use 'invite' or 'magiclink' based on user existence
 */
async function determineEmailLinkType(
  adminClient: SupabaseClient<Database>,
  email: string,
): Promise<'invite' | 'magiclink'> {
  const user = await adminClient
    .from('accounts')
    .select('*')
    .eq('email', email)
    .single();

  // If user not found, return 'invite' type (allows registration)
  if (user.error || !user.data) {
    return 'invite';
  }

  // If user exists, return 'magiclink' type (sign in)
  return 'magiclink';
}

/**
 * @name redirectToError
 * @description Redirects to join page with error message
 */
function redirectToError(message: string): NextResponse {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const errorUrl = new URL(pathsConfig.app.joinTeam, siteUrl);

  errorUrl.searchParams.set('error', message);

  return NextResponse.redirect(errorUrl);
}
