'use client';

import { useEffect, useRef, useState } from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';

import { cn } from '@kit/ui/utils';

import { FeatureLandingIcon } from '~/(marketing)/_components/feature-landing-icon';
import { EarlyAccessFeatureMock } from '~/(marketing)/early-access/_components/early-access-feature-mocks';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
  EARLY_ACCESS_FEATURE_BLOCKS,
} from '~/lib/marketing/early-access-content';
import {
  marketingCard,
  marketingHeroEase,
  marketingIconWell,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

const FEATURE_COUNT = EARLY_ACCESS_FEATURE_BLOCKS.length;
const SCROLL_VH_PER_FEATURE = 72;
const FEATURE_SWITCH_FADE_S = 0.32;

type FeatureBlock = (typeof EARLY_ACCESS_FEATURE_BLOCKS)[number];

function FeatureTourCard({ block }: { block: FeatureBlock }) {
  return (
    <div
      className={cn(
        marketingCard,
        'flex h-full max-h-[calc(100vh-5.5rem)] flex-col overflow-hidden rounded-[1.25rem] p-5 md:p-6 lg:p-8',
        block.soon && 'opacity-95',
      )}
    >
      <div className="grid h-full min-h-0 items-stretch gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] lg:gap-8">
        <div className="flex min-h-0 min-w-0 flex-col">
          <span className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-[var(--workspace-shell-text-muted)]">
            <span
              className={cn(
                marketingIconWell,
                'size-7 shrink-0 rounded-md border-[color:var(--ozer-accent)]/35 p-0',
              )}
            >
              <FeatureLandingIcon
                name={block.icon}
                className="size-3.5 text-[var(--ozer-accent)]"
              />
            </span>
            {block.eyebrow}
          </span>
          <h3 className="font-heading mb-2 text-xl font-semibold tracking-tight text-[var(--workspace-shell-text)] md:text-2xl lg:text-[1.65rem] lg:leading-tight xl:text-3xl">
            {block.title}
          </h3>
          <p className="mb-2 text-sm leading-relaxed text-[var(--workspace-shell-text)] md:text-base">
            {block.moment}
          </p>
          <p
            className={`mb-4 text-sm leading-relaxed md:text-base ${marketingMutedText}`}
          >
            {block.desc}
          </p>

          <div className="mb-4">
            <p className="mb-2 text-xs font-medium tracking-[0.08em] text-[var(--workspace-shell-text-muted)] uppercase">
              Includes
            </p>
            <ul className="space-y-2">
              {block.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="flex items-start gap-2 text-sm leading-snug text-[var(--workspace-shell-text)]"
                >
                  <span
                    className={cn(
                      'mt-2 size-1.5 shrink-0 rounded-full',
                      EARLY_ACCESS_ACCENT_CLASS[block.accent],
                    )}
                    aria-hidden
                  />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          {block.soon ? (
            <span
              className={cn(
                'mt-4 inline-block w-fit rounded-full px-3 py-1.5 text-xs font-bold',
                EARLY_ACCESS_ACCENT_SOFT_CLASS[block.accent],
              )}
            >
              Included in testing — unlocks automatically when ready
            </span>
          ) : null}
        </div>

        <EarlyAccessFeatureMock
          type={block.mock}
          accent={block.accent}
          className="h-full min-h-[14rem] w-full lg:min-h-0"
        />
      </div>
    </div>
  );
}

function FeatureTourSlidePanel({ activeId }: { activeId: string }) {
  const activeBlock =
    EARLY_ACCESS_FEATURE_BLOCKS.find((block) => block.id === activeId) ??
    EARLY_ACCESS_FEATURE_BLOCKS[0];

  if (!activeBlock) {
    return null;
  }

  return (
    <div className="relative max-h-[calc(100vh-5.5rem)] min-h-[22rem] lg:min-h-[calc(100vh-7rem)]">
      <AnimatePresence initial={false} mode="sync">
        <motion.article
          key={activeBlock.id}
          id={activeBlock.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: FEATURE_SWITCH_FADE_S,
            ease: marketingHeroEase,
          }}
          className="absolute inset-0"
        >
          <FeatureTourCard block={activeBlock} />
        </motion.article>
      </AnimatePresence>
    </div>
  );
}

function scrollProgressToFeatureIndex(progress: number) {
  if (FEATURE_COUNT <= 1) {
    return 0;
  }

  const index = Math.round(progress * (FEATURE_COUNT - 1));

  return Math.min(FEATURE_COUNT - 1, Math.max(0, index));
}

function featureIndexToScrollProgress(index: number) {
  if (FEATURE_COUNT <= 1) {
    return 0;
  }

  return index / (FEATURE_COUNT - 1);
}

function FeatureTourNav({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string, index: number) => void;
}) {
  return (
    <nav aria-label="Features" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 px-2 text-[11px] font-medium tracking-[0.08em] text-[var(--workspace-shell-text-muted)] uppercase">
        Features
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {EARLY_ACCESS_FEATURE_BLOCKS.map((block, index) => {
          const isActive = activeId === block.id;

          return (
            <li key={block.id} className="shrink-0 lg:shrink">
              <a
                href={`#${block.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(block.id, index);
                }}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm',
                  isActive
                    ? 'bg-[var(--workspace-shell-sidebar-accent)] font-semibold text-[var(--workspace-shell-text)]'
                    : 'font-medium text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                <span
                  className={cn(
                    marketingIconWell,
                    'size-7 shrink-0 rounded-md p-0',
                    isActive && 'border-[color:var(--ozer-accent)]/35',
                  )}
                >
                  <FeatureLandingIcon
                    name={block.icon}
                    className={cn(
                      'size-3.5',
                      isActive
                        ? 'text-[var(--ozer-accent)]'
                        : 'text-[var(--workspace-shell-text-muted)]',
                    )}
                  />
                </span>
                <span className="min-w-0 whitespace-nowrap lg:whitespace-normal">
                  {block.eyebrow}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ScrollPinnedFeatureTour() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(
    EARLY_ACCESS_FEATURE_BLOCKS[0]?.id ?? '',
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const index = scrollProgressToFeatureIndex(progress);
    const nextId = EARLY_ACCESS_FEATURE_BLOCKS[index]?.id;

    if (nextId) {
      setActiveId((current) => (current === nextId ? current : nextId));
    }
  });

  const scrollToFeature = (id: string, index: number) => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scrollableDistance = Math.max(
      container.offsetHeight - window.innerHeight,
      1,
    );
    const progress = featureIndexToScrollProgress(index);
    const target =
      window.scrollY +
      container.getBoundingClientRect().top +
      progress * scrollableDistance;

    window.scrollTo({ top: target, behavior: 'auto' });
    window.history.replaceState(null, '', `#${id}`);
    setActiveId(id);
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    if (!hash) {
      return;
    }

    const index = EARLY_ACCESS_FEATURE_BLOCKS.findIndex(
      (block) => block.id === hash,
    );

    if (index < 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToFeature(hash, index);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${FEATURE_COUNT * SCROLL_VH_PER_FEATURE}vh` }}
    >
      <div className="sticky top-20 lg:top-24">
        <div className="lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[12.5rem_minmax(0,1fr)] xl:gap-x-12">
          <div className="mb-6 lg:mb-0">
            <FeatureTourNav activeId={activeId} onNavigate={scrollToFeature} />
          </div>

          <FeatureTourSlidePanel activeId={activeId} />
        </div>
      </div>
    </div>
  );
}

function StackedFeatureTour() {
  const [activeId, setActiveId] = useState(
    EARLY_ACCESS_FEATURE_BLOCKS[0]?.id ?? '',
  );

  useEffect(() => {
    const sections = EARLY_ACCESS_FEATURE_BLOCKS.map((block) =>
      document.getElementById(block.id),
    ).filter((element): element is HTMLElement => Boolean(element));

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const nextId = visible[0]?.target.id;

        if (nextId) {
          setActiveId(nextId);
        }
      },
      {
        rootMargin: '-35% 0px -45% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  const scrollToFeature = (id: string) => {
    const section = document.getElementById(id);

    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'auto', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
    setActiveId(id);
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);

    if (!hash) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToFeature(hash);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-12 xl:grid-cols-[14.5rem_minmax(0,1fr)] xl:gap-x-16">
      <div className="mb-8 lg:mb-0">
        <FeatureTourNav
          activeId={activeId}
          onNavigate={(id) => scrollToFeature(id)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        {EARLY_ACCESS_FEATURE_BLOCKS.map((block) => (
          <article key={block.id} id={block.id} className="scroll-mt-28">
            <FeatureTourCard block={block} />
          </article>
        ))}
      </div>
    </div>
  );
}

export function EarlyAccessFeatureTour() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <StackedFeatureTour />;
  }

  return <ScrollPinnedFeatureTour />;
}
