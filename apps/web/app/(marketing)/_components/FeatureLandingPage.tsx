import Link from 'next/link';

import { ArrowRight, Download } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { MARKETING_FREE_SIGNUP_URL } from '~/lib/billing/pricing-marketing';
import { isAssistantDownloadFilePath } from '~/lib/marketing/assistant-download';
import type { FeatureSlug } from '~/lib/marketing/feature-landing-pages';
import {
  marketingBodyText,
  marketingBtnPrimary,
  marketingDisplay,
  marketingLede,
  marketingMutedText,
  marketingRule,
  marketingSectionMuted,
  marketingTextLink,
} from '~/lib/marketing/marketing-ui';

import { FeatureCoverPreview } from './feature-cover-previews';
import type { FAQItem } from './feature-landing-faqs';
import { MarketingFaqsSection } from './marketing-faqs';
import {
  MarketingSectionHeader,
  MarketingSectionIndex,
} from './marketing-section-index';

export type FeatureHighlight = {
  icon: string;
  title: string;
  description: string;
};

export type ConnectedFeature = {
  label: string;
  href: string;
};

export type { FAQItem };

export interface FeatureLandingPageProps {
  coverSlug: FeatureSlug;
  eyebrow: string;
  heading: string;
  subheading: string;
  /** Direct answer for search / answer engines (40–60 words). */
  answerFirst: string;
  primaryKeyword: string;
  highlights: FeatureHighlight[];
  connectedTo: ConnectedFeature[];
  connectionHeading?: string;
  connectionDescription?: string;
  faqs?: FAQItem[];
  relatedBlog: { href: string; label: string };
  relatedComparisons?: Array<{ href: string; label: string }>;
  heroBadge?: string;
  secondaryCta?: {
    label: string;
    href: string;
  };
  ctaText?: string;
  ctaHref?: string;
}

export function FeatureLandingPage({
  coverSlug,
  eyebrow,
  heading,
  subheading,
  answerFirst,
  primaryKeyword,
  highlights,
  connectedTo,
  connectionHeading = 'Works with the rest of Ozer',
  connectionDescription,
  faqs,
  relatedBlog,
  relatedComparisons = [],
  heroBadge,
  secondaryCta,
  ctaText = 'Start free',
  ctaHref = MARKETING_FREE_SIGNUP_URL,
}: FeatureLandingPageProps) {
  const relatedLinks = [
    ...connectedTo.slice(0, 2).map((item) => ({
      href: item.href,
      label: item.label,
    })),
    { href: '/pricing', label: 'Ozer pricing, with graduated seats from £14' },
    relatedBlog,
    ...relatedComparisons,
  ];

  return (
    <main
      className="marketing-shell relative overflow-hidden"
      aria-label={primaryKeyword}
    >
      <section className="mx-auto w-full max-w-[88rem] px-6 pt-10 pb-20 md:pt-14 md:pb-28">
        <MarketingSectionIndex label={eyebrow} aside={heroBadge} />

        <div className="mt-10 grid gap-12 md:mt-14 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">
            <h1
              className={cn(
                marketingDisplay,
                'text-[var(--workspace-shell-text)] lg:text-[4.75rem]',
              )}
            >
              {heading}
            </h1>
            <p className={cn(marketingLede, 'mt-8', marketingBodyText)}>
              {answerFirst}
            </p>
            {subheading !== answerFirst ? (
              <p
                className={`mt-4 max-w-2xl text-[0.9375rem] leading-relaxed ${marketingMutedText}`}
              >
                {subheading}
              </p>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="lg" className={marketingBtnPrimary}>
                <Link href={ctaHref}>
                  {ctaText}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              {secondaryCta ? (
                isAssistantDownloadFilePath(secondaryCta.href) ? (
                  <a
                    href={secondaryCta.href}
                    download
                    data-test="feature-assistant-download"
                    className={marketingTextLink}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {secondaryCta.label}
                  </a>
                ) : (
                  <Link
                    href={secondaryCta.href}
                    data-test="feature-assistant-download-page"
                    className={marketingTextLink}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {secondaryCta.label}
                  </Link>
                )
              ) : null}
              <Link href="/features" className={marketingTextLink}>
                All features
              </Link>
            </div>
          </div>

          <div className="w-full lg:col-span-5">
            <FeatureCoverPreview slug={coverSlug} variant="hero" />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[88rem] px-6 pb-20 md:pb-28">
        <MarketingSectionHeader
          label="Highlights"
          title="What you get"
          headingId="feature-highlights-heading"
        />
        <ol className={cn(marketingRule, 'mt-12 grid border-t md:grid-cols-2')}>
          {highlights.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                marketingRule,
                'border-b py-8 md:pr-12 md:odd:border-r md:even:pl-12',
              )}
            >
              <span className="text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-heading mt-3 text-[1.5rem] leading-tight font-medium tracking-[-0.01em] text-[var(--workspace-shell-text)]">
                {item.title}
              </h3>
              <p
                className={`mt-2 text-[0.9375rem] leading-relaxed ${marketingMutedText}`}
              >
                {item.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`py-20 md:py-28 ${marketingSectionMuted}`}>
        <div className="mx-auto w-full max-w-[88rem] px-6">
          <MarketingSectionHeader
            label="Connected"
            title={connectionHeading}
            intro={connectionDescription}
            headingId="feature-connected-heading"
          />
          <ul className={cn(marketingRule, 'mt-12 border-b')}>
            {relatedLinks.map((link) => (
              <li
                key={`${link.href}-${link.label}`}
                className={cn(marketingRule, 'border-t')}
              >
                <Link
                  href={link.href}
                  className="group flex items-baseline justify-between gap-6 py-4 text-[1.0625rem] text-[var(--workspace-shell-text)] transition-colors duration-200 hover:text-[var(--ozer-coral-600)] focus-visible:ring-2 focus-visible:ring-[var(--ozer-accent)] focus-visible:outline-none dark:hover:text-[var(--ozer-coral-400)]"
                >
                  {link.label}
                  <span
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {faqs && faqs.length > 0 ? (
        <MarketingFaqsSection
          faqs={faqs}
          tone="muted"
          headingId="feature-faq-heading"
        />
      ) : null}

      <section
        id="get-started"
        className="scroll-mt-24 bg-[var(--ozer-plum-950)] text-[var(--ozer-text-on-dark)]"
        aria-labelledby="feature-cta-heading"
      >
        <div className="mx-auto w-full max-w-[88rem] px-6 py-20 md:py-28">
          <MarketingSectionIndex label="Get started" tone="dark" />
          <h2
            id="feature-cta-heading"
            className={cn(marketingDisplay, 'mt-12 max-w-[16ch] md:mt-16')}
          >
            Run this in your Ozer workspace.
          </h2>
          <div className="mt-10 grid gap-8 md:mt-14 lg:grid-cols-12 lg:gap-10">
            <p
              className={cn(
                marketingLede,
                'text-[var(--ozer-text-on-dark-muted)] lg:col-span-5',
              )}
            >
              Start free. Personal and family stay free. Business is Free,
              Starter from £14 or Pro from £29, and extra seats cost less.
            </p>
            <div className="lg:col-span-6 lg:col-start-7">
              <Button asChild size="lg" className={marketingBtnPrimary}>
                <Link href={ctaHref}>
                  {ctaText}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
