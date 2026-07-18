import { type RefObject, useEffect } from 'react';

const AUTOPLAY_MS_DEFAULT = 3200;

function sanitizeTiltDegrees(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return '0deg';
  }
  return `${trimmed}deg`;
}

type UseYbbPortfolioCarouselOptions = {
  slideCount: number;
  autoplay: boolean;
  autoplayMs: number;
};

export function useYbbPortfolioCarousel(
  stageRef: RefObject<HTMLElement | null>,
  options: UseYbbPortfolioCarouselOptions,
) {
  const { slideCount, autoplay, autoplayMs } = options;

  useEffect(() => {
    const root = stageRef.current;
    if (!root || slideCount === 0) {
      return;
    }

    const stage = root;

    const track = stage.querySelector<HTMLElement>(
      '[data-ybb-portfolio-track]',
    );
    const viewport = stage.querySelector<HTMLElement>('.ybbPortfolioViewport');
    const allSlides = [
      ...stage.querySelectorAll<HTMLElement>('[data-ybb-portfolio-slide]'),
    ];
    const prev = stage.querySelector<HTMLButtonElement>(
      '[data-ybb-portfolio-prev]',
    );
    const next = stage.querySelector<HTMLButtonElement>(
      '[data-ybb-portfolio-next]',
    );
    const section = stage.closest('.ybbPortfolio') ?? stage.parentElement;
    const dots = [
      ...(section?.querySelectorAll<HTMLButtonElement>(
        '[data-ybb-portfolio-dot]',
      ) ?? []),
    ];
    const count = slideCount;

    if (!track || !viewport || count === 0 || allSlides.length === 0) {
      return;
    }

    let index = count;
    let autoplayId = 0;
    let hovered = false;
    let inView = true;
    let pointerId: number | null = null;
    let startX = 0;
    let dragOffset = 0;
    let dragging = false;
    let resizeTimer = 0;

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const intervalMs = autoplayMs > 500 ? autoplayMs : AUTOPLAY_MS_DEFAULT;

    function logicalIndex(i: number) {
      return ((i % count) + count) % count;
    }

    function gap() {
      const styles = getComputedStyle(track!);
      return parseFloat(styles.columnGap || styles.gap) || 0;
    }

    function slideStep() {
      const slide = allSlides[0];
      return slide ? slide.offsetWidth + gap() : 0;
    }

    function offsetFor(i: number) {
      const slide = allSlides[i];
      if (!slide) {
        return 0;
      }
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const viewportCenter = viewport!.clientWidth / 2;
      return viewportCenter - slideCenter;
    }

    function setTransform(i: number, immediate = false) {
      const x = offsetFor(i) + dragOffset;
      track!.style.transition =
        immediate || reduced
          ? 'none'
          : 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)';
      track!.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    function updateUi() {
      const logical = logicalIndex(index);
      stage.dataset.ybbPortfolioIndex = String(logical);
      allSlides.forEach((slide) => {
        const i = Number(slide.dataset.ybbPortfolioIndex);
        const clone = Number(slide.dataset.ybbPortfolioClone);
        const physical = clone * count + i;
        const isCurrent = physical === index;
        const isNeighbor = Math.abs(physical - index) === 1;
        slide.classList.toggle('is-active', isCurrent);
        slide.classList.toggle('is-near', !isCurrent && isNeighbor);
        slide.setAttribute('aria-hidden', isCurrent ? 'false' : 'true');
      });
      dots.forEach((dot, i) => {
        const active = i === logical;
        dot.classList.toggle('ybbPortfolioDotActive', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function normalizeLoop() {
      if (index < count) {
        index += count;
        setTransform(index, true);
        void track!.offsetWidth;
      } else if (index >= count * 2) {
        index -= count;
        setTransform(index, true);
        void track!.offsetWidth;
      }
    }

    function goTo(nextIndex: number, immediate = false) {
      index = nextIndex;
      setTransform(index, immediate);
      updateUi();
      if (immediate || reduced) {
        normalizeLoop();
        void track!.offsetWidth;
      }
    }

    function step(delta: number) {
      goTo(index + delta);
      restartAutoplay();
    }

    function canAutoplay() {
      return (
        autoplay &&
        !reduced &&
        !hovered &&
        !dragging &&
        inView &&
        !document.hidden
      );
    }

    function startAutoplay() {
      stopAutoplay();
      if (!canAutoplay()) {
        return;
      }
      autoplayId = window.setInterval(() => {
        if (canAutoplay()) {
          goTo(index + 1);
        }
      }, intervalMs);
    }

    function stopAutoplay() {
      if (autoplayId) {
        window.clearInterval(autoplayId);
        autoplayId = 0;
      }
    }

    function restartAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== track || event.propertyName !== 'transform') {
        return;
      }
      normalizeLoop();
    };

    const onPrevClick = () => step(-1);
    const onNextClick = () => step(1);

    const dotHandlers = dots.map((dot) => () => {
      const logical = Number(dot.dataset.ybbPortfolioDot);
      if (Number.isNaN(logical)) {
        return;
      }
      goTo(count + logical);
      restartAutoplay();
    });

    const onMouseEnter = () => {
      hovered = true;
      stopAutoplay();
    };
    const onMouseLeave = () => {
      hovered = false;
      startAutoplay();
    };
    const onFocusIn = () => {
      hovered = true;
      stopAutoplay();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (stage.contains(event.relatedTarget as Node | null)) {
        return;
      }
      hovered = false;
      startAutoplay();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      pointerId = event.pointerId;
      startX = event.clientX;
      dragOffset = 0;
      dragging = true;
      track!.style.transition = 'none';
      viewport.setPointerCapture(pointerId);
      viewport.classList.add('is-dragging');
      stopAutoplay();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }
      dragOffset = event.clientX - startX;
      setTransform(index, true);
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }
      dragging = false;
      viewport.classList.remove('is-dragging');
      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      pointerId = null;

      const threshold = Math.min(50, slideStep() * 0.18);
      const dx = dragOffset;
      dragOffset = 0;

      if (Math.abs(dx) > threshold) {
        goTo(index + (dx < 0 ? 1 : -1));
      } else {
        goTo(index);
      }
      startAutoplay();
    };

    const onDragStart = (event: Event) => event.preventDefault();

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => goTo(index, true), 100);
    };

    track.addEventListener('transitionend', onTransitionEnd);
    prev?.addEventListener('click', onPrevClick);
    next?.addEventListener('click', onNextClick);
    dots.forEach((dot, i) => dot.addEventListener('click', dotHandlers[i]!));
    stage.addEventListener('mouseenter', onMouseEnter);
    stage.addEventListener('mouseleave', onMouseLeave);
    stage.addEventListener('focusin', onFocusIn);
    stage.addEventListener('focusout', onFocusOut);
    viewport.tabIndex = 0;
    viewport.addEventListener('keydown', onKeyDown);
    viewport.addEventListener('pointerdown', onPointerDown);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('dragstart', onDragStart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('resize', onResize);

    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry) {
            return;
          }
          inView = entry.isIntersecting;
          if (inView) {
            startAutoplay();
          } else {
            stopAutoplay();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(stage);
    }

    goTo(count, true);
    startAutoplay();

    return () => {
      stopAutoplay();
      window.clearTimeout(resizeTimer);
      track.removeEventListener('transitionend', onTransitionEnd);
      prev?.removeEventListener('click', onPrevClick);
      next?.removeEventListener('click', onNextClick);
      dots.forEach((dot, i) =>
        dot.removeEventListener('click', dotHandlers[i]!),
      );
      stage.removeEventListener('mouseenter', onMouseEnter);
      stage.removeEventListener('mouseleave', onMouseLeave);
      stage.removeEventListener('focusin', onFocusIn);
      stage.removeEventListener('focusout', onFocusOut);
      viewport.removeEventListener('keydown', onKeyDown);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      io?.disconnect();
    };
  }, [stageRef, slideCount, autoplay, autoplayMs]);
}

export { sanitizeTiltDegrees };
