import { notFound } from 'next/navigation';

import { AppLandingPage } from '~/(marketing)/_components/app-landing-page';
import {
  buildAppJsonLd,
  buildAppMetadata,
} from '~/lib/marketing/app-landing-seo';
import {
  APP_LANDING_SLUGS,
  getAppLandingConfig,
} from '~/lib/marketing/app-landing-pages';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return APP_LANDING_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getAppLandingConfig(slug);
  if (!config) return {};
  return buildAppMetadata(config);
}

async function AppMarketingPage({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getAppLandingConfig(slug);

  if (!config) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildAppJsonLd(config)} />
      <AppLandingPage config={config} />
    </>
  );
}

export default withI18n(AppMarketingPage);
