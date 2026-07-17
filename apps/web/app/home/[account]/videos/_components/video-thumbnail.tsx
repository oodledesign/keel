'use client';

import { useState } from 'react';

import Image from 'next/image';

import { VIDEO_THUMB_PLACEHOLDER } from '~/lib/videos/thumbnail';

export function VideoThumbnail({
  candidates,
  alt,
  className,
}: {
  candidates: string[];
  alt: string;
  className?: string;
}) {
  const urls = candidates.length > 0 ? candidates : [VIDEO_THUMB_PLACEHOLDER];
  const [index, setIndex] = useState(0);
  const src = urls[Math.min(index, urls.length - 1)]!;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      className={className}
      onError={() => {
        setIndex((current) =>
          current < urls.length - 1 ? current + 1 : current,
        );
      }}
    />
  );
}
