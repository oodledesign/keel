import Link from 'next/link';

import { ArrowRight, Download } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type { FeatureSlug } from '~/lib/marketing/feature-landing-pages';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingEyebrow,
  marketingFeatureCard,
  marketingIconWell,
  marketingMutedText,
  marketingPanelDeep,
  marketingSectionMuted,
} from '~/lib/marketing/marketing-ui';

import { FeatureCoverPreview } from './feature-cover-previews';
import type { FAQItem } from './feature-landing-faqs';
import { FeatureLandingIcon } from './feature-landing-icon';
import { MarketingFaqsSection } from './marketing-faqs';

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
  ctaHref = '/auth/sign-up',
}: FeatureLandingPageProps) {
  return (
    <main
      className="marketing-shell relative overflow-hidden"
      aria-label={primaryKeyword}
    >
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pt-24 pb-16 md:pt-28 lg:flex-row lg:items-center lg:gap-12">
        <div className="max-w-3xl flex-1 space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className={marketingEyebrow}>{eyebrow}</span>
            {heroBadge ? (
              <span className="inline-flex items-center rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-1.5 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                {heroBadge}
              </span>
            ) : null}
          </div>

          <div className="space-y-5">
            <h1 className="font-heading text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
              {heading}
            </h1>
            <p
              className={`max-w-2xl text-base leading-relaxed md:text-lg ${marketingBodyText}`}
            >
              {answerFirst}
            </p>
            {subheading !== answerFirst ? (
              <p
                className={`max-w-2xl text-sm leading-relaxed ${marketingMutedText}`}
              >
                {subheading}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className={marketingBtnGradient}>
              <Link href={ctaHref}>
                {ctaText}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            {secondaryCta ? (
              <Button
                asChild
                variant="outline"
                size="lg"
                className={marketingBtnOutline}
              >
                <Link href={secondaryCta.href}>
                  <Download className="mr-1.5 h-4 w-4" />
                  {secondaryCta.label}
                </Link>
              </Button>
            ) : null}
            <Button
              asChild
              variant="outline"
              size="lg"
              className={marketingBtnOutline}
            >
              <Link href="/features">See all features</Link>
            </Button>
          </div>
        </div>

        <div className="w-full flex-1 lg:max-w-xl">
          <FeatureCoverPreview slug={coverSlug} variant="hero" />
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
            What you get
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {highlights.map((item) => (
            <article key={item.title} className={`${marketingFeatureCard} p-6`}>
              <div className={`mb-4 h-11 w-11 ${marketingIconWell}`}>
                <FeatureLandingIcon name={item.icon} className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
                {item.title}
              </h3>
              <p
                className={`mt-3 text-sm leading-relaxed ${marketingMutedText}`}
              >
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`relative py-16 ${marketingSectionMuted}`}>
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="max-w-2xl space-y-4">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-4xl">
              {connectionHeading}
            </h2>
            {connectionDescription ? (
              <p className={`text-base leading-relaxed ${marketingBodyText}`}>
                {connectionDescription}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {connectedTo.slice(0, 2).map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-4 py-2 text-sm font-medium text-[var(--ozer-coral-600)] transition hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]"
              >
                Related: {item.label}
              </Link>
            ))}
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-4 py-2 text-sm font-medium text-[var(--ozer-coral-600)] transition hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]"
            >
              Ozer pricing — flat price for the whole team
            </Link>
            <Link
              href={relatedBlog.href}
              className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-4 py-2 text-sm font-medium text-[var(--ozer-coral-600)] transition hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]"
            >
              {relatedBlog.label}
            </Link>
            {relatedComparisons.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-4 py-2 text-sm font-medium text-[var(--ozer-coral-600)] transition hover:border-[var(--ozer-accent)]/40 hover:bg-[var(--ozer-accent-subtle)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
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
        id="early-access"
        className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-6 pt-4 pb-20"
      >
        <div className={`${marketingPanelDeep} p-8 text-center md:p-12`}>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)]">
            Run this in your Workspace OS
          </h2>
          <p
            className={`mx-auto mt-3 max-w-xl text-sm leading-relaxed md:text-base ${marketingBodyText}`}
          >
            Start free. Personal and family stay free. Pay when you add a paid
            workspace — one price covers the team.
          </p>
          <Button asChild size="lg" className={`mt-6 ${marketingBtnGradient}`}>
            <Link href={ctaHref}>
              {ctaText}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
