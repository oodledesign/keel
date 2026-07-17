'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { RefreshCw, Sparkles, Undo2, X } from 'lucide-react';

import { LEGACY_LIBRARY_KEY_TO_PRESET } from '@kit/site-blocks-core/mapping';
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
  WEBSITE_LAYOUT_PRESET_OPTIONS,
  type WebsiteLayoutPreset,
  type WebsiteSitemapPage,
  type WebsiteWireframeCopy,
  type WebsiteWireframeLayout,
  type WebsiteWireframePage,
  type WebsiteWireframeSection,
  createPlanningId,
} from '~/lib/websites/planning-types';
import type { WireframePageProposal } from '~/lib/websites/site-studio-ai-types';
import {
  SITE_STUDIO_AI_CREDITS,
  siteStudioCreditLabel,
} from '~/lib/websites/site-studio-credits';
import {
  createDefaultWireframeCopy,
  ensureWireframeCopy,
  libraryEntryLabel,
} from '~/lib/websites/wireframe-copy';

import { saveWebsiteWireframes } from '../_lib/server/planning-actions';
import {
  proposeWebsiteWireframeSection,
  proposeWebsiteWireframes,
} from '../_lib/server/site-studio-actions';
import { WireframeLibrarySection } from './site-studio/wireframe-library-sections';
import { WireframePageViewer } from './site-studio/wireframe-page-viewer';
import { WireframePuckPage } from './site-studio/wireframe-puck-page';

function coarseLayoutForPreset(
  preset: WebsiteLayoutPreset,
): WebsiteWireframeLayout {
  switch (preset) {
    case 'hero-split':
    case 'hero-form':
    case 'feature-alternating':
    case 'contact-form':
    case 'map-section':
      return 'split';
    case 'feature-grid':
    case 'logo-cloud':
    case 'stats-bar':
    case 'gallery-grid':
      return 'grid';
    case 'testimonials':
    case 'pricing-table':
    case 'team-grid':
    case 'blog-grid':
      return 'cards';
    case 'cta-band':
      return 'cta';
    case 'footer':
      return 'footer';
    default:
      return 'full';
  }
}

