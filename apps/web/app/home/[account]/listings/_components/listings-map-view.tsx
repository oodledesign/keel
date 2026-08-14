'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import { Bell, Building2, MapPin, X } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxMap, {
  type MapRef,
  Marker,
  NavigationControl,
  Popup,
} from 'react-map-gl/mapbox';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
} from '~/lib/commercial/commercial-constants';

import type { CommercialListing } from '../_lib/server/listings.service';
import { ListingAgentAvatarStack } from './listing-agent-avatar-stack';
import './listings-map-popup.css';

/** Public Mapbox token — set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local / Vercel. */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? '';

const UK_DEFAULT = {
  longitude: -1.5,
  latitude: 52.5,
  zoom: 5.5,
} as const;

function formatMoney(pence: number | null) {
  if (pence == null) return null;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatSize(listing: CommercialListing) {
  if (listing.sizeMinSqft == null && listing.sizeMaxSqft == null) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n);
  const min = listing.sizeMinSqft;
  const max = listing.sizeMaxSqft;
  if (min != null && max != null && min !== max) {
    return `${fmt(min)}–${fmt(max)} sq ft`;
  }
  return `${fmt(min ?? max!)} sq ft`;
}

function formatUpdatedAt(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function locationLabel(listing: CommercialListing) {
  return [listing.addressLine1, listing.town, listing.postcode]
    .filter(Boolean)
    .join(', ');
}

function listingHref(accountSlug: string, listingId: string) {
  return pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId);
}

function hasCoords(listing: CommercialListing) {
  return listing.latitude != null && listing.longitude != null;
}

function fitMapToListings(
  map: MapRef,
  points: CommercialListing[],
  options?: { duration?: number },
) {
  const duration = options?.duration ?? 700;
  const withCoords = points.filter(hasCoords);
  if (withCoords.length === 0) return;

  if (withCoords.length === 1) {
    const only = withCoords[0]!;
    map.flyTo({
      center: [only.longitude!, only.latitude!],
      zoom: 12,
      duration,
    });
    return;
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const listing of withCoords) {
    minLng = Math.min(minLng, listing.longitude!);
    maxLng = Math.max(maxLng, listing.longitude!);
    minLat = Math.min(minLat, listing.latitude!);
    maxLat = Math.max(maxLat, listing.latitude!);
  }

  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    {
      padding: { top: 56, bottom: 56, left: 56, right: 56 },
      maxZoom: 14,
      duration,
    },
  );
}

function moneyLabel(listing: CommercialListing) {
  const rent = formatMoney(listing.askingRentPence);
  const price = formatMoney(listing.askingPricePence);
  if (rent) return `${rent} pa`;
  return price;
}

interface ListingsMapViewProps {
  listings: CommercialListing[];
  accountSlug: string;
  loading?: boolean;
}

