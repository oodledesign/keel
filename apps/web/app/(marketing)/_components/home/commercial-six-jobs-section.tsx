'use client';

import {
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import Link from 'next/link';

import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  COMMERCIAL_SIX_JOBS_HEADING,
  COMMERCIAL_SIX_JOBS_PANELS,
  type SixJobsPanel,
} from '~/lib/marketing/commercial-home-content';
import { marketingTextLink } from '~/lib/marketing/marketing-ui';

import {
  AiVisual,
  BrochuresVisual,
  CirculationVisual,
  PipelineVisual,
  PortalsVisual,
  RequirementsVisual,
} from './commercial-six-jobs-visuals';

export function CommercialSixJobsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const reducedMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);

  const activePanel =
    COMMERCIAL_SIX_JOBS_PANELS[activeIndex] ?? COMMERCIAL_SIX_JOBS_PANELS[0]!;

  const goTo = useCallback((index: number) => {
    setUserInteracted(true);
    setActiveIndex(
      (index + COMMERCIAL_SIX_JOBS_PANELS.length) %
        COMMERCIAL_SIX_JOBS_PANELS.length,
    );
  }, []);

  const next = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  const prev = useCallback(() => {
    goTo(activeIndex - 1);
  }, [activeIndex, goTo]);

  // Gentle autoplay that stops permanently on any user interaction
  useEffect(() => {
    if (userInteracted || reducedMotion) return;

    const timer = setInterval(() => {
      setActiveIndex((curr) => (curr + 1) % COMMERCIAL_SIX_JOBS_PANELS.length);
    }, 7500);

    return () => clearInterval(timer);
  }, [userInteracted, reducedMotion]);

  // Mobile swipe handling
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) next();
      else prev();
    }
  };

  const renderVisual = (panel: SixJobsPanel) => {
    switch (panel.id) {
      case 'portals':
        return <PortalsVisual />;
      case 'requirements':
        return <RequirementsVisual />;
      case 'circulation':
        return <CirculationVisual />;
      case 'pipeline':
        return <PipelineVisual />;
      case 'brochures':
        return (
          <BrochuresVisual
            onOpenSample={() => {
              window.open('/commercial-property#brochures', '_blank');
            }}
          />
        );
      case 'ai':
        return <AiVisual />;
    }
  };

  return (
    <section
      id="six-jobs"
      className="relative w-full py-20 md:py-28"
      aria-labelledby="six-jobs-heading"
    >
      <div className="mx-auto w-full max-w-[88rem] px-6">
        {/* Section Header */}
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold tracking-wider text-[var(--workspace-shell-text-muted)] uppercase">
            {COMMERCIAL_SIX_JOBS_HEADING.eyebrow}
          </p>
          <h2
            id="six-jobs-heading"
            className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--workspace-shell-text)] sm:text-4xl lg:text-5xl"
          >
            {COMMERCIAL_SIX_JOBS_HEADING.title}
          </h2>
        </div>

        {/* Tab switcher navigation bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--workspace-shell-border)] pb-4">
          <div
            role="tablist"
            aria-label="Six jobs"
            className="flex flex-wrap items-center gap-1.5"
          >
            {COMMERCIAL_SIX_JOBS_PANELS.map((panel, idx) => {
              const isSelected = activeIndex === idx;
              return (
                <button
                  key={panel.id}
                  id={`tab-${panel.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls={`panel-${panel.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => goTo(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      next();
                    } else if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      prev();
                    }
                  }}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-medium transition-colors',
                    isSelected
                      ? 'bg-[var(--ozer-plum-950)] text-[var(--ozer-cream-50)]'
                      : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                  )}
                >
                  {panel.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--workspace-shell-text-muted)] tabular-nums">
              {String(activeIndex + 1).padStart(2, '0')} /{' '}
              {String(COMMERCIAL_SIX_JOBS_PANELS.length).padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prev}
                aria-label="Previous job"
                className="flex size-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next job"
                className="flex size-8 items-center justify-center rounded-full border border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Stage: Fixed min-height container preventing layout shifts */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={cn(
            'relative min-h-[580px] overflow-hidden rounded-3xl border p-6 transition-colors duration-500 sm:p-10 md:min-h-[520px] lg:p-12',
            activePanel.bgStyle.bg,
            activePanel.bgStyle.border,
            activePanel.bgStyle.text,
          )}
        >
          {COMMERCIAL_SIX_JOBS_PANELS.map((panel, idx) => {
            const isActive = idx === activeIndex;

            return (
              <div
                key={panel.id}
                id={`panel-${panel.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${panel.id}`}
                aria-hidden={!isActive}
                className={cn(
                  'w-full transition-opacity duration-300',
                  isActive ? 'block opacity-100' : 'hidden opacity-0',
                )}
              >
                <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
                  {/* Left Column: Copy */}
                  <div className="lg:col-span-5">
                    <p
                      className={cn(
                        'text-xs font-bold tracking-wider uppercase',
                        panel.bgStyle.mutedText,
                      )}
                    >
                      {panel.label}
                    </p>
                    <h3 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                      {panel.h3}
                    </h3>
                    <p
                      className={cn(
                        'mt-3 text-sm leading-relaxed sm:text-base',
                        panel.bgStyle.mutedText,
                      )}
                    >
                      {panel.oneLine}
                    </p>

                    {panel.bullets.length > 0 && (
                      <ul className="mt-6 space-y-2.5">
                        {panel.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-2.5 text-xs font-medium sm:text-sm"
                          >
                            <span
                              className={cn(
                                'mt-1.5 size-1.5 shrink-0 rounded-full',
                                panel.bgStyle.bulletDot,
                              )}
                            />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Right Column: Exactly one visual */}
                  <div className="lg:col-span-7">{renderVisual(panel)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section Footer */}
        <div className="mt-8 flex justify-end">
          <Link
            href="/commercial-property"
            className={cn(
              marketingTextLink,
              'inline-flex items-center gap-1 text-sm font-semibold',
            )}
          >
            See every feature
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
