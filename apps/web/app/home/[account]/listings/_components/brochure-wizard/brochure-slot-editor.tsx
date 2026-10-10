'use client';

import { type DragEvent, useState } from 'react';

import { ImageIcon, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import type {
  BrochureImageFit,
  BrochureImageFocus,
  BrochureImageSlot,
  BrochurePage,
  BrochureSlotValue,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

/** Drag payload shared by the media tray and image slots. */
export const BROCHURE_DRAG_TYPE = 'application/x-ozer-brochure';

export type BrochureDragPayload =
  | { kind: 'media'; mediaId: string }
  | { kind: 'slot'; pageId: string; key: string };

export function readBrochureDrag(event: DragEvent): BrochureDragPayload | null {
  try {
    const raw = event.dataTransfer.getData(BROCHURE_DRAG_TYPE);
    return raw ? (JSON.parse(raw) as BrochureDragPayload) : null;
  } catch {
    return null;
  }
}

export function writeBrochureDrag(
  event: DragEvent,
  payload: BrochureDragPayload,
) {
  event.dataTransfer.setData(BROCHURE_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = 'move';
}

const SLOT_LABELS: Record<string, string> = {
  hero: 'Cover image',
  photo: 'Photo',
  photo1: 'Photo 1',
  photo2: 'Photo 2',
  photo3: 'Photo 3',
  plan: 'Floor plan',
  title: 'Title',
  address: 'Address',
  disposal: 'Disposal label',
  headline: 'Price lines',
  size: 'Size',
  rent: 'Rent',
  price: 'Price',
  reducedBadge: 'Reduced badge',
  brandName: 'Brand name',
  body: 'Body',
  highlights: 'Key points (one per line)',
  epc: 'EPC',
  caption: 'Caption',
  notice: 'Important notice',
  branchName: 'Branch name',
  branchAddress: 'Branch address',
  branchPhone: 'Branch phone',
  branchEmail: 'Branch email',
};

const MULTILINE_KEYS = new Set(['body', 'highlights', 'notice', 'headline']);

const FIT_OPTIONS: Array<{ id: BrochureImageFit; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'fill', label: 'Fill frame' },
  { id: 'whole', label: 'Whole image' },
];

const FOCUS_OPTIONS: Array<{ id: BrochureImageFocus; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'center', label: 'Centre' },
  { id: 'bottom', label: 'Bottom' },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-md border border-[var(--workspace-shell-border)]"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'px-2 py-1 text-xs transition-colors',
            value === option.id
              ? 'bg-[var(--ozer-accent)] text-white'
              : 'text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ImageSlotEditor({
  pageId,
  slotKey,
  slot,
  media,
  drawingIds,
  selected,
  onSelect,
  onChange,
  onDrop,
}: {
  pageId: string;
  slotKey: string;
  slot: BrochureImageSlot;
  media: BrochureMediaItem[];
  drawingIds: ReadonlySet<string>;
  selected: boolean;
  onSelect: () => void;
  onChange: (slot: BrochureImageSlot) => void;
  onDrop: (payload: BrochureDragPayload) => void;
}) {
  const [over, setOver] = useState(false);
  const fit = slot.fit ?? 'auto';
  const isDrawing = Boolean(slot.mediaId && drawingIds.has(slot.mediaId));
  const fills = fit === 'fill' || (fit === 'auto' && !isDrawing);
  const photos = media.filter((item) => item.mediaType === 'image');
  const plans = media.filter((item) => item.mediaType === 'floorplan');

  return (
    <div className="grid gap-2">
      <Label>{SLOT_LABELS[slotKey] ?? slotKey}</Label>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${SLOT_LABELS[slotKey] ?? slotKey}: select, or drop an image here`}
        draggable={Boolean(slot.url)}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        onDragStart={(event) =>
          writeBrochureDrag(event, { kind: 'slot', pageId, key: slotKey })
        }
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(BROCHURE_DRAG_TYPE)) {
            event.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const payload = readBrochureDrag(event);
          if (payload) onDrop(payload);
        }}
        className={cn(
          'relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 bg-[var(--ozer-surface-panel-hover)] transition-colors',
          over
            ? 'border-[var(--ozer-accent)]'
            : selected
              ? 'border-[var(--ozer-accent)]/70'
              : 'border-dashed border-[var(--workspace-shell-border)]',
        )}
      >
        {slot.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.url}
            alt=""
            className="h-full w-full"
            style={{
              objectFit: fills ? 'cover' : 'contain',
              objectPosition: `center ${slot.focus ?? 'center'}`,
            }}
          />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-xs text-[var(--workspace-shell-text-muted)]">
            <ImageIcon className="h-4 w-4" />
            Drop an image here, or select this slot and click one below
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <Select
          value={slot.mediaId ?? '__none__'}
          onValueChange={(value) => {
            if (value === '__none__') {
              onChange({ type: 'image', mediaId: null, url: null });
              return;
            }
            const item = media.find((m) => m.id === value);
            if (item)
              onChange({ type: 'image', mediaId: item.id, url: item.url });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Choose image" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No image</SelectItem>
            {photos.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Photos</SelectLabel>
                {photos.map((item, index) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fileName ?? `Photo ${index + 1}`}
                    {drawingIds.has(item.id) ? ' (drawing)' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            {plans.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Floor plans</SelectLabel>
                {plans.map((item, index) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fileName ?? `Floor plan ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
          </SelectContent>
        </Select>
        {slot.url ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Remove image"
            onClick={() =>
              onChange({ type: 'image', mediaId: null, url: null })
            }
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {slot.url ? (
        <>
          <Segmented
            label="Image fit"
            value={fit}
            options={FIT_OPTIONS}
            onChange={(next) => onChange({ ...slot, fit: next })}
          />
          {fit === 'auto' ? (
            <p className="text-[11px] text-[var(--workspace-shell-text-muted)]">
              {isDrawing
                ? 'Looks like a drawing, so the whole image is shown.'
                : 'Looks like a photo, so it fills the frame.'}
            </p>
          ) : null}
          {fills ? (
            <div className="grid gap-1">
              <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                Keep this part when cropping
              </span>
              <Segmented
                label="Crop position"
                value={slot.focus ?? 'center'}
                options={FOCUS_OPTIONS}
                onChange={(next) => onChange({ ...slot, focus: next })}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Edits every slot on one page. Image slots accept dragged media and other slots. */
export function BrochureSlotEditor({
  page,
  media,
  drawingIds,
  selectedSlotKey,
  onSelectSlot,
  onChange,
  onDropOnSlot,
}: {
  page: BrochurePage;
  media: BrochureMediaItem[];
  drawingIds: ReadonlySet<string>;
  selectedSlotKey: string | null;
  onSelectSlot: (key: string) => void;
  onChange: (slots: Record<string, BrochureSlotValue>) => void;
  onDropOnSlot: (key: string, payload: BrochureDragPayload) => void;
}) {
  function updateSlot(key: string, value: BrochureSlotValue) {
    onChange({ ...page.slots, [key]: value });
  }

  return (
    <div className="space-y-5">
      {Object.entries(page.slots).map(([key, slot]) => {
        if (slot.type === 'text') {
          const label = SLOT_LABELS[key] ?? key;
          return (
            <div key={key} className="grid gap-1.5">
              <Label>{label}</Label>
              {MULTILINE_KEYS.has(key) ? (
                <Textarea
                  value={slot.text}
                  rows={key === 'notice' || key === 'headline' ? 3 : 6}
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

        if (slot.type === 'image' && key === 'shopfront') {
          return (
            <div key={key} className="grid gap-1.5">
              <Label>Shopfront</Label>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {slot.url
                  ? 'From the branch settings for this workspace.'
                  : 'No shopfront photo is set for this branch.'}
              </p>
            </div>
          );
        }

        if (slot.type === 'image') {
          return (
            <ImageSlotEditor
              key={key}
              pageId={page.id}
              slotKey={key}
              slot={slot}
              media={media}
              drawingIds={drawingIds}
              selected={selectedSlotKey === key}
              onSelect={() => onSelectSlot(key)}
              onChange={(next) => updateSlot(key, next)}
              onDrop={(payload) => onDropOnSlot(key, payload)}
            />
          );
        }

        if (slot.type === 'facts') {
          return (
            <div key={key} className="grid gap-2">
              <Label>Facts</Label>
              {slot.rows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2"
                >
                  <Input
                    aria-label={`Fact ${index + 1} label`}
                    value={row.label}
                    onChange={(e) =>
                      updateSlot(key, {
                        type: 'facts',
                        rows: slot.rows.map((r, i) =>
                          i === index ? { ...r, label: e.target.value } : r,
                        ),
                      })
                    }
                  />
                  <Input
                    aria-label={`Fact ${index + 1} value`}
                    value={row.value}
                    onChange={(e) =>
                      updateSlot(key, {
                        type: 'facts',
                        rows: slot.rows.map((r, i) =>
                          i === index ? { ...r, value: e.target.value } : r,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Remove fact ${index + 1}`}
                    onClick={() =>
                      updateSlot(key, {
                        type: 'facts',
                        rows: slot.rows.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
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
            <div key={key} className="grid gap-2">
              <Label>Nearby places on the map</Label>
              {slot.amenities.map((amenity, index) => (
                <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    aria-label={`Place ${index + 1}`}
                    value={amenity.label}
                    onChange={(e) =>
                      updateSlot(key, {
                        ...slot,
                        amenities: slot.amenities.map((a, i) =>
                          i === index ? { ...a, label: e.target.value } : a,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Remove place ${index + 1}`}
                    onClick={() =>
                      updateSlot(key, {
                        ...slot,
                        amenities: slot.amenities
                          .filter((_, i) => i !== index)
                          .map((a, i) => ({ ...a, index: i + 1 })),
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() =>
                  updateSlot(key, {
                    ...slot,
                    amenities: [
                      ...slot.amenities,
                      { label: 'Place', index: slot.amenities.length + 1 },
                    ],
                  })
                }
              >
                Add place
              </Button>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
