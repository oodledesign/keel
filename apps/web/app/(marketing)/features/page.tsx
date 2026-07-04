import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { listFeaturePageConfigs } from '~/lib/marketing/feature-landing-pages';
import {
  marketingBodyText,
  marketingEyebrow,
  marketingFeatureCard,
  marketingIconAccent,
  marketingIconWell,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { JsonLd } from '~/lib/seo/json-ld';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { FeatureCoverPreview } from '../_components/feature-cover-previews';
import { FeatureLandingIcon } from '../_components/feature-landing-icon';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS features — Ozer',
  description:
    'Planner, pipeline, invoices, meetings, and portals in one Workspace OS. Built for freelancers and small agencies — not seven tools and Zapier.',
  path: '/features',
  ogType: 'feature',
});

export default function FeaturesIndexPage() {
  const features = listFeaturePageConfigs();

  return (
    <main className="relative overflow-hidden marketing-shell">
      <JsonLd
        data={schemaGraph([
          softwareApplicationJsonLd({
            name: 'Ozer',
            description:
              'Workspace OS features for freelancers and small agencies.',
            url: absoluteUrl('/features'),
            offers: [{ name: 'Personal & Family', price: 0 }],
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Features', path: '/features' },
          ]),
        ])}
      />

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-24 md:pt-28">
        <div className="max-w-3xl space-y-5">
          <span className={marketingEyebrow}>Ozer Features</span>
          <h1 className="font-heading text-4xl font-bold leading-tight text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
            The Workspace OS, feature by feature
          </h1>
          <p className={`text-base leading-relaxed md:text-lg ${marketingBodyText}`}>
            Planner, pipeline, invoices, meetings, and more — one system so a
            small studio does not need seven tools and Zapier.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className={`group overflow-hidden transition hover:border-[var(--ozer-accent)]/30 ${marketingFeatureCard}`}
            >
              <FeatureCoverPreview
                slug={feature.slug}
                variant="card"
                className="rounded-none border-0 border-b border-[color:var(--workspace-shell-border)] shadow-none"
              />
              <div className="p-6">
                <div className={`mb-4 h-11 w-11 ${marketingIconWell}`}>
                  <FeatureLandingIcon
                    name={feature.indexIcon}
                    className={`h-5 w-5 ${marketingIconAccent}`}
                  />
                </div>
                <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
                  {feature.name}
                </h2>
                {feature.heroBadge ? (
                  <p className={`mt-1 text-xs font-medium ${marketingMutedText}`}>
                    {feature.heroBadge}
                  </p>
                ) : null}
                <p className={`mt-2 text-sm leading-relaxed ${marketingMutedText}`}>
                  {feature.shortDescription}
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-[var(--ozer-coral-600)] dark:text-[var(--ozer-coral-400)]">
                  See {feature.name}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
