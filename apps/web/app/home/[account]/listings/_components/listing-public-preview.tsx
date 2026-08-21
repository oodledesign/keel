'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  type PublicBrochureData,
  formatBrochureAddress,
  formatBrochurePrice,
  formatBrochureRent,
  formatBrochureSize,
  formatDisposalLabel,
} from '~/lib/commercial/public-brochure.shared';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { ListingPreviewExternalLink } from '../_lib/listing-preview-links';

export type ListingPreviewUnit = {
  id: string;
  label: string;
  floorOrUnit: string | null;
  sizeSqft: number | null;
  askingRentPence: number | null;
  status: string | null;
};

type ListingPublicPreviewProps = {
  data: PublicBrochureData;
  sector: string | null;
  units: ListingPreviewUnit[];
  externalLinks: ListingPreviewExternalLink[];
  backHref: string;
};

function formatMoneyPence(pence: number | null): string | null {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatAvailableFrom(value: string | null): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatSqft(value: number | null): string | null {
  if (value == null) return null;
  return `${new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(value)} sq ft`;
}

function formatSqm(value: number | null): string | null {
  if (value == null) return null;
  const sqm = value * 0.092903;
  return `${new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 0,
  }).format(sqm)} sq m`;
}

function buildMapEmbedSrc(input: {
  latitude: number | null;
  longitude: number | null;
  address: string;
}): string | null {
  if (input.latitude != null && input.longitude != null) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${input.latitude},${input.longitude}`,
    )}&z=15&output=embed`;
  }
  if (!input.address.trim()) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(
    input.address,
  )}&z=15&output=embed`;
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--ozer-border-on-light)] py-2.5 last:border-b-0">
      <span className="text-sm text-[var(--ozer-text-on-light-muted)]">
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-[var(--ozer-text-on-light)]">
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-[var(--ozer-text-on-light)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ImageCarousel({
  images,
  title,
}: {
  images: PublicBrochureData['images'];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;

  if (!current) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center bg-[var(--ozer-cream-100)] text-sm text-[var(--ozer-text-on-light-muted)]">
        No photos yet
      </div>
    );
  }

  const go = (delta: number) => {
    setIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return images.length - 1;
      if (next >= images.length) return 0;
      return next;
    });
  };

  return (
    <div className="relative h-full min-h-[220px] overflow-hidden bg-[var(--ozer-cream-100)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.fileName || title}
        className="h-full w-full object-cover"
      />
      {images.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Photo ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition',
                  i === index ? 'bg-white' : 'bg-white/45',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ListingPublicPreview({
  data,
  sector,
  units,
  externalLinks,
  backHref,
}: ListingPublicPreviewProps) {
  const { listing, agents, images, floorplans, accountName, brand } = data;
  const address = formatBrochureAddress(listing);
  const rent = formatBrochureRent(listing);
  const price = formatBrochurePrice(listing);
  const size = formatBrochureSize(listing);
  const availableFrom = formatAvailableFrom(listing.availableFrom);
  const mapSrc = buildMapEmbedSrc({
    latitude: listing.latitude,
    longitude: listing.longitude,
    address,
  });

  const epc =
    listing.epcBand || listing.epcRating != null
      ? [
          listing.epcBand,
          listing.epcRating != null ? String(listing.epcRating) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const headlineParts = [
    formatDisposalLabel(listing.disposalType).toUpperCase(),
    size?.toUpperCase() ?? null,
    listing.useClass ? `CLASS ${listing.useClass.toUpperCase()}` : null,
    sector ? sector.toUpperCase() : null,
    listing.name,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-4 py-3 text-[var(--ozer-text-on-light)]">
        <div className="flex items-start gap-2 text-sm">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          <div>
            <p className="font-medium">Staff preview — not a public link</p>
            <p className="text-[var(--ozer-text-on-light-muted)]">
              This is how marketing content reads for{' '}
              {accountName ?? 'your desk'}. Drafts work here without turning on
              brochure share.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {externalLinks.map((link) => (
            <Button key={link.href} variant="outline" size="sm" asChild>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                {link.label}
              </a>
            </Button>
          ))}
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>Back to disposal</Link>
          </Button>
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] text-[var(--ozer-text-on-light)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
        <header className="border-b border-[color:var(--ozer-border-on-light)] px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                {listing.name}
              </h1>
              {address ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--ozer-text-on-light-muted)]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{address}</span>
                </p>
              ) : null}
            </div>
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={accountName ?? 'Agency'}
                className="h-10 w-auto max-w-[140px] object-contain"
              />
            ) : accountName ? (
              <span className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                {accountName}
              </span>
            ) : null}
          </div>
        </header>

        <div className="grid border-b border-[color:var(--ozer-border-on-light)] lg:grid-cols-2">
          <div className="min-h-[240px] lg:min-h-[320px]">
            <ImageCarousel images={images} title={listing.name} />
          </div>
          <div className="min-h-[240px] bg-[var(--ozer-cream-100)] lg:min-h-[320px]">
            {mapSrc ? (
              <iframe
                title="Property location"
                src={mapSrc}
                className="h-full min-h-[240px] w-full border-0 lg:min-h-[320px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-[var(--ozer-text-on-light-muted)]">
                No map location set
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-8">
          <div>
            <p className="text-lg font-semibold tracking-tight sm:text-xl">
              {headlineParts.join(' · ')}
            </p>
          </div>

          <Section title="Details">
            <div className="rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)]/60 px-4">
              {size ? <FactRow label="Size" value={size} /> : null}
              {sector ? <FactRow label="Property type" value={sector} /> : null}
              {listing.useClass ? (
                <FactRow label="Use class" value={listing.useClass} />
              ) : null}
              {rent ? <FactRow label="Rent" value={rent} /> : null}
              {price ? <FactRow label="Price" value={price} /> : null}
              {listing.tenure ? (
                <FactRow label="Tenure" value={listing.tenure} />
              ) : null}
              {availableFrom ? (
                <FactRow label="Available" value={availableFrom} />
              ) : null}
              {epc ? <FactRow label="EPC" value={epc} /> : null}
              {!size &&
              !sector &&
              !listing.useClass &&
              !rent &&
              !price &&
              !listing.tenure &&
              !availableFrom &&
              !epc ? (
                <p className="py-3 text-sm text-[var(--ozer-text-on-light-muted)]">
                  No marketing facts filled in yet.
                </p>
              ) : null}
            </div>
          </Section>

          {listing.summary?.trim() ? (
            <Section title="Summary">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                {listing.summary.trim()}
              </p>
            </Section>
          ) : null}

          {listing.keyPoints.length > 0 ? (
            <Section title="Key points">
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {listing.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {listing.description?.trim() ? (
            <Section title="Description">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                {listing.description.trim()}
              </p>
            </Section>
          ) : null}

          {listing.locationCopy?.trim() ? (
            <Section title="Location">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--ozer-text-on-light)]">
                {listing.locationCopy.trim()}
              </p>
            </Section>
          ) : null}

          <Section title="Availability">
            {units.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-[color:var(--ozer-border-on-light)]">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-[var(--ozer-cream-50)] text-[var(--ozer-text-on-light-muted)]">
                    <tr>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        sq ft
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        sq m
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Rent
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Availability
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => (
                      <tr
                        key={unit.id}
                        className="border-t border-[color:var(--ozer-border-on-light)]"
                      >
                        <td className="px-3 py-2.5 font-medium">
                          {unit.label}
                          {unit.floorOrUnit ? (
                            <span className="mt-0.5 block text-xs font-normal text-[var(--ozer-text-on-light-muted)]">
                              {unit.floorOrUnit}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          {formatSqft(unit.sizeSqft) ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {formatSqm(unit.sizeSqft) ?? '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          {formatMoneyPence(unit.askingRentPence) ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 capitalize">
                          {unit.status?.replaceAll('_', ' ') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                No floor units have been made available.
              </p>
            )}
          </Section>

          {images.length > 0 ? (
            <Section title="Photos">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="aspect-[4/3] overflow-hidden rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-100)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.fileName || listing.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {floorplans.length > 0 ? (
            <Section title="Floorplans">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {floorplans.map((plan) => (
                  <a
                    key={plan.id}
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overflow-hidden rounded-xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] transition hover:border-[var(--ozer-accent)]/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={plan.url}
                      alt={plan.fileName || 'Floorplan'}
                      className="max-h-64 w-full object-contain p-3"
                    />
                    {plan.fileName ? (
                      <p className="border-t border-[color:var(--ozer-border-on-light)] px-3 py-2 text-xs text-[var(--ozer-text-on-light-muted)]">
                        {plan.fileName}
                      </p>
                    ) : null}
                  </a>
                ))}
              </div>
            </Section>
          ) : null}

          <Section title="Contacts">
            {agents.length > 0 ? (
              <ul className="space-y-3">
                {agents.map((agent) => (
                  <li
                    key={agent.userId}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--ozer-border-on-light)] px-3 py-3"
                  >
                    {agent.pictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={agent.pictureUrl}
                        alt=""
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--ozer-cream-100)] text-sm font-semibold text-[var(--ozer-text-on-light-muted)]">
                        {agent.name.trim().charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{agent.name}</p>
                      {agent.email ? (
                        <a
                          href={`mailto:${agent.email}`}
                          className="inline-flex items-center gap-1 text-sm text-[var(--ozer-accent)] hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </a>
                      ) : null}
                    </div>
                    {agent.phone ? (
                      <a
                        href={`tel:${agent.phone.replace(/\s+/g, '')}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-cream-50)] px-3 py-2 text-sm font-medium"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {agent.phone}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                No agents assigned to this disposal yet.
              </p>
            )}
          </Section>

          <div className="pt-2">
            <Link href={backHref} className={workspaceBtnPrimaryMd}>
              Back to disposal
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
