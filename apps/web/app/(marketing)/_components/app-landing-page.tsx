import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import type { AppLandingConfig } from '~/lib/marketing/app-landing-pages';

type AppLandingPageProps = {
  config: AppLandingConfig;
};

const BUSINESS_LITE_SIGNUP = buildPricingSignupUrl({
  profile: 'work_design',
  productId: 'keel-business-lite',
  planId: 'business-lite-free',
});

export function AppLandingPage({ config }: AppLandingPageProps) {
  const Icon = config.icon;

  return (
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(42,157,143,0.18),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 pb-16 pt-24 md:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-[#2A9D8F]/30 bg-[#2A9D8F]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#7ee8d8]">
                {config.hero.eyebrow}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-violet-100/90">
                From {formatGbp(config.fromPriceGbp)}/mo per workspace
              </span>
            </div>

            <div className="space-y-5">
              <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                {config.hero.title}
                <span className="bg-gradient-to-r from-[#2A9D8F] via-teal-200 to-[#2563EB] bg-clip-text text-transparent">
                  {' '}
                  {config.hero.titleAccent}
                </span>
                .
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-violet-100/85 md:text-lg">
                {config.hero.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full bg-gradient-to-r from-[#2A9D8F] to-[#2563EB] px-6 text-white hover:opacity-95"
              >
                <Link href={BUSINESS_LITE_SIGNUP}>
                  Start with free Business Lite
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 rounded-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-[#0F1B35]/85 p-5 shadow-[0_30px_100px_rgba(8,20,40,0.55)] backdrop-blur">
            <div className="absolute -inset-px rounded-3xl bg-[linear-gradient(135deg,rgba(42,157,143,0.35),rgba(37,99,235,0.2),transparent_58%)] opacity-70" />
            <div className="relative space-y-4 rounded-2xl border border-white/10 bg-[#0B132B] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#2A9D8F]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-white">{config.name}</p>
                  <p className="text-xs text-violet-200/75">Ozer workspace add-on</p>
                </div>
              </div>
              <ul className="space-y-3">
                {config.features.map((feature) => (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                  >
                    <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2A9D8F]" />
                    <div>
                      <p className="text-sm font-medium text-white">{feature.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-violet-100/75">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative mx-auto w-full max-w-7xl px-6 pb-20"
        aria-labelledby="app-features-heading"
      >
        <div className="mb-8 max-w-2xl">
          <h2
            id="app-features-heading"
            className="font-heading text-3xl font-semibold text-white md:text-4xl"
          >
            What {config.name} includes
          </h2>
          <p className="mt-3 text-violet-100/80">
            Install {config.name} on any Ozer business workspace. Business Lite is free — you only pay for the apps you need.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {config.features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(15,27,53,0.95),rgba(11,19,43,0.95))] p-6"
            >
              <feature.icon className="h-5 w-5 text-[#2A9D8F]" aria-hidden />
              <h3 className="mt-4 font-heading text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="border-y border-white/10 bg-[#070610]/80 py-20"
        aria-labelledby="app-how-heading"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2
            id="app-how-heading"
            className="font-heading text-3xl font-semibold text-white md:text-4xl"
          >
            How to get {config.name}
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {config.steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2A9D8F]/20 text-sm font-bold text-[#7ee8d8]">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#070610]/80 py-20">
        <div className="mx-auto w-full max-w-3xl px-6">
          <h2 className="font-heading text-3xl font-semibold text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {config.faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
              >
                <summary className="cursor-pointer list-none font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {faq.question}
                    <span className="text-violet-300/80 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-violet-100/80">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0F1B35] to-[#0B132B] px-8 py-12 text-center">
          <h2 className="font-heading text-3xl font-semibold text-white">
            Add {config.name} to your workspace
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100/80">
            Create a free Business Lite workspace, then subscribe to {config.name} from billing when you are ready.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 rounded-full bg-[#2A9D8F] px-7 text-[#0B132B] hover:bg-[#238b7f] hover:text-white"
          >
            <Link href={BUSINESS_LITE_SIGNUP}>Get started free</Link>
          </Button>
          <p className="mt-4 text-xs text-violet-200/60">
            Explore all apps on the{' '}
            <Link href="/apps" className="underline hover:text-white">
              Ozer apps page
            </Link>
            {' · '}
            Already have an account?{' '}
            <Link href={pathsConfig.auth.signIn} className="underline hover:text-white">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
