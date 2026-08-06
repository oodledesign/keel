import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AuthLayoutShell } from '@kit/auth/shared';
import { MultiFactorAuthError, requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';

import { AppLogo } from '~/components/app-logo';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  buildClientPortalPath,
  getClientPortalInviteByToken,
  linkPendingClientPortalInvitesForUser,
} from '~/lib/clients/client-portal-invites.service';

import { AcceptPortalInviteForm } from './_components/accept-portal-invite-form';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function AcceptPortalInvitePage(props: PageProps) {
  const { token } = await props.params;
  const { error: queryError } = await props.searchParams;

  if (!token || token.length < 16) {
    notFound();
  }

  const acceptPath = pathsConfig.app.joinPortalInviteAccept.replace(
    '[token]',
    token,
  );
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (auth.error ?? !auth.data) {
    if (auth.error instanceof MultiFactorAuthError) {
      const urlParams = new URLSearchParams({
        next: pathsConfig.app.joinPortalInvite.replace('[token]', token),
      });
      redirect(`${pathsConfig.auth.verifyMfa}?${urlParams.toString()}`);
    }

    redirect(acceptPath);
  }

  await linkPendingClientPortalInvitesForUser();

  const invite = await getClientPortalInviteByToken(token);
  if (!invite) {
    notFound();
  }

  const current = invite;

  const clientLabel = current.clientOrgName ?? 'a client portal';
  const ownerName = current.accountName ?? 'A workspace';
  const signedInEmail = auth.data.email?.trim().toLowerCase() ?? '';
  const invitedEmail = current.invitedEmail.toLowerCase();
  const emailMismatch =
    Boolean(signedInEmail) && signedInEmail !== invitedEmail;

  return (
    <AuthLayoutShell Logo={AppLogo}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-10">
        <div>
          <Heading level={4}>Client portal invite</Heading>
          <p className="text-muted-foreground mt-2 text-sm">
            <strong>{ownerName}</strong> invited you to access{' '}
            <strong>{clientLabel}</strong>.
          </p>
        </div>

        {queryError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
            {queryError}
          </div>
        ) : null}

        {emailMismatch ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              This invite was sent to <strong>{current.invitedEmail}</strong>,
              but you are signed in as <strong>{auth.data.email}</strong>. Sign
              out and open the invite link again, or sign in with the invited
              address.
            </div>
            <Button asChild variant="outline">
              <Link href={acceptPath}>Continue with invited email</Link>
            </Button>
          </div>
        ) : current.status === 'revoked' ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
            This invite is no longer valid (revoked).
          </div>
        ) : current.status === 'accepted' ? (
          <div className="space-y-4">
            <p className="text-sm">You have access to this client portal.</p>
            {current.clientOrgSlug ? (
              <Button asChild>
                <Link href={buildClientPortalPath(current.clientOrgSlug)}>
                  Open portal
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <AcceptPortalInviteForm
            token={token}
            clientOrgSlug={current.clientOrgSlug}
          />
        )}
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(AcceptPortalInvitePage);
