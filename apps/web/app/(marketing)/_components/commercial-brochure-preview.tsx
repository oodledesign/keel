'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { marketingHeroEase } from '~/lib/marketing/marketing-ui';

type CommercialBrochurePreviewProps = {
  liveUrl: string;
  className?: string;
};

const PREVIEW_SLIDES = [
  {
    id: 'cover',
    kind: 'content' as const,
    eyebrow: 'To let',
    title: '4B Valley Industries',
    body: 'Tonbridge · branded cover with your logo and disposal status.',
  },
  {
    id: 'facts',
    kind: 'content' as const,
    eyebrow: 'Key facts',
    title: 'Rent, size & tenure',
    body: 'Flip through the numbers landlords and enquirees expect up front.',
  },
  {
    id: 'enquire',
    kind: 'content' as const,
    eyebrow: 'Get in touch',
    title: 'Enquire in the deck',
    body: 'Agent details and a form — leads come straight back to the desk.',
  },
  {
    id: 'cta',
    kind: 'cta' as const,
    eyebrow: 'Live brochure',
    title: 'See the full slideshow',
    body: 'Photos, floorplans, location map, and the full enquire experience.',
  },
];

export function CommercialBrochurePreview({
  liveUrl,
  className,
}: CommercialBrochurePreviewProps) {
  const [index, setIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const slide = PREVIEW_SLIDES[index] ?? PREVIEW_SLIDES[0]!;
  const total = PREVIEW_SLIDES.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % total);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [mounted, total]);

  const go = (next: number) => {
    setIndex(((next % total) + total) % total);
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[#1a2744] text-white shadow-[0_20px_50px_rgba(26,39,68,0.28)]',
        className,
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Brochure preview"
    >
      <div className="relative aspect-[16/11] sm:aspect-[16/10]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8"
            initial={mounted ? { opacity: 0, y: 14 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={mounted ? { opacity: 0, y: -10 } : undefined}
            transition={
              mounted
                ? { duration: 0.35, ease: marketingHeroEase }
                : { duration: 0 }
            }
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,92,52,0.18),transparent_55%),linear-gradient(to_top,#0f1729_8%,rgba(15,23,41,0.35)_55%,transparent)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-x-8 top-8 grid grid-cols-3 gap-2 opacity-30 sm:inset-x-10 sm:top-10"
              aria-hidden
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-lg border border-white/15 bg-white/5"
                />
              ))}
            </div>

            <div className="relative z-10 max-w-md">
              <p className="inline-flex rounded-full bg-[var(--ozer-coral-500)] px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-[var(--ozer-plum-950)] uppercase">
                {slide.eyebrow}
              </p>
              <h3 className="font-heading mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                {slide.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70 sm:text-base">
                {slide.body}
              </p>

              {slide.kind === 'cta' ? (
                <Button
                  asChild
                  className="mt-5 rounded-full bg-[var(--ozer-coral-500)] text-[var(--ozer-plum-950)] hover:bg-[var(--ozer-coral-400)]"
                >
                  <Link href={liveUrl} target="_blank" rel="noreferrer">
                    View live version
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
        <button
          type="button"
          aria-label="Previous preview slide"
          onClick={() => go(index - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5">
          {PREVIEW_SLIDES.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Go to preview slide ${i + 1}`}
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
          aria-label="Next preview slide"
          onClick={() => go(index + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 transition hover:border-white/40 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
