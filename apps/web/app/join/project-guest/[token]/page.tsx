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
}

async function AcceptProjectGuestPage(props: PageProps) {
  const { token } = await props.params;
  if (!token || token.length < 16) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const auth = await requireUser(client);
  const nextPath = pathsConfig.app.joinProjectGuest.replace('[token]', token);

  if (auth.error ?? !auth.data) {
    if (auth.error instanceof MultiFactorAuthError) {
      const urlParams = new URLSearchParams({ next: nextPath });
      redirect(`${pathsConfig.auth.verifyMfa}?${urlParams.toString()}`);
    }

    const urlParams = new URLSearchParams({ next: nextPath });
    redirect(`${pathsConfig.auth.signIn}?${urlParams.toString()}`);
  }

  await linkPendingProjectGuestsForUser();

  const guest = await getProjectGuestByToken(token);
  if (!guest) {
    notFound();
  }

  const projectLabel = guest.projectName ?? 'a project';
  const ownerName = guest.accountName ?? 'A workspace';

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

        {guest.status === 'revoked' ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
            This invite is no longer valid (revoked).
          </div>
        ) : guest.status === 'accepted' ? (
          <div className="space-y-4">
            <p className="text-sm">This invite has already been accepted.</p>
            <Button asChild>
              <Link href={buildGuestProjectPath(guest.projectId)}>
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
