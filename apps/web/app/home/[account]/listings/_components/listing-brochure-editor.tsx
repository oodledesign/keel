'use client';

import { useMemo, useState, useTransition } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  getListingBrochureDocument,
  regenerateListingBrochure,
  saveListingBrochureDocument,
} from '../_lib/server/brochure-actions';
import {
  BROCHURE_LAYOUT_OPTIONS,
  createBlankBrochurePage,
} from '~/lib/commercial/brochure-pdf/build-brochure-document';
import {
  BROCHURE_TEMPLATE_OPTIONS,
  type BrochureDocument,
  type BrochureLayoutId,
  type BrochureOrientation,
  type BrochurePage,
  type BrochureSlotValue,
  type BrochureTemplateId,
  newBrochurePageId,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

type ListingBrochureEditorProps = {
  listingId: string;
  accountId: string;
  accountSlug: string;
  listingName: string;
  accountName: string;
  brand: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  initialDocument: BrochureDocument & { id: string };
  images: BrochureMediaItem[];
};

function layoutLabel(id: BrochureLayoutId) {
  return BROCHURE_LAYOUT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function slotText(
  page: BrochurePage,
  key: string,
): string {
  const s = page.slots[key];
  return s?.type === 'text' ? s.text : '';
}

function slotImageUrl(page: BrochurePage, key: string): string | null {
  const s = page.slots[key];
  return s?.type === 'image' ? s.url : null;
}

function PreviewPage({
  page,
  orientation,
  templateId,
  brandName,
  brand,
}: {
  page: BrochurePage;
  orientation: BrochureOrientation;
  templateId: BrochureTemplateId;
  brandName: string;
  brand: ListingBrochureEditorProps['brand'];
}) {
  const primary = brand.primaryColor || 'var(--ozer-plum-900, #351E28)';
  const accent = brand.accentColor || 'var(--ozer-coral-500, #FF5C34)';
  const paper = 'var(--ozer-cream-50, #FBF6EC)';
  const landscape = orientation === 'landscape';
  const title =
    slotText(page, 'title') ||
    slotText(page, 'address') ||
    layoutLabel(page.layoutId);

  const frameClass = cn(
    'overflow-hidden rounded-md border border-[var(--workspace-shell-border)] bg-white shadow-sm',
    landscape ? 'aspect-[297/210]' : 'aspect-[210/297]',
  );

  if (page.layoutId === 'cover_hero_band') {
    const hero = slotImageUrl(page, 'hero');
    const disposal = slotText(page, 'disposal');
    const bandPct = templateId === 'editorial' ? 26 : templateId === 'compact' ? 38 : 32;

    if (landscape) {
      return (
        <div className={frameClass}>
          <div className="flex h-full">
            <div className="relative h-full flex-1 bg-[var(--ozer-cream-100,#F5EFE3)]">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div
              className="flex h-full flex-col gap-1.5 p-3"
              style={{
                width: `${bandPct}%`,
                backgroundColor: primary,
                color: paper,
                borderLeft:
                  templateId === 'editorial' ? `3px solid ${accent}` : undefined,
              }}
            >
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt=""
                  className="mb-1 h-6 w-auto max-w-full object-contain object-left"
                />
              ) : (
                <p className="text-[9px] font-semibold tracking-wide uppercase opacity-80">
                  {brandName}
                </p>
              )}
              {disposal ? (
                <p className="text-[9px] font-semibold uppercase" style={{ color: accent }}>
                  {disposal}
                </p>
              ) : null}
              <p className="line-clamp-4 text-sm font-semibold leading-snug">
                {title}
              </p>
              <p className="mt-auto text-[9px] opacity-50">Cover</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={frameClass}>
        <div className="flex h-full flex-col">
          <div className="relative min-h-0 flex-1 bg-[var(--ozer-cream-100,#F5EFE3)]">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div
            className="flex flex-col gap-1 p-3"
            style={{ backgroundColor: primary, color: paper, minHeight: '32%' }}
          >
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className="mb-1 h-5 w-auto max-w-[40%] object-contain object-left"
              />
            ) : (
              <p className="text-[9px] uppercase opacity-70">{brandName}</p>
            )}
            <p className="line-clamp-2 text-sm font-semibold">{title}</p>
          </div>
        </div>
      </div>
    );
  }

  if (
    page.layoutId === 'photo_full' ||
    page.layoutId === 'photo_grid_2' ||
    page.layoutId === 'photo_grid_3' ||
    page.layoutId === 'floorplan'
  ) {
    const urls = [
      slotImageUrl(page, 'photo'),
      slotImageUrl(page, 'photo1'),
      slotImageUrl(page, 'plan'),
      slotImageUrl(page, 'photo2'),
      slotImageUrl(page, 'photo3'),
    ].filter(Boolean) as string[];

    return (
      <div className={frameClass}>
        <div
          className={cn(
            'grid h-full gap-1 bg-[var(--ozer-cream-100,#F5EFE3)] p-1.5',
            page.layoutId === 'photo_grid_2' && landscape
              ? 'grid-rows-2'
              : page.layoutId === 'photo_grid_2'
                ? 'grid-rows-2'
                : page.layoutId === 'photo_grid_3'
                  ? 'grid-rows-[1.2fr_0.8fr]'
                  : 'grid-rows-1',
          )}
        >
          {urls.length === 0 ? (
            <div className="flex items-center justify-center text-xs text-[var(--workspace-shell-text-muted)]">
              {layoutLabel(page.layoutId)}
            </div>
          ) : page.layoutId === 'photo_grid_3' ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[0]}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="grid grid-cols-2 gap-1">
                {urls.slice(1, 3).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={u}
                    src={u}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ))}
              </div>
            </>
          ) : (
            urls.slice(0, page.layoutId === 'photo_grid_2' ? 2 : 1).map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u}
                src={u}
                alt=""
                className="h-full w-full object-cover"
              />
            ))
          )}
        </div>
      </div>
    );
  }

  if (page.layoutId === 'map_amenities') {
    return (
      <div className={frameClass}>
        <div
          className={cn(
            'flex h-full gap-2 bg-white p-3',
            landscape ? 'flex-row' : 'flex-col',
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold" style={{ color: primary }}>
              {title || 'Location'}
            </p>
            <p className="line-clamp-4 text-[10px] text-[var(--workspace-shell-text-muted)]">
              {slotText(page, 'body') || 'Map & amenities'}
            </p>
          </div>
          <div
            className={cn(
              'rounded-sm bg-[var(--ozer-cream-100,#F5EFE3)]',
              landscape ? 'w-[58%]' : 'h-[45%] w-full',
            )}
          />
        </div>
      </div>
    );
  }

  // facts / description / contact — text-led
  const body = slotText(page, 'body');
  const highlights = slotText(page, 'highlights').trim();
  return (
    <div className={frameClass}>
      <div className="flex h-full flex-col gap-2 bg-white p-3">
        <div
          className="h-1 w-10 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <p className="text-xs font-semibold" style={{ color: primary }}>
          {title}
        </p>
        {body ? (
          <p className="line-clamp-5 text-[10px] leading-relaxed text-[var(--workspace-shell-text-muted)]">
            {body}
          </p>
        ) : null}
        {highlights ? (
          <p className="line-clamp-4 whitespace-pre-line text-[10px] text-[var(--workspace-shell-text)]">
            {highlights}
          </p>
        ) : null}
        {!body && !highlights ? (
          <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
            {layoutLabel(page.layoutId)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SlotEditor({
  page,
  images,
  onChange,
}: {
  page: BrochurePage;
  images: BrochureMediaItem[];
  onChange: (slots: Record<string, BrochureSlotValue>) => void;
}) {
  const entries = Object.entries(page.slots);

  function updateSlot(key: string, value: BrochureSlotValue) {
    onChange({ ...page.slots, [key]: value });
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, slot]) => {
        if (slot.type === 'text') {
          const multiline = key === 'body' || key === 'highlights' || key === 'notice';
          return (
            <div key={key} className="grid gap-1.5">
              <Label className="capitalize">{key}</Label>
              {multiline ? (
                <Textarea
                  value={slot.text}
                  rows={key === 'notice' ? 4 : 6}
                  onChange={(e) =>
                    updateSlot(key, { type: 'text', text: e.target.value })
                  }
                />
              ) : (
                <Input
                  value={slot.text}
                  onChange={(e) =>
                    updateSlot(key, { type: 'text', text: e.target.value })
                  }
                />
              )}
            </div>
          );
        }

        if (slot.type === 'image') {
          return (
            <div key={key} className="grid gap-1.5">
              <Label className="capitalize">{key}</Label>
              <Select
                value={slot.mediaId ?? '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') {
                    updateSlot(key, { type: 'image', mediaId: null, url: null });
                    return;
                  }
                  const media = images.find((i) => i.id === v);
                  updateSlot(key, {
                    type: 'image',
                    mediaId: v,
                    url: media?.url ?? null,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose photo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No image</SelectItem>
                  {images.map((img) => (
                    <SelectItem key={img.id} value={img.id}>
                      {img.fileName ?? (img.isCover ? 'Cover photo' : img.id.slice(0, 8))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {slot.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slot.url}
                  alt=""
                  className="mt-1 h-24 w-full rounded-md object-cover"
                />
              ) : null}
            </div>
          );
        }

        if (slot.type === 'facts') {
          return (
            <div key={key} className="grid gap-2">
              <Label>Facts</Label>
              {slot.rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className="grid grid-cols-2 gap-2">
                  <Input
                    value={row.label}
                    onChange={(e) => {
                      const rows = slot.rows.map((r, i) =>
                        i === index ? { ...r, label: e.target.value } : r,
                      );
                      updateSlot(key, { type: 'facts', rows });
                    }}
                  />
                  <Input
                    value={row.value}
                    onChange={(e) => {
                      const rows = slot.rows.map((r, i) =>
                        i === index ? { ...r, value: e.target.value } : r,
                      );
                      updateSlot(key, { type: 'facts', rows });
                    }}
                  />
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateSlot(key, {
                    type: 'facts',
                    rows: [...slot.rows, { label: 'Label', value: '' }],
                  })
                }
              >
                Add row
              </Button>
            </div>
          );
        }

        if (slot.type === 'map') {
          return (
            <div key={key} className="space-y-2">
              <Label>Map amenities</Label>
              {slot.amenities.map((amenity, index) => (
                <Input
                  key={index}
                  value={amenity.label}
                  onChange={(e) => {
                    const amenities = slot.amenities.map((a, i) =>
                      i === index ? { ...a, label: e.target.value } : a,
                    );
                    updateSlot(key, { ...slot, amenities });
                  }}
                />
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  updateSlot(key, {
                    ...slot,
                    amenities: [
                      ...slot.amenities,
                      {
                        label: 'Amenity',
                        index: slot.amenities.length + 1,
                      },
                    ],
                  })
                }
              >
                Add amenity
              </Button>
            </div>
          );
        }

        return (
          <p
            key={key}
            className="text-xs text-[var(--workspace-shell-text-muted)]"
          >
            {key}: {slot.type} (auto from listing)
          </p>
        );
      })}
    </div>
  );
}

export function ListingBrochureEditor({
  listingId,
  accountId,
  accountSlug: _accountSlug,
  listingName,
  accountName,
  brand,
  initialDocument,
  images,
}: ListingBrochureEditorProps) {
  const [document, setDocument] = useState(initialDocument);
  const [selectedPageId, setSelectedPageId] = useState(
    initialDocument.pages[0]?.id ?? '',
  );
  const [pending, startTransition] = useTransition();

  const selectedPage = useMemo(
    () => document.pages.find((p) => p.id === selectedPageId) ?? document.pages[0],
    [document.pages, selectedPageId],
  );

  function updatePages(pages: BrochurePage[]) {
    setDocument((current) => ({ ...current, pages }));
  }

  function movePage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= document.pages.length) return;
    const next = [...document.pages];
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    updatePages(next);
  }

  function save() {
    startTransition(async () => {
      try {
        const saved = await saveListingBrochureDocument({
          listingId,
          accountId,
          templateId: document.templateId,
          orientation: document.orientation,
          pages: document.pages,
        });
        setDocument(saved);
        toast.success('Brochure saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save brochure',
        );
      }
    });
  }

  function regenerate(templateId: BrochureTemplateId) {
    if (
      !window.confirm(
        'Regenerate from template? This replaces the current pages for this orientation.',
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const next = await regenerateListingBrochure({
          listingId,
          accountId,
          templateId,
          orientation: document.orientation,
        });
        setDocument(next);
        setSelectedPageId(next.pages[0]?.id ?? '');
        toast.success('Brochure regenerated');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not regenerate',
        );
      }
    });
  }

  function changeOrientation(orientation: BrochureOrientation) {
    if (orientation === document.orientation) return;
    if (
      !window.confirm(
        'Switch orientation? Unsaved edits on this orientation will be discarded. Continue?',
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const next = await getListingBrochureDocument({
          listingId,
          accountId,
          orientation,
        });
        setDocument(next);
        setSelectedPageId(next.pages[0]?.id ?? '');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not switch orientation',
        );
      }
    });
  }

  function downloadPdf() {
    startTransition(async () => {
      try {
        await saveListingBrochureDocument({
          listingId,
          accountId,
          templateId: document.templateId,
          orientation: document.orientation,
          pages: document.pages,
        });
        const params = new URLSearchParams({
          listingId,
          accountId,
          orientation: document.orientation,
          template: document.templateId,
          useSaved: '1',
        });
        const res = await fetch(`/api/listings/brochure-pdf?${params}`);
        if (!res.ok) throw new Error('PDF generation failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${listingName || 'brochure'}.pdf`;
        window.document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not download PDF',
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Brochure editor
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Slot-based pages for {listingName}. Preview mirrors layout and brand
            colours — download PDF for print-ready output. After changing
            template, regenerate to rebuild pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={document.orientation}
            onValueChange={(v) => changeOrientation(v as BrochureOrientation)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={document.templateId}
            onValueChange={(v) => regenerate(v as BrochureTemplateId)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BROCHURE_TEMPLATE_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={save}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={downloadPdf}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        {/* Filmstrip */}
        <aside className="space-y-2 rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--workspace-shell-text)]">
              Pages ({document.pages.length})
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                const blank = createBlankBrochurePage('photo_full');
                updatePages([...document.pages, blank]);
                setSelectedPageId(blank.id);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {document.pages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setSelectedPageId(page.id)}
                className={cn(
                  'w-full rounded-md border p-2 text-left transition-colors',
                  page.id === selectedPage?.id
                    ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                    : 'border-[var(--workspace-shell-border)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
                )}
              >
                <p className="text-[10px] text-[var(--workspace-shell-text-muted)]">
                  Page {index + 1}
                </p>
                <p className="truncate text-xs font-medium text-[var(--workspace-shell-text)]">
                  {layoutLabel(page.layoutId)}
                </p>
              </button>
            ))}
          </div>
        </aside>

        {/* Preview */}
        <section className="rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
          {selectedPage ? (
            <div className="mx-auto max-w-2xl">
              <PreviewPage
                page={selectedPage}
                orientation={document.orientation}
                templateId={document.templateId}
                brandName={accountName || listingName}
                brand={brand}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              Add a page to get started.
            </p>
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-4 rounded-xl border border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3">
          {selectedPage ? (
            <>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    movePage(
                      document.pages.findIndex((p) => p.id === selectedPage.id),
                      -1,
                    )
                  }
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() =>
                    movePage(
                      document.pages.findIndex((p) => p.id === selectedPage.id),
                      1,
                    )
                  }
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => {
                    const copy: BrochurePage = {
                      ...selectedPage,
                      id: newBrochurePageId(),
                      slots: structuredClone(selectedPage.slots),
                    };
                    const idx = document.pages.findIndex(
                      (p) => p.id === selectedPage.id,
                    );
                    const next = [...document.pages];
                    next.splice(idx + 1, 0, copy);
                    updatePages(next);
                    setSelectedPageId(copy.id);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => {
                    const next = document.pages.filter(
                      (p) => p.id !== selectedPage.id,
                    );
                    updatePages(next);
                    setSelectedPageId(next[0]?.id ?? '');
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="grid gap-1.5">
                <Label>Layout</Label>
                <Select
                  value={selectedPage.layoutId}
                  onValueChange={(v) => {
                    const layoutId = v as BrochureLayoutId;
                    const blank = createBlankBrochurePage(layoutId);
                    const next = document.pages.map((p) =>
                      p.id === selectedPage.id
                        ? { ...blank, id: selectedPage.id }
                        : p,
                    );
                    updatePages(next);
                  }}
                >
                  <SelectTrigger>
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
              </div>

              <SlotEditor
                page={selectedPage}
                images={images}
                onChange={(slots) => {
                  updatePages(
                    document.pages.map((p) =>
                      p.id === selectedPage.id ? { ...p, slots } : p,
                    ),
                  );
                }}
              />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
