'use client';

import { type DragEvent, Fragment, type ReactNode, useState } from 'react';

import {
  AlertTriangle,
  Building2,
  Car,
  GraduationCap,
  Hash,
  Hospital,
  ImageIcon,
  type LucideIcon,
  Plane,
  ShoppingBasket,
  TrainFront,
  Trees,
  Wand2,
  X,
} from 'lucide-react';

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
import { Switch } from '@kit/ui/switch';
import { cn } from '@kit/ui/utils';

import {
  type BrochureDisplayOptions,
  type BrochureImageFit,
  type BrochureImageFocus,
  type BrochureImageSlot,
  type BrochurePage,
  type BrochureSlotValue,
  type BrochureTemplateId,
  isCoverLayout,
} from '~/lib/commercial/brochure-pdf/brochure-document';
import {
  type BrochureHeadingField,
  headingFieldsFor,
  isBrochureHeadingKey,
} from '~/lib/commercial/brochure-pdf/brochure-headings';
import {
  BROCHURE_LINK_BUTTON_IDS,
  type BrochureLinkButtonId,
} from '~/lib/commercial/brochure-pdf/brochure-links';
import {
  AMENITY_ICONS,
  type AmenityIcon,
  type BrochureAmenityItem,
  MAX_AMENITIES,
  joinNearbyAmenityLabel,
  resolveAmenityIcon,
  splitNearbyAmenityLabel,
} from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';
import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

import { BrochureMediaImage } from './brochure-media-image';
import {
  BrochureMergeFieldHint,
  BrochureMergeTextField,
} from './brochure-merge-text-field';

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

const PLACE_LIMIT_OPTIONS = [
  { value: 'all', label: 'All places' },
  { value: '8', label: 'Up to 8' },
  { value: '5', label: 'Up to 5' },
  { value: '3', label: 'Up to 3' },
  { value: '0', label: 'None (property pin only)' },
] as const;

const PLACE_ICONS: Record<AmenityIcon, { label: string; Icon: LucideIcon }> = {
  rail: { label: 'Station', Icon: TrainFront },
  car: { label: 'Road', Icon: Car },
  town: { label: 'Town centre', Icon: Building2 },
  airport: { label: 'Airport', Icon: Plane },
  grocery: { label: 'Shops', Icon: ShoppingBasket },
  hospital: { label: 'Hospital', Icon: Hospital },
  school: { label: 'School', Icon: GraduationCap },
  park: { label: 'Park', Icon: Trees },
};

