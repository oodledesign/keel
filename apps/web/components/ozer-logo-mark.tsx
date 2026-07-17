'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';

import { useTheme } from 'next-themes';

import { cn } from '@kit/ui/utils';

import { brandAssets } from '~/config/brand.config';

export type OzerLogoMarkProps = {
  className?: string;
  /** Collapsed sidebar: show the flower icon mark. */
  collapsed?: boolean;
  /** Force light or dark wordmark instead of following theme. */
  tone?: 'light' | 'dark' | 'auto';
};

function resolveWordmark(
  tone: OzerLogoMarkProps['tone'],
  resolvedTheme?: string,
) {
  if (tone === 'light') {
    return brandAssets.wordmarkOnLight;
  }

  if (tone === 'dark') {
    return brandAssets.wordmarkOnDark;
  }

  return resolvedTheme === 'light'
    ? brandAssets.wordmarkOnLight
    : brandAssets.wordmarkOnDark;
}

export function OzerLogoMark({
  className,
  collapsed = false,
  tone = 'auto',
}: OzerLogoMarkProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const wordmarkSrc = resolveWordmark(tone, mounted ? resolvedTheme : 'dark');

  if (collapsed) {
    return (
      <Image
        src={brandAssets.icon}
        alt=""
        width={64}
        height={64}
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
        'h-9 w-[124px] lg:h-10 lg:w-[142px]',
        className,
      )}
    >
      <Image
        src={wordmarkSrc}
        alt="Ozer"
        width={200}
        height={48}
        priority
        className="h-full w-auto max-w-full object-contain object-left"
      />
    </span>
  );
}
