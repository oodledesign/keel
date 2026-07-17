import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { withI18n } from '~/lib/i18n/with-i18n';
import { listComparisonConfigs } from '~/lib/marketing/compare';
import {
  marketingBodyText,
  marketingEyebrow,
  marketingFeatureCard,
  marketingMutedText,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

export const metadata = buildMarketingMetadata({
  title: 'Software comparisons — Ozer',
  description:
    'Neutral UK comparisons of Ozer and tools like Hello Bonsai, HoneyBook, Moxie, and Productive — pricing maths included.',
  path: '/compare',
  ogType: 'default',
  keywords: [
    'Ozer alternatives',
    'Hello Bonsai alternative UK',
    'HoneyBook alternative UK',
    'Moxie alternative UK',
    'Productive.io alternative UK',
  ],
});

function CompareIndexPage() {
  const pages = listComparisonConfigs();

  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Software comparisons — Ozer',
            description:
              'Neutral UK comparisons of Ozer and other studio tools.',
            path: '/compare',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
          ]),
        ])}
      />

      <section className="relative mx-auto w-full max-w-3xl px-6 pt-24 pb-20 md:pt-28">
        <span className={marketingEyebrow}>Compare</span>
        <h1 className="font-heading mt-4 text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl">
          Honest UK comparisons
        </h1>
        <p className={cn('mt-4 text-lg leading-relaxed', marketingBodyText)}>
          Fair, sourced pages for studios asking “should I use X or something
          else?” Each page includes pricing maths for a four-person team and a
          section that may send you to the competitor.
        </p>

        <ul className="mt-12 space-y-4">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/compare/${page.slug}`}
                className={cn(
                  'block rounded-2xl border border-[color:var(--workspace-shell-border)] p-6 transition hover:border-[var(--ozer-accent)]/30',
                  marketingFeatureCard,
                )}
              >
                <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                  {page.competitorName} alternatives (2026)
                </h2>
                <p
                  className={cn(
                    'mt-2 text-sm leading-relaxed',
                    marketingMutedText,
                  )}
                >
                  {page.inBrief[0]}
                </p>
                <span className="mt-4 inline-block text-sm font-medium text-[var(--ozer-coral-600)]">
                  Read the comparison
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default withI18n(CompareIndexPage);
