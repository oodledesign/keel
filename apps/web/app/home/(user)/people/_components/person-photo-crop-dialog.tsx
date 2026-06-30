'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ZoomIn } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import {
  exportSquareCrop,
  getCoverScale,
  loadImageFromFile,
  type CropTransform,
} from '../_lib/person-photo-process';

const VIEWPORT_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type PersonPhotoCropDialogProps = {
  open: boolean;
  file: File | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
};

export function PersonPhotoCropDialog({
  open,
  file,
  onOpenChange,
  onConfirm,
}: PersonPhotoCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    let cancelled = false;

    void loadImageFromFile(file).then((loaded) => {
      if (!cancelled) {
        setImage(loaded);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, file]);

  const transform: CropTransform = {
    scale: zoom,
    offsetX: offset.x,
    offsetY: offset.y,
  };

  const imageStyle = image
    ? (() => {
        const baseScale = getCoverScale(
          image.width,
          image.height,
          VIEWPORT_SIZE,
        );
        const totalScale = baseScale * zoom;
        const drawWidth = image.width * totalScale;
        const drawHeight = image.height * totalScale;
        const x = (VIEWPORT_SIZE - drawWidth) / 2 + offset.x;
        const y = (VIEWPORT_SIZE - drawHeight) / 2 + offset.y;

        return {
          width: drawWidth,
          height: drawHeight,
          left: x,
          top: y,
        };
      })()
    : null;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!image) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
    },
    [image, offset.x, offset.y],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      setOffset({
        x: drag.originX + (event.clientX - drag.startX),
        y: drag.originY + (event.clientY - drag.startY),
      });
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  const handleSave = async () => {
    if (!image) return;

    setSaving(true);
    try {
      const cropped = await exportSquareCrop(image, VIEWPORT_SIZE, transform);
      onConfirm(cropped);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div
            className={cn(
              'relative mx-auto touch-none overflow-hidden rounded-xl',
              'border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]',
            )}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {image && imageStyle ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  width: imageStyle.width,
                  height: imageStyle.height,
                  left: imageStyle.left,
                  top: imageStyle.top,
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--workspace-shell-text-muted)]">
                Loading…
              </div>
            )}

            <div
              className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20"
              aria-hidden
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="photo-zoom"
              className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
              Drag to reposition · use zoom to crop
            </Label>
            <input
              id="photo-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-[var(--ozer-accent)]"
            />
          </div>

          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Saved as a square 512×512 JPEG with light compression.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[var(--ozer-accent)] hover:bg-[var(--ozer-accent-hover)]"
            disabled={!image || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
