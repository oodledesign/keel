import { AppLogo } from '~/components/app-logo';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { AuthFormCard } from '../_components/auth-form-card';
import { NativeAuthBounce } from './_components/native-auth-bounce';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('auth:nativeAuthHeading'),
  };
};

function NativeAuthPage() {
  return (
    <AuthFormCard>
      <div className="flex justify-center">
        <AppLogo className="h-7 w-auto" />
      </div>

      <NativeAuthBounce />
    </AuthFormCard>
  );
}

export default withI18n(NativeAuthPage);
