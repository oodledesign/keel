'use client';

import { useMemo, useState } from 'react';

import { ImageIcon, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { CommercialListingMedia } from '../_lib/server/listings.service';
import { ListingMediaLightbox } from './listing-media-lightbox';

function mediaHref(item: CommercialListingMedia) {
  return item.url ?? item.externalUrl ?? null;
}

const SIZE_CLASS = {
  sm: 'grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7',
  md: 'grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4',
} as const;

export function ListingPrivateImageThumbs({
  images,
  size = 'sm',
  onDelete,
  deleteDisabled,
}: {
  images: CommercialListingMedia[];
  size?: 'sm' | 'md';
  onDelete?: (item: CommercialListingMedia) => void;
  deleteDisabled?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const previewable = useMemo(
    () => images.filter((item) => Boolean(mediaHref(item))),
    [images],
  );
  const activeIndex =
    lightboxIndex == null || previewable.length === 0
      ? null
      : Math.min(lightboxIndex, previewable.length - 1);

  const openLightbox = (item: CommercialListingMedia) => {
    const index = previewable.findIndex((row) => row.id === item.id);
    if (index >= 0) setLightboxIndex(index);
  };

  if (images.length === 0) return null;

  return (
    <>
      <ul className={cn('grid', SIZE_CLASS[size])}>
        {images.map((item) => {
          const href = mediaHref(item);
          return (
            <li
              key={item.id}
              className="group relative overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
            >
              {href ? (
                <button
                  type="button"
                  className="block w-full cursor-zoom-in text-left"
                  onClick={() => openLightbox(item)}
                  title={item.fileName ?? 'Private image'}
                  aria-label={`View ${item.fileName ?? 'private image'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={href}
                    alt={item.fileName ?? 'Private image'}
                    className="aspect-square w-full object-cover transition-opacity group-hover:opacity-95"
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-1 px-2 text-[var(--workspace-shell-text)]/40">
                  <ImageIcon className="h-5 w-5" />
                  <span className="line-clamp-2 text-center text-[10px]">
                    {item.fileName ?? 'Private image'}
                  </span>
                </div>
              )}
              {onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 bg-[var(--workspace-shell-panel)]/90 text-[var(--workspace-shell-text)] shadow-sm"
                  disabled={deleteDisabled}
                  onClick={() => onDelete(item)}
                  aria-label={`Delete ${item.fileName ?? 'private image'}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ListingMediaLightbox
        items={previewable}
        index={activeIndex}
        onIndexChange={setLightboxIndex}
        label="Private image preview"
      />
    </>
  );
}
