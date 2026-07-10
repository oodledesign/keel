'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  createPlanningId,
  WIREFRAME_LAYOUT_OPTIONS,
  type WebsiteSitemapPage,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
} from '~/lib/websites/planning-types';
import {
  WEBSITE_SECTION_LIBRARY,
  findSectionLibraryEntry,
} from '~/lib/websites/section-library';

import { saveWebsiteWireframes } from '../_lib/server/planning-actions';
import { generateWebsiteWireframes } from '../_lib/server/site-studio-actions';

function layoutPreviewClass(layout: WebsiteWireframeSection['layout']) {
  switch (layout) {
    case 'split':
      return 'grid grid-cols-2 gap-1';
    case 'grid':
      return 'grid grid-cols-3 gap-1';
    case 'cards':
      return 'grid grid-cols-2 gap-1 sm:grid-cols-3';
    case 'cta':
      return 'flex h-10 items-center justify-center';
    case 'footer':
      return 'grid grid-cols-4 gap-1';
    default:
      return 'block';
  }
}

function WireframePreview({ section }: { section: WebsiteWireframeSection }) {
  const blocks =
    section.layout === 'full' || section.layout === 'cta'
      ? 1
      : section.layout === 'split'
        ? 2
        : section.layout === 'footer'
          ? 4
          : 3;

  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-2',
        layoutPreviewClass(section.layout),
      )}
    >
      {Array.from({ length: blocks }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded bg-[var(--workspace-shell-sidebar-accent)]',
            section.layout === 'cta' ? 'h-6 w-full' : 'h-8',
          )}
        />
      ))}
    </div>
  );
}

function syncWireframesFromSitemap(
  sitemap: WebsiteSitemapPage[],
  existing: WebsiteWireframePage[],
): WebsiteWireframePage[] {
  return sitemap.map((page) => {
    const current = existing.find((item) => item.pageId === page.id);
    if (current) {
      return {
        ...current,
        title: page.title,
        sections: page.sections.map((section) => {
          const match = current.sections.find(
            (row) => row.sitemapSectionId === section.id,
          );
          if (match) {
            return { ...match, title: section.title };
          }
          return {
            id: createPlanningId(),
            sitemapSectionId: section.id,
            title: section.title,
            layout: 'full' as const,
            libraryKey: null,
            copyOutline: '',
            contentNotes: section.description,
          };
        }),
      };
    }

    return {
      id: createPlanningId(),
      pageId: page.id,
      title: page.title,
      sections: page.sections.map((section) => ({
        id: createPlanningId(),
        sitemapSectionId: section.id,
        title: section.title,
        layout: 'full' as const,
        libraryKey: null,
        copyOutline: '',
        contentNotes: section.description,
      })),
    };
  });
}

