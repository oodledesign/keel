'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Component,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

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
  PAGE_TYPE_OPTIONS,
  PLANNING_STATUS_OPTIONS,
  SECTION_TYPE_OPTIONS,
  createPlanningId,
  planningStatusMeta,
  sectionTypeMeta,
  slugifyPageTitle,
  type WebsitePageType,
  type WebsitePlanningStatus,
  type WebsiteSectionType,
  type WebsiteSitemapPage,
  type WebsiteSitemapSection,
} from '~/lib/websites/planning-types';

import { saveWebsiteSitemap } from '../../_lib/server/planning-actions';
import { generateWebsiteSitemap } from '../../_lib/server/site-studio-actions';

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]';

function SectionRow({
  section,
  canEdit,
  onChange,
  onRemove,
  onMove,
}: {
  section: WebsiteSitemapSection;
  canEdit: boolean;
  onChange: (patch: Partial<WebsiteSitemapSection>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeMeta = sectionTypeMeta(section.sectionType);

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]',
      )}
      style={{ borderLeftColor: 'transparent' }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', typeMeta.dotClass)} />
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm text-[var(--workspace-shell-text)]"
          onClick={() => setExpanded((current) => !current)}
        >
          {section.title || 'Untitled section'}
        </button>
        {section.componentKey ? (
          <span
            className="inline-flex items-center gap-1 rounded border border-[var(--ozer-accent)]/40 bg-[var(--ozer-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--ozer-accent)]"
            title={`Repeating component: ${section.componentKey}`}
          >
            <Component className="h-3 w-3" />
            {section.componentKey}
          </span>
        ) : null}
        <button
          type="button"
          className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {expanded ? (
        <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] p-2">
          <Input
            value={section.title}
            readOnly={!canEdit}
            onChange={(event) => onChange({ title: event.target.value })}
            className={cn(inputClass, 'h-8 text-sm')}
            placeholder="Section title"
          />
          <Textarea
            value={section.description}
            readOnly={!canEdit}
            rows={2}
            onChange={(event) => onChange({ description: event.target.value })}
            className={cn(inputClass, 'text-sm')}
            placeholder="What this section communicates…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={section.sectionType ?? 'other'}
              onValueChange={(value) =>
                onChange({ sectionType: value as WebsiteSectionType })
              }
              disabled={!canEdit}
            >
              <SelectTrigger className={cn(inputClass, 'h-8 w-32 text-xs')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTION_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', option.dotClass)} />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit ? (
              <Input
                value={section.componentKey ?? ''}
                onChange={(event) =>
                  onChange({
                    componentKey: event.target.value.trim()
                      ? event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]+/g, '-')
                      : null,
                  })
                }
                placeholder="Repeat key (e.g. site-header)"
                className={cn(inputClass, 'h-8 w-44 text-xs')}
                title="Sections sharing a repeat key stay in sync — edit once, update all instances"
              />
            ) : null}
            {canEdit ? (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  onClick={() => onMove(-1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  onClick={() => onMove(1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                  onClick={onRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WebsiteSitemapCanvas({
  accountId,
  websiteId,
  initialSitemap,
  canEdit,
  siteStudioEnabled,
}: {
  accountId: string;
  websiteId: string;
  initialSitemap: WebsiteSitemapPage[];
  canEdit: boolean;
  siteStudioEnabled: boolean;
}) {
  const [pages, setPages] = useState(initialSitemap);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isGenerating, startGenerating] = useTransition();
  const [, startTransition] = useTransition();
  const dragPageId = useRef<string | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    setPages(initialSitemap);
    skipNextSave.current = true;
  }, [initialSitemap]);

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
          await saveWebsiteSitemap({ accountId, websiteId, sitemap: pages });
          setSaveState('saved');
        } catch (error) {
          setSaveState('idle');
          toast.error(
            error instanceof Error ? error.message : 'Could not save sitemap',
          );
        }
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [accountId, canEdit, pages, websiteId, startTransition]);

  const topLevelPages = useMemo(
    () =>
      pages.filter(
        (page) => !page.parentId || !pages.some((p) => p.id === page.parentId),
      ),
    [pages],
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, WebsiteSitemapPage[]>();
    for (const page of pages) {
      if (page.parentId && pages.some((p) => p.id === page.parentId)) {
        const list = map.get(page.parentId) ?? [];
        list.push(page);
        map.set(page.parentId, list);
      }
    }
    return map;
  }, [pages]);

  function addPage(parentId: string | null = null) {
    const title = 'New page';
    setPages((current) => [
      ...current,
      {
        id: createPlanningId(),
        title,
        slug: slugifyPageTitle(title),
        sections: [],
        pageType: 'other',
        status: 'draft',
        parentId,
      },
    ]);
  }

  function updatePage(pageId: string, patch: Partial<WebsiteSitemapPage>) {
    setPages((current) =>
      current.map((page) => {
        if (page.id !== pageId) return page;
        const next = { ...page, ...patch };
        if (patch.title !== undefined) {
          next.slug = slugifyPageTitle(patch.title) || page.slug;
        }
        return next;
      }),
    );
  }

  function removePage(pageId: string) {
    setPages((current) =>
      current
        .filter((page) => page.id !== pageId)
        .map((page) =>
          page.parentId === pageId ? { ...page, parentId: null } : page,
        ),
    );
  }

  /** Edit a section; propagate to all instances sharing its componentKey. */
  function updateSection(
    pageId: string,
    sectionId: string,
    patch: Partial<WebsiteSitemapSection>,
  ) {
    setPages((current) => {
      const sourcePage = current.find((page) => page.id === pageId);
      const source = sourcePage?.sections.find(
        (section) => section.id === sectionId,
      );
      const sharedKey = source?.componentKey ?? null;
      // Content fields propagate across component instances; the key itself doesn't.
      const propagate =
        sharedKey &&
        (patch.title !== undefined ||
          patch.description !== undefined ||
          patch.sectionType !== undefined);

      return current.map((page) => ({
        ...page,
        sections: page.sections.map((section) => {
          if (page.id === pageId && section.id === sectionId) {
            return { ...section, ...patch };
          }
          if (propagate && section.componentKey === sharedKey) {
            const { componentKey: _ignored, ...contentPatch } = patch;
            return { ...section, ...contentPatch };
          }
          return section;
        }),
      }));
    });
  }

  function addSection(pageId: string) {
    setPages((current) =>
      current.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              sections: [
                ...page.sections,
                {
                  id: createPlanningId(),
                  title: 'New section',
                  description: '',
                  sectionType: 'content' as WebsiteSectionType,
                  componentKey: null,
                  status: 'draft' as WebsitePlanningStatus,
                },
              ],
            },
      ),
    );
  }

  function moveSection(pageId: string, sectionId: string, direction: -1 | 1) {
    setPages((current) =>
      current.map((page) => {
        if (page.id !== pageId) return page;
        const index = page.sections.findIndex((s) => s.id === sectionId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= page.sections.length) {
          return page;
        }
        const sections = [...page.sections];
        const [moved] = sections.splice(index, 1);
        sections.splice(target, 0, moved!);
        return { ...page, sections };
      }),
    );
  }

  function removeSection(pageId: string, sectionId: string) {
    setPages((current) =>
      current.map((page) =>
        page.id !== pageId
          ? page
          : {
              ...page,
              sections: page.sections.filter((s) => s.id !== sectionId),
            },
      ),
    );
  }

  function handleDrop(targetPageId: string) {
    const sourceId = dragPageId.current;
    dragPageId.current = null;
    if (!sourceId || sourceId === targetPageId) return;

    setPages((current) => {
      const sourceIndex = current.findIndex((page) => page.id === sourceId);
      const targetIndex = current.findIndex((page) => page.id === targetPageId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved!);
      return next;
    });
  }

  function generate(mode: 'replace' | 'add-missing-seo-pages') {
    if (
      mode === 'replace' &&
      pages.length > 0 &&
      !window.confirm(
        'Replace the current sitemap with an AI-suggested one? This overwrites existing pages.',
      )
    ) {
      return;
    }

    startGenerating(async () => {
      try {
        const next = await generateWebsiteSitemap({
          accountId,
          websiteId,
          mode,
        });
        skipNextSave.current = true;
        setPages(next);
        toast.success(
          mode === 'replace'
            ? 'Sitemap suggested from brief'
            : 'Missing SEO pages added',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not generate sitemap',
        );
      }
    });
  }

  function renderPageCard(page: WebsiteSitemapPage, isChild = false) {
    const statusMeta = planningStatusMeta(page.status);
    const children = childrenOf.get(page.id) ?? [];

    return (
      <div
        key={page.id}
        className={cn('space-y-2', isChild ? '' : 'w-72 shrink-0')}
      >
        <div
          draggable={canEdit && !isChild}
          onDragStart={() => {
            dragPageId.current = page.id;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(page.id)}
          className={cn(
            'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40',
            isChild && 'ml-4 border-dashed',
          )}
        >
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-1.5">
              {canEdit && !isChild ? (
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--workspace-shell-text-muted)]" />
              ) : null}
              <Input
                value={page.title}
                readOnly={!canEdit}
                onChange={(event) =>
                  updatePage(page.id, { title: event.target.value })
                }
                className={cn(inputClass, 'h-8 font-medium')}
                placeholder="Page title"
              />
              {canEdit ? (
                <button
                  type="button"
                  className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                  onClick={() => removePage(page.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                /{page.slug}
              </span>
              <span
                className={cn(
                  'ml-auto rounded-full border px-2 py-0.5 text-[10px]',
                  statusMeta.colorClass,
                )}
              >
                {statusMeta.label}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Select
                value={page.pageType ?? 'other'}
                onValueChange={(value) =>
                  updatePage(page.id, { pageType: value as WebsitePageType })
                }
                disabled={!canEdit}
              >
                <SelectTrigger className={cn(inputClass, 'h-7 w-[7.5rem] text-xs')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={page.status ?? 'draft'}
                onValueChange={(value) =>
                  updatePage(page.id, {
                    status: value as WebsitePlanningStatus,
                  })
                }
                disabled={!canEdit}
              >
                <SelectTrigger className={cn(inputClass, 'h-7 w-[7.5rem] text-xs')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANNING_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit ? (
                <Select
                  value={page.parentId ?? '__none__'}
                  onValueChange={(value) =>
                    updatePage(page.id, {
                      parentId: value === '__none__' ? null : value,
                    })
                  }
                >
                  <SelectTrigger className={cn(inputClass, 'h-7 w-[7.5rem] text-xs')}>
                    <SelectValue placeholder="Nest under…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Top level</SelectItem>
                    {pages
                      .filter(
                        (candidate) =>
                          candidate.id !== page.id &&
                          candidate.parentId !== page.id,
                      )
                      .map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          Under {candidate.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            {siteStudioEnabled ? (
              <Input
                value={page.seoIntent ?? ''}
                readOnly={!canEdit}
                onChange={(event) =>
                  updatePage(page.id, { seoIntent: event.target.value })
                }
                className={cn(inputClass, 'h-7 text-xs')}
                placeholder="Search intent (one line)"
              />
            ) : null}

            {page.approvalNote ? (
              <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-2 py-1 text-xs text-amber-200/90">
                Client: {page.approvalNote}
              </p>
            ) : null}

            <div className="space-y-1.5">
              {page.sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  canEdit={canEdit}
                  onChange={(patch) => updateSection(page.id, section.id, patch)}
                  onRemove={() => removeSection(page.id, section.id)}
                  onMove={(direction) =>
                    moveSection(page.id, section.id, direction)
                  }
                />
              ))}
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-full text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                  onClick={() => addSection(page.id)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Section
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {children.map((child) => renderPageCard(child, true))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text)]/70">
            Pages as cards — drag to reorder, nest with the parent selector,
            colour-code sections, and mark repeating components.
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
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => generate('replace')}
                disabled={isGenerating}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? 'Generating…' : 'Suggest from brief'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
                onClick={() => generate('add-missing-seo-pages')}
                disabled={isGenerating || pages.length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Add missing SEO pages
              </Button>
            </>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)]"
              onClick={() => addPage()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add page
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTION_TYPE_OPTIONS.map((option) => (
          <span
            key={option.value}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--workspace-shell-border)] px-2 py-0.5 text-[10px] text-[var(--workspace-shell-text-muted)]"
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', option.dotClass)} />
            {option.label}
          </span>
        ))}
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-10 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          {siteStudioEnabled
            ? 'No pages yet. Fill in the Brief, then click Suggest from brief — or add pages manually.'
            : 'No pages yet. Add Home, About, Services, Contact…'}
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-2">
          <div className="flex items-start gap-4">
            {topLevelPages.map((page) => renderPageCard(page))}
          </div>
        </div>
      )}
    </div>
  );
}
