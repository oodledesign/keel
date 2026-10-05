'use client';

import { cn } from '@kit/ui/utils';

import {
  type ContentPlatform,
  type ContentStatus,
  contentPlatform,
  contentStatus,
} from '~/lib/projects/content/content-calendar';

export function PlatformDot({
  platform,
  className,
}: {
  platform: ContentPlatform;
  className?: string;
}) {
  const info = contentPlatform(platform);
  if (!info) return null;
  return (
    <span
      title={info.label}
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] leading-none font-bold text-white',
        className,
      )}
      style={{ backgroundColor: info.color }}
    >
      {info.short}
    </span>
  );
}

export function PlatformDots({
  platforms,
  max = 4,
}: {
  platforms: ContentPlatform[];
  max?: number;
}) {
  if (platforms.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {platforms.slice(0, max).map((platform) => (
        <PlatformDot key={platform} platform={platform} />
      ))}
      {platforms.length > max ? (
        <span className="text-[9px] text-[var(--workspace-shell-text-muted)]">
          +{platforms.length - max}
        </span>
      ) : null}
    </span>
  );
}

export function StatusPill({
  status,
  className,
}: {
  status: ContentStatus;
  className?: string;
}) {
  const info = contentStatus(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
        className,
      )}
      style={{ backgroundColor: info.bg, color: info.fg }}
    >
      {info.label}
    </span>
  );
}

export function statusDotColor(status: ContentStatus) {
  return contentStatus(status).fg;
}
