import { redirect } from 'next/navigation';

import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { VerifyEmailContent } from './_components/verify-email-content';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:verifyEmailHeading', { defaultValue: 'Verify your email' }),
  };
};

async function VerifyEmailPage() {
  const client = getSupabaseServerClient();
  const { data } = await client.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect(pathsConfig.auth.signIn);
  }

  if (user.email_confirmed_at) {
    redirect(pathsConfig.app.home);
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <Heading level={4} className="tracking-tight">
          <Trans i18nKey="auth:verifyEmailHeading" defaults="Verify your email" />
        </Heading>
      </div>

      <VerifyEmailContent email={user.email ?? null} />
    </>
  );
}

export default withI18n(VerifyEmailPage);
