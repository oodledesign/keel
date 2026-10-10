'use client';

import { useState } from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
} from 'lucide-react';

import { Button } from '@kit/ui/button';

import type {
  BrochurePage,
  BrochureRenderWarningKind,
} from '~/lib/commercial/brochure-pdf/brochure-document';

import { brochureLayoutLabel } from './brochure-preview-page';
import type { BrochurePreviewResult } from './brochure-wizard';

const WARNING_TEXT: Record<BrochureRenderWarningKind, string> = {
  small_image: 'An image is low resolution and may look blurry when printed.',
  missing_image: 'An image space is empty.',
  text_cut: "Some text didn't fit and was cut short.",
  empty_page: 'This page has nothing on it, so it was left out of the PDF.',
};

export function BrochurePreviewStep({
  preview,
  loading,
  error,
  pages,
  onRetry,
  onFixPage,
  onBack,
  onNext,
}: {
  preview: BrochurePreviewResult | null;
  loading: boolean;
  error: string | null;
  pages: BrochurePage[];
  onRetry: () => void;
  onFixPage: (pageId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [pageNumber, setPageNumber] = useState(1);

  if (loading || (!preview && !error)) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--workspace-shell-text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Building the PDF…
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[var(--workspace-shell-text-muted)]">
        <p>{error}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to pages
          </Button>
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const total = preview.pageIds.length;
  const current = Math.min(Math.max(pageNumber, 1), Math.max(total, 1));
  const currentPageId = preview.pageIds[current - 1];
  const currentPage = pages.find((p) => p.id === currentPageId);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem]">
      <main className="flex min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--workspace-shell-border)] px-5 py-2.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => setPageNumber(current - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-xs text-[var(--workspace-shell-text)]">
            Page {current} of {total}
            {currentPage ? (
              <span className="text-[var(--workspace-shell-text-muted)]">
                {' '}
                · {brochureLayoutLabel(currentPage.layoutId)}
              </span>
            ) : null}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Next page"
            disabled={current >= total}
            onClick={() => setPageNumber(current + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {currentPageId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onFixPage(currentPageId)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Fix this page
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 bg-[var(--ozer-surface-panel-hover)] p-4">
          <iframe
            key={`${preview.url}-${current}`}
            title="Brochure PDF preview"
            src={`${preview.url}#page=${current}&view=Fit`}
            className="h-full w-full rounded-md border border-[var(--workspace-shell-border)] bg-white"
          />
        </div>
      </main>

      <aside className="flex min-h-0 flex-col border-l border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Checks
          </h3>
          {preview.warnings.length === 0 ? (
            <p className="flex gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--ozer-success)]" />
              No problems found. Still look through every page before you
              approve it.
            </p>
          ) : (
            <ul className="space-y-2">
              {preview.warnings.map((warning, index) => {
                const renderedAt = preview.pageIds.indexOf(warning.pageId) + 1;
                return (
                  <li
                    key={`${warning.pageId}-${warning.kind}-${index}`}
                    className="rounded-md border border-[var(--workspace-shell-border)] p-2.5"
                  >
                    <p className="flex gap-2 text-xs text-[var(--workspace-shell-text)]">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--ozer-accent)]" />
                      <span>
                        <span className="font-medium">
                          Page {warning.pageNumber}:
                        </span>{' '}
                        {WARNING_TEXT[warning.kind]}
                      </span>
                    </p>
                    <div className="mt-2 flex gap-2 pl-5">
                      {renderedAt > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPageNumber(renderedAt)}
                        >
                          Show
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => onFixPage(warning.pageId)}
                      >
                        Fix
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 justify-between gap-2 border-t border-[var(--workspace-shell-border)] p-4">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Pages
          </Button>
          <Button type="button" className="gap-1.5" onClick={onNext}>
            Approve
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </aside>
    </div>
  );
}
