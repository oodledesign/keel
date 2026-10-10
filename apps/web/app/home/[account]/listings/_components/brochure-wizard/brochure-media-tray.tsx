'use client';

import { cn } from '@kit/ui/utils';

import type { BrochureMediaItem } from '~/lib/commercial/public-brochure.shared';

import { writeBrochureDrag } from './brochure-slot-editor';

/**
 * Every listing photo and floor plan. Drag one onto an image slot, or click
 * it to fill the selected slot.
 */
export function BrochureMediaTray({
  media,
  drawingIds,
  usedIds,
  canPlace,
  onPlace,
}: {
  media: BrochureMediaItem[];
  drawingIds: ReadonlySet<string>;
  usedIds: ReadonlySet<string>;
  canPlace: boolean;
  onPlace: (item: BrochureMediaItem) => void;
}) {
  if (media.length === 0) {
    return (
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        This listing has no photos or floor plans yet. Add them on the Media
        tab.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        {canPlace
          ? 'Click an image to put it in the selected slot, or drag it onto any slot.'
          : 'Drag an image onto a slot, or select a slot first and click an image.'}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {media.map((item, index) => {
          const label =
            item.fileName ??
            (item.mediaType === 'floorplan'
              ? `Floor plan ${index + 1}`
              : `Photo ${index + 1}`);
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                draggable
                onDragStart={(event) =>
                  writeBrochureDrag(event, { kind: 'media', mediaId: item.id })
                }
                onClick={() => {
                  if (canPlace) onPlace(item);
                }}
                title={label}
                aria-label={`${canPlace ? 'Use' : 'Drag'} ${label}`}
                className={cn(
                  'relative block h-16 w-24 overflow-hidden rounded-md border bg-white transition-shadow',
                  canPlace
                    ? 'cursor-pointer hover:ring-2 hover:ring-[var(--ozer-accent)]'
                    : 'cursor-grab',
                  usedIds.has(item.id)
                    ? 'border-[var(--workspace-shell-border)]'
                    : 'border-[var(--ozer-accent)]/40',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className={cn(
                    'h-full w-full',
                    drawingIds.has(item.id) ? 'object-contain' : 'object-cover',
                  )}
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-left text-[9px] text-white">
                  {item.mediaType === 'floorplan'
                    ? 'Floor plan'
                    : drawingIds.has(item.id)
                      ? 'Drawing'
                      : usedIds.has(item.id)
                        ? 'In use'
                        : 'Unused'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
