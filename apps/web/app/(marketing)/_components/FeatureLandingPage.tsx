import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { FeatureLandingFaqs, type FAQItem } from './feature-landing-faqs';
import { FeatureLandingIcon } from './feature-landing-icon';

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
  eyebrow: string;
  heading: string;
  subheading: string;
  primaryKeyword: string;
  highlights: FeatureHighlight[];
  connectedTo: ConnectedFeature[];
  connectionHeading?: string;
  connectionDescription?: string;
  faqs?: FAQItem[];
  ctaText?: string;
  ctaHref?: string;
}

export function FeatureLandingPage({
  eyebrow,
  heading,
  subheading,
  primaryKeyword,
  highlights,
  connectedTo,
  connectionHeading = 'Works with the rest of Ozer',
  connectionDescription,
  faqs,
  ctaText = 'Get early access',
  ctaHref = '#early-access',
}: FeatureLandingPageProps) {
  return (
    <main
      className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(42,157,143,0.18),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white"
      aria-label={primaryKeyword}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pb-16 pt-24 md:pt-28">
        <div className="max-w-3xl space-y-8">
          <span className="inline-flex items-center rounded-full border border-[#2A9D8F]/30 bg-[#2A9D8F]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#7ee8d8]">
            {eyebrow}
          </span>

          <div className="space-y-5">
            <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
              {heading}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-violet-100/85 md:text-lg">
              {subheading}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full bg-gradient-to-r from-[#2A9D8F] to-[#2563EB] px-6 text-white hover:from-[#249786] hover:to-[#1d4ed8]"
            >
              <Link href={ctaHref}>
                {ctaText}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 rounded-full border-violet-300/25 bg-[#100d1f]/70 px-6 text-violet-100 hover:bg-[#17122e]"
            >
              <Link href="/features">See all features</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Everything you need
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {highlights.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#2A9D8F]/10 text-[#7ee8d8]">
                <FeatureLandingIcon name={item.icon} className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-violet-50">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-violet-100/80">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-[#0c0a18]/80 py-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="max-w-2xl space-y-4">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {connectionHeading}
            </h2>
            {connectionDescription ? (
              <p className="text-base leading-relaxed text-violet-100/80">
                {connectionDescription}
              </p>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {connectedTo.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="inline-flex items-center rounded-full border border-[#2A9D8F]/25 bg-[#2A9D8F]/10 px-4 py-2 text-sm font-medium text-[#b8f3ea] transition hover:border-[#2A9D8F]/40 hover:bg-[#2A9D8F]/15"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {faqs && faqs.length > 0 ? (
        <section className="relative mx-auto w-full max-w-3xl px-6 py-16">
          <h2 className="font-heading mb-8 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <FeatureLandingFaqs faqs={faqs} />
        </section>
      ) : null}

      <section
        id="early-access"
        className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-6 pb-20 pt-4"
      >
        <div className="rounded-3xl border border-violet-300/15 bg-[#0f0d1e]/85 p-8 text-center shadow-[0_30px_100px_rgba(23,8,50,0.55)] md:p-12">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white">
            Ready to see it in action?
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed text-violet-100/75 md:text-base">
            Join early access and be one of the first agencies running on Ozer.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 h-11 rounded-full bg-gradient-to-r from-[#2A9D8F] to-[#2563EB] px-6 text-white hover:from-[#249786] hover:to-[#1d4ed8]"
          >
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
