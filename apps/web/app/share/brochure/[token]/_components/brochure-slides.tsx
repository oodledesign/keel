'use client';

import Image from 'next/image';

import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';

import type {
  BrochureAgent,
  BrochureListing,
  BrochureMediaItem,
  PublicBrochureData,
} from '~/lib/commercial/public-brochure.shared';
import {
  formatBrochureAddress,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
  formatDisposalLabel,
} from '~/lib/commercial/public-brochure.shared';
import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

import { BrochureEnquireForm } from './brochure-enquire-form';

export type BrochureSlide =
  | { kind: 'cover' }
  | { kind: 'facts' }
  | { kind: 'photo'; media: BrochureMediaItem; index: number; total: number }
  | { kind: 'summary' }
  | { kind: 'key_points' }
  | { kind: 'description' }
  | { kind: 'location' }
  | {
      kind: 'floorplan';
      media: BrochureMediaItem;
      index: number;
      total: number;
    }
  | { kind: 'contact' };

export function buildBrochureSlides(data: PublicBrochureData): BrochureSlide[] {
  const slides: BrochureSlide[] = [{ kind: 'cover' }, { kind: 'facts' }];

  data.images.forEach((media, index) => {
    slides.push({
      kind: 'photo',
      media,
      index,
      total: data.images.length,
    });
  });

  if (data.listing.summary?.trim()) {
    slides.push({ kind: 'summary' });
  }
  if (data.listing.keyPoints.length > 0) {
    slides.push({ kind: 'key_points' });
  }
  if (data.listing.description?.trim()) {
    slides.push({ kind: 'description' });
  }
  const hasLocationSlide =
    Boolean(data.listing.locationCopy?.trim()) ||
    (data.listing.latitude != null && data.listing.longitude != null) ||
    Boolean(formatBrochureAddress(data.listing));
  if (hasLocationSlide) {
    slides.push({ kind: 'location' });
  }

  data.floorplans.forEach((media, index) => {
    slides.push({
      kind: 'floorplan',
      media,
      index,
      total: data.floorplans.length,
    });
  });

  slides.push({ kind: 'contact' });
  return slides;
}

type SlideProps = {
  data: PublicBrochureData;
  slide: BrochureSlide;
};

function fadeProps(reduced: boolean, delay = 0) {
  return {
    initial: { opacity: 0, y: reduced ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduced ? 0 : -10 },
    transition: reduced
      ? { duration: 0 }
      : { duration: 0.45, delay, ease: marketingHeroEase },
  };
}