export function ListingsMapView({
  listings,
  accountSlug,
  loading = false,
}: ListingsMapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const listItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popupId, setPopupId] = useState<string | null>(null);

  const mappable = useMemo(() => listings.filter(hasCoords), [listings]);

  const mappableKey = useMemo(
    () =>
      mappable
        .map((l) => `${l.id}:${l.latitude}:${l.longitude}`)
        .sort()
        .join('|'),
    [mappable],
  );

  const selected = useMemo(
    () => listings.find((l) => l.id === selectedId) ?? null,
    [listings, selectedId],
  );

  const popupListing = useMemo(
    () => listings.find((l) => l.id === popupId) ?? null,
    [listings, popupId],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mappable.length === 0) return;
    // Defer until Mapbox has sized the container.
    const frame = requestAnimationFrame(() => {
      fitMapToListings(map, mappable, { duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [mappable, mappableKey]);

  useEffect(() => {
    if (!selected || !hasCoords(selected)) return;
    mapRef.current?.flyTo({
      center: [selected.longitude!, selected.latitude!],
      zoom: Math.max(mapRef.current.getZoom(), 11),
      duration: 600,
    });
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    const el = listItemRefs.current.get(selectedId);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const selectListing = (listing: CommercialListing, openPopup = false) => {
    setSelectedId(listing.id);
    if (openPopup && hasCoords(listing)) {
      setPopupId(listing.id);
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] lg:h-[min(78vh,820px)] lg:flex-row">
      <div className="flex max-h-[42vh] w-full flex-col border-b border-[color:var(--workspace-shell-border)] lg:max-h-none lg:w-[42%] lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
          <p className="text-xs text-[var(--workspace-shell-text)]/55">
            {listings.length} {listings.length === 1 ? 'disposal' : 'disposals'}
            {mappable.length < listings.length
              ? ` · ${mappable.length} on map`
              : null}
          </p>
          {loading ? (
            <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
              Loading…
            </span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <MapPin className="h-8 w-8 text-[var(--workspace-shell-text)]/20" />
              <p className="text-sm text-[var(--workspace-shell-text)]/60">
                No disposals to show
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {listings.map((listing) => {
                const href = listingHref(accountSlug, listing.id);
                const location = locationLabel(listing);
                const size = formatSize(listing);
                const money = moneyLabel(listing);
                const updated = formatUpdatedAt(listing.updatedAt);
                const mapped = hasCoords(listing);
                const isSelected = listing.id === selectedId;

                return (
                  <li key={listing.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      ref={(node) => {
                        if (node) listItemRefs.current.set(listing.id, node);
                        else listItemRefs.current.delete(listing.id);
                      }}
                      onClick={() => selectListing(listing, true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectListing(listing, true);
                        }
                      }}
                      className={`flex w-full cursor-pointer gap-3 px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--ozer-accent-subtle)]'
                          : 'hover:bg-[var(--workspace-shell-sidebar-accent)]'
                      }`}
                      aria-pressed={isSelected}
                    >
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--workspace-shell-sidebar-accent)]"
                      >
                        {listing.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={listing.coverUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <Building2 className="h-5 w-5 text-[var(--workspace-shell-text)]/20" />
                          </span>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="line-clamp-1 text-sm font-semibold text-[var(--workspace-shell-text)] hover:text-[var(--ozer-accent-muted)]"
                          >
                            {listing.name}
                          </Link>
                          {(listing.matchCount ?? 0) > 0 ? (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--ozer-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white"
                              title={`${listing.matchCount} match${listing.matchCount === 1 ? '' : 'es'}`}
                            >
                              <Bell className="h-3 w-3" />
                              {listing.matchCount}
                            </span>
                          ) : null}
                        </div>
                        {location ? (
                          <p className="line-clamp-1 text-xs text-[var(--workspace-shell-text)]/50">
                            {location}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[listing.disposalType]}`}
                          >
                            {DISPOSAL_TYPE_LABELS[listing.disposalType]}
                          </span>
                          {money ? (
                            <span className="text-xs font-medium text-[var(--workspace-shell-text)]">
                              {money}
                            </span>
                          ) : null}
                          {size ? (
                            <span className="text-xs text-[var(--workspace-shell-text)]/55">
                              {size}
                            </span>
                          ) : null}
                          {updated ? (
                            <span className="text-[11px] text-[var(--workspace-shell-text)]/40">
                              Updated {updated}
                            </span>
                          ) : null}
                          {!mapped ? (
                            <span className="text-[11px] text-[var(--workspace-shell-text)]/35">
                              No map location
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="relative min-h-[48vh] flex-1 lg:min-h-0">
        {!MAPBOX_TOKEN ? (
          <div className="flex h-full min-h-[48vh] flex-col items-center justify-center gap-2 bg-[var(--workspace-shell-sidebar-accent)] px-6 text-center lg:min-h-0">
            <MapPin className="h-10 w-10 text-[var(--workspace-shell-text)]/25" />
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Mapbox token required
            </p>
            <p className="max-w-sm text-xs text-[var(--workspace-shell-text)]/55">
              Add{' '}
              <code className="rounded bg-[var(--workspace-shell-panel)] px-1 py-0.5 text-[11px]">
                NEXT_PUBLIC_MAPBOX_TOKEN
              </code>{' '}
              to <code className="text-[11px]">.env.local</code> (or Vercel) to
              enable the map view.
            </p>
          </div>
        ) : (
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={UK_DEFAULT}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
            attributionControl
            onLoad={() => {
              if (mappable.length > 0) {
                fitMapToListings(mapRef.current!, mappable, { duration: 0 });
              }
            }}
          >
            <NavigationControl position="bottom-right" showCompass={false} />

            {mappable.map((listing) => {
              const isSelected = listing.id === selectedId;
              return (
                <Marker
                  key={listing.id}
                  longitude={listing.longitude!}
                  latitude={listing.latitude!}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    selectListing(listing, true);
                  }}
                >
                  <button
                    type="button"
                    aria-label={listing.name}
                    className={`rounded-full border-2 border-white shadow-md transition-transform ${
                      isSelected
                        ? 'h-4 w-4 scale-125 bg-[var(--ozer-accent)]'
                        : 'h-3.5 w-3.5 bg-[var(--ozer-info)] hover:scale-110'
                    }`}
                  />
                </Marker>
              );
            })}

            {popupListing && hasCoords(popupListing) ? (
              <Popup
                longitude={popupListing.longitude!}
                latitude={popupListing.latitude!}
                anchor="bottom"
                offset={14}
                closeButton={false}
                closeOnClick={false}
                onClose={() => setPopupId(null)}
                className="listings-map-popup"
              >
                <div className="relative w-[248px] p-3.5 pr-11">
                  <button
                    type="button"
                    aria-label="Close"
                    className="absolute top-1.5 right-1.5 inline-flex size-8 items-center justify-center rounded-md text-[var(--workspace-shell-text-muted)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                    onClick={() => setPopupId(null)}
                  >
                    <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                  </button>

                  <div className="space-y-2">
                    <p className="line-clamp-2 pr-1 text-sm leading-snug font-semibold text-[var(--workspace-shell-text)]">
                      {popupListing.name}
                    </p>

                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[popupListing.disposalType]}`}
                    >
                      {DISPOSAL_TYPE_LABELS[popupListing.disposalType]}
                    </span>

                    {(moneyLabel(popupListing) ||
                      formatSize(popupListing)) && (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {[moneyLabel(popupListing), formatSize(popupListing)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {(popupListing.actingAgents?.length ?? 0) > 0 ? (
                        <ListingAgentAvatarStack
                          agents={popupListing.actingAgents ?? []}
                          size="sm"
                        />
                      ) : (
                        <span />
                      )}

                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 rounded-md border-[color:var(--ozer-accent)] px-2.5 text-xs font-medium text-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-subtle)] hover:text-[var(--ozer-accent)]"
                      >
                        <Link href={listingHref(accountSlug, popupListing.id)}>
                          Open disposal
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Popup>
            ) : null}
          </MapboxMap>
        )}
      </div>
    </div>
  );
}
