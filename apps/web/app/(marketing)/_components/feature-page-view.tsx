import {
  buildFeatureFaqJsonLd,
  getFeaturePageConfig,
  type FeatureSlug,
} from '~/lib/marketing/feature-landing-pages';

import { FeatureLandingPage } from './FeatureLandingPage';

export function FeaturePageView({ slug }: { slug: FeatureSlug }) {
  const config = getFeaturePageConfig(slug);
  const faqJsonLd =
    config.props.faqs.length > 0
      ? buildFeatureFaqJsonLd(config.props.faqs)
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(config.jsonLd),
        }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(faqJsonLd),
          }}
        />
      ) : null}
      <FeatureLandingPage
        {...config.props}
        primaryKeyword={config.primaryKeyword}
      />
    </>
  );
}
