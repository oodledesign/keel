'use client';

import { useEffect, type RefObject } from 'react';

function fieldScrollsInternally(element: HTMLElement, deltaY: number): boolean {
  if (element.scrollHeight <= element.clientHeight + 1) {
    return false;
  }

  if (deltaY < 0) {
    return element.scrollTop > 0;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  return false;
}

function isVerticallyScrollable(element: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(element);

  return (
    (overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay') &&
    element.scrollHeight > element.clientHeight + 1
  );
}

/** Forward wheel deltas to the nearest scrollable ancestor when a field cannot scroll. */
export function scrollWheelDeltaToScrollParent(
  from: HTMLElement,
  event: WheelEvent,
): boolean {
  if (fieldScrollsInternally(from, event.deltaY)) {
    return false;
  }

  let parent: HTMLElement | null = from.parentElement;

  while (parent) {
    if (isVerticallyScrollable(parent)) {
      parent.scrollTop += event.deltaY;
      event.preventDefault();
      return true;
    }

    parent = parent.parentElement;
  }

  const scrollingElement = document.scrollingElement;

  if (
    scrollingElement instanceof HTMLElement &&
    scrollingElement.scrollHeight > scrollingElement.clientHeight + 1
  ) {
    scrollingElement.scrollTop += event.deltaY;
    event.preventDefault();
    return true;
  }

  return false;
}

export function bindWheelScrollPassthrough(element: HTMLElement) {
  const onWheel = (event: WheelEvent) => {
    if (event.target !== element) {
      return;
    }

    scrollWheelDeltaToScrollParent(element, event);
  };

  element.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    element.removeEventListener('wheel', onWheel);
  };
}

export function bindTouchScrollPassthrough(element: HTMLElement) {
  let lastTouchY: number | null = null;

  const onTouchStart = (event: TouchEvent) => {
    lastTouchY = event.touches[0]?.clientY ?? null;
  };

  const onTouchMove = (event: TouchEvent) => {
    const touchY = event.touches[0]?.clientY;

    if (touchY == null || lastTouchY == null) {
      return;
    }

    const deltaY = lastTouchY - touchY;
    lastTouchY = touchY;

    if (fieldScrollsInternally(element, deltaY)) {
      return;
    }

    let parent: HTMLElement | null = element.parentElement;

    while (parent) {
      if (isVerticallyScrollable(parent)) {
        parent.scrollTop += deltaY;
        event.preventDefault();
        return;
      }

      parent = parent.parentElement;
    }

    const scrollingElement = document.scrollingElement;

    if (
      scrollingElement instanceof HTMLElement &&
      scrollingElement.scrollHeight > scrollingElement.clientHeight + 1
    ) {
      scrollingElement.scrollTop += deltaY;
      event.preventDefault();
    }
  };

  const onTouchEnd = () => {
    lastTouchY = null;
  };

  element.addEventListener('touchstart', onTouchStart, { passive: true });
  element.addEventListener('touchmove', onTouchMove, { passive: false });
  element.addEventListener('touchend', onTouchEnd, { passive: true });
  element.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchmove', onTouchMove);
    element.removeEventListener('touchend', onTouchEnd);
    element.removeEventListener('touchcancel', onTouchEnd);
  };
}

export function bindFormFieldScrollPassthrough(element: HTMLElement) {
  const cleanupWheel = bindWheelScrollPassthrough(element);
  const cleanupTouch = bindTouchScrollPassthrough(element);

  return () => {
    cleanupWheel();
    cleanupTouch();
  };
}

export function useFormFieldScrollPassthrough<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    return bindFormFieldScrollPassthrough(node);
  }, [ref, ...deps]);
}

export function useFormFieldScrollPassthroughRefs<T extends HTMLElement>(
  getNodes: () => Array<T | null | undefined>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const nodes = getNodes().filter((node): node is T => node != null);
    const cleanups = nodes.map((node) => bindFormFieldScrollPassthrough(node));

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, deps);
}
