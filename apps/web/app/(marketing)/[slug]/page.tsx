import { notFound } from 'next/navigation';

import { SegmentLandingPage } from '~/(marketing)/_components/segment-landing-page';
import {
  buildSegmentMetadata,
  segmentJsonLdScript,
} from '~/lib/marketing/segment-landing-seo';
import { getSegmentLandingConfig } from '~/lib/marketing/segment-landing-pages';
import { withI18n } from '~/lib/i18n/with-i18n';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return [
    { slug: 'personal' },
    { slug: 'work' },
    { slug: 'property' },
    { slug: 'community' },
  ];
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: segmentJsonLdScript(config) }}
      />
      <SegmentLandingPage config={config} />
    </>
  );
}

export default withI18n(SegmentMarketingPage);
