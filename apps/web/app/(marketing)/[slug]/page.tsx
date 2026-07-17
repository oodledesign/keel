import { notFound } from 'next/navigation';

import { SegmentLandingPage } from '~/(marketing)/_components/segment-landing-page';
import { withI18n } from '~/lib/i18n/with-i18n';
import { getSegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';
import {
  buildSegmentJsonLd,
  buildSegmentMetadata,
} from '~/lib/marketing/segment-landing-seo';
import { JsonLd } from '~/lib/seo/json-ld';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return [{ slug: 'personal' }, { slug: 'work' }];
}

export async function generateMetadata({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getSegmentLandingConfig(slug);
  if (!config) return {};
  return buildSegmentMetadata(config);
}

async function SegmentMarketingPage({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getSegmentLandingConfig(slug);

  if (!config) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildSegmentJsonLd(config)} />
      <SegmentLandingPage config={config} />
    </>
  );
}

export default withI18n(SegmentMarketingPage);
