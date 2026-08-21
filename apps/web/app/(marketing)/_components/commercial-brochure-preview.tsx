'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  type BrochureSlide,
  BrochureSlideView,
  buildBrochureSlides,
} from '~/lib/commercial/brochure-slides';
import type { PublicBrochureData } from '~/lib/commercial/public-brochure.shared';
import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

type CommercialBrochurePreviewProps = {
  data?: PublicBrochureData | null;
  className?: string;
};

const FRAME = { width: 1440, height: 810 };

const SAMPLE_BROCHURE: PublicBrochureData = {
  token: 'marketing-preview',
  accountName: 'Ozer Commercial',
  brand: {
    logoUrl: null,
    primaryColor: '#0D2344',
    secondaryColor: '#FFFFFF',
    accentColor: '#57C87F',
  },
  listing: {
    id: 'marketing-preview',
    accountId: 'marketing-preview',
    name: '4B Valley Industries',
    addressLine1: 'Valley Industries',
    addressLine2: null,
    town: 'Tonbridge',
    county: 'Kent',
    postcode: 'TN9 1RA',
    latitude: null,
    longitude: null,
    disposalType: 'to_let',
    tenure: 'Leasehold',
    useClass: 'E / B2 / B8',
    askingRentPence: 1850000,
    askingRentToPence: null,
    askingPricePence: null,
    rentFrequency: 'pa',
    hideRentFromMarketing: false,
    hidePriceFromMarketing: false,
    serviceChargePerSqft: 4.5,
    ratesPayablePerSqft: 8.25,
    estateChargePerSqft: null,
    sizeMinSqft: 4250,
    sizeMaxSqft: 4250,
    epcBand: 'C',
    epcRating: 68,
    availableFrom: '2026-09-01',
    summary:
      'A self-contained industrial / warehouse unit on an established Tonbridge estate, with yard, parking, and eaves for occupational occupiers.',
    description:
      'The unit is offered to let as a whole. Specification includes a loading door, allocated parking, and an office content to the front. Further information and a floorplan are in the live brochure.',
    locationCopy:
      'Valley Industries sits a short drive from Tonbridge town centre and the A21, with local occupiers across industrial, trade, and warehouse uses.',
    keyPoints: [
      'To let — 4,250 sq ft',
      'Yard and allocated parking',
      'Established commercial estate',
      'Enquire from the deck',
    ],
  },
  agents: [],
  images: [],
  floorplans: [],
};

function slidesForPreview(data: PublicBrochureData): BrochureSlide[] {
  return buildBrochureSlides(data).filter((slide) => slide.kind !== 'contact');
}

export function CommercialBrochurePreview({
  data,
  className,
}: CommercialBrochurePreviewProps) {
  const reduced = useReducedMotion() ?? false;
  const brochure = data ?? SAMPLE_BROCHURE;
  const slides = useMemo(() => slidesForPreview(brochure), [brochure]);
  const [index, setIndex] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const total = slides.length;
  const current = slides[index] ?? slides[0];

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      setScale(width / FRAME.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || total < 2) return;

    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % total);
    }, 4800);

    return () => window.clearInterval(timer);
  }, [reduced, total]);

  const go = (next: number) => {
    if (total < 1) return;
    setIndex(((next % total) + total) % total);
  };

  const brandStyle = {
    '--brochure-primary': brochure.brand.primaryColor,
    '--brochure-secondary': brochure.brand.secondaryColor,
    '--brochure-accent': brochure.brand.accentColor,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-plum-950)] shadow-[0_20px_50px_rgba(26,39,68,0.28)]',
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Brochure preview"
    >
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden bg-[var(--brochure-primary)]"
        style={{
          ...brandStyle,
          aspectRatio: `${FRAME.width} / ${FRAME.height}`,
        }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{
            width: FRAME.width,
            height: FRAME.height,
            transform: `scale(${scale})`,
            opacity: scale > 0 ? 1 : 0,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
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
                <BrochureSlideView data={brochure} slide={current} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          aria-label="Previous brochure slide"
          onClick={() => go(index - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-[var(--ozer-text-on-dark)] transition hover:border-white/40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex max-w-[min(100%,16rem)] flex-wrap items-center justify-center gap-1.5 overflow-hidden sm:max-w-none">
          {slides.map((item, i) => (
            <button
              key={`${item.kind}-${i}`}
              type="button"
              aria-label={`Go to brochure slide ${i + 1}`}
              aria-current={i === index ? true : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index
                  ? 'w-6 bg-[var(--ozer-coral-500)]'
                  : 'w-1.5 bg-white/35',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Next brochure slide"
          onClick={() => go(index + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-[var(--ozer-text-on-dark)] transition hover:border-white/40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
