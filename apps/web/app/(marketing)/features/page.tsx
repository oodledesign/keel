import Link from 'next/link';

import type { Metadata } from 'next';

import { ArrowRight } from 'lucide-react';

import { listFeaturePageConfigs } from '~/lib/marketing/feature-landing-pages';

import { FeatureCoverPreview } from '../_components/feature-cover-previews';
import { FeatureLandingIcon } from '../_components/feature-landing-icon';

const FEATURES_INDEX_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Ozer',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, macOS',
  url: 'https://ozer.so',
  description: 'Business operating system for freelancers and agencies',
  offers: {
    '@type': 'Offer',
    availability: 'https://schema.org/ComingSoon',
  },
};

export const metadata: Metadata = {
  title: 'Features | Ozer — Business OS for Freelancers and Agencies',
  description:
    'One connected system for everything in your agency — planning, email, client portals, invoicing, meeting notes, pipeline, and more.',
  alternates: {
    canonical: 'https://ozer.so/features',
  },
};

export default function FeaturesIndexPage() {
  const features = listFeaturePageConfigs();

  return (
    <main className="relative overflow-hidden marketing-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FEATURES_INDEX_JSON_LD),
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-24 md:pt-28">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center rounded-full border border-[var(--ozer-accent)]/30 bg-[var(--ozer-accent-subtle)] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ozer-accent-muted)]">
            Ozer Features
          </span>
          <h1 className="font-heading text-4xl font-bold leading-tight text-[var(--workspace-shell-text)] md:text-5xl lg:text-6xl">
            Everything You Need. All in One Place.
          </h1>
          <p className="text-base leading-relaxed text-violet-100/85 md:text-lg">
            Ozer replaces the pile of disconnected tools with one system where
            everything knows about everything else.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="group overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-sidebar-accent)]"
            >
              <FeatureCoverPreview
                slug={feature.slug}
                variant="card"
                className="rounded-none border-0 border-b border-[color:var(--workspace-shell-border)] shadow-none"
              />
              <div className="p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent-muted)] transition group-hover:bg-[var(--ozer-accent-subtle)]">
                  <FeatureLandingIcon
                    name={feature.indexIcon}
                    className="h-5 w-5"
                  />
                </div>
                <h2 className="text-lg font-semibold text-violet-50">
                  {feature.name}
                </h2>
                {feature.heroBadge ? (
                  <p className="mt-1 text-xs font-medium text-violet-300/70">
                    {feature.heroBadge}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-violet-100/75">
                  {feature.shortDescription}
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-[var(--ozer-accent-muted)]">
                  Learn more
                  <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
