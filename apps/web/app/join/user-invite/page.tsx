import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { AuthLayoutShell } from '@kit/auth/shared';
import { MultiFactorAuthError, requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import {
  fulfillAdminUserInvite,
  loadAdminUserInviteByToken,
} from '~/lib/admin/user-invites.service';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

interface AdminUserInvitePageProps {
  searchParams: Promise<{
    invite_token?: string;
    error?: string;
    is_new_user?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signUp'),
  };
};

async function AdminUserInvitePage(props: AdminUserInvitePageProps) {
  const searchParams = await props.searchParams;
  const token = searchParams.invite_token;

  if (searchParams.error) {
    return (
      <AuthLayoutShell Logo={AppLogo}>
        <InviteError message={searchParams.error} />
      </AuthLayoutShell>
    );
  }

  if (!token) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (auth.error ?? !auth.data) {
    if (auth.error instanceof MultiFactorAuthError) {
      const urlParams = new URLSearchParams({
        next: `${pathsConfig.app.joinUserInvite}?invite_token=${token}`,
      });

      redirect(`${pathsConfig.auth.verifyMfa}?${urlParams.toString()}`);
    }

    redirect(
      `/join/user-invite/accept?invite_token=${encodeURIComponent(token)}`,
    );
  }

  const adminClient = getSupabaseServerAdminClient();
  const invitation = await loadAdminUserInviteByToken(adminClient, token);

  if (
    !invitation ||
    invitation.status === 'revoked' ||
    invitation.status === 'expired'
  ) {
    return (
      <AuthLayoutShell Logo={AppLogo}>
        <InviteError message="Invitation not found or expired" />
      </AuthLayoutShell>
    );
  }

  if (invitation.email.toLowerCase() !== auth.data.email.toLowerCase()) {
    return (
      <AuthLayoutShell Logo={AppLogo}>
        <InviteError message="This invitation was sent to a different email address." />
      </AuthLayoutShell>
    );
  }

  const isNewAccount = searchParams.is_new_user === 'true';
  const supportsInviteAuthSelection =
    authConfig.providers.password || authConfig.providers.magicLinkSignIn;

  if (isNewAccount && supportsInviteAuthSelection) {
    const fulfillPath = `${pathsConfig.app.joinUserInvite}?invite_token=${encodeURIComponent(token)}`;
    const identitiesParams = new URLSearchParams({
      next: fulfillPath,
      require_auth_method: 'true',
      invite_token: token,
      invite_kind: 'admin',
    });
    redirect(`/identities?${identitiesParams.toString()}`);
  }

  let result: { redirectTo: string };

  try {
    result = await fulfillAdminUserInvite(
      adminClient,
      token,
      auth.data.id,
      auth.data.email,
    );
  } catch (error) {
    return (
      <AuthLayoutShell Logo={AppLogo}>
        <InviteError
          message={
            error instanceof Error
              ? error.message
              : 'Could not complete invitation'
          }
        />
      </AuthLayoutShell>
    );
  }

  redirect(result.redirectTo);
}

function InviteError(props: { message: string }) {
  return (
    <div className={'flex flex-col space-y-4 text-center'}>
      <Heading level={2}>Invitation problem</Heading>
      <p className={'text-muted-foreground text-sm'}>{props.message}</p>
      <Button asChild variant={'outline'}>
        <Link href={pathsConfig.auth.signIn}>
          <ArrowLeft className={'mr-2 h-4'} />
          <Trans i18nKey={'auth:signIn'} />
        </Link>
      </Button>
    </div>
  );
}

export default withI18n(AdminUserInvitePage);
