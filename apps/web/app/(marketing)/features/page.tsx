import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { listFeaturePageConfigs } from '~/lib/marketing/feature-landing-pages';
import {
  marketingBodyText,
  marketingDisplay,
  marketingLede,
  marketingMutedText,
  marketingRule,
} from '~/lib/marketing/marketing-ui';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
} from '~/lib/seo/schema';

import { FeatureCoverPreview } from '../_components/feature-cover-previews';
import { MarketingSectionIndex } from '../_components/marketing-section-index';

export const metadata = buildMarketingMetadata({
  title: 'Workspace OS features — Ozer',
  description:
    'Planner, pipeline, invoices, activity tracking, meetings and portals in one Workspace OS, built for freelancers and small agencies who are tired of stitching seven tools together.',
  path: '/features',
  ogType: 'feature',
});

export default function FeaturesIndexPage() {
  const features = listFeaturePageConfigs();

  return (
    <main className="marketing-shell relative overflow-hidden">
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

      <section className="relative mx-auto w-full max-w-[88rem] px-6 pt-24 pb-24 md:pt-32">
        <MarketingSectionIndex
          label="Features"
          aside={<span className="tabular-nums">{features.length} pages</span>}
        />
        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h1
            className={cn(
              marketingDisplay,
              'text-[var(--workspace-shell-text)] lg:col-span-8 lg:text-[4.75rem]',
            )}
          >
            Every part of the workspace, one page each.
          </h1>
          <p className={cn(marketingLede, marketingBodyText, 'lg:col-span-4')}>
            Planner, pipeline, invoices, activity tracking and meetings share
            the same records, so a small studio can drop the separate tools and
            the Zapier glue between them.
          </p>
        </div>

        <ol className="mt-20 grid gap-x-10 gap-y-16 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => (
            <li key={feature.slug}>
              <Link
                href={`/features/${feature.slug}`}
                className="group block rounded-[2px] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none"
              >
                <FeatureCoverPreview
                  slug={feature.slug}
                  variant="card"
                  className="overflow-hidden rounded-[var(--ozer-radius-media)] border border-[color:var(--workspace-shell-border)] shadow-none"
                />
                <div
                  className={cn(
                    marketingRule,
                    'mt-6 flex items-baseline gap-3 border-t pt-4',
                  )}
                >
                  <span
                    className={cn('text-sm tabular-nums', marketingMutedText)}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-heading text-[1.625rem] leading-tight font-medium tracking-[-0.01em] text-[var(--workspace-shell-text)] decoration-1 underline-offset-[6px] group-hover:underline">
                    {feature.name}
                  </h2>
                </div>
                {feature.heroBadge ? (
                  <p className={cn('mt-2 text-xs', marketingMutedText)}>
                    {feature.heroBadge}
                  </p>
                ) : null}
                <p
                  className={cn(
                    'mt-3 text-[0.9375rem] leading-relaxed',
                    marketingMutedText,
                  )}
                >
                  {feature.shortDescription}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--workspace-shell-text)]">
                  Read more
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
