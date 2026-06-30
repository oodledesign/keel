import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import PricingSection from '~/(marketing)/_components/pricing-section';
import { cn } from '@kit/ui/utils';
import { marketingShellClass } from '~/lib/marketing/marketing-ui';
import { OzerPricingPage } from '~/(marketing)/pricing/_components/ozer-pricing-page';
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
    <div className={cn('relative overflow-hidden', marketingShellClass)}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />
      <div className="relative flex flex-col space-y-8">
        <SitePageHeader
          title={t('marketing:pricing')}
          subtitle={t('marketing:pricingSubtitle')}
        />

        <div className="container mx-auto px-4 pb-8 xl:pb-16">
          <PricingSection />

          <div className="mt-16 border-t border-[color:var(--workspace-shell-border)] pt-16">
            <OzerPricingPage />
          </div>
        </div>
      </div>
    </div>
  );
}

export default withI18n(PricingPage);
