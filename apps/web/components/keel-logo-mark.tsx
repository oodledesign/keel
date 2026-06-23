import Image from 'next/image';

import { cn } from '@kit/ui/utils';

import { brandAssets } from '~/config/brand.config';

type KeelLogoMarkProps = {
  className?: string;
  /** Collapsed sidebar: show the icon mark. */
  collapsed?: boolean;
  /** Force light or dark wordmark instead of theme classes. */
  tone?: 'light' | 'dark' | 'auto';
};

export function KeelLogoMark({
  className,
  collapsed = false,
  tone: _tone = 'auto',
}: KeelLogoMarkProps) {
  if (collapsed) {
    return (
      <Image
        src={brandAssets.icon}
        alt=""
        width={380}
        height={380}
        priority
        className={cn('h-8 w-8 shrink-0 object-contain', className)}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center overflow-hidden',
        'h-8 w-[112px] lg:h-9 lg:w-[128px]',
        className,
      )}
    >
      <Image
        src={brandAssets.wordmarkLight}
        alt="Ozer"
        width={1024}
        height={285}
        priority
        className="h-full w-auto max-w-full object-contain object-left"
      />
    </span>
  );
}
