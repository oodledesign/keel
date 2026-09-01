'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  AnimatePresence,
  type MotionValue,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';

import { cn } from '@kit/ui/utils';

import { FeatureLandingIcon } from '~/(marketing)/_components/feature-landing-icon';
import { FeatureTourMock } from '~/(marketing)/_components/feature-tour-mocks';
import {
  EARLY_ACCESS_ACCENT_CLASS,
  EARLY_ACCESS_ACCENT_SOFT_CLASS,
} from '~/lib/marketing/early-access-content';
import {
  FEATURE_TOUR_BLOCKS,
  type FeatureTourBlock,
} from '~/lib/marketing/feature-tour-content';
import {
  marketingCard,
  marketingHeroEase,
  marketingIconWell,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

const FEATURE_COUNT = FEATURE_TOUR_BLOCKS.length;
const SCROLL_VH_PER_FEATURE = 72;
const FEATURE_SWITCH_FADE_S = 0.32;

type FeatureBlock = FeatureTourBlock;

function FeatureTourCard({
  block,
  scrollYProgress,
  activeIndex,
}: {
  block: FeatureBlock;
  scrollYProgress?: MotionValue<number>;
  activeIndex?: number;
}) {
  return (
    <div
      className={cn(
        marketingCard,
        'relative flex h-full flex-col overflow-x-hidden overflow-y-auto rounded-[1.25rem] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-hidden',
        block.soon && 'opacity-95',
      )}
      data-test="feature-tour-card"
    >
      {scrollYProgress != null && activeIndex != null ? (
        <FeatureStepProgress
          scrollYProgress={scrollYProgress}
          activeIndex={activeIndex}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] lg:items-stretch lg:gap-8 lg:p-8">
        <div className="flex shrink-0 flex-col lg:min-h-0 lg:min-w-0">
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
            className={`mb-3 text-sm leading-relaxed md:mb-4 md:text-base ${marketingMutedText}`}
          >
            {block.desc}
          </p>

          <div className="mb-3 shrink-0 md:mb-4">
            <p className="mb-2 text-xs font-medium tracking-[0.08em] text-[var(--workspace-shell-text-muted)] uppercase">
              Includes
            </p>
            <ul className="space-y-1.5 md:space-y-2">
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
                'mt-1 inline-block w-fit rounded-full px-3 py-1.5 text-xs font-bold md:mt-2',
                EARLY_ACCESS_ACCENT_SOFT_CLASS[block.accent],
              )}
            >
              {block.soonLabel ?? 'Coming soon'}
            </span>
          ) : null}
        </div>

        <FeatureTourMock
          type={block.mock}
          accent={block.accent}
          className="h-36 max-h-36 w-full shrink-0 sm:h-44 sm:max-h-44 md:h-52 md:max-h-52 lg:h-full lg:max-h-none lg:min-h-0 lg:shrink"
        />
      </div>
    </div>
  );
}

function featureStepBounds(activeIndex: number) {
  if (FEATURE_COUNT <= 1) {
    return { start: 0, end: 1 };
  }

  const start =
    activeIndex === 0 ? 0 : (activeIndex - 0.5) / (FEATURE_COUNT - 1);
  const end =
    activeIndex === FEATURE_COUNT - 1
      ? 1
      : (activeIndex + 0.5) / (FEATURE_COUNT - 1);

  return { start, end };
}

