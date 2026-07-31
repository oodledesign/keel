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
  buildGuestProjectPath,
  getProjectGuestByToken,
  linkPendingProjectGuestsForUser,
} from '~/lib/projects/project-guests.service';

import { AcceptProjectGuestForm } from './_components/accept-project-guest-form';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function AcceptProjectGuestPage(props: PageProps) {
  const { token } = await props.params;
  const { error: queryError } = await props.searchParams;

  if (!token || token.length < 16) {
    notFound();
  }

  const acceptPath = `${pathsConfig.app.joinProjectGuest.replace('[token]', token)}/accept`;
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  // Unauthenticated: send through magic-link / invite auth for the invited email
  // (do not dump on generic sign-in).
  if (auth.error ?? !auth.data) {
    if (auth.error instanceof MultiFactorAuthError) {
      const urlParams = new URLSearchParams({
        next: pathsConfig.app.joinProjectGuest.replace('[token]', token),
      });
      redirect(`${pathsConfig.auth.verifyMfa}?${urlParams.toString()}`);
    }

    redirect(acceptPath);
  }

  await linkPendingProjectGuestsForUser();

  const guest = await getProjectGuestByToken(token);
  if (!guest) {
    notFound();
  }

  // Refresh after auto-link may have flipped pending → accepted.
  const latest =
    guest.status === 'pending'
      ? await getProjectGuestByToken(token)
      : guest;
  const current = latest ?? guest;

  const projectLabel = current.projectName ?? 'a project';
  const ownerName = current.accountName ?? 'A workspace';
  const signedInEmail = auth.data.email?.trim().toLowerCase() ?? '';
  const invitedEmail = current.invitedEmail.toLowerCase();
  const emailMismatch =
    Boolean(signedInEmail) && signedInEmail !== invitedEmail;

  return (
    <AuthLayoutShell Logo={AppLogo}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-10">
        <div>
          <Heading level={4}>Project guest invite</Heading>
          <p className="text-muted-foreground mt-2 text-sm">
            <strong>{ownerName}</strong> invited you to collaborate on{' '}
            <strong>{projectLabel}</strong>.
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
            <p className="text-sm">You have access to this project.</p>
            <Button asChild>
              <Link href={buildGuestProjectPath(current.projectId)}>
                Open project
              </Link>
            </Button>
          </div>
        ) : (
          <AcceptProjectGuestForm token={token} />
        )}
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(AcceptProjectGuestPage);
