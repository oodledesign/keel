import { Suspense } from 'react';

import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import { StackCostCalculatorClient } from '~/(marketing)/tools/stack-cost-calculator/_components/stack-cost-calculator';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  marketingBodyText,
  marketingEyebrow,
  marketingMutedText,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { CALCULATOR_FAQS } from '~/lib/marketing/stack-calculator-data';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
} from '~/lib/seo/schema';

export const metadata = buildMarketingMetadata({
  title: 'Stack cost calculator UK — Ozer',
  description:
    'How much does business software cost for a small agency in the UK? Add your tools, seats, and card fees. Compare the annual total in £ to Ozer’s flat team price.',
  path: '/tools/stack-cost-calculator',
  ogType: 'default',
  keywords: [
    'how much does business software cost for a small agency UK',
    'agency software cost calculator',
    'freelance tool stack cost UK',
  ],
});

function StackCostCalculatorPage() {
  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <JsonLd
        data={schemaGraph([
          articleJsonLd({
            headline:
              'How much does business software cost for a small agency in the UK?',
            description:
              'Methodology for estimating annual SaaS spend for a small UK studio, compared with Ozer Business Team.',
            path: '/tools/stack-cost-calculator',
            authorName: 'Dan Potter',
            dateModified: '2026-07-04',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Tools', path: '/tools/stack-cost-calculator' },
            {
              name: 'Stack cost calculator',
              path: '/tools/stack-cost-calculator',
            },
          ]),
          faqPageJsonLd(CALCULATOR_FAQS),
        ])}
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 pt-24 pb-20 md:pt-28">
        <span className={marketingEyebrow}>Tools</span>
        <h1 className="font-heading mt-4 text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl">
          Stack cost calculator
        </h1>

        <aside className="mt-6 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <h2 className="text-sm font-semibold tracking-wide text-[var(--workspace-shell-text)] uppercase">
            In brief
          </h2>
          <ol
            className={cn(
              'mt-2 list-decimal space-y-1 pl-5 text-sm',
              marketingBodyText,
            )}
          >
            <li>
              Defaults are sensible UK starting points for common tool
              categories — edit every field to match your invoices.
            </li>
            <li>
              Per-seat tools multiply monthly price by seats; optional card fees
              use 2.9% of annual card revenue plus £0.20 per transaction.
            </li>
            <li>
              Ozer’s comparison figure is Business Team from billing config: a
              flat workspace price for up to five members, with no subscription
              transaction fee.
            </li>
          </ol>
        </aside>

        <p
          className={cn(
            'mt-6 max-w-2xl text-lg leading-relaxed',
            marketingBodyText,
          )}
        >
          Add what you pay today. See the annual total in pounds next to Ozer —
          no login, no stored profile data.
        </p>

        <div className="mt-10">
          <Suspense
            fallback={<p className={marketingMutedText}>Loading calculator…</p>}
          >
            <StackCostCalculatorClient />
          </Suspense>
        </div>

        <p className={cn('mt-10 text-sm', marketingMutedText)}>
          Related:{' '}
          <Link href="/pricing" className="underline underline-offset-2">
            Ozer pricing
          </Link>
          {' · '}
          <Link
            href="/pricing/explained"
            className="underline underline-offset-2"
          >
            Ozer pricing, explained
          </Link>
          {' · '}
          <Link href="/compare" className="underline underline-offset-2">
            Comparisons
          </Link>
        </p>
      </div>
    </main>
  );
}

export default withI18n(StackCostCalculatorPage);
