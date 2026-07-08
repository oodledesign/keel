import Link from 'next/link';

import { Button } from '@kit/ui/button';

import {
  formatGbp,
  formatGbpYear,
  SourcedText,
} from '~/lib/marketing/compare/sourced';
import type { ComparisonConfig } from '~/lib/marketing/compare/types';
import { MarketingFaqsSection } from '~/(marketing)/_components/marketing-faqs';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingFeatureCard,
  marketingMutedText,
  marketingShellClass,
} from '~/lib/marketing/marketing-ui';
import { cn } from '@kit/ui/utils';
import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';

type ComparisonPageProps = {
  config: ComparisonConfig;
};

export function ComparisonPage({ config }: ComparisonPageProps) {
  const { competitorName, competitorShortName } = config;

  return (
    <main className={cn('relative overflow-hidden', marketingShellClass)}>
      <article className="relative mx-auto w-full max-w-3xl px-6 pb-20 pt-24 md:pt-28">
        <span className={marketingEyebrow}>Compare</span>
        <h1 className="font-heading mt-4 text-4xl font-bold leading-tight text-[var(--workspace-shell-text)] md:text-5xl">
          {competitorName} alternatives (2026)
        </h1>
        <p className={cn('mt-4 text-lg leading-relaxed', marketingBodyText)}>
          Honest UK comparison of {competitorName} and Ozer for a four-person studio.
          Text names only — no logos, no scorecards designed to crown a winner.
        </p>

        {/* a. In brief */}
        <section className="mt-12" aria-labelledby="in-brief-heading">
          <h2
            id="in-brief-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            In brief
          </h2>
          <ol className={cn('mt-4 list-decimal space-y-2 pl-5', marketingBodyText)}>
            {config.inBrief.map((sentence) => (
              <li key={sentence}>{sentence}</li>
            ))}
          </ol>
        </section>

        {/* b. At-a-glance table */}
        <section className="mt-14" aria-labelledby="glance-heading">
          <h2
            id="glance-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            At a glance
          </h2>
          <div
            className={cn(
              'mt-4 overflow-x-auto rounded-2xl border border-[color:var(--workspace-shell-border)]',
              marketingFeatureCard,
            )}
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--workspace-shell-border)]">
                  <th className="px-4 py-3 font-semibold text-[var(--workspace-shell-text)]">
                    Topic
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--workspace-shell-text)]">
                    {competitorShortName}
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--workspace-shell-text)]">
                    Ozer
                  </th>
                </tr>
              </thead>
              <tbody>
                {config.glanceRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[color:var(--workspace-shell-border)] last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 align-top font-medium text-[var(--workspace-shell-text)]"
                    >
                      {row.label}
                    </th>
                    <td className={cn('px-4 py-3 align-top', marketingMutedText)}>
                      <SourcedText sourced={row.competitor} />
                    </td>
                    <td className={cn('px-4 py-3 align-top', marketingMutedText)}>
                      <SourcedText sourced={row.ozer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* c. Pricing maths */}
        <section className="mt-14" aria-labelledby="pricing-maths-heading">
          <h2
            id="pricing-maths-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            {config.pricingMaths.heading}
          </h2>
          <p className={cn('mt-3', marketingBodyText)}>
            {config.pricingMaths.intro}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div
              className={cn(
                'rounded-2xl border border-[color:var(--workspace-shell-border)] p-5',
                marketingFeatureCard,
              )}
            >
              <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
                {competitorShortName} (illustrative)
              </h3>
              <ul className={cn('mt-3 space-y-2 text-sm', marketingMutedText)}>
                {config.pricingMaths.competitorLines.map((line) => (
                  <li key={line.label}>
                    <span className="text-[var(--workspace-shell-text)]">
                      {line.label}:{' '}
                    </span>
                    <SourcedText
                      sourced={line.amountGbp}
                      format={(v) => formatGbp(Number(v))}
                    />
                    {line.note ? (
                      <span className="mt-0.5 block text-xs">{line.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-[var(--workspace-shell-text)]">
                Total:{' '}
                <SourcedText
                  sourced={config.pricingMaths.competitorTotalGbp}
                  format={(v) => formatGbpYear(Number(v))}
                />
              </p>
            </div>

            <div
              className={cn(
                'rounded-2xl border border-[color:var(--workspace-shell-border)] p-5',
                marketingFeatureCard,
              )}
            >
              <h3 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
                Ozer (Business Team)
              </h3>
              <ul className={cn('mt-3 space-y-2 text-sm', marketingMutedText)}>
                {config.pricingMaths.ozerLines.map((line) => (
                  <li key={line.label}>
                    <span className="text-[var(--workspace-shell-text)]">
                      {line.label}:{' '}
                    </span>
                    <SourcedText
                      sourced={line.amountGbp}
                      format={(v) => formatGbp(Number(v))}
                    />
                    {line.note ? (
                      <span className="mt-0.5 block text-xs">{line.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-[var(--workspace-shell-text)]">
                Total:{' '}
                <SourcedText
                  sourced={config.pricingMaths.ozerTotalGbp}
                  format={(v) => formatGbpYear(Number(v))}
                />
              </p>
            </div>
          </div>

          <ul className={cn('mt-4 list-disc space-y-1 pl-5 text-xs', marketingMutedText)}>
            {config.pricingMaths.footnotes.map((note) => (
              <li key={note.text}>
                {note.text}{' '}
                <a
                  href={note.sourceUrl}
                  className="underline underline-offset-2"
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                >
                  Source
                </a>
                {!note.verified && process.env.NODE_ENV === 'development' ? (
                  <span className="ml-1 rounded bg-amber-200 px-1 py-0.5 text-[10px] font-semibold uppercase text-amber-950">
                    verify me
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* d. Choose competitor */}
        <section className="mt-14" aria-labelledby="choose-competitor-heading">
          <h2
            id="choose-competitor-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Choose {competitorShortName} if…
          </h2>
          <ul className={cn('mt-4 list-disc space-y-2 pl-5', marketingBodyText)}>
            {config.chooseCompetitorIf.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* e. Choose Ozer */}
        <section className="mt-14" aria-labelledby="choose-ozer-heading">
          <h2
            id="choose-ozer-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Choose Ozer if…
          </h2>
          <ul className={cn('mt-4 list-disc space-y-2 pl-5', marketingBodyText)}>
            {config.chooseOzerIf.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* f. FAQ */}
        <MarketingFaqsSection
          faqs={config.faqs}
          tone="light"
          title="Frequently asked questions"
          headingId="compare-faq-heading"
          sectionClassName="px-0"
          className="max-w-none px-0"
        />

        {/* g. Migration */}
        <section className="mt-4" aria-labelledby="migration-heading">
          <h2
            id="migration-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Moving to Ozer
          </h2>
          <p className={cn('mt-3', marketingBodyText)}>{config.migrationNote}</p>
        </section>

        <section className="mt-14" aria-labelledby="related-heading">
          <h2
            id="related-heading"
            className="font-heading text-2xl font-semibold text-[var(--workspace-shell-text)]"
          >
            Related Ozer features
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {config.relatedFeatures.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-4 py-2 text-sm font-medium text-[var(--ozer-coral-600)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild size="lg" className={marketingBtnGradient}>
            <Link href={MARKETING_FREE_SIGNUP_URL}>Start free</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={marketingBtnOutline}>
            <Link href="/pricing">See pricing</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={marketingBtnOutline}>
            <Link href="/pricing/explained">Ozer pricing, explained</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={marketingBtnOutline}>
            <Link href="/tools/stack-cost-calculator">Stack cost calculator</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={marketingBtnOutline}>
            <Link href="/compare">All comparisons</Link>
          </Button>
        </div>
      </article>
    </main>
  );
}
