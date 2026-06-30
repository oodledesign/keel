import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  buildPricingSignupUrl,
  formatGbp,
} from '~/lib/billing/pricing-marketing';
import { listAppLandingSummaries } from '~/lib/marketing/app-landing-pages';
import { marketingBtnGradient, marketingHeadlineGradient } from '~/lib/marketing/marketing-ui';
import { withI18n } from '~/lib/i18n/with-i18n';

const BUSINESS_LITE_SIGNUP = buildPricingSignupUrl({
  profile: 'work_design',
  productId: 'keel-business-lite',
  planId: 'business-lite-free',
});

export const metadata = {
  title: 'Ozer Apps — Signatures, Rankly, Feedflow & Videos',
  description:
    'Add powerful tools to any Ozer business workspace. Install Signatures, Rankly, Feedflow, and Videos on free Business Lite — pay only for the apps you use.',
};

function AppsMarketingPage() {
  const apps = listAppLandingSummaries();

  return (
    <main className="relative overflow-hidden marketing-shell">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-24 md:pt-28">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ozer-accent-muted)]">
            Ozer apps
          </span>
          <h1 className="font-heading text-4xl font-bold leading-tight text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
            Add the tools you need to any{' '}
            <span className={marketingHeadlineGradient}>
              business workspace
            </span>
            .
          </h1>
          <p className="text-base leading-relaxed text-violet-100/85 md:text-lg">
            Ozer apps install per workspace — start with free Business Lite, then subscribe to Signatures, Rankly, Feedflow, or Videos when you need them. No bundle bloat.
          </p>
          <Button asChild size="lg" className={marketingBtnGradient}>
            <Link href={BUSINESS_LITE_SIGNUP}>
              Start with free Business Lite
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2">
          {apps.map((app) => {
            const Icon = app.icon;

            return (
              <Link
                key={app.slug}
                href={`/apps/${app.slug}`}
                className="group rounded-2xl border border-[color:var(--workspace-shell-border)] marketing-feature-card p-6 transition hover:border-[var(--ozer-accent)]/40"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)] transition group-hover:border-[var(--ozer-accent)]/30">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-heading text-xl font-semibold text-[var(--workspace-shell-text)]">
                        {app.name}
                      </h2>
                      <span className="text-xs font-medium text-violet-200/70">
                        From {formatGbp(app.fromPriceGbp)}/mo
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-violet-100/80">
                      {app.description}
                    </p>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-[var(--ozer-accent-muted)]">
                      Learn more
                      <ArrowRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-12 text-center text-sm text-violet-200/70">
          Need a full CRM too?{' '}
          <Link href="/work" className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]">
            Explore business workspaces
          </Link>
          {' · '}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]">
            Compare all pricing
          </Link>
          {' · '}
          <Link href={pathsConfig.auth.signIn} className="underline underline-offset-2 hover:text-[var(--workspace-shell-text)]">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default withI18n(AppsMarketingPage);
