'use client';

import type { ReactNode } from 'react';

import { cn } from './lib/cn';
import { useWireframeMode } from './context/wireframe-mode';

export function SectionShell({
  children,
  className,
  tone = 'canvas',
  wireframe,
}: {
  children: ReactNode;
  className?: string;
  tone?: 'canvas' | 'surface' | 'atmosphere' | 'ink';
  wireframe?: boolean;
}) {
  const isWire = useWireframeMode(wireframe);
  const toneClass =
    tone === 'surface'
      ? 'bg-[var(--sb-surface)]'
      : tone === 'atmosphere'
        ? 'bg-[var(--sb-atmosphere)]'
        : tone === 'ink'
          ? 'bg-[var(--sb-ink)] text-[var(--sb-accent-contrast)]'
          : 'bg-[var(--sb-canvas)]';

  return (
    <section
      className={cn(
        'sb-section w-full px-[var(--sb-space-6)] py-[var(--sb-space-12)]',
        toneClass,
        isWire && 'sb-wireframe',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[var(--sb-max)]">{children}</div>
    </section>
  );
}

export function MediaPlaceholder({
  label = 'Image',
  className,
  aspect = 'landscape',
}: {
  label?: string;
  className?: string;
  aspect?: 'landscape' | 'portrait' | 'square' | 'wide';
}) {
  const aspectClass =
    aspect === 'portrait'
      ? 'aspect-[3/4]'
      : aspect === 'square'
        ? 'aspect-square'
        : aspect === 'wide'
          ? 'aspect-[21/9]'
          : 'aspect-[4/3]';

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-[var(--sb-radius-md)] border border-dashed border-[var(--sb-wire)] bg-[var(--sb-atmosphere)] text-xs font-medium tracking-wide text-[var(--sb-ink-muted)] uppercase',
        aspectClass,
        className,
      )}
      aria-hidden
    >
      {label}
    </div>
  );
}

export function OutlineText({
  children,
  className,
  as: Tag = 'p',
}: {
  children?: ReactNode;
  className?: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'li';
}) {
  if (!children) return null;
  return <Tag className={className}>{children}</Tag>;
}

export function CtaButton({
  label,
  variant = 'primary',
  className,
}: {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 text-sm font-medium',
        'rounded-[var(--sb-button-radius)]',
        variant === 'primary' &&
          'bg-[var(--sb-color-primary)] text-[var(--sb-color-primary-contrast)]',
        variant === 'secondary' &&
          'border border-[var(--sb-border)] bg-[var(--sb-surface)] text-[var(--sb-ink)]',
        variant === 'ghost' && 'text-[var(--sb-ink)] underline-offset-4',
        className,
      )}
    >
      {label || 'Button'}
    </span>
  );
}

export function ItemCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--sb-radius-md)] border border-[var(--sb-border)] bg-[var(--sb-surface)] p-[var(--sb-space-4)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
