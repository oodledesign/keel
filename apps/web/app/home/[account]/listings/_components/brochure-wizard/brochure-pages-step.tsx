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

import {
  type BrochureLayoutId,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureTemplateId,
  newBrochurePageId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  BROCHURE_LAYOUT_OPTIONS,
  createBlankBrochurePage,
} from '~/lib/commercial/brochure-pdf/build-brochure-document';
import {
  placeBrochureMedia,
  swapBrochureImageSlots,
  switchBrochurePageLayout,
} from '~/lib/commercial/brochure-pdf/switch-brochure-layout';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

import { BrochureMediaTray } from './brochure-media-tray';
import { BrochurePageStrip } from './brochure-page-strip';
import {
  BrochurePreviewPage,
  type BrochureWizardBrand,
} from './brochure-preview-page';
import {
  type BrochureDragPayload,
  BrochureSlotEditor,
} from './brochure-slot-editor';

const MAX_PAGES = 30;

export function BrochurePagesStep({
  doc,
  pages,
  selectedPageId,
  onSelectPage,
  editPages,
  media,
  drawingIds,
  brandName,
  brand,
  warnedPageIds,
  onNext,
}: {
  doc: { templateId: BrochureTemplateId; orientation: BrochureOrientation };
  pages: BrochurePage[];
  warnedPageIds: ReadonlySet<string>;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  editPages: (update: (pages: BrochurePage[]) => BrochurePage[]) => void;
  media: BrochureMediaItem[];
  drawingIds: ReadonlySet<string>;
  brandName: string;
  brand: BrochureWizardBrand;
  onNext: () => void;
}) {
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
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

  function addPage() {
    const blank = createBlankBrochurePage('photo_full');
    const insertAt = page ? pages.findIndex((p) => p.id === page.id) + 1 : 0;
    editPages((current) =>
      current.length >= MAX_PAGES
        ? current
        : [...current.slice(0, insertAt), blank, ...current.slice(insertAt)],
    );
    selectPage(blank.id);
  }

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
          onAdd={addPage}
        />
      </aside>

      <main className="flex min-h-0 flex-col">
        {page ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-[var(--workspace-shell-border)] px-5 py-2.5">
              <Label htmlFor="brochure-layout" className="text-xs">
                Layout
              </Label>
              <Select
                value={page.layoutId}
                onValueChange={(value) => {
                  updatePage(page.id, (p) =>
                    switchBrochurePageLayout(p, value as BrochureLayoutId),
                  );
                  setSelectedSlotKey(null);
                }}
              >
                <SelectTrigger
                  id="brochure-layout"
                  className="h-8 w-56 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BROCHURE_LAYOUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Changing the layout keeps this page&apos;s text and images.
              </p>
              <Button
                type="button"
                size="sm"
                className="ml-auto gap-1.5"
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
                <BrochurePreviewPage
                  page={page}
                  orientation={doc.orientation}
                  templateId={doc.templateId}
                  brandName={brandName}
                  brand={brand}
                  drawingIds={drawingIds}
                />
                <p className="mt-2 text-center text-[11px] text-[var(--workspace-shell-text-muted)]">
                  A quick preview. The next step shows the real PDF.
                </p>
              </div>
            </div>

            <div className="shrink-0 border-t border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-5 py-3">
              <BrochureMediaTray
                media={media}
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
            media={media}
            drawingIds={drawingIds}
            selectedSlotKey={selectedSlotKey}
            onSelectSlot={setSelectedSlotKey}
            onChange={(slots) => updatePage(page.id, (p) => ({ ...p, slots }))}
            onDropOnSlot={dropOnSlot}
          />
        ) : null}
      </aside>
    </div>
  );
}
