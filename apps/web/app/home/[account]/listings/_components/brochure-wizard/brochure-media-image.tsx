'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { FileText } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { loadPdfJs } from './brochure-pdfjs';

const PDF_THUMB_WIDTH = 480;

/** First-page renders by file path; the signed query string changes on refresh. */
const pdfThumbs = new Map<string, Promise<string>>();

function filePath(url: string): string {
  return url.split('?')[0] ?? url;
}

function pdfFirstPage(url: string): Promise<string> {
  const key = filePath(url);
  const cached = pdfThumbs.get(key);
  if (cached) return cached;
  const thumb = (async () => {
    const lib = await loadPdfJs();
    const task = lib.getDocument({ url });
    try {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: PDF_THUMB_WIDTH / base.width,
      });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
      void task.destroy();
    }
  })();
  pdfThumbs.set(key, thumb);
  thumb.catch(() => pdfThumbs.delete(key));
  return thumb;
}

/** A listing image, or the first page of a listing PDF drawn in the browser. */
export function BrochureMediaImage({
  src,
  isPdf,
  className,
  style,
  onError,
}: {
  src: string;
  isPdf?: boolean;
  className?: string;
  style?: CSSProperties;
  onError?: () => void;
}) {
  const path = filePath(src);
  const [thumb, setThumb] = useState<{ path: string; url: string } | null>(
    null,
  );
  const [failed, setFailed] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    pdfFirstPage(src).then(
      (url) => {
        if (!cancelled) setThumb({ path: filePath(src), url });
      },
      (err: unknown) => {
        if (cancelled) return;
        console.error('[brochure-wizard] PDF thumbnail failed', err);
        setFailed(filePath(src));
        onErrorRef.current?.();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isPdf, src]);

  if (!isPdf) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={onError}
        className={className}
        style={style}
      />
    );
  }

  if (thumb?.path === path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumb.url} alt="" className={className} style={style} />
    );
  }

  return (
    <span
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 text-[10px] text-[var(--workspace-shell-text-muted)]',
        failed !== path && 'motion-safe:animate-pulse',
        className,
      )}
    >
      <FileText className="h-4 w-4" />
      PDF
    </span>
  );
}