function CoverSlide({
  listing,
  coverUrl,
  logoUrl,
  accountName,
}: {
  listing: BrochureListing;
  coverUrl: string | null;
  logoUrl: string | null;
  accountName: string | null;
}) {
  const reduced = useReducedMotion() ?? false;
  const address = formatBrochureAddress(listing);

  return (
    <div className="relative flex h-full w-full items-end overflow-hidden">
      {coverUrl ? (
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : { scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={
            reduced ? { duration: 0 } : { duration: 12, ease: 'linear' }
          }
        >
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 bg-[var(--brochure-primary)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

      {logoUrl ? (
        <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] left-6 z-10 sm:left-10 md:left-16">
          <Image
            src={logoUrl}
            alt={accountName ?? 'Agency'}
            width={160}
            height={48}
            unoptimized
            priority
            className="h-10 w-auto max-w-[180px] object-contain drop-shadow-md sm:h-12"
          />
        </div>
      ) : null}

      <div className="relative z-10 w-full px-6 pt-10 pb-24 sm:px-10 sm:pb-28 md:px-16">
        <motion.p
          className="inline-flex rounded-full bg-[var(--brochure-accent)] px-3.5 py-1.5 text-xs font-semibold tracking-[0.16em] text-[var(--brochure-primary)] uppercase shadow-[0_2px_12px_rgba(0,0,0,0.35)] ring-1 ring-black/25"
          {...fadeProps(reduced, 0.05)}
        >
          {formatDisposalLabel(listing.disposalType)}
        </motion.p>
        <motion.h1
          className="font-heading mt-3 max-w-4xl text-4xl leading-[1.05] font-bold tracking-[-0.02em] text-[var(--ozer-text-on-dark)] sm:text-5xl md:text-6xl lg:text-7xl"
          {...fadeProps(reduced, 0.1)}
        >
          {listing.name}
        </motion.h1>
        {address ? (
          <motion.p
            className="mt-4 max-w-2xl text-base text-[var(--ozer-text-on-dark-muted)] sm:text-lg"
            {...fadeProps(reduced, 0.16)}
          >
            {address}
          </motion.p>
        ) : null}
      </div>
    </div>
  );
}

function FactsSlide({ listing }: { listing: BrochureListing }) {
  const reduced = useReducedMotion() ?? false;
  const rent = formatBrochureRent(listing);
  const price = formatBrochurePrice(listing);
  const size = formatBrochureSize(listing);

  const facts: Array<{ label: string; value: string }> = [];
  if (rent) facts.push({ label: 'Rent', value: rent });
  if (price) facts.push({ label: 'Price', value: price });
  if (size) facts.push({ label: 'Size', value: size });
  if (listing.tenure) facts.push({ label: 'Tenure', value: listing.tenure });
  if (listing.useClass)
    facts.push({ label: 'Use class', value: listing.useClass });
  if (listing.epcBand || listing.epcRating != null) {
    facts.push({
      label: 'EPC',
      value: [
        listing.epcBand,
        listing.epcRating != null ? String(listing.epcRating) : null,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  if (listing.availableFrom) {
    facts.push({
      label: 'Available',
      value: new Date(`${listing.availableFrom}T12:00:00`).toLocaleDateString(
        'en-GB',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      ),
    });
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--brochure-primary)] px-6 py-20 sm:px-10 md:px-16">
      <div className="w-full max-w-4xl">
        <motion.p
          className="text-xs font-medium tracking-[0.18em] text-[var(--brochure-accent)] uppercase"
          {...fadeProps(reduced)}
        >
          Key facts
        </motion.p>
        <motion.h2
          className="font-heading mt-3 text-3xl font-bold text-[var(--ozer-text-on-dark)] sm:text-4xl"
          {...fadeProps(reduced, 0.06)}
        >
          {listing.name}
        </motion.h2>

        <motion.div
          className="mt-8 grid gap-3 sm:grid-cols-2"
          {...fadeProps(reduced, 0.12)}
        >
          {facts.length === 0 ? (
            <p className="text-[var(--ozer-text-on-dark-muted)]">
              Details available on request.
            </p>
          ) : (
            facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-[var(--ozer-border-on-dark)]/35 bg-[var(--ozer-cream-50)] px-5 py-4"
              >
                <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  {fact.label}
                </p>
                <p className="font-heading mt-1 text-xl font-bold text-[var(--workspace-shell-text)]">
                  {fact.value}
                </p>
              </div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
}

function PhotoSlide({
  media,
  index,
  total,
  contain = false,
  label,
}: {
  media: BrochureMediaItem;
  index: number;
  total: number;
  contain?: boolean;
  label?: string;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[var(--brochure-primary)]">
      <Image
        src={media.url}
        alt={media.fileName ?? label ?? 'Property photo'}
        fill
        unoptimized
        sizes="100vw"
        className={contain ? 'object-contain p-4 sm:p-8' : 'object-cover'}
        priority={index === 0}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--ozer-plum-950)]/80 to-transparent px-6 pt-16 pb-20 sm:px-10">
        <p className="text-sm text-[var(--ozer-text-on-dark-muted)]">
          {label ?? 'Photography'} · {index + 1} / {total}
        </p>
      </div>
    </div>
  );
}

function CopySlide({
  eyebrow,
  title,
  body,
  bullets,
}: {
  eyebrow: string;
  title: string;
  body?: string | null;
  bullets?: string[];
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--brochure-primary)] px-6 py-20 sm:px-10 md:px-16">
      <div className="w-full max-w-3xl">
        <motion.p
          className="text-xs font-medium tracking-[0.18em] text-[var(--brochure-accent)] uppercase"
          {...fadeProps(reduced)}
        >
          {eyebrow}
        </motion.p>
        <motion.h2
          className="font-heading mt-3 text-3xl font-bold text-[var(--ozer-text-on-dark)] sm:text-4xl"
          {...fadeProps(reduced, 0.06)}
        >
          {title}
        </motion.h2>
        {body ? (
          <motion.p
            className="mt-6 text-base leading-relaxed whitespace-pre-line text-[var(--ozer-text-on-dark-muted)] sm:text-lg"
            {...fadeProps(reduced, 0.12)}
          >
            {body}
          </motion.p>
        ) : null}
        {bullets && bullets.length > 0 ? (
          <motion.ul className="mt-6 space-y-3" {...fadeProps(reduced, 0.14)}>
            {bullets.map((point, i) => (
              <li
                key={`${i}-${point.slice(0, 24)}`}
                className="flex gap-3 text-base text-[var(--ozer-text-on-dark)] sm:text-lg"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brochure-accent)]" />
                <span>{point}</span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </div>
    </div>
  );
}

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

function LocationSlide({ listing }: { listing: BrochureListing }) {
  const reduced = useReducedMotion() ?? false;
  const address = formatBrochureAddress(listing);
  const mapQuery =
    listing.latitude != null && listing.longitude != null
      ? `${listing.latitude},${listing.longitude}`
      : address;
  const embedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--brochure-primary)] px-6 py-20 sm:px-10 md:px-12 lg:px-16">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <motion.p
            className="text-xs font-medium tracking-[0.18em] text-[var(--brochure-accent)] uppercase"
            {...fadeProps(reduced)}
          >
            Location
          </motion.p>
          <motion.h2
            className="font-heading mt-3 text-3xl font-bold text-[var(--ozer-text-on-dark)] sm:text-4xl"
            {...fadeProps(reduced, 0.06)}
          >
            The area
          </motion.h2>
          {address ? (
            <motion.p
              className="mt-3 text-sm text-[var(--ozer-text-on-dark-muted)] sm:text-base"
              {...fadeProps(reduced, 0.1)}
            >
              {address}
            </motion.p>
          ) : null}
          {listing.locationCopy?.trim() ? (
            <motion.p
              className="mt-6 text-base leading-relaxed whitespace-pre-line text-[var(--ozer-text-on-dark-muted)] sm:text-lg"
              {...fadeProps(reduced, 0.12)}
            >
              {listing.locationCopy}
            </motion.p>
          ) : null}
        </div>

        <motion.div
          className="overflow-hidden rounded-2xl border border-white/15 bg-black/20 shadow-lg"
          {...fadeProps(reduced, 0.14)}
        >
          {embedSrc ? (
            <iframe
              title="Property location map"
              src={embedSrc}
              className="h-[min(48vh,28rem)] w-full border-0 lg:h-[min(56vh,32rem)]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              allowFullScreen
            />
          ) : (
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-[var(--ozer-text-on-dark-muted)]">
              Map unavailable for this property.
            </div>
          )}
        </motion.div>
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
              <motion.div className="mb-6" {...fadeProps(reduced)}>
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
              {...fadeProps(reduced, 0.04)}
            >
              Get in touch
            </motion.p>
            <motion.h2
              className="font-heading mt-3 text-3xl font-bold text-[var(--ozer-text-on-dark)] sm:text-4xl"
              {...fadeProps(reduced, 0.08)}
            >
              Interested in this property?
            </motion.h2>
            {data.accountName ? (
              <motion.p
                className="mt-3 text-[var(--ozer-text-on-dark-muted)]"
                {...fadeProps(reduced, 0.1)}
              >
                {data.accountName}
              </motion.p>
            ) : null}

            <motion.div
              className="mt-8 space-y-3"
              {...fadeProps(reduced, 0.14)}
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
            {...fadeProps(reduced, 0.12)}
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

export function BrochureSlideView({ data, slide }: SlideProps) {
  const coverUrl =
    data.images.find((img) => img.isCover)?.url ?? data.images[0]?.url ?? null;

  switch (slide.kind) {
    case 'cover':
      return (
        <CoverSlide
          listing={data.listing}
          coverUrl={coverUrl}
          logoUrl={data.brand.logoUrl}
          accountName={data.accountName}
        />
      );
    case 'facts':
      return <FactsSlide listing={data.listing} />;
    case 'photo':
      return (
        <PhotoSlide
          media={slide.media}
          index={slide.index}
          total={slide.total}
        />
      );
    case 'summary':
      return (
        <CopySlide
          eyebrow="Overview"
          title="The opportunity"
          body={data.listing.summary}
        />
      );
    case 'key_points':
      return (
        <CopySlide
          eyebrow="Highlights"
          title="Key points"
          bullets={data.listing.keyPoints}
        />
      );
    case 'description':
      return (
        <CopySlide
          eyebrow="Details"
          title="Description"
          body={data.listing.description}
        />
      );
    case 'location':
      return <LocationSlide listing={data.listing} />;
    case 'floorplan':
      return (
        <PhotoSlide
          media={slide.media}
          index={slide.index}
          total={slide.total}
          contain
          label="Floorplan"
        />
      );
    case 'contact':
      return <ContactSlide data={data} />;
    default:
      return null;
  }
}
