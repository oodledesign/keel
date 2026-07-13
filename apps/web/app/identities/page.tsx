import { Metadata } from 'next';

import { redirect } from 'next/navigation';

import { AuthLayoutShell } from '@kit/auth/shared';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import { AppLogo } from '~/components/app-logo';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { IdentitiesStepWrapper } from './_components/identities-step-wrapper';
import { loadInvitePasswordSetupContext } from './_lib/load-invite-password-setup-context';

export const meta = async (): Promise<Metadata> => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:setupAccount'),
  };
};

type IdentitiesPageProps = {
  searchParams: Promise<{
    next?: string;
    require_auth_method?: string;
    invite_token?: string;
    invite_kind?: string;
  }>;
};

/**
 * @name IdentitiesPage
 * @description Invited users set a password for their account email.
 */
async function IdentitiesPage(props: IdentitiesPageProps) {
  const { nextPath, inviteContext, isInviteSetup } = await fetchData(props);

  const descriptionKey =
    isInviteSetup &&
    inviteContext.hasWorkspaceInvite &&
    inviteContext.workspaceName
      ? 'auth:invitePasswordSetupWithWorkspace'
      : isInviteSetup
        ? 'auth:invitePasswordSetupPersonal'
        : 'auth:linkAccountToSignInDescription';

  return (
    <AuthLayoutShell
      Logo={AppLogo}
      contentClassName="max-w-md overflow-y-hidden"
    >
      <div
        className={
          'flex max-h-[70vh] w-full flex-col items-center space-y-6 overflow-y-auto'
        }
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <Heading
            level={4}
            className="text-center"
            data-test="identities-page-heading"
          >
            {isInviteSetup ? (
              inviteContext.firstName ? (
                <Trans
                  i18nKey="auth:invitePasswordSetupGreetingNamed"
                  values={{ name: inviteContext.firstName }}
                />
              ) : (
                <Trans i18nKey="auth:invitePasswordSetupGreeting" />
              )
            ) : (
              <Trans i18nKey={'auth:linkAccountToSignIn'} />
            )}
          </Heading>

          <p
            className="text-muted-foreground max-w-sm text-sm leading-relaxed"
            data-test="identities-page-description"
          >
            <Trans
              i18nKey={descriptionKey}
              values={
                inviteContext.workspaceName
                  ? { workspace: inviteContext.workspaceName }
                  : undefined
              }
              components={{
                workspace: (
                  <span className="text-foreground font-medium" />
                ),
              }}
            />
          </p>

          {isInviteSetup ? (
            <p className="text-foreground/80 max-w-sm text-sm font-medium">
              <Trans i18nKey={'auth:invitePasswordSetupAction'} />
            </p>
          ) : null}
        </div>

        <IdentitiesStepWrapper nextPath={nextPath} />
      </div>
    </AuthLayoutShell>
  );
}

export default withI18n(IdentitiesPage);

async function fetchData(props: IdentitiesPageProps) {
  const searchParams = await props.searchParams;
  const client = getSupabaseServerClient();
  const auth = await requireUser(client);

  if (!auth.data) {
    throw redirect(pathsConfig.auth.signIn);
  }

  const nextPath = getSafeRedirectPath(searchParams.next, pathsConfig.app.home);
  const isInviteSetup = Boolean(searchParams.invite_token?.trim());

  const metadataName =
    typeof auth.data.user_metadata?.full_name === 'string'
      ? auth.data.user_metadata.full_name
      : typeof auth.data.user_metadata?.name === 'string'
        ? auth.data.user_metadata.name
        : typeof auth.data.user_metadata?.first_name === 'string'
          ? auth.data.user_metadata.first_name
          : null;

  const inviteContext = await loadInvitePasswordSetupContext({
    inviteToken: searchParams.invite_token,
    inviteKind: searchParams.invite_kind,
    fallbackName: metadataName,
  });

  return { nextPath, inviteContext, isInviteSetup };
}
