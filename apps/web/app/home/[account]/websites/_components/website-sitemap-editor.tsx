'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  createPlanningId,
  slugifyPageTitle,
  type WebsiteSitemapPage,
} from '~/lib/websites/planning-types';

import { saveWebsiteSitemap } from '../_lib/server/planning-actions';

export function WebsiteSitemapEditor({
  accountId,
  websiteId,
  initialSitemap,
  onSitemapChange,
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialSitemap: WebsiteSitemapPage[];
  onSitemapChange?: (sitemap: WebsiteSitemapPage[]) => void;
  canEdit: boolean;
}) {
  const [pages, setPages] = useState(initialSitemap);
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(
    () => new Set(initialSitemap.map((page) => page.id)),
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, startTransition] = useTransition();
  const skipNextSave = useRef(true);
  const onSitemapChangeRef = useRef(onSitemapChange);
  onSitemapChangeRef.current = onSitemapChange;

  useEffect(() => {
    setPages((current) => {
      if (current === initialSitemap) return current;
      skipNextSave.current = true;
      return initialSitemap;
    });
  }, [initialSitemap]);

  function updatePages(
    next:
      | WebsiteSitemapPage[]
      | ((current: WebsiteSitemapPage[]) => WebsiteSitemapPage[]),
  ) {
    setPages((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      queueMicrotask(() => onSitemapChangeRef.current?.(resolved));
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

  function addPage() {
    const title = 'New page';
    const page: WebsiteSitemapPage = {
      id: createPlanningId(),
      title,
      slug: slugifyPageTitle(title),
      sections: [],
    };
    updatePages((current) => [...current, page]);
    setExpandedPageIds((current) => new Set([...current, page.id]));
  }

  function updatePage(pageId: string, patch: Partial<WebsiteSitemapPage>) {
    updatePages((current) =>
      current.map((page) => {
        if (page.id !== pageId) return page;
        const next = { ...page, ...patch };
        if (patch.title !== undefined) {
          next.slug = slugifyPageTitle(patch.title);
        }
        return next;
      }),
    );
  }

  function removePage(pageId: string) {
    updatePages((current) => current.filter((page) => page.id !== pageId));
  }

  function addSection(pageId: string) {
    updatePages((current) =>
      current.map((page) => {
        if (page.id !== pageId) return page;
        return {
          ...page,
          sections: [
            ...page.sections,
            {
              id: createPlanningId(),
              title: 'New section',
              description: '',
            },
          ],
        };
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--workspace-shell-text)]/70">
            Map pages and sections before design. ~5 minutes with the client.
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
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
            onClick={addPage}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add page
          </Button>
        ) : null}
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-sm text-[var(--workspace-shell-text-muted)]">
          No pages yet. Add Home, About, Services, Contact…
        </div>
      ) : (
        <ul className="space-y-3">
          {pages.map((page) => {
            const expanded = expandedPageIds.has(page.id);
            return (
              <li
                key={page.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40"
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    className="mt-1 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                    onClick={() =>
                      setExpandedPageIds((current) => {
                        const next = new Set(current);
                        if (next.has(page.id)) next.delete(page.id);
                        else next.add(page.id);
                        return next;
                      })
                    }
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={page.title}
                        readOnly={!canEdit}
                        onChange={(event) =>
                          updatePage(page.id, { title: event.target.value })
                        }
                        className="h-9 max-w-xs border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
                        placeholder="Page title"
                      />
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">/{page.slug}</span>
                    </div>
                    {expanded ? (
                      <div className="space-y-2 pl-1">
                        {page.sections.map((section) => (
                          <div
                            key={section.id}
                            className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1 space-y-2">
                                <Input
                                  value={section.title}
                                  readOnly={!canEdit}
                                  onChange={(event) =>
                                    setPages((current) =>
                                      current.map((item) =>
                                        item.id !== page.id
                                          ? item
                                          : {
                                              ...item,
                                              sections: item.sections.map(
                                                (row) =>
                                                  row.id === section.id
                                                    ? {
                                                        ...row,
                                                        title: event.target.value,
                                                      }
                                                    : row,
                                              ),
                                            },
                                      ),
                                    )
                                  }
                                  className="h-8 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-sm text-[var(--workspace-shell-text)]"
                                  placeholder="Section title"
                                />
                                <Textarea
                                  value={section.description}
                                  readOnly={!canEdit}
                                  rows={2}
                                  onChange={(event) =>
                                    setPages((current) =>
                                      current.map((item) =>
                                        item.id !== page.id
                                          ? item
                                          : {
                                              ...item,
                                              sections: item.sections.map(
                                                (row) =>
                                                  row.id === section.id
                                                    ? {
                                                        ...row,
                                                        description:
                                                          event.target.value,
                                                      }
                                                    : row,
                                              ),
                                            },
                                      ),
                                    )
                                  }
                                  placeholder="What this section communicates…"
                                  className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-sm text-[var(--workspace-shell-text)]"
                                />
                              </div>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-[var(--workspace-shell-text-muted)] hover:text-red-400"
                                  onClick={() =>
                                    setPages((current) =>
                                      current.map((item) =>
                                        item.id !== page.id
                                          ? item
                                          : {
                                              ...item,
                                              sections: item.sections.filter(
                                                (row) => row.id !== section.id,
                                              ),
                                            },
                                      ),
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {canEdit ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                            onClick={() => addSection(page.id)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add section
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                        {page.sections.length} section
                        {page.sections.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className={cn('text-[var(--workspace-shell-text-muted)] hover:text-red-400')}
                      onClick={() => removePage(page.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
