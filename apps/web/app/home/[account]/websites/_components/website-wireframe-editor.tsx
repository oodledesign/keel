'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  type WebsiteSitemapPage,
  type WebsiteWireframeCopy,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
  createPlanningId,
} from '~/lib/websites/planning-types';
import {
  WEBSITE_SECTION_LIBRARY,
  findSectionLibraryEntry,
} from '~/lib/websites/section-library';
import {
  createDefaultWireframeCopy,
  ensureWireframeCopy,
  libraryEntryLabel,
} from '~/lib/websites/wireframe-copy';

import { saveWebsiteWireframes } from '../_lib/server/planning-actions';
import { generateWebsiteWireframes } from '../_lib/server/site-studio-actions';
import { WireframeLibrarySection } from './site-studio/wireframe-library-sections';
import { WireframePageViewer } from './site-studio/wireframe-page-viewer';

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
            return {
              ...match,
              title: section.title,
              copy: ensureWireframeCopy({
                ...match,
                title: section.title,
              }),
            };
          }
          return {
            id: createPlanningId(),
            sitemapSectionId: section.id,
            title: section.title,
            layout: 'full' as const,
            libraryKey: null,
            copyOutline: '',
            contentNotes: section.description,
            copy: createDefaultWireframeCopy(null),
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
        copy: createDefaultWireframeCopy(null),
      })),
    };
  });
}

function WireframeCanvasSection({
  section,
  canEdit,
  onChange,
}: {
  section: WebsiteWireframeSection;
  canEdit: boolean;
  onChange: (patch: Partial<WebsiteWireframeSection>) => void;
}) {
  const copy = ensureWireframeCopy(section);

  function patchCopy(next: WebsiteWireframeCopy) {
    onChange({ copy: next });
  }

  function onSlotChange(key: string, value: string) {
    patchCopy({
      ...copy,
      slots: { ...copy.slots, [key]: value },
    });
  }

  function onItemSlotChange(itemId: string, key: string, value: string) {
    patchCopy({
      ...copy,
      items: (copy.items ?? []).map((item) =>
        item.id !== itemId
          ? item
          : { ...item, slots: { ...item.slots, [key]: value } },
      ),
    });
  }

  return (
    <WireframeLibrarySection
      libraryKey={section.libraryKey}
      layout={section.layout}
      copy={copy}
      canEdit={canEdit}
      onSlotChange={onSlotChange}
      onItemSlotChange={onItemSlotChange}
    />
  );
}

