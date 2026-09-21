'use client';

import { useState } from 'react';

import { cn } from '@kit/ui/utils';

export function ListingCoverImage({
  src,
  className,
  eager = false,
}: {
  src: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 animate-pulse bg-[var(--workspace-shell-sidebar-accent)] transition-opacity duration-300',
          loaded ? 'opacity-0' : 'opacity-100',
        )}
      />
      {/* Signed storage URLs are not in next/image remotePatterns. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          'transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
      />
    </>
  );
}