export function WebsiteWireframeEditor({
  accountId,
  websiteId,
  sitemap,
  initialWireframes,
  canEdit,
  siteStudioEnabled = false,
}: {
  accountId: string;
  websiteId: string;
  sitemap: WebsiteSitemapPage[];
  initialWireframes: WebsiteWireframePage[];
  canEdit: boolean;
  siteStudioEnabled?: boolean;
}) {
  const [wireframes, setWireframes] = useState(initialWireframes);
  const [activePageId, setActivePageId] = useState<string | null>(
    initialWireframes[0]?.pageId ?? sitemap[0]?.id ?? null,
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGenerating, startGenerating] = useTransition();
  const [, startTransition] = useTransition();
  const skipNextSave = useRef(true);

  useEffect(() => {
    setWireframes(initialWireframes);
    skipNextSave.current = true;
  }, [initialWireframes]);

  useEffect(() => {
    if (!canEdit) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSaveState('saving');
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          await saveWebsiteWireframes({
            accountId,
            websiteId,
            wireframes,
          });
          setSaveState('saved');
        } catch (error) {
          setSaveState('idle');
          toast.error(
            error instanceof Error ? error.message : 'Could not save wireframes',
          );
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [accountId, canEdit, wireframes, websiteId, startTransition]);

  const activePage = useMemo(
    () => wireframes.find((page) => page.pageId === activePageId) ?? null,
    [activePageId, wireframes],
  );

  function syncFromSitemap() {
    const next = syncWireframesFromSitemap(sitemap, wireframes);
    setWireframes(next);
    if (!activePageId && next[0]) {
      setActivePageId(next[0].pageId);
    }
    toast.success('Wireframes synced from sitemap');
  }

  function generateForActivePage() {
    if (!activePageId) return;

    startGenerating(async () => {
      try {
        const next = await generateWebsiteWireframes({
          accountId,
          websiteId,
          pageId: activePageId,
        });
        skipNextSave.current = true;
        setWireframes(next);
        toast.success('Wireframe generated — review copy outlines');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not generate wireframe',
        );
      }
    });
  }

  function updateSection(
    pageId: string,
    sectionId: string,
    patch: Partial<WebsiteWireframeSection>,
  ) {
    setWireframes((current) =>
      current.map((page) =>
        page.pageId !== pageId
          ? page
          : {
              ...page,
              sections: page.sections.map((section) =>
                section.id === sectionId ? { ...section, ...patch } : section,
              ),
            },
      ),
    );
  }

  const inputClass =
    'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text)]/70">
            Layout intent per section — sync from sitemap, then refine.
          </p>
          {canEdit ? (
            <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : 'Autosaves'}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && siteStudioEnabled ? (
            <Button
              type="button"
              size="sm"
              onClick={generateForActivePage}
              disabled={isGenerating || !activePageId}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generating…' : 'Generate for page'}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
              onClick={syncFromSitemap}
              disabled={sitemap.length === 0}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync from sitemap
            </Button>
          ) : null}
        </div>
      </div>

      {sitemap.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          Build your sitemap first, then sync wireframes here.
        </div>
      ) : wireframes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          No wireframes yet. Click sync from sitemap to generate structure.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-wrap gap-2 lg:flex-col">
            {wireframes.map((page) => (
              <button
                key={page.pageId}
                type="button"
                onClick={() => setActivePageId(page.pageId)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  activePageId === page.pageId
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {page.title}
              </button>
            ))}
          </div>

          {activePage ? (
            <div className="space-y-4">
              {activePage.sections.map((section) => {
                const libraryEntry = findSectionLibraryEntry(section.libraryKey);
                return (
                  <div
                    key={section.id}
                    className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40 p-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                      <div className="space-y-3">
                        <Input
                          value={section.title}
                          readOnly={!canEdit}
                          onChange={(event) =>
                            updateSection(activePage.pageId, section.id, {
                              title: event.target.value,
                            })
                          }
                          className={cn(inputClass, 'h-9')}
                        />
                        {siteStudioEnabled ? (
                          <Select
                            value={section.libraryKey ?? '__custom__'}
                            onValueChange={(value) => {
                              if (value === '__custom__') {
                                updateSection(activePage.pageId, section.id, {
                                  libraryKey: null,
                                });
                                return;
                              }
                              const entry = findSectionLibraryEntry(value);
                              updateSection(activePage.pageId, section.id, {
                                libraryKey: value,
                                ...(entry ? { layout: entry.layout } : {}),
                              });
                            }}
                            disabled={!canEdit}
                          >
                            <SelectTrigger className={inputClass}>
                              <SelectValue placeholder="Section library…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__custom__">
                                Custom (no library section)
                              </SelectItem>
                              {WEBSITE_SECTION_LIBRARY.map((entry) => (
                                <SelectItem key={entry.key} value={entry.key}>
                                  {entry.label} — {entry.hint}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <Select
                          value={section.layout}
                          onValueChange={(value) =>
                            updateSection(activePage.pageId, section.id, {
                              layout: value as WebsiteWireframeSection['layout'],
                            })
                          }
                          disabled={!canEdit}
                        >
                          <SelectTrigger className={inputClass}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WIREFRAME_LAYOUT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label} — {option.hint}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {siteStudioEnabled ? (
                          <Textarea
                            value={section.copyOutline ?? ''}
                            readOnly={!canEdit}
                            rows={3}
                            onChange={(event) =>
                              updateSection(activePage.pageId, section.id, {
                                copyOutline: event.target.value,
                              })
                            }
                            placeholder="Client-facing copy outline: headline, supporting line, CTA…"
                            className={cn(inputClass, 'text-sm')}
                          />
                        ) : null}
                        <Textarea
                          value={section.contentNotes}
                          readOnly={!canEdit}
                          rows={3}
                          onChange={(event) =>
                            updateSection(activePage.pageId, section.id, {
                              contentNotes: event.target.value,
                            })
                          }
                          placeholder={
                            siteStudioEnabled
                              ? 'Internal notes: layout intent, content to collect…'
                              : 'Layout notes, content blocks, CTA labels…'
                          }
                          className={cn(inputClass, 'text-sm')}
                        />
                      </div>
                      <div className="space-y-2">
                        <WireframePreview section={section} />
                        {libraryEntry ? (
                          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                            {libraryEntry.label}: {libraryEntry.hint}
                            <br />
                            Slots: {libraryEntry.copySlots.join(', ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
