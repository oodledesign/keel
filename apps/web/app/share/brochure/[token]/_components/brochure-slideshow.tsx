'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';
import { formatBrochureAddress } from '~/lib/commercial/public-brochure.shared';
import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

import {
  type BrochureSlide,
  BrochureSlideView,
  buildBrochureSlides,
} from './brochure-slides';

type BrochureSlideshowProps = {
  data: PublicBrochureData;
};

export function BrochureSlideshow({ data }: BrochureSlideshowProps) {
  const reduced = useReducedMotion() ?? false;
  const slides = useMemo(() => buildBrochureSlides(data), [data]);
  const [index, setIndex] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const current = slides[index] as BrochureSlide;
  const isPhotoLike =
    current?.kind === 'photo' ||
    current?.kind === 'floorplan' ||
    current?.kind === 'cover';
  const isContact = current?.kind === 'contact';
  // Chrome always on text/contact slides; on photo slides only after mouse move.
  const showChrome = chromeVisible || !isPhotoLike;

  const go = useCallback(
    (next: number) => {
      // Navigate without revealing chrome — keeps photo slides immersive.
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!isPhotoLike || isContact) return;
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2800);
  }, [isContact, isPhotoLike]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prev();
      } else if (event.key === 'Home') {
        go(0);
      } else if (event.key === 'End') {
        go(slides.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, next, prev, slides.length]);

  const address = formatBrochureAddress(data.listing);
  const brandStyle = {
    '--brochure-primary': data.brand.primaryColor,
    '--brochure-secondary': data.brand.secondaryColor,
    '--brochure-accent': data.brand.accentColor,
  } as CSSProperties;

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-[var(--brochure-primary)] text-[var(--ozer-text-on-dark)]"
      style={brandStyle}
      onMouseMove={revealChrome}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const delta = end - start;
        if (Math.abs(delta) < 48) return;
        if (delta < 0) next();
        else prev();
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${data.listing.name} brochure`}
    >
      {/* Desktop click zones — disabled on contact so forms stay usable */}
      {!isContact ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            className="absolute inset-y-0 left-0 z-20 hidden w-1/3 cursor-w-resize bg-transparent md:block"
            onClick={prev}
          />
          <button
            type="button"
            aria-label="Next slide"
            className="absolute inset-y-0 right-0 z-20 hidden w-1/3 cursor-e-resize bg-transparent md:block"
            onClick={next}
          />
        </>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.kind}-${index}`}
          className="absolute inset-0"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -12 }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 0.4, ease: marketingHeroEase }
          }
        >
          <BrochureSlideView data={data} slide={current} />
        </motion.div>
      </AnimatePresence>

      {/* Top chrome */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 bg-gradient-to-b from-black/55 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-10 transition-opacity duration-300 sm:px-6 ${
          showChrome ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--ozer-text-on-dark)]">
            {data.listing.name}
          </p>
          {address ? (
            <p className="truncate text-xs text-[var(--ozer-text-on-dark-muted)]">
              {address}
            </p>
          ) : null}
        </div>
        <p className="shrink-0 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-[var(--ozer-text-on-dark-muted)] tabular-nums">
          {index + 1} / {slides.length}
        </p>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/70 to-transparent px-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300 sm:px-6 ${
          showChrome ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-[var(--ozer-text-on-dark)] transition hover:border-[var(--brochure-accent)]/60 hover:text-[var(--brochure-accent)]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="pointer-events-auto flex max-w-[60vw] flex-wrap items-center justify-center gap-1.5">
            {slides.map((slide, i) => (
              <button
                key={`${slide.kind}-${i}`}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? 'w-6 bg-[var(--brochure-accent)]'
                    : 'w-1.5 bg-[var(--ozer-text-on-dark)]/35 hover:bg-[var(--ozer-text-on-dark)]/60'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-[var(--ozer-text-on-dark)] transition hover:border-[var(--brochure-accent)]/60 hover:text-[var(--brochure-accent)]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
