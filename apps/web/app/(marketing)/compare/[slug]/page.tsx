import { notFound } from 'next/navigation';

import { ComparisonPage } from '~/(marketing)/compare/_components/comparison-page';
import {
  buildComparisonJsonLd,
  buildComparisonMetadata,
  COMPARISON_SLUGS,
  getComparisonConfig,
} from '~/lib/marketing/compare';
import { withI18n } from '~/lib/i18n/with-i18n';
import { JsonLd } from '~/lib/seo/json-ld';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return COMPARISON_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getComparisonConfig(slug);
  if (!config) return {};
  return buildComparisonMetadata(config);
}

async function ComparisonSlugPage({ params }: PageProps) {
  const slug = (await params).slug;
  const config = getComparisonConfig(slug);

  if (!config) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildComparisonJsonLd(config)} />
      <ComparisonPage config={config} />
    </>
  );
}

export default withI18n(ComparisonSlugPage);
