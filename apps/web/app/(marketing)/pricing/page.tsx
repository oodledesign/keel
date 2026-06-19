import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { KeelPricingPage } from '~/(marketing)/pricing/_components/keel-pricing-page';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const generateMetadata = async () => {
  const { t } = await createI18nServerInstance();

  return {
    title: t('marketing:pricing'),
    description:
      'Ozer pricing — free personal & family workspaces, paid community, business, and property plans, plus optional add-ons.',
  };
};

async function PricingPage() {
  const { t } = await createI18nServerInstance();

  return (
    <div className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(42,157,143,0.18),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />
      <div className="relative flex flex-col space-y-8">
        <SitePageHeader
          title={t('marketing:pricing')}
          subtitle={t('marketing:pricingSubtitle')}
        />

        <div className="container mx-auto px-4 pb-8 xl:pb-16">
          <KeelPricingPage />
        </div>
      </div>
    </div>
  );
}

export default withI18n(PricingPage);
