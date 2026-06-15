'use client';

import { useEffect, useState, useTransition } from 'react';

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
  canEdit,
}: {
  accountId: string;
  websiteId: string;
  initialSitemap: WebsiteSitemapPage[];
  canEdit: boolean;
}) {
  const [pages, setPages] = useState(initialSitemap);
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(
    () => new Set(initialSitemap.map((page) => page.id)),
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPages(initialSitemap);
  }, [initialSitemap]);

  useEffect(() => {
    if (!canEdit) return;

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
    setPages((current) => [...current, page]);
    setExpandedPageIds((current) => new Set([...current, page.id]));
  }

  function updatePage(pageId: string, patch: Partial<WebsiteSitemapPage>) {
    setPages((current) =>
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
    setPages((current) => current.filter((page) => page.id !== pageId));
  }

  function addSection(pageId: string) {
    setPages((current) =>
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
          <p className="text-sm text-white/70">
            Map pages and sections before design. ~5 minutes with the client.
          </p>
          {canEdit ? (
            <p className="mt-1 text-xs text-zinc-500">
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
            className="border-white/10 text-white hover:bg-white/5"
            onClick={addPage}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add page
          </Button>
        ) : null}
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
          No pages yet. Add Home, About, Services, Contact…
        </div>
      ) : (
        <ul className="space-y-3">
          {pages.map((page) => {
            const expanded = expandedPageIds.has(page.id);
            return (
              <li
                key={page.id}
                className="rounded-xl border border-white/10 bg-[#0B132B]/40"
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    className="mt-1 text-zinc-500 hover:text-white"
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
                        className="h-9 max-w-xs border-white/10 bg-[#0B132B] text-white"
                        placeholder="Page title"
                      />
                      <span className="text-xs text-zinc-500">/{page.slug}</span>
                    </div>
                    {expanded ? (
                      <div className="space-y-2 pl-1">
                        {page.sections.map((section) => (
                          <div
                            key={section.id}
                            className="rounded-lg border border-white/5 bg-black/20 p-3"
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
                                  className="h-8 border-white/10 bg-[#0B132B] text-sm text-white"
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
                                  className="border-white/10 bg-[#0B132B] text-sm text-white"
                                />
                              </div>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-zinc-500 hover:text-red-400"
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
                            className="text-zinc-400 hover:text-white"
                            onClick={() => addSection(page.id)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add section
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        {page.sections.length} section
                        {page.sections.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className={cn('text-zinc-500 hover:text-red-400')}
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