function legacyKeyForPreset(preset: WebsiteLayoutPreset): string | null {
  const entry = Object.entries(LEGACY_LIBRARY_KEY_TO_PRESET).find(
    ([, value]) => value === preset,
  );
  return entry?.[0] ?? null;
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
  regenerating,
  onChange,
  onRegenerate,
}: {
  section: WebsiteWireframeSection;
  canEdit: boolean;
  siteStudioEnabled: boolean;
  regenerating?: boolean;
  onChange: (patch: Partial<WebsiteWireframeSection>) => void;
  onRegenerate?: () => void;
}) {
  if (!siteStudioEnabled) return null;

  const selected =
    section.layoutPreset ??
    (section.libraryKey
      ? LEGACY_LIBRARY_KEY_TO_PRESET[section.libraryKey]
      : undefined) ??
    '__custom__';

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Select
        value={selected}
        onValueChange={(value) => {
          if (value === '__custom__') {
            onChange({
              libraryKey: null,
              layoutPreset: null,
              copy: createDefaultWireframeCopy(null),
            });
            return;
          }
          const preset = value as WebsiteLayoutPreset;
          const legacyKey = legacyKeyForPreset(preset);
          onChange({
            layoutPreset: preset,
            layout: coarseLayoutForPreset(preset),
            libraryKey: legacyKey,
            copy: createDefaultWireframeCopy(legacyKey),
          });
        }}
        disabled={!canEdit || regenerating}
      >
        <SelectTrigger className="h-8 w-full border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-xs text-[var(--workspace-shell-text)]">
          <SelectValue placeholder="Block layout…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__custom__">Custom / legacy</SelectItem>
          {WEBSITE_LAYOUT_PRESET_OPTIONS.map((entry) => (
            <SelectItem key={entry.value} value={entry.value}>
              {entry.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canEdit && onRegenerate ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 justify-start px-1 text-[11px]"
          disabled={regenerating}
          onClick={onRegenerate}
          title={siteStudioCreditLabel(
            SITE_STUDIO_AI_CREDITS.wireframeGenerate,
          )}
        >
          <Sparkles className="mr-1 h-3 w-3" />
          {regenerating
            ? 'Regenerating…'
            : `Regenerate (${siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.wireframeGenerate)})`}
        </Button>
      ) : null}
    </div>
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
  const [proposal, setProposal] = useState<WireframePageProposal | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<
    WebsiteWireframePage[] | null
  >(null);
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<
    string | null
  >(null);
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

  function proposeForActivePage() {
    if (!activePageId) return;

    startGenerating(async () => {
      try {
        const next = await proposeWebsiteWireframes({
          accountId,
          websiteId,
          pageId: activePageId,
        });
        setProposal({
          ...next,
          page: {
            ...next.page,
            sections: next.page.sections.map((section) => ({
              ...section,
              copy: ensureWireframeCopy(section),
            })),
          },
        });
        toast.success(
          `Wireframe preview ready (${siteStudioCreditLabel(next.creditsUsed)})`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not generate wireframe',
        );
      }
    });
  }

  function applyWireframeProposal() {
    if (!proposal) return;
    setUndoSnapshot(wireframes);
    updateWireframes((current) =>
      current.some((page) => page.pageId === proposal.page.pageId)
        ? current.map((page) =>
            page.pageId === proposal.page.pageId ? proposal.page : page,
          )
        : [...current, proposal.page],
    );
    setActivePageId(proposal.page.pageId);
    setProposal(null);
    toast.success('Wireframe applied');
  }

  function undoWireframeApply() {
    if (!undoSnapshot) return;
    updateWireframes(undoSnapshot);
    setUndoSnapshot(null);
    toast.success('Wireframes restored');
  }

  function regenerateSection(sectionId: string) {
    if (!activePageId) return;

    setRegeneratingSectionId(sectionId);
    startGenerating(async () => {
      try {
        const next = await proposeWebsiteWireframeSection({
          accountId,
          websiteId,
          pageId: activePageId,
          sectionId,
        });
        setUndoSnapshot(wireframes);
        updateWireframes((current) =>
          current.map((page) =>
            page.pageId !== next.pageId
              ? page
              : {
                  ...page,
                  sections: page.sections.map((section) =>
                    section.id === sectionId
                      ? {
                          ...next.section,
                          copy: ensureWireframeCopy(next.section),
                        }
                      : section,
                  ),
                },
          ),
        );
        toast.success(
          `Section regenerated (${siteStudioCreditLabel(next.creditsUsed)})`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not regenerate section',
        );
      } finally {
        setRegeneratingSectionId(null);
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
              onClick={proposeForActivePage}
              disabled={isGenerating || !activePageId}
              title={siteStudioCreditLabel(
                SITE_STUDIO_AI_CREDITS.wireframeGenerate,
              )}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isGenerating
                ? 'Generating…'
                : `Generate for page (${siteStudioCreditLabel(SITE_STUDIO_AI_CREDITS.wireframeGenerate)})`}
            </Button>
          ) : null}
          {undoSnapshot ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={undoWireframeApply}
              disabled={!canEdit}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo AI
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

      {proposal ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Preview — wireframes for {proposal.page.title}
              </p>
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {proposal.page.sections.length} sections · charged{' '}
                {proposal.creditsUsed} credits. Copy is client-shareable;
                content notes stay internal. Nothing saved until you apply.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setProposal(null)}
                disabled={isGenerating}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={applyWireframeProposal}
                disabled={isGenerating}
              >
                Apply wireframe
              </Button>
            </div>
          </div>
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {proposal.page.sections.map((section) => (
              <li
                key={section.id}
                className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-3 py-2"
              >
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {section.title}
                  <span className="ml-2 text-[10px] font-normal tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                    {section.layout}
                    {section.libraryKey ? ` · ${section.libraryKey}` : ''}
                  </span>
                </p>
                {section.copyOutline ? (
                  <p className="mt-0.5 text-xs whitespace-pre-line text-[var(--workspace-shell-text)]">
                    {section.copyOutline}
                  </p>
                ) : null}
                {section.contentNotes ? (
                  <p className="mt-1 text-[11px] text-[var(--workspace-shell-text-muted)] italic">
                    Internal: {section.contentNotes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                          regenerating={regeneratingSectionId === sectionId}
                          onChange={(patch) =>
                            updateSection(activePage.pageId, section.id, patch)
                          }
                          onRegenerate={
                            canEdit
                              ? () => regenerateSection(section.id)
                              : undefined
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
              renderFullPage={
                siteStudioEnabled
                  ? () => (
                      <WireframePuckPage
                        sections={activePage.sections}
                        wireframe
                      />
                    )
                  : undefined
              }
              canvasHeader={
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {siteStudioEnabled
                    ? 'Puck block wireframes — swap layout presets in the rail to re-render live. Copy outline drives shareable text; notes stay internal.'
                    : `Continuous page preview — choose a library variant (e.g. ${libraryEntryLabel('hero-split')}) so the preview matches the layout you will build.`}
                </p>
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
