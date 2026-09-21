'use client';

import { useEffect, useRef } from 'react';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

export type ListingMediaLightboxItem = {
  id: string;
  fileName: string | null;
  url?: string | null;
  externalUrl?: string | null;
};

function itemHref(item: ListingMediaLightboxItem) {
  return item.url ?? item.externalUrl ?? null;
}

export function ListingMediaLightbox({
  items,
  index,
  onIndexChange,
  label = 'Media lightbox',
}: {
  items: ListingMediaLightboxItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  label?: string;
}) {
  const touchStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const currentIndex = index ?? 0;
  const item = index != null ? (items[index] ?? null) : null;

  useEffect(() => {
    if (index == null) return;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onIndexChange(
          items.length === 0 ? null : (index - 1 + items.length) % items.length,
        );
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onIndexChange(items.length === 0 ? null : (index + 1) % items.length);
      } else if (event.key === 'Escape') {
        onIndexChange(null);
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [
          ...dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled])',
          ),
        ];
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (
          event.shiftKey &&
          (active === first || active === dialogRef.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, items.length, onIndexChange]);

  if (!item) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={() => onIndexChange(null)}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null || items.length < 2) return;
        const delta = end - start;
        if (Math.abs(delta) < 50) return;
        onIndexChange(
          delta > 0
            ? (currentIndex - 1 + items.length) % items.length
            : (currentIndex + 1) % items.length,
        );
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {item.fileName ?? 'Untitled'}
          </p>
          <p className="text-xs text-white/60">
            {(index ?? 0) + 1} of {items.length}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(null);
          }}
          aria-label="Close lightbox"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        {items.length > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-3 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              onClick={() =>
                onIndexChange((currentIndex - 1 + items.length) % items.length)
              }
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              onClick={() => onIndexChange((currentIndex + 1) % items.length)}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        ) : null}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={itemHref(item) ?? undefined}
          alt={item.fileName ?? 'Listing media'}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
