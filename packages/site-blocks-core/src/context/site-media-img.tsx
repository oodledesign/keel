'use client';

import { type ImgHTMLAttributes, useEffect, useMemo, useState } from 'react';

/**
 * Normalize legacy authenticated Supabase storage paths to public URLs.
 * Mirrors apps/web `toSupabasePublicStorageUrl` without coupling packages.
 */
export function normalizeSiteMediaUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  return trimmed.replace(
    /\/storage\/v1\/object\/(?!public\/)([a-z0-9_-]+)\//i,
    '/storage/v1/object/public/$1/',
  );
}

type SiteMediaImgProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'onError'
> & {
  src?: string | null;
  fallbackClassName?: string;
};

/**
 * Robust site image: normalizes storage URLs and shows a quiet fallback on error.
 */
export function SiteMediaImg({
  src,
  alt = '',
  className,
  fallbackClassName,
  ...rest
}: SiteMediaImgProps) {
  const normalized = useMemo(() => normalizeSiteMediaUrl(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalized]);

  if (!normalized || failed) {
    return (
      <div
        role="img"
        aria-label={alt || 'Missing image'}
        className={
          fallbackClassName ??
          className ??
          'flex aspect-video items-center justify-center bg-[var(--sb-atmosphere,#e8e6e1)] text-xs text-[var(--sb-ink-muted,#6b6862)]'
        }
      >
        {alt ? alt : 'Image unavailable'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote site media in Puck iframe
    <img
      {...rest}
      src={normalized}
      alt={alt}
      className={className}
      loading={rest.loading ?? 'lazy'}
      decoding={rest.decoding ?? 'async'}
      referrerPolicy={rest.referrerPolicy ?? 'no-referrer'}
      onError={() => setFailed(true)}
    />
  );
}
