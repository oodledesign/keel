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
  tone = 'auto',
}: KeelLogoMarkProps) {
  const lightClass =
    tone === 'dark'
      ? 'hidden'
      : tone === 'light'
        ? 'block'
        : 'dark:hidden';
  const darkClass =
    tone === 'light'
      ? 'hidden'
      : tone === 'dark'
        ? 'block'
        : 'hidden dark:block';

  if (collapsed) {
    return (
      <Image
        src={brandAssets.icon}
        alt=""
        width={791}
        height={633}
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
        'h-8 w-[100px] lg:h-9 lg:w-[120px]',
        className,
      )}
    >
      <Image
        src={brandAssets.wordmarkLight}
        alt=""
        width={1044}
        height={304}
        priority
        className={cn(
          'h-full w-auto max-w-full object-contain object-left',
          lightClass,
        )}
        aria-hidden
      />
      <Image
        src={brandAssets.wordmarkDark}
        alt=""
        width={1027}
        height={304}
        priority
        className={cn(
          'absolute inset-y-0 left-0 h-full w-auto max-w-full object-contain object-left',
          darkClass,
        )}
        aria-hidden
      />
    </span>
  );
}
