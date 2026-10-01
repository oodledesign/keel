'use client';

import { useState } from 'react';

import { ImageIcon } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  COVER_FRAME,
  type CoverFocus,
  coverPlacement,
} from '~/lib/building-surveyor/survey-cover';
import { workspaceTextMuted } from '~/lib/workspace-ui';

export type CoverImageSize = { width: number; height: number };

/**
 * Miniature of the report's cover photo frame. It uses the same placement
 * maths as the PDF, so what you see here is what prints.
 */
export function SurveyCoverFrame({
  src,
  alt,
  focus,
  className,
  onImageSize,
}: {
  src: string | null;
  alt: string;
  focus: CoverFocus;
  className?: string;
  onImageSize?: (size: CoverImageSize) => void;
}) {
  const [size, setSize] = useState<CoverImageSize | null>(null);
  const placement = size ? coverPlacement(size, focus) : null;

  return (
    <div
      className={cn(
        'bg-muted/40 relative flex items-center justify-center overflow-hidden rounded-lg border',
        className,
      )}
      style={{ aspectRatio: `${COVER_FRAME.width} / ${COVER_FRAME.height}` }}
      data-test="survey-cover-frame"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (!naturalWidth || !naturalHeight) return;
            const next = { width: naturalWidth, height: naturalHeight };
            setSize(next);
            onImageSize?.(next);
          }}
          className={
            placement ? 'absolute max-w-none' : 'h-full w-full object-cover'
          }
          style={
            placement
              ? {
                  left: `${(placement.offsetX / COVER_FRAME.width) * 100}%`,
                  top: `${(placement.offsetY / COVER_FRAME.height) * 100}%`,
                  width: `${(placement.width / COVER_FRAME.width) * 100}%`,
                  height: `${(placement.height / COVER_FRAME.height) * 100}%`,
                }
              : undefined
          }
        />
      ) : (
        <ImageIcon className={`h-5 w-5 ${workspaceTextMuted}`} aria-hidden />
      )}
    </div>
  );
}
