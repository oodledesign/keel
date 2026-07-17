'use client';

import { cn } from '@kit/ui/utils';

import { resolveActivityAppIcon } from '~/lib/activity/activity-app-icons';
import type { ActivityBlockListRow } from '~/lib/activity/activity-history';

type ActivityAppIconProps = {
  block: Pick<ActivityBlockListRow, 'appName' | 'bundleId' | 'domain'>;
  size?: 'sm' | 'md';
  className?: string;
};

export function ActivityAppIcon({
  block,
  size = 'sm',
  className,
}: ActivityAppIconProps) {
  const icon = resolveActivityAppIcon(block);
  const dimension = size === 'md' ? 24 : 18;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md',
        className,
      )}
      style={{
        width: dimension,
        height: dimension,
        backgroundColor: icon.background,
      }}
      aria-hidden
    >
      {icon.src ? (
        <img
          src={icon.src}
          alt=""
          width={dimension}
          height={dimension}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className="text-[9px] leading-none font-semibold text-white"
          style={{ fontSize: size === 'md' ? 10 : 9 }}
        >
          {icon.fallback}
        </span>
      )}
    </span>
  );
}
