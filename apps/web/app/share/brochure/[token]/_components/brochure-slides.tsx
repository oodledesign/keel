'use client';

import Image from 'next/image';

import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';

import {
  type BrochureSlideViewProps,
  BrochureSlideView as ContentSlideView,
  brochureFadeProps,
} from '~/lib/commercial/brochure-slides';
import type {
  BrochureAgent,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';

import { BrochureEnquireForm } from './brochure-enquire-form';

export {
  type BrochureSlide,
  buildBrochureSlides,
} from '~/lib/commercial/brochure-slides';

function AgentCard({ agent }: { agent: BrochureAgent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-black/25 p-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--ozer-plum-800)]">
        {agent.pictureUrl ? (
          <Image
            src={agent.pictureUrl}
            alt={agent.name}
            fill
            unoptimized
            sizes="64px"
            className="object-cover"
          />
        ) : (
          <div className="font-heading flex h-full w-full items-center justify-center text-xl font-bold text-[var(--ozer-text-on-dark)]">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-heading text-lg font-bold text-[var(--ozer-text-on-dark)]">
          {agent.name}
        </p>
        <div className="mt-1 flex flex-col gap-1 text-sm text-[var(--ozer-text-on-dark-muted)]">
          {agent.email ? (
            <a
              href={`mailto:${agent.email}`}
              className="inline-flex items-center gap-1.5 hover:text-[var(--brochure-accent)]"
            >
              <Mail className="h-3.5 w-3.5" />
              {agent.email}
            </a>
          ) : null}
          {agent.phone ? (
            <a
              href={`tel:${agent.phone}`}
              className="inline-flex items-center gap-1.5 hover:text-[var(--brochure-accent)]"
            >
              <Phone className="h-3.5 w-3.5" />
              {agent.phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactSlide({ data }: { data: PublicBrochureData }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--brochure-primary)]">
      <div className="flex min-h-full items-center justify-center px-6 py-20 sm:px-10 md:px-16">
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            {data.brand.logoUrl ? (
              <motion.div className="mb-6" {...brochureFadeProps(reduced)}>
                <Image
                  src={data.brand.logoUrl}
                  alt={data.accountName ?? 'Agency'}
                  width={180}
                  height={56}
                  unoptimized
                  className="h-12 w-auto max-w-[200px] object-contain"
                />
              </motion.div>
            ) : null}
            <motion.p
              className="text-xs font-medium tracking-[0.18em] text-[var(--brochure-accent)] uppercase"
              {...brochureFadeProps(reduced, 0.04)}
            >
              Get in touch
            </motion.p>
            <motion.h2
              className="font-heading mt-3 text-3xl font-bold text-[var(--ozer-text-on-dark)] sm:text-4xl"
              {...brochureFadeProps(reduced, 0.08)}
            >
              Interested in this property?
            </motion.h2>
            {data.accountName ? (
              <motion.p
                className="mt-3 text-[var(--ozer-text-on-dark-muted)]"
                {...brochureFadeProps(reduced, 0.1)}
              >
                {data.accountName}
              </motion.p>
            ) : null}

            <motion.div
              className="mt-8 space-y-3"
              {...brochureFadeProps(reduced, 0.14)}
            >
              {data.agents.length === 0 ? (
                <p className="text-sm text-[var(--ozer-text-on-dark-muted)]">
                  Send an enquiry and the team will respond.
                </p>
              ) : (
                data.agents.map((agent) => (
                  <AgentCard key={agent.userId} agent={agent} />
                ))
              )}
            </motion.div>
          </div>

          <motion.div
            className="rounded-2xl border border-white/15 bg-black/25 p-5 sm:p-6"
            {...brochureFadeProps(reduced, 0.12)}
          >
            <p className="font-heading text-lg font-bold text-[var(--ozer-text-on-dark)]">
              Enquire
            </p>
            <p className="mt-1 mb-5 text-sm text-[var(--ozer-text-on-dark-muted)]">
              We’ll pass your details to the acting agent.
            </p>
            <BrochureEnquireForm
              token={data.token}
              listingName={data.listing.name}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function BrochureSlideView({ data, slide }: BrochureSlideViewProps) {
  if (slide.kind === 'contact') {
    return <ContactSlide data={data} />;
  }

  return <ContentSlideView data={data} slide={slide} />;
}
