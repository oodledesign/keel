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

import { FeatureTourMock } from '~/(marketing)/_components/feature-tour-mocks';
import { MarketingScreen } from '~/(marketing)/_components/marketing-screen';
import {
  FEATURE_TOUR_BLOCKS,
  type FeatureTourBlock,
} from '~/lib/marketing/feature-tour-content';
import {
  marketingHeroEase,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

const SCROLL_VH_PER_FEATURE = 72;
const FEATURE_SWITCH_FADE_S = 0.32;

type FeatureBlock = FeatureTourBlock;

function formatIndex(value: number) {
  return String(value).padStart(2, '0');
}

function FeatureTourCard({
  block,
  index,
  blocks,
  scrollYProgress,
  activeIndex,
}: {
  block: FeatureBlock;
  index: number;
  blocks?: FeatureBlock[];
  scrollYProgress?: MotionValue<number>;
  activeIndex?: number;
}) {
  return (
    <div
      className="relative flex h-full flex-col overflow-x-hidden overflow-y-auto bg-[var(--ozer-cream-50)] lg:max-h-[calc(100vh-5.5rem)] lg:overflow-hidden dark:bg-[var(--ozer-plum-900)]"
      data-test="feature-tour-card"
    >
      {blocks != null && scrollYProgress != null && activeIndex != null ? (
        <FeatureStepProgress
          blocks={blocks}
          scrollYProgress={scrollYProgress}
          activeIndex={activeIndex}
        />
      ) : (
        <div className="marketing-rule border-t" aria-hidden="true" />
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-6 pt-6 lg:grid lg:grid-cols-[minmax(0,10fr)_minmax(0,14fr)] lg:items-stretch lg:gap-12 lg:pt-8">
        <div className="flex shrink-0 flex-col lg:min-h-0 lg:min-w-0">
          <p className="mb-4 text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)]">
            <span className="text-[var(--workspace-shell-text)] tabular-nums">
              {formatIndex(index + 1)}
            </span>
            <span aria-hidden="true"> / </span>
            {block.eyebrow}
          </p>
          <h3 className="font-heading mb-4 text-[1.75rem] leading-[1.08] font-medium tracking-[-0.015em] text-balance text-[var(--workspace-shell-text)] md:text-[2.125rem] xl:text-[2.5rem]">
            {block.title}
          </h3>
          <p className="mb-2 text-[0.9375rem] leading-relaxed text-[var(--workspace-shell-text)] md:text-base">
            {block.moment}
          </p>
          <p
            className={`mb-5 text-[0.9375rem] leading-relaxed md:text-base ${marketingMutedText}`}
          >
            {block.desc}
          </p>

          <ul
            className="marketing-rule shrink-0 border-b text-sm leading-snug text-[var(--workspace-shell-text)]"
            aria-label={`${block.eyebrow} includes`}
          >
            {block.highlights.map((highlight) => (
              <li key={highlight} className="marketing-rule border-t py-2.5">
                {highlight}
              </li>
            ))}
          </ul>

          {block.soon ? (
            <p className="mt-4 text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)]">
              {block.soonLabel ?? 'Coming soon'}
            </p>
          ) : null}
        </div>

        {block.screen ? (
          <MarketingScreen
            screen={block.screen}
            fill
            className="w-full shrink-0 lg:h-full lg:min-h-0 lg:shrink"
          />
        ) : (
          <FeatureTourMock
            type={block.mock}
            accent={block.accent}
            className="h-36 max-h-36 w-full shrink-0 sm:h-44 sm:max-h-44 md:h-52 md:max-h-52 lg:h-full lg:max-h-none lg:min-h-0 lg:shrink"
          />
        )}
      </div>
    </div>
  );
}

function featureStepBounds(activeIndex: number, count: number) {
  if (count <= 1) {
    return { start: 0, end: 1 };
  }

  const start = activeIndex === 0 ? 0 : (activeIndex - 0.5) / (count - 1);
  const end = activeIndex === count - 1 ? 1 : (activeIndex + 0.5) / (count - 1);

  return { start, end };
}

function FeatureStepProgress({
  blocks,
  scrollYProgress,
  activeIndex,
}: {
  blocks: FeatureBlock[];
  scrollYProgress: MotionValue<number>;
  activeIndex: number;
}) {
  const count = blocks.length;
  const { start, end } = featureStepBounds(activeIndex, count);
  const scaleX = useTransform(scrollYProgress, (progress) => {
    const range = Math.max(end - start, 0.0001);

    return Math.min(1, Math.max(0, (progress - start) / range));
  });

  const isLast = activeIndex >= count - 1;
  const nextLabel = isLast ? null : blocks[activeIndex + 1]?.eyebrow;

  return (
    <div className="shrink-0">
      <div
        className="marketing-rule h-px overflow-hidden bg-[var(--ozer-plum-alpha-12)] dark:bg-[var(--ozer-border-on-dark)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(((activeIndex + 1) / count) * 100)}
        aria-label={
          nextLabel
            ? `Scroll progress to ${nextLabel}`
            : 'Scroll progress through features'
        }
      >
        <motion.div
          className="h-full origin-left bg-[var(--workspace-shell-text)]"
          style={{ scaleX }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-[0.8125rem] font-medium text-[var(--workspace-shell-text-muted)] tabular-nums">
        <span>
          <span className="text-[var(--workspace-shell-text)]">
            {formatIndex(activeIndex + 1)}
          </span>{' '}
          / {formatIndex(count)}
        </span>
        {nextLabel ? <span>Next: {nextLabel}</span> : <span>End</span>}
      </div>
    </div>
  );
}

function FeatureTourSlidePanel({
  blocks,
  activeId,
  activeIndex,
  scrollYProgress,
}: {
  blocks: FeatureBlock[];
  activeId: string;
  activeIndex: number;
  scrollYProgress: MotionValue<number>;
}) {
  const activeBlock =
    blocks.find((block) => block.id === activeId) ?? blocks[0];

  if (!activeBlock) {
    return null;
  }

  return (
    <div className="relative h-[calc(100dvh-10.5rem)] lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)] lg:min-h-[calc(100vh-7rem)]">
      {/* 10.5rem = sticky header (top-20) + Features pills + mb-4 */}
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
            index={activeIndex}
            blocks={blocks}
            scrollYProgress={scrollYProgress}
            activeIndex={activeIndex}
          />
        </motion.article>
      </AnimatePresence>
    </div>
  );
}

function scrollProgressToFeatureIndex(progress: number, count: number) {
  if (count <= 1) {
    return 0;
  }

  const index = Math.round(progress * (count - 1));

  return Math.min(count - 1, Math.max(0, index));
}

function featureIndexToScrollProgress(index: number, count: number) {
  if (count <= 1) {
    return 0;
  }

  return index / (count - 1);
}

function FeatureTourNav({
  blocks,
  activeId,
  onNavigate,
}: {
  blocks: FeatureBlock[];
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
      <ul
        ref={scrollerRef}
        data-test="feature-tour-pills"
        className="flex flex-nowrap gap-5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {blocks.map((block, index) => {
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
                aria-current={isActive ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onNavigate(block.id, index);
                }}
                className={cn(
                  'flex items-baseline gap-3 py-2 text-left text-sm transition-colors duration-200 lg:border-t lg:py-2.5',
                  'marketing-rule',
                  isActive
                    ? 'font-medium text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                <span
                  className={cn(
                    'text-[0.75rem] tabular-nums',
                    isActive && 'text-[var(--ozer-accent)]',
                  )}
                >
                  {formatIndex(index + 1)}
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

function ScrollPinnedFeatureTour({ blocks }: { blocks: FeatureBlock[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(blocks[0]?.id ?? '');
  const activeIndex = Math.max(
    0,
    blocks.findIndex((block) => block.id === activeId),
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    const index = scrollProgressToFeatureIndex(progress, blocks.length);
    const nextId = blocks[index]?.id;

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
    const progress = featureIndexToScrollProgress(index, blocks.length);
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

    const index = blocks.findIndex((block) => block.id === hash);

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
      style={{ height: `${blocks.length * SCROLL_VH_PER_FEATURE}vh` }}
    >
      <div className="sticky top-20 lg:top-24">
        <div className="lg:grid lg:grid-cols-[11.5rem_minmax(0,1fr)] lg:gap-x-10 xl:grid-cols-[12.5rem_minmax(0,1fr)] xl:gap-x-12">
          <div className="mb-4 lg:mb-0">
            <FeatureTourNav
              blocks={blocks}
              activeId={activeId}
              onNavigate={scrollToFeature}
            />
          </div>

          <FeatureTourSlidePanel
            blocks={blocks}
            activeId={activeId}
            activeIndex={activeIndex}
            scrollYProgress={scrollYProgress}
          />
        </div>
      </div>
    </div>
  );
}

function StackedFeatureTour({ blocks }: { blocks: FeatureBlock[] }) {
  const [activeId, setActiveId] = useState(blocks[0]?.id ?? '');

  useEffect(() => {
    const sections = blocks
      .map((block) => document.getElementById(block.id))
      .filter((element): element is HTMLElement => Boolean(element));

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
  }, [blocks]);

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
          blocks={blocks}
          activeId={activeId}
          onNavigate={(id) => scrollToFeature(id)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6 md:gap-8">
        {blocks.map((block, index) => (
          <article key={block.id} id={block.id} className="scroll-mt-28">
            <FeatureTourCard block={block} index={index} />
          </article>
        ))}
      </div>
    </div>
  );
}

export function FeatureTour({
  blocks = FEATURE_TOUR_BLOCKS,
}: {
  blocks?: FeatureTourBlock[];
}) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <StackedFeatureTour blocks={blocks} />;
  }

  return <ScrollPinnedFeatureTour blocks={blocks} />;
}
