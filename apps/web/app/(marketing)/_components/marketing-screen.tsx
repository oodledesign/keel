import type { CSSProperties } from 'react';

import Image from 'next/image';

import { cn } from '@kit/ui/utils';

import type { MarketingScreenData } from '~/lib/marketing/marketing-screen';

/**
 * Real product screenshot, cropped like photography: 10px radius, hairline
 * border, no window chrome. Numbered pins point at the parts that matter and
 * are captioned below as an ordered list.
 */
export function MarketingScreen({
  screen,
  tone = 'light',
  priority = false,
  sizes = '(min-width: 1024px) 50vw, 100vw',
  fill = false,
  hideCaptions = false,
  className,
  frameClassName,
}: {
  screen: MarketingScreenData;
  tone?: 'light' | 'dark';
  priority?: boolean;
  sizes?: string;
  /** From `lg` up, stretch the frame to its container height instead of using an aspect ratio. */
  fill?: boolean;
  hideCaptions?: boolean;
  className?: string;
  frameClassName?: string;
}) {
  const annotations = screen.annotations ?? [];
  const onDark = tone === 'dark';

  return (
    <figure className={cn('flex min-h-0 flex-col', className)}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[var(--ozer-radius-media)] border bg-[var(--ozer-cream-100)]',
          onDark
            ? 'border-[color:var(--ozer-border-on-dark-strong)]'
            : 'border-[color:var(--ozer-border-on-light)] dark:border-[color:var(--ozer-border-on-dark)]',
          '[container-type:size] aspect-[var(--marketing-screen-aspect)]',
          fill && 'lg:aspect-auto lg:min-h-0 lg:flex-1',
          frameClassName,
        )}
        style={
          {
            '--marketing-screen-aspect': `${screen.width} / ${screen.height}`,
          } as CSSProperties
        }
      >
        <Image
          src={screen.src}
          alt={screen.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover object-left-top"
        />
        {annotations.length > 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0"
            style={{
              width: `max(100cqw, calc(100cqh * ${screen.width} / ${screen.height}))`,
              aspectRatio: `${screen.width} / ${screen.height}`,
            }}
          >
            {annotations.map((annotation, index) => (
              <span
                key={annotation.label}
                className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ozer-plum-950)] text-[0.6875rem] font-semibold text-[var(--ozer-cream-50)] tabular-nums ring-2 ring-[var(--ozer-cream-50)]"
                style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {annotations.length > 0 && !hideCaptions ? (
        <figcaption className="mt-4 shrink-0">
          <MarketingScreenCaptions
            screen={screen}
            tone={tone}
            className="sm:grid-cols-3"
          />
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Numbered captions for a screen's pins, for layouts that place them apart from the image. */
export function MarketingScreenCaptions({
  screen,
  tone = 'light',
  className,
}: {
  screen: MarketingScreenData;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const onDark = tone === 'dark';

  return (
    <ol
      className={cn(
        'grid gap-x-6 gap-y-2 text-[0.8125rem] leading-snug',
        onDark
          ? 'text-[var(--ozer-text-on-dark-muted)]'
          : 'text-[var(--ozer-text-on-light-muted)] dark:text-[var(--ozer-text-on-dark-muted)]',
        className,
      )}
    >
      {(screen.annotations ?? []).map((annotation, index) => (
        <li key={annotation.label} className="flex gap-2.5">
          <span
            className={cn(
              'font-semibold tabular-nums',
              onDark
                ? 'text-[var(--ozer-text-on-dark)]'
                : 'text-[var(--ozer-plum-950)] dark:text-[var(--ozer-text-on-dark)]',
            )}
          >
            {index + 1}
          </span>
          {annotation.label}
        </li>
      ))}
    </ol>
  );
}
