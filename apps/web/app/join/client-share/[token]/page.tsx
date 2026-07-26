import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AuthLayoutShell } from '@kit/auth/shared';
import { MultiFactorAuthError, requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';

import { AppLogo } from '~/components/app-logo';
import pathsConfig from '~/config/paths.config';
import { getShareByToken } from '~/lib/clients/client-workspace-shares.service';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AcceptClientShareForm } from './_components/accept-client-share-form';

interface PageProps {
  params: Promise<{ token: string }>;
}

async function AcceptClientSharePage(props: PageProps) {
  const { token } = await props.params;
  if (!token || token.length < 16) {
    notFound();
  }

  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (auth.error ?? !auth.data) {
    if (auth.error instanceof MultiFactorAuthError) {
      const urlParams = new URLSearchParams({
        next: pathsConfig.app.joinClientShare.replace('[token]', token),
      });
      redirect(`${pathsConfig.auth.verifyMfa}?${urlParams.toString()}`);
    }

    const urlParams = new URLSearchParams({
      next: pathsConfig.app.joinClientShare.replace('[token]', token),
    });
    redirect(`${pathsConfig.auth.signIn}?${urlParams.toString()}`);
  }

  const share = await getShareByToken(token);
  if (!share) {
    notFound();
  }

  const clientName =
    share.clientDisplayName ?? share.clientOrgName ?? 'a client';
  const ownerName = share.ownerAccountName ?? 'A workspace';

  return (
    <AuthLayoutShell Logo={AppLogo}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-10">
        <div>
          <Heading level={4}>Accept client share</Heading>
          <p className="text-muted-foreground mt-2 text-sm">
            <strong>{ownerName}</strong> shared <strong>{clientName}</strong>{' '}
            with your workspace.
          </p>
        </div>

        {share.status === 'revoked' || share.status === 'expired' ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
            This invite is no longer valid ({share.status}).
          </div>
        ) : share.status === 'active' ? (
          <div className="space-y-4">
            <p className="text-sm">
              This invite was already accepted
              {share.guestAccountSlug
                ? ` by ${share.guestAccountName ?? share.guestAccountSlug}`
                : ''}
              .
            </p>
            {share.guestAccountSlug ? (
              <Button asChild>
                <Link
                  href={pathsConfig.app.accountSharedClients.replace(
                    '[account]',
                    share.guestAccountSlug,
                  )}
                >
                  Open shared clients
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <AcceptClientShareForm
            token={token}
            capabilities={share.capabilities}
            invitedEmail={share.invitedEmail}
          />
        )}
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(AcceptClientSharePage);
