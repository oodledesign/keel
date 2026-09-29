import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import {
  MARKETING_BUSINESS_LITE_SIGNUP_URL,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { withI18n } from '~/lib/i18n/with-i18n';
import { listAppLandingSummaries } from '~/lib/marketing/app-landing-pages';
import {
  marketingBodyText,
  marketingBtnPrimary,
  marketingDisplay,
  marketingLede,
  marketingMutedText,
  marketingRule,
} from '~/lib/marketing/marketing-ui';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

import { MarketingSectionIndex } from '../_components/marketing-section-index';

export const metadata = buildMarketingMetadata({
  title: 'Business workspace apps | Ozer',
  description:
    'Install Signatures on free Business Lite. Flat mailbox tiers by workspace, never per person.',
  path: '/apps',
  ogType: 'app',
});

function AppsMarketingPage() {
  const apps = listAppLandingSummaries();

  return (
    <main className="marketing-shell relative overflow-hidden">
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Business workspace apps | Ozer',
            description: 'Install Signatures on free Business Lite.',
            path: '/apps',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Apps', path: '/apps' },
          ]),
        ])}
      />
      <section className="relative mx-auto w-full max-w-[88rem] px-6 pt-24 pb-24 md:pt-32">
        <MarketingSectionIndex label="Apps" />
        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
          <h1
            className={cn(
              marketingDisplay,
              'text-[var(--workspace-shell-text)] lg:col-span-8 lg:text-[4.75rem]',
            )}
          >
            Apps for any business workspace.
          </h1>
          <div className="flex flex-col gap-6 lg:col-span-4">
            <p className={cn(marketingLede, marketingBodyText)}>
              Install on a workspace. Start free on Business Lite, then add
              Signatures when you need it. Mailbox tiers are priced per
              workspace, never per person.
            </p>
            <div>
              <Button asChild className={marketingBtnPrimary}>
                <Link href={MARKETING_BUSINESS_LITE_SIGNUP_URL}>
                  Start free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <ol className={cn(marketingRule, 'mt-20 border-b')}>
          {apps.map((app, index) => (
            <li key={app.slug} className={cn(marketingRule, 'border-t')}>
              <Link
                href={`/apps/${app.slug}`}
                className="group grid gap-3 py-8 focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none md:grid-cols-[3rem_minmax(0,4fr)_minmax(0,5fr)_auto] md:items-baseline md:gap-10"
              >
                <span
                  className={cn('text-sm tabular-nums', marketingMutedText)}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="font-heading text-[2rem] leading-tight font-medium tracking-[-0.015em] text-[var(--workspace-shell-text)] decoration-1 underline-offset-[6px] group-hover:underline">
                  {app.name}
                </h2>
                <p
                  className={cn(
                    'text-[0.9375rem] leading-relaxed',
                    marketingMutedText,
                  )}
                >
                  {app.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap text-[var(--workspace-shell-text)] tabular-nums">
                  From {formatGbp(app.fromPriceGbp)}/mo
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <p className={`mt-12 text-sm ${marketingMutedText}`}>
          Need a full CRM too?{' '}
          <Link
            href="/work"
            className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]"
          >
            Explore business workspaces
          </Link>
          {' · '}
          <Link
            href="/pricing"
            className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]"
          >
            Compare all pricing
          </Link>
          {' · '}
          <Link
            href={pathsConfig.auth.signIn}
            className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default withI18n(AppsMarketingPage);