function FeatureStepProgress({
  scrollYProgress,
  activeIndex,
}: {
  scrollYProgress: MotionValue<number>;
  activeIndex: number;
}) {
  const { start, end } = featureStepBounds(activeIndex);
  const scaleX = useTransform(scrollYProgress, (progress) => {
    const range = Math.max(end - start, 0.0001);

    return Math.min(1, Math.max(0, (progress - start) / range));
  });

  const isLast = activeIndex >= FEATURE_COUNT - 1;
  const nextLabel = isLast
    ? null
    : FEATURE_TOUR_BLOCKS[activeIndex + 1]?.eyebrow;

  return (
    <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-5 pt-4 pb-3 md:px-6 lg:px-8">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium tracking-[0.04em] text-[var(--workspace-shell-text-muted)] uppercase">
        <span>
          {activeIndex + 1} / {FEATURE_COUNT}
        </span>
        {nextLabel ? <span>Next · {nextLabel}</span> : <span>End</span>}
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-[var(--workspace-shell-sidebar-accent)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((activeIndex + 1) / FEATURE_COUNT) * 100)}
        aria-label={
          nextLabel
            ? `Scroll progress to ${nextLabel}`
            : 'Scroll progress through features'
        }
      >
        <motion.div
          className="h-full origin-left rounded-full bg-[var(--ozer-accent)]"
          style={{ scaleX }}
        />
      </div>
    </div>
  );
}

function FeatureTourSlidePanel({
  activeId,
  activeIndex,
  scrollYProgress,
}: {
  activeId: string;
  activeIndex: number;
  scrollYProgress: MotionValue<number>;
}) {
  const activeBlock =
    FEATURE_TOUR_BLOCKS.find((block) => block.id === activeId) ??
    FEATURE_TOUR_BLOCKS[0];

  if (!activeBlock) {
    return null;
  }

  return (
    <div className="relative h-[calc(100dvh-10.5rem)] lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)] lg:min-h-[calc(100vh-7rem)]">
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
          <FeatureTourCard
            block={activeBlock}
            scrollYProgress={scrollYProgress}
            activeIndex={activeIndex}
          />
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
  const scrollerRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLAnchorElement>());
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const active = itemRefs.current.get(activeId);

    if (!scroller || !active) {
      return;
    }

    if (scroller.scrollWidth <= scroller.clientWidth) {
      return;
    }

    const scrollerRect = scroller.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const nextLeft =
      scroller.scrollLeft +
      (activeRect.left - scrollerRect.left) -
      scrollerRect.width / 2 +
      activeRect.width / 2;

    scroller.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeId, reduceMotion]);

  return (
    <nav aria-label="Features" className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-2 px-2 text-[11px] font-medium tracking-[0.08em] text-[var(--workspace-shell-text-muted)] uppercase">
        Features
      </p>
      <ul
        ref={scrollerRef}
        data-test="feature-tour-pills"
        className="flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {FEATURE_TOUR_BLOCKS.map((block, index) => {
          const isActive = activeId === block.id;

          return (
            <li key={block.id} className="shrink-0 lg:shrink">
              <a
                ref={(node) => {
                  if (node) {
                    itemRefs.current.set(block.id, node);
                  } else {
                    itemRefs.current.delete(block.id);
                  }
                }}
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
  const [activeId, setActiveId] = useState(FEATURE_TOUR_BLOCKS[0]?.id ?? '');
  const activeIndex = Math.max(
    0,
    FEATURE_TOUR_BLOCKS.findIndex((block) => block.id === activeId),
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const index = scrollProgressToFeatureIndex(progress);
    const nextId = FEATURE_TOUR_BLOCKS[index]?.id;

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

    const index = FEATURE_TOUR_BLOCKS.findIndex((block) => block.id === hash);

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
          <div className="mb-4 lg:mb-0">
            <FeatureTourNav activeId={activeId} onNavigate={scrollToFeature} />
          </div>

          <FeatureTourSlidePanel
            activeId={activeId}
            activeIndex={activeIndex}
            scrollYProgress={scrollYProgress}
          />
        </div>
      </div>
    </div>
  );
}

function StackedFeatureTour() {
  const [activeId, setActiveId] = useState(FEATURE_TOUR_BLOCKS[0]?.id ?? '');

  useEffect(() => {
    const sections = FEATURE_TOUR_BLOCKS.map((block) =>
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
        {FEATURE_TOUR_BLOCKS.map((block) => (
          <article key={block.id} id={block.id} className="scroll-mt-28">
            <FeatureTourCard block={block} />
          </article>
        ))}
      </div>
    </div>
  );
}

export function FeatureTour() {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <StackedFeatureTour />;
  }

  return <ScrollPinnedFeatureTour />;
}
