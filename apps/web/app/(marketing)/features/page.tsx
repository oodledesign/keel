import Link from 'next/link';

import type { Metadata } from 'next';

import { ArrowRight } from 'lucide-react';

import { listFeaturePageConfigs } from '~/lib/marketing/feature-landing-pages';

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
    <main className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(42,157,143,0.18),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.22),transparent_42%),linear-gradient(180deg,#05050b_0%,#080711_45%,#070612_100%)] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(FEATURES_INDEX_JSON_LD),
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),transparent_22%)]" />

      <section className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-24 md:pt-28">
        <div className="max-w-3xl space-y-5">
          <span className="inline-flex items-center rounded-full border border-[#2A9D8F]/30 bg-[#2A9D8F]/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[#7ee8d8]">
            Ozer Features
          </span>
          <h1 className="font-heading text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
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
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-[#2A9D8F]/30 hover:bg-white/[0.05]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#2A9D8F]/10 text-[#7ee8d8] transition group-hover:bg-[#2A9D8F]/15">
                <FeatureLandingIcon
                  name={feature.indexIcon}
                  className="h-5 w-5"
                />
              </div>
              <h2 className="text-lg font-semibold text-violet-50">
                {feature.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-violet-100/75">
                {feature.shortDescription}
              </p>
              <span className="mt-4 inline-flex items-center text-sm font-medium text-[#7ee8d8]">
                Learn more
                <ArrowRight className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
