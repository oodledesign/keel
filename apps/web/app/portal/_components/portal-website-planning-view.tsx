'use client';

import { useMemo, useState, useTransition } from 'react';

import { Check, MessageSquareWarning } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { setWebsiteShareApproval } from '~/home/[account]/websites/_lib/server/site-studio-actions';
import { WireframeLibrarySection } from '~/home/[account]/websites/_components/site-studio/wireframe-library-sections';
import {
  PLANNING_STATUS_OPTIONS,
  sectionTypeMeta,
  type WebsitePortalShareScope,
  type WebsiteShareScope,
  type WebsiteSitemapPage,
  type WebsiteStyleSystem,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
} from '~/lib/websites/planning-types';
import { ensureWireframeCopy } from '~/lib/websites/wireframe-copy';

type PlanningScope = WebsiteShareScope | WebsitePortalShareScope;

function scopeShowsWireframes(scope: PlanningScope) {
  return scope === 'wireframes' || scope === 'design' || scope === 'full';
}

function scopeShowsStyle(scope: PlanningScope) {
  return scope === 'design' || scope === 'full';
}

function WireframePreview({ section }: { section: WebsiteWireframeSection }) {
  const copy = ensureWireframeCopy(section);

  return (
    <WireframeLibrarySection
      libraryKey={section.libraryKey}
      layout={section.layout}
      copy={copy}
      canEdit={false}
      onSlotChange={() => undefined}
      onItemSlotChange={() => undefined}
    />
  );
}

function statusMeta(status: WebsiteSitemapPage['status']) {
  return (
    PLANNING_STATUS_OPTIONS.find((item) => item.value === (status ?? 'draft')) ??
    PLANNING_STATUS_OPTIONS[0]!
  );
}

function PageApproval({
  page,
  shareToken,
  onUpdated,
}: {
  page: WebsiteSitemapPage;
  shareToken: string;
  onUpdated: (pageId: string, status: 'approved' | 'blocked', note?: string) => void;
}) {
  const [note, setNote] = useState(page.approvalNote ?? '');
  const [showNote, setShowNote] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (status: 'approved' | 'blocked') => {
    startTransition(async () => {
      try {
        await setWebsiteShareApproval({
          token: shareToken,
          pageId: page.id,
          status,
          note: status === 'blocked' ? note : undefined,
        });
        onUpdated(page.id, status, status === 'blocked' ? note : undefined);
        toast.success(
          status === 'approved' ? 'Page approved' : 'Change request sent',
        );
        setShowNote(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save approval',
        );
      }
    });
  };

  return (
    <div className="mt-3 space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => submit('approved')}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Approve page
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setShowNote((value) => !value)}
        >
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" />
          Request changes
        </Button>
      </div>
      {showNote ? (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What should we change on this page?"
            rows={3}
            className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]"
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !note.trim()}
            onClick={() => submit('blocked')}
          >
            Send feedback
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PortalWebsitePlanningView({
  scope,
  sitemap,
  wireframes,
  style,
  shareToken,
}: {
  scope: PlanningScope;
  sitemap: WebsiteSitemapPage[];
  wireframes: WebsiteWireframePage[];
  style: WebsiteStyleSystem | null;
  /** When set, clients can approve pages or request changes. */
  shareToken?: string;
}) {
  const [pages, setPages] = useState(sitemap);
  const showWireframes = scopeShowsWireframes(scope);
  const showStyle = scopeShowsStyle(scope);

  const wireframeByPage = useMemo(() => {
    const map = new Map<string, WebsiteWireframePage>();
    for (const page of wireframes) {
      map.set(page.pageId, page);
    }
    return map;
  }, [wireframes]);

  const handleApproval = (
    pageId: string,
    status: 'approved' | 'blocked',
    note?: string,
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? { ...page, status, approvalNote: note ?? page.approvalNote }
          : page,
      ),
    );
  };

  if (scope === 'off' || pages.length === 0) {
    return (
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        No planning artefacts are available to view yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
          Sitemap
        </h3>
        <ul className="space-y-4">
          {pages.map((page) => {
            const meta = statusMeta(page.status);
            return (
              <li
                key={page.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {page.title}
                    </p>
                    <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                      /{page.slug || '—'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      meta.colorClass,
                    )}
                  >
                    {meta.label}
                  </span>
                </div>

                {page.description ? (
                  <p className="mt-2 text-sm text-[var(--workspace-shell-text)]/75">
                    {page.description}
                  </p>
                ) : null}

                {page.sections.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {page.sections.map((section) => {
                      const sectionMeta = sectionTypeMeta(section.sectionType);
                      return (
                        <li
                          key={section.id}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs',
                            sectionMeta.colorClass,
                          )}
                        >
                          {section.title}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {page.approvalNote ? (
                  <p className="mt-2 text-sm text-red-300">
                    Feedback: {page.approvalNote}
                  </p>
                ) : null}

                {shareToken ? (
                  <PageApproval
                    page={page}
                    shareToken={shareToken}
                    onUpdated={handleApproval}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {showWireframes ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
            Wireframes
          </h3>
          <div className="space-y-6">
            {pages.map((page) => {
              const wireframe = wireframeByPage.get(page.id);
              if (!wireframe || wireframe.sections.length === 0) return null;

              return (
                <div
                  key={`wire-${page.id}`}
                  className="rounded-xl border border-[color:var(--workspace-shell-border)] p-4"
                >
                  <p className="mb-3 font-medium text-[var(--workspace-shell-text)]">
                    {page.title}
                  </p>
                  <div className="space-y-3">
                    {wireframe.sections.map((section) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
                          {section.title}
                        </p>
                        <WireframePreview section={section} />
                        {section.contentNotes ? (
                          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                            {section.contentNotes}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {showStyle && style ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--workspace-shell-text-muted)]">
            Design tokens
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['Canvas', style.tokens.canvas],
                ['Atmosphere', style.tokens.atmosphere],
                ['Accent', style.tokens.accent],
                ['Contrast', style.tokens.contrast],
              ] as const
            ).map(([label, color]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-md border border-[color:var(--workspace-shell-border)]"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    {label}
                  </p>
                  <p className="font-mono text-sm text-[var(--workspace-shell-text)]">
                    {color}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {style.tokens.headingFont || style.tokens.bodyFont ? (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Type: {style.tokens.headingFont || '—'} /{' '}
              {style.tokens.bodyFont || '—'}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