function SectionLibraryControl({
  section,
  canEdit,
  siteStudioEnabled,
  onChange,
}: {
  section: WebsiteWireframeSection;
  canEdit: boolean;
  siteStudioEnabled: boolean;
  onChange: (patch: Partial<WebsiteWireframeSection>) => void;
}) {
  if (!siteStudioEnabled) return null;

  return (
    <Select
      value={section.libraryKey ?? '__custom__'}
      onValueChange={(value) => {
        if (value === '__custom__') {
          onChange({
            libraryKey: null,
            copy: createDefaultWireframeCopy(null),
          });
          return;
        }
        const entry = findSectionLibraryEntry(value);
        onChange({
          libraryKey: value,
          ...(entry ? { layout: entry.layout } : {}),
          copy: createDefaultWireframeCopy(value),
        });
      }}
      disabled={!canEdit}
    >
      <SelectTrigger className="h-8 w-full border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-xs text-[var(--workspace-shell-text)]">
        <SelectValue placeholder="Section library…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__custom__">Custom section</SelectItem>
        {WEBSITE_SECTION_LIBRARY.map((entry) => (
          <SelectItem key={entry.key} value={entry.key}>
            {entry.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function WebsiteWireframeEditor({
  accountId,
  websiteId,
  sitemap,
  initialWireframes,
  onWireframesChange,
  canEdit,
  siteStudioEnabled = false,
}: {
  accountId: string;
  websiteId: string;
  sitemap: WebsiteSitemapPage[];
  initialWireframes: WebsiteWireframePage[];
  onWireframesChange?: (wireframes: WebsiteWireframePage[]) => void;
  canEdit: boolean;
  siteStudioEnabled?: boolean;
}) {
  const [wireframes, setWireframes] = useState(initialWireframes);
  const [activePageId, setActivePageId] = useState<string | null>(
    initialWireframes[0]?.pageId ?? sitemap[0]?.id ?? null,
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [isGenerating, startGenerating] = useTransition();
  const [, startTransition] = useTransition();
  const skipNextSave = useRef(true);
  const onWireframesChangeRef = useRef(onWireframesChange);
  onWireframesChangeRef.current = onWireframesChange;

  useEffect(() => {
    setWireframes((current) => {
      if (current === initialWireframes) return current;
      skipNextSave.current = true;
      return initialWireframes;
    });
  }, [initialWireframes]);

  useEffect(() => {
    if (!activePageId && sitemap[0]) {
      setActivePageId(sitemap[0].id);
      return;
    }
    if (
      activePageId &&
      sitemap.length > 0 &&
      !sitemap.some((page) => page.id === activePageId) &&
      !wireframes.some((page) => page.pageId === activePageId)
    ) {
      setActivePageId(sitemap[0]?.id ?? wireframes[0]?.pageId ?? null);
    }
  }, [activePageId, sitemap, wireframes]);

  function updateWireframes(
    next:
      | WebsiteWireframePage[]
      | ((current: WebsiteWireframePage[]) => WebsiteWireframePage[]),
  ) {
    setWireframes((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      queueMicrotask(() => onWireframesChangeRef.current?.(resolved));
      return resolved;
    });
  }

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
            error instanceof Error
              ? error.message
              : 'Could not save wireframes',
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
    updateWireframes(next);
    if (next[0]) {
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
        updateWireframes(
          next.map((page) => ({
            ...page,
            sections: page.sections.map((section) => ({
              ...section,
              copy: ensureWireframeCopy(section),
            })),
          })),
        );
        toast.success('Wireframe generated — edit copy in place');
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
    updateWireframes((current) =>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text)]/70">
            Relume-style wireframes — pick a library section, then edit copy in
            place.
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
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
            {sitemap.length} page{sitemap.length === 1 ? '' : 's'} ready in the
            sitemap. Sync to create wireframe structure, or generate AI layouts
            for the selected page.
          </div>
          <div className="flex flex-wrap gap-2">
            {sitemap.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePageId(page.id)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  activePageId === page.id
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-text)]'
                    : 'border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                {page.title}
                <span className="mt-0.5 block text-xs opacity-70">
                  {page.sections.length} section
                  {page.sections.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
            <WireframePageViewer
              className="min-h-[70vh]"
              pageTitle={activePage.title}
              pageDescription={
                sitemap.find((page) => page.id === activePage.pageId)
                  ?.description
              }
              sections={activePage.sections.map((section) => {
                const sitemapSection = sitemap
                  .find((page) => page.id === activePage.pageId)
                  ?.sections.find(
                    (item) => item.id === section.sitemapSectionId,
                  );
                return {
                  id: section.id,
                  title: section.title,
                  description:
                    sitemapSection?.description ||
                    section.copyOutline ||
                    undefined,
                  notes: section.contentNotes || undefined,
                  clientComment: section.clientComment,
                };
              })}
              canEditNotes={canEdit}
              onNotesChange={(sectionId, notes) =>
                updateSection(activePage.pageId, sectionId, {
                  contentNotes: notes,
                })
              }
              renderSectionControls={
                siteStudioEnabled
                  ? (sectionId) => {
                      const section = activePage.sections.find(
                        (item) => item.id === sectionId,
                      );
                      if (!section) return null;
                      return (
                        <SectionLibraryControl
                          section={section}
                          canEdit={canEdit}
                          siteStudioEnabled={siteStudioEnabled}
                          onChange={(patch) =>
                            updateSection(activePage.pageId, section.id, patch)
                          }
                        />
                      );
                    }
                  : undefined
              }
              renderSection={(sectionId) => {
                const section = activePage.sections.find(
                  (item) => item.id === sectionId,
                );
                if (!section) return null;
                return (
                  <WireframeCanvasSection
                    section={section}
                    canEdit={canEdit}
                    onChange={(patch) =>
                      updateSection(activePage.pageId, section.id, patch)
                    }
                  />
                );
              }}
              canvasHeader={
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Continuous page preview — collapse the sections column for a
                  full-width browser-like flow. Tip: choose a library variant
                  (e.g. {libraryEntryLabel('hero-split')}) so the preview
                  matches the layout you will build.
                </p>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
