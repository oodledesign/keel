'use client';

import { Undo2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { WebsiteSitemapPage } from '~/lib/websites/planning-types';
import type { SitemapProposeMode } from '~/lib/websites/site-studio-ai-types';

export type SitemapAiPreviewProps = {
  mode: SitemapProposeMode;
  pages: WebsiteSitemapPage[];
  currentPageCount: number;
  skippedExistingSlugs: string[];
  creditsUsed: number;
  busy?: boolean;
  onApply: () => void;
  onDismiss: () => void;
};

function modeTitle(mode: SitemapProposeMode) {
  switch (mode) {
    case 'from-brief':
      return 'Replace sitemap from brief';
    case 'add-missing-seo-pages':
      return 'Add missing SEO pages';
    case 'local-service-variants':
      return 'Add local / service variants';
  }
}

function modeHint(mode: SitemapProposeMode, currentPageCount: number) {
  switch (mode) {
    case 'from-brief':
      return currentPageCount > 0
        ? `Applies a full replacement of ${currentPageCount} existing page${currentPageCount === 1 ? '' : 's'}.`
        : 'Applies this new sitemap.';
    case 'add-missing-seo-pages':
      return 'Appends these pages (existing slugs skipped).';
    case 'local-service-variants':
      return 'Appends service-area child pages under existing parents.';
  }
}

export function SitemapAiPreview({
  mode,
  pages,
  currentPageCount,
  skippedExistingSlugs,
  creditsUsed,
  busy,
  onApply,
  onDismiss,
}: SitemapAiPreviewProps) {
  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Preview — {modeTitle(mode)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {modeHint(mode, currentPageCount)} Charged {creditsUsed} credits.
            Nothing is saved until you apply.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            disabled={busy}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Dismiss
          </Button>
          <Button type="button" size="sm" onClick={onApply} disabled={busy}>
            Apply {pages.length} page{pages.length === 1 ? '' : 's'}
          </Button>
        </div>
      </div>

      {skippedExistingSlugs.length > 0 ? (
        <p className="mt-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
          Skipped existing: {skippedExistingSlugs.join(', ')}
        </p>
      ) : null}

      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {pages.map((page) => (
          <li
            key={page.id}
            className={cn(
              'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2',
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                {page.title}
                <span className="ml-2 font-mono text-[11px] font-normal text-[var(--workspace-shell-text-muted)]">
                  /{page.slug}
                </span>
              </p>
              {page.pageType ? (
                <span className="text-[10px] tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  {page.pageType}
                </span>
              ) : null}
            </div>
            {page.seoIntent ? (
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                SEO: {page.seoIntent}
              </p>
            ) : null}
            {page.sections.length > 0 ? (
              <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
                Sections:{' '}
                {page.sections.map((section) => section.title).join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SitemapAiUndoBar({
  onUndo,
  disabled,
}: {
  onUndo: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-accent-subtle)] px-3 py-2">
      <p className="text-xs text-[var(--workspace-shell-text)]">
        Sitemap updated. One undo level available.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onUndo}
        disabled={disabled}
      >
        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
        Undo
      </Button>
    </div>
  );
}
