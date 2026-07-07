import { JsonLd } from '~/lib/seo/json-ld';
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  webPageJsonLd,
} from '~/lib/seo/schema';
import {
  getFeaturePageConfig,
  type FeatureSlug,
} from '~/lib/marketing/feature-landing-pages';

import { FeatureLandingPage } from './FeatureLandingPage';

const FEATURE_COMPARE_LINKS: Partial<
  Record<FeatureSlug, Array<{ href: string; label: string }>>
> = {
  invoicing: [
    { href: '/compare/hellobonsai', label: 'Hello Bonsai vs Ozer' },
    { href: '/compare/honeybook', label: 'HoneyBook vs Ozer' },
  ],
  contracts: [
    { href: '/compare/hellobonsai', label: 'Hello Bonsai vs Ozer' },
    { href: '/compare/withmoxie', label: 'Moxie vs Ozer' },
  ],
  pipeline: [
    { href: '/compare/honeybook', label: 'HoneyBook vs Ozer' },
    { href: '/compare/hellobonsai', label: 'Hello Bonsai vs Ozer' },
  ],
  'project-management': [
    { href: '/compare/productive-io', label: 'Productive.io vs Ozer' },
    { href: '/compare/withmoxie', label: 'Moxie vs Ozer' },
  ],
  finances: [
    { href: '/compare/productive-io', label: 'Productive.io vs Ozer' },
  ],
  'client-portals': [
    { href: '/compare/honeybook', label: 'HoneyBook vs Ozer' },
    { href: '/compare/withmoxie', label: 'Moxie vs Ozer' },
  ],
  'desktop-assistant': [
    { href: '/compare/hellobonsai', label: 'Hello Bonsai vs Ozer' },
  ],
  activity: [
    { href: '/compare/hellobonsai', label: 'Hello Bonsai vs Ozer' },
    { href: '/compare/productive-io', label: 'Productive.io vs Ozer' },
  ],
};

export function FeaturePageView({ slug }: { slug: FeatureSlug }) {
  const config = getFeaturePageConfig(slug);
  const path = `/features/${slug}`;

  const schema = schemaGraph([
    webPageJsonLd({
      name: config.metadata.title,
      description: config.metadata.description,
      path,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Features', path: '/features' },
      { name: config.name, path },
    ]),
    faqPageJsonLd(config.props.faqs),
  ]);

  return (
    <>
      <JsonLd data={schema} />
      <FeatureLandingPage
        coverSlug={config.slug}
        {...config.props}
        answerFirst={config.answerFirst}
        relatedBlog={config.relatedBlog}
        relatedComparisons={FEATURE_COMPARE_LINKS[slug]}
        heroBadge={config.heroBadge}
        secondaryCta={config.secondaryCta}
        primaryKeyword={config.primaryKeyword}
      />
    </>
  );
}