/** One nearby place: icon, name and distance, stored together as its label. */
function PlaceEditor({
  amenity,
  hiddenNoteId,
  onChange,
  onRemove,
}: {
  amenity: BrochureAmenityItem;
  /** Set when the place won't appear; points at the note explaining why. */
  hiddenNoteId: string | null;
  onChange: (amenity: BrochureAmenityItem) => void;
  onRemove: () => void;
}) {
  const n = amenity.index;
  const { name, distance } = splitNearbyAmenityLabel(amenity.label);
  const shown = resolveAmenityIcon(amenity);
  const ShownIcon = shown ? PLACE_ICONS[shown].Icon : Hash;

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5',
        hiddenNoteId && 'opacity-50',
      )}
    >
      <Select
        value={amenity.icon ?? 'auto'}
        onValueChange={(value) =>
          onChange({
            ...amenity,
            icon: value === 'auto' ? null : (value as AmenityIcon),
          })
        }
      >
        <SelectTrigger
          aria-label={`Icon for place ${n}`}
          className="h-9 w-14 px-2"
        >
          <SelectValue>
            <ShownIcon className="h-4 w-4" />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Automatic
            </span>
          </SelectItem>
          {AMENITY_ICONS.map((icon) => {
            const { label, Icon } = PLACE_ICONS[icon];
            return (
              <SelectItem key={icon} value={icon}>
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Input
        aria-label={`Place ${n} name`}
        aria-describedby={hiddenNoteId ?? undefined}
        placeholder="Name"
        value={name}
        onChange={(e) =>
          onChange({
            ...amenity,
            label: joinNearbyAmenityLabel(e.target.value, distance),
          })
        }
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        aria-label={`Remove place ${n}`}
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Input
        aria-label={`Place ${n} distance`}
        aria-describedby={hiddenNoteId ?? undefined}
        placeholder="Distance, e.g. 0.3 mi"
        className="col-start-2 h-8 text-xs"
        value={distance}
        onChange={(e) =>
          onChange({
            ...amenity,
            label: joinNearbyAmenityLabel(name, e.target.value),
          })
        }
      />
    </div>
  );
}

const SLOT_LABELS: Record<string, string> = {
  hero: 'Cover image',
  photo: 'Photo',
  photo1: 'Photo 1',
  photo2: 'Photo 2',
  photo3: 'Photo 3',
  photo4: 'Photo 4',
  plan: 'Floor plan',
  certificate: 'Certificate',
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
  epc: 'EPC rating, e.g. B (47)',
  caption: 'Caption',
  notice: 'Important notice',
  branchName: 'Branch name',
  branchAddress: 'Branch address',
  branchPhone: 'Branch phone',
  branchEmail: 'Branch email',
};

const LINK_BUTTONS: Array<{
  id: BrochureLinkButtonId;
  label: string;
  setupKey: 'showWebsiteListingButton' | 'showSlideshowBrochureButton';
}> = [
  {
    id: 'website',
    label: 'Website listing',
    setupKey: 'showWebsiteListingButton',
  },
  {
    id: 'slideshow',
    label: 'Online brochure',
    setupKey: 'showSlideshowBrochureButton',
  },
];

/** The slot a heading's input sits above. */
function headingAnchor(
  field: BrochureHeadingField,
  slots: Record<string, BrochureSlotValue>,
): string | null {
  if (field.key === 'officeLabel') return 'branchName';
  if (field.key === 'noticeLabel') return 'notice';
  return ['title', 'caption'].find((key) => key in slots) ?? null;
}

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
  onImageError,
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
  onImageError: () => void;
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
  const epcs = media.filter((item) => item.mediaType === 'epc');
  const isPdf = Boolean(
    slot.mediaId && media.find((item) => item.id === slot.mediaId)?.isPdf,
  );

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
          <BrochureMediaImage
            src={slot.url}
            isPdf={isPdf}
            onError={onImageError}
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
            {epcs.length > 0 ? (
              <SelectGroup>
                <SelectLabel>EPC</SelectLabel>
                {epcs.map((item, index) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fileName ?? `EPC ${index + 1}`}
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
  templateId,
  display,
  media,
  onImageError,
  drawingIds,
  selectedSlotKey,
  onSelectSlot,
  onChange,
  onDropOnSlot,
  onHiddenButtonsChange,
}: {
  page: BrochurePage;
  templateId: BrochureTemplateId;
  /** Setup switches that turn link buttons off on every page. */
  display: Pick<
    BrochureDisplayOptions,
    'showWebsiteListingButton' | 'showSlideshowBrochureButton'
  >;
  media: BrochureMediaItem[];
  onImageError: () => void;
  drawingIds: ReadonlySet<string>;
  selectedSlotKey: string | null;
  onSelectSlot: (key: string) => void;
  onChange: (slots: Record<string, BrochureSlotValue>) => void;
  onDropOnSlot: (key: string, payload: BrochureDragPayload) => void;
  onHiddenButtonsChange: (hidden: BrochureLinkButtonId[]) => void;
}) {
  const headingFields = headingFieldsFor(page, templateId);
  const headingsBefore = new Map<string, BrochureHeadingField[]>();
  const unanchored: BrochureHeadingField[] = [];
  for (const field of headingFields) {
    const anchor = headingAnchor(field, page.slots);
    if (anchor && anchor in page.slots) {
      headingsBefore.set(anchor, [
        ...(headingsBefore.get(anchor) ?? []),
        field,
      ]);
    } else {
      unanchored.push(field);
    }
  }
  const hasTextFields =
    headingFields.length > 0 ||
    Object.values(page.slots).some(
      (slot) => slot.type === 'text' || slot.type === 'facts',
    );
  const showsButtons =
    isCoverLayout(page.layoutId) || page.layoutId === 'contact';
  const hiddenButtons = page.hiddenButtons ?? [];

  function updateSlot(key: string, value: BrochureSlotValue) {
    onChange({ ...page.slots, [key]: value });
  }

  function renderHeading(field: BrochureHeadingField) {
    const slot = page.slots[field.key];
    return (
      <div key={field.key} className="grid gap-1.5">
        <Label>{field.label}</Label>
        <BrochureMergeTextField
          label={field.label}
          value={slot?.type === 'text' ? slot.text : ''}
          placeholder={field.placeholder}
          onChange={(text) => updateSlot(field.key, { type: 'text', text })}
        />
      </div>
    );
  }

  function renderSlot(key: string, slot: BrochureSlotValue): ReactNode {
    if (slot.type === 'text') {
      const label = SLOT_LABELS[key] ?? key;
      return (
        <div key={key} className="grid gap-1.5">
          <Label>{label}</Label>
          <BrochureMergeTextField
            label={label}
            value={slot.text}
            multiline={MULTILINE_KEYS.has(key)}
            rows={key === 'notice' || key === 'headline' ? 3 : 6}
            onChange={(text) => updateSlot(key, { type: 'text', text })}
          />
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
          onImageError={onImageError}
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
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2"
            >
              <BrochureMergeTextField
                label={`Fact ${index + 1} label`}
                value={row.label}
                onChange={(text) =>
                  updateSlot(key, {
                    type: 'facts',
                    rows: slot.rows.map((r, i) =>
                      i === index ? { ...r, label: text } : r,
                    ),
                  })
                }
              />
              <BrochureMergeTextField
                label={`Fact ${index + 1} value`}
                value={row.value}
                onChange={(text) =>
                  updateSlot(key, {
                    type: 'facts',
                    rows: slot.rows.map((r, i) =>
                      i === index ? { ...r, value: text } : r,
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
      const shownCount = Math.min(slot.limit ?? MAX_AMENITIES, MAX_AMENITIES);
      const hiddenCount = Math.max(0, slot.amenities.length - shownCount);
      return (
        <div key={key} className="grid gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${page.id}-${key}-limit`}>Places to show</Label>
            <Select
              value={slot.limit == null ? 'all' : String(slot.limit)}
              onValueChange={(value) =>
                updateSlot(key, {
                  ...slot,
                  limit: value === 'all' ? undefined : Number(value),
                })
              }
            >
              <SelectTrigger id={`${page.id}-${key}-limit`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACE_LIMIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label>Nearby places on the map</Label>
          {slot.amenities.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Left empty, the brochure lists places found near the property.
            </p>
          ) : null}
          {slot.amenities.map((amenity, index) => (
            <PlaceEditor
              key={index}
              amenity={amenity}
              hiddenNoteId={
                index >= shownCount ? `${page.id}-${key}-hidden` : null
              }
              onChange={(next) =>
                updateSlot(key, {
                  ...slot,
                  amenities: slot.amenities.map((a, i) =>
                    i === index ? next : a,
                  ),
                })
              }
              onRemove={() =>
                updateSlot(key, {
                  ...slot,
                  amenities: slot.amenities
                    .filter((_, i) => i !== index)
                    .map((a, i) => ({ ...a, index: i + 1 })),
                })
              }
            />
          ))}
          {hiddenCount > 0 ? (
            <p
              id={`${page.id}-${key}-hidden`}
              className="flex items-start gap-1.5 text-xs text-[var(--workspace-shell-text)]"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--ozer-accent)]" />
              {shownCount === MAX_AMENITIES
                ? `A page shows up to ${MAX_AMENITIES} places, so the last ${hiddenCount === 1 ? 'one' : hiddenCount} won't appear.`
                : `Places to show is set to ${shownCount}, so the last ${hiddenCount === 1 ? 'one' : hiddenCount} won't appear.`}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit"
            disabled={slot.amenities.length >= MAX_AMENITIES}
            onClick={() =>
              updateSlot(key, {
                ...slot,
                amenities: [
                  ...slot.amenities,
                  { label: '', index: slot.amenities.length + 1 },
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
  }

  return (
    <div className="space-y-5">
      {hasTextFields ? <BrochureMergeFieldHint /> : null}
      {unanchored.map(renderHeading)}
      {Object.entries(page.slots).map(([key, slot]) =>
        isBrochureHeadingKey(key) ? null : (
          <Fragment key={key}>
            {(headingsBefore.get(key) ?? []).map(renderHeading)}
            {renderSlot(key, slot)}
          </Fragment>
        ),
      )}
      {showsButtons ? (
        <div className="grid gap-2">
          <Label>Buttons on this page</Label>
          <ul className="space-y-2">
            {LINK_BUTTONS.map((button) => {
              const allowed = display[button.setupKey];
              const switchId = `${page.id}-button-${button.id}`;
              return (
                <li
                  key={button.id}
                  className="flex items-center justify-between gap-3"
                >
                  <label
                    htmlFor={switchId}
                    className={cn(
                      'text-sm text-[var(--workspace-shell-text)]',
                      !allowed && 'opacity-50',
                    )}
                  >
                    {button.label}
                  </label>
                  <Switch
                    id={switchId}
                    checked={allowed && !hiddenButtons.includes(button.id)}
                    disabled={!allowed}
                    onCheckedChange={(checked) =>
                      onHiddenButtonsChange(
                        BROCHURE_LINK_BUTTON_IDS.filter((id) =>
                          id === button.id
                            ? !checked
                            : hiddenButtons.includes(id),
                        ),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {LINK_BUTTONS.some((button) => !display[button.setupKey])
              ? 'A greyed-out button is turned off for every page in Set up. '
              : ''}
            Each button only appears when the listing has that link.
          </p>
        </div>
      ) : null}
    </div>
  );
}
