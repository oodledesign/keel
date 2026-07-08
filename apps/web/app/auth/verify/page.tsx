import { redirect } from 'next/navigation';

import { MultiFactorChallengeContainer } from '@kit/auth/mfa';
import { getSafeRedirectPath } from '@kit/shared/utils';
import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthFormCard } from '../_components/auth-form-card';

interface Props {
  searchParams: Promise<{
    next?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

async function VerifyPage(props: Props) {
  const client = getSupabaseServerClient();

  const { data } = await client.auth.getClaims();

  if (!data?.claims) {
    redirect(pathsConfig.auth.signIn);
  }

  const needsMfa = await checkRequiresMultiFactorAuthentication(client);

  if (!needsMfa) {
    redirect(pathsConfig.auth.signIn);
  }

  const nextPath = (await props.searchParams).next;
  const redirectPath = getSafeRedirectPath(nextPath, pathsConfig.app.home);

  return (
    <AuthFormCard>
      <MultiFactorChallengeContainer
        userId={data.claims.sub}
        paths={{
          redirectPath,
        }}
      />
    </AuthFormCard>
  );
}

export default withI18n(VerifyPage);
