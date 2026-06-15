import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { PrivacyPolicyContent } from '../_components/legal-content';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export async function generateMetadata() {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:privacyPolicy'),
  };
}

async function PrivacyPolicyPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div>
      <SitePageHeader
        title={t('marketing:privacyPolicy')}
        subtitle={t('marketing:privacyPolicyDescription')}
      />

      <div className="container mx-auto px-4 py-8">
        <PrivacyPolicyContent />
      </div>
    </div>
  );
}

export default withI18n(PrivacyPolicyPage);
