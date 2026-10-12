'use client';

import { useMemo, useState } from 'react';

import { ArrowRight } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import {
  BROCHURE_CONTENT_OPTIONS,
  type BrochureContentKind,
  contentOf,
  defaultLayoutFor,
  layoutsFor,
} from '~/lib/commercial/brochure-pdf/brochure-content';
import {
  type BrochureDisplayOptions,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureTemplateId,
  newBrochurePageId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import { createBlankBrochurePage } from '~/lib/commercial/brochure-pdf/build-brochure-document';
import {
  placeBrochureMedia,
  swapBrochureImageSlots,
  switchBrochurePageContent,
  switchBrochurePageLayout,
} from '~/lib/commercial/brochure-pdf/switch-brochure-layout';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

import { getBrochurePageContent } from '../../_lib/server/brochure-actions';
import { BrochureLayoutPicker } from './brochure-layout-picker';
import { BrochureLivePage } from './brochure-live-page';
import { BrochureMediaTray } from './brochure-media-tray';
import { BrochurePageStrip } from './brochure-page-strip';
import {
  type BrochureDragPayload,
  BrochureSlotEditor,
} from './brochure-slot-editor';

const MAX_PAGES = 30;

export function BrochurePagesStep({
  listingId,
  accountId,
  display,
  doc,
  pages,
  selectedPageId,
  onSelectPage,
  editPages,
  media,
  onMediaError,
  drawingIds,
  warnedPageIds,
  onNext,
}: {
  listingId: string;
  accountId: string;
  display: BrochureDisplayOptions;
  doc: { templateId: BrochureTemplateId; orientation: BrochureOrientation };
  pages: BrochurePage[];
  warnedPageIds: ReadonlySet<string>;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  editPages: (update: (pages: BrochurePage[]) => BrochurePage[]) => void;
  media: BrochureMediaItem[];
  /** A thumbnail failed to load (its signed link may have expired). */
  onMediaError: () => void;
  drawingIds: ReadonlySet<string>;
  onNext: () => void;
}) {
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const page = pages.find((p) => p.id === selectedPageId) ?? pages[0] ?? null;
  const mediaById = useMemo(
    () => new Map(media.map((m) => [m.id, m])),
    [media],
  );
  const usedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of pages) {
      for (const slot of Object.values(p.slots)) {
        if (slot.type === 'image' && slot.mediaId) ids.add(slot.mediaId);
      }
    }
    return ids;
  }, [pages]);

  const selectedImageSlot =
    page && selectedSlotKey && page.slots[selectedSlotKey]?.type === 'image'
      ? selectedSlotKey
      : null;

  function selectPage(pageId: string) {
    onSelectPage(pageId);
    setSelectedSlotKey(null);
  }

  function updatePage(
    pageId: string,
    update: (p: BrochurePage) => BrochurePage,
  ) {
    editPages((current) =>
      current.map((p) => (p.id === pageId ? update(p) : p)),
    );
  }

  function placeMedia(pageId: string, key: string, item: BrochureMediaItem) {
    updatePage(pageId, (p) => ({
      ...p,
      slots: { ...p.slots, [key]: placeBrochureMedia(item) },
    }));
  }

  function dropOnSlot(key: string, payload: BrochureDragPayload) {
    if (!page) return;
    if (payload.kind === 'media') {
      const item = mediaById.get(payload.mediaId);
      if (item) placeMedia(page.id, key, item);
      return;
    }
    editPages((current) =>
      swapBrochureImageSlots(current, payload, { pageId: page.id, key }),
    );
  }

  function duplicatePage(pageId: string) {
    editPages((current) => {
      const index = current.findIndex((p) => p.id === pageId);
      const source = current[index];
      if (!source || current.length >= MAX_PAGES) return current;
      const copy = { ...structuredClone(source), id: newBrochurePageId() };
      return [
        ...current.slice(0, index + 1),
        copy,
        ...current.slice(index + 1),
      ];
    });
  }

  function deletePage(pageId: string) {
    if (pages.length <= 1) return;
    const index = pages.findIndex((p) => p.id === pageId);
    editPages((current) => current.filter((p) => p.id !== pageId));
    if (pageId === page?.id) {
      const neighbour = pages[index + 1] ?? pages[index - 1];
      if (neighbour) selectPage(neighbour.id);
    }
  }

  /** `content` filled from the listing; null when it couldn't be loaded. */
  async function listingContent(
    content: BrochureContentKind,
  ): Promise<BrochurePage | null> {
    if (content === 'photos') return null;
    setLoadingContent(true);
    try {
      return await getBrochurePageContent({
        listingId,
        accountId,
        content,
        templateId: doc.templateId,
        orientation: doc.orientation,
        display,
        usedMediaIds: [...usedIds],
      });
    } catch {
      toast.error(
        'The listing details could not be loaded, so the page starts blank.',
      );
      return null;
    } finally {
      setLoadingContent(false);
    }
  }

  async function changeContent(pageId: string, content: BrochureContentKind) {
    const target = pages.find((p) => p.id === pageId);
    if (!target || contentOf(target.layoutId) === content) return;
    setSelectedSlotKey(null);
    const filled = target.contentStash?.[content]
      ? null
      : await listingContent(content);
    updatePage(pageId, (p) => switchBrochurePageContent(p, content, filled));
  }

  async function addPage(content: BrochureContentKind) {
    const afterId = page?.id ?? null;
    const filled = await listingContent(content);
    const added: BrochurePage = {
      ...(filled ?? createBlankBrochurePage(defaultLayoutFor(content))),
      id: newBrochurePageId(),
    };
    editPages((current) => {
      if (current.length >= MAX_PAGES) return current;
      const after = current.findIndex((p) => p.id === afterId);
      const insertAt = after >= 0 ? after + 1 : current.length;
      return [...current.slice(0, insertAt), added, ...current.slice(insertAt)];
    });
    selectPage(added.id);
  }

  const content = page ? contentOf(page.layoutId) : null;
  const layouts = content ? layoutsFor(content) : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-[13rem_minmax(0,1fr)_20rem]">
      <aside className="flex min-h-0 flex-col border-r border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
        <BrochurePageStrip
          pages={pages}
          selectedPageId={page?.id ?? null}
          warnedPageIds={warnedPageIds}
          onSelect={selectPage}
          onReorder={(next) => editPages(() => next)}
          onDuplicate={duplicatePage}
          onDelete={deletePage}
          onAdd={(kind) => void addPage(kind)}
          adding={loadingContent}
        />
      </aside>

      <main className="flex min-h-0 flex-col">
        {page ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--workspace-shell-border)] px-5 py-2.5">
              <Label htmlFor="brochure-content" className="text-xs">
                Page content
              </Label>
              <Select
                value={content ?? undefined}
                disabled={loadingContent}
                onValueChange={(value) =>
                  void changeContent(page.id, value as BrochureContentKind)
                }
              >
                <SelectTrigger
                  id="brochure-content"
                  className="h-8 w-44 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROCHURE_CONTENT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.id}
                      value={option.id}
                      className="text-xs"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {layouts.length > 1 ? (
                <>
                  <Label htmlFor="brochure-layout" className="text-xs">
                    Layout
                  </Label>
                  <BrochureLayoutPicker
                    id="brochure-layout"
                    value={page.layoutId}
                    layouts={layouts}
                    orientation={doc.orientation}
                    onChange={(layoutId) => {
                      updatePage(page.id, (p) =>
                        switchBrochurePageLayout(p, layoutId),
                      );
                      setSelectedSlotKey(null);
                    }}
                  />
                </>
              ) : null}
              <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-[var(--workspace-shell-text-muted)]">
                {loadingContent
                  ? 'Filling the page from the listing…'
                  : 'New content is filled from the listing. Switch back and your edits return.'}
              </p>
              <Button
                type="button"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={onNext}
              >
                Check the PDF
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
              <div
                className={
                  doc.orientation === 'landscape'
                    ? 'w-full max-w-3xl'
                    : 'w-full max-w-md'
                }
              >
                <BrochureLivePage
                  listingId={listingId}
                  accountId={accountId}
                  templateId={doc.templateId}
                  orientation={doc.orientation}
                  pages={pages}
                  pageId={page.id}
                  display={display}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-5 py-3">
              <BrochureMediaTray
                media={media}
                onImageError={onMediaError}
                drawingIds={drawingIds}
                usedIds={usedIds}
                canPlace={selectedImageSlot != null}
                onPlace={(item) => {
                  if (selectedImageSlot) {
                    placeMedia(page.id, selectedImageSlot, item);
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text-muted)]">
            Add a page to get started.
          </div>
        )}
      </main>

      <aside className="min-h-0 overflow-y-auto border-l border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
        {page ? (
          <BrochureSlotEditor
            key={page.id}
            page={page}
            templateId={doc.templateId}
            display={display}
            media={media}
            onImageError={onMediaError}
            drawingIds={drawingIds}
            selectedSlotKey={selectedSlotKey}
            onSelectSlot={setSelectedSlotKey}
            onChange={(slots) => updatePage(page.id, (p) => ({ ...p, slots }))}
            onDropOnSlot={dropOnSlot}
            onHiddenButtonsChange={(hidden) =>
              updatePage(page.id, (p) => {
                const next: BrochurePage = { ...p, hiddenButtons: hidden };
                if (hidden.length === 0) delete next.hiddenButtons;
                return next;
              })
            }
          />
        ) : null}
      </aside>
    </div>
  );
}
