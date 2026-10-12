'use client';

import { useEffect, useRef, useState } from 'react';

import { AlertTriangle, Loader2 } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import type {
  BrochureDisplayOptions,
  BrochureOrientation,
  BrochurePage,
  BrochureRenderWarning,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';

import { BrochureLayoutThumb } from './brochure-layout-thumb';
import { WARNING_TEXT } from './brochure-preview-step';

type PdfJs = typeof import('pdfjs-dist');

let pdfJs: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfJs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
      { type: 'module' },
    );
    return lib;
  });
  return pdfJs;
}

type Status = 'loading' | 'ready' | 'left_out' | 'error';

export type BrochureLivePageDisplay = Pick<
  BrochureDisplayOptions,
  | 'showReducedPrice'
  | 'showWebsiteListingButton'
  | 'showSlideshowBrochureButton'
>;

const DEBOUNCE_MS = 500;

/**
 * The selected page as the real renderer draws it, refreshed shortly after
 * each edit. A skeleton of the layout stands in until the first render
 * arrives or if it fails.
 */
export function BrochureLivePage({
  listingId,
  accountId,
  templateId,
  orientation,
  pages,
  pageId,
  display,
}: {
  listingId: string;
  accountId: string;
  templateId: BrochureTemplateId;
  orientation: BrochureOrientation;
  pages: BrochurePage[];
  pageId: string;
  display: BrochureLivePageDisplay;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [renderedPageId, setRenderedPageId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<BrochureRenderWarning[]>([]);

  const {
    showReducedPrice,
    showWebsiteListingButton,
    showSlideshowBrochureButton,
  } = display;

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/listings/brochure-pdf/page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            listingId,
            accountId,
            templateId,
            orientation,
            pages,
            pageId,
            display: {
              showReducedPrice,
              showWebsiteListingButton,
              showSlideshowBrochureButton,
            },
          }),
        });
        if (res.status === 204) {
          setRenderedPageId(null);
          setWarnings([]);
          setStatus('left_out');
          return;
        }
        if (!res.ok) throw new Error(`Page render failed (${res.status})`);
        const header = res.headers.get('X-Brochure-Warnings');
        const bytes = new Uint8Array(await res.arrayBuffer());

        const lib = await loadPdfJs();
        const task = lib.getDocument({ data: bytes });
        try {
          const pdf = await task.promise;
          const pdfPage = await pdf.getPage(1);
          const base = pdfPage.getViewport({ scale: 1 });
          const cssWidth = frameRef.current?.clientWidth || base.width;
          const scale =
            (cssWidth * (window.devicePixelRatio || 1)) / base.width;
          const viewport = pdfPage.getViewport({ scale });
          const offscreen = document.createElement('canvas');
          offscreen.width = Math.ceil(viewport.width);
          offscreen.height = Math.ceil(viewport.height);
          await pdfPage.render({ canvas: offscreen, viewport }).promise;
          if (controller.signal.aborted) return;

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (!canvas || !ctx) return;
          canvas.width = offscreen.width;
          canvas.height = offscreen.height;
          ctx.drawImage(offscreen, 0, 0);
        } finally {
          void task.destroy();
        }

        setRenderedPageId(pageId);
        setWarnings(parseWarnings(header));
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[brochure-wizard] live page render failed', err);
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    listingId,
    accountId,
    templateId,
    orientation,
    pages,
    pageId,
    showReducedPrice,
    showWebsiteListingButton,
    showSlideshowBrochureButton,
  ]);

  const showingRender = renderedPageId === pageId && status !== 'left_out';
  const showSkeleton = !showingRender;
  const layoutId = pages.find((p) => p.id === pageId)?.layoutId;

  return (
    <div>
      <div ref={frameRef} className="relative">
        <canvas
          ref={canvasRef}
          aria-label="Page preview"
          className={cn(
            'w-full rounded-md border border-[var(--workspace-shell-border)] bg-white shadow-sm',
            showSkeleton && 'hidden',
          )}
        />
        {showSkeleton && layoutId ? (
          <BrochureLayoutThumb
            layoutId={layoutId}
            orientation={orientation}
            skeleton
            className={cn(
              'w-full rounded-md shadow-sm',
              status === 'loading' && 'motion-safe:animate-pulse',
            )}
          />
        ) : null}
        {showingRender && status === 'loading' ? (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[var(--workspace-shell-panel)] px-2 py-0.5 text-[11px] text-[var(--workspace-shell-text-muted)] shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--workspace-shell-text-muted)]">
        {status === 'left_out'
          ? 'This page has no photos, so it will be left out of the PDF.'
          : status === 'error'
            ? 'Preview unavailable. The next step still shows the PDF.'
            : showSkeleton
              ? 'Drawing the page…'
              : null}
      </p>
      {showingRender && warnings.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {[...new Set(warnings.map((w) => w.kind))].map((kind) => (
            <li
              key={kind}
              className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--workspace-shell-text)]"
            >
              <AlertTriangle className="h-3 w-3 text-[var(--ozer-accent)]" />
              {WARNING_TEXT[kind]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function parseWarnings(header: string | null): BrochureRenderWarning[] {
  if (!header) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(header));
    return Array.isArray(parsed) ? (parsed as BrochureRenderWarning[]) : [];
  } catch {
    return [];
  }
}
