'use client';

import { useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Label } from '@kit/ui/label';
import { Slider } from '@kit/ui/slider';

import {
  COVER_FRAME,
  COVER_MAX_ZOOM,
  type CoverFocus,
  DEFAULT_COVER_FOCUS,
  coverPlacement,
  isDefaultCoverFocus,
  normalizeCoverFocus,
} from '~/lib/building-surveyor/survey-cover';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { type CoverImageSize, SurveyCoverFrame } from './survey-cover-frame';

const KEY_STEP = 0.03;

export function SurveyCoverCropDialog({
  open,
  onOpenChange,
  src,
  initialFocus,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  initialFocus: CoverFocus;
  pending: boolean;
  onSave: (focus: CoverFocus) => void;
}) {
  const [focus, setFocus] = useState(initialFocus);
  const [size, setSize] = useState<CoverImageSize | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    focus: CoverFocus;
  } | null>(null);

  const placement = size ? coverPlacement(size, focus) : null;
  const dirty =
    focus.x !== initialFocus.x ||
    focus.y !== initialFocus.y ||
    focus.zoom !== initialFocus.zoom;

  // The parent mounts this dialog only while it is open, so the initial
  // focus is always current.
  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
  };

  const moveBy = (dx: number, dy: number) => {
    setFocus((current) =>
      normalizeCoverFocus({ ...current, x: current.x + dx, y: current.y + dy }),
    );
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      focus,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const frame = frameRef.current;
    if (!start || !frame || !size) return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const layout = coverPlacement(size, start.focus);
    // Pixels dragged -> frame units, then -> a share of the hidden overflow.
    const unitsX =
      ((event.clientX - start.pointerX) / rect.width) * COVER_FRAME.width;
    const unitsY =
      ((event.clientY - start.pointerY) / rect.height) * COVER_FRAME.height;
    setFocus(
      normalizeCoverFocus({
        ...start.focus,
        x:
          layout.overflowX > 0
            ? start.focus.x - unitsX / layout.overflowX
            : start.focus.x,
        y:
          layout.overflowY > 0
            ? start.focus.y - unitsY / layout.overflowY
            : start.focus.y,
      }),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Arrow keys move the photo in the direction of the key.
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveBy(move[0], move[1]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm" data-test="survey-cover-crop">
        <DialogHeader>
          <DialogTitle>Adjust cover photo</DialogTitle>
          <DialogDescription>
            Drag the photo to reposition it and use the slider to zoom. This is
            how it will sit on the front cover.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            ref={frameRef}
            role="application"
            aria-label="Cover photo position. Use the arrow keys to move the photo."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className={`focus-visible:ring-ring w-56 touch-none rounded-lg outline-none focus-visible:ring-2 ${
              placement && (placement.overflowX > 0 || placement.overflowY > 0)
                ? 'cursor-grab active:cursor-grabbing'
                : ''
            }`}
          >
            <SurveyCoverFrame
              src={src}
              alt="Cover photo"
              focus={focus}
              className="w-full"
              onImageSize={setSize}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="cover-zoom"
            className={`text-xs ${workspaceTextMuted}`}
          >
            Zoom
          </Label>
          <Slider
            id="cover-zoom"
            aria-label="Zoom"
            min={1}
            max={COVER_MAX_ZOOM}
            step={0.05}
            value={[focus.zoom]}
            onValueChange={([zoom]) =>
              setFocus((current) =>
                normalizeCoverFocus({ ...current, zoom: zoom ?? 1 }),
              )
            }
            data-test="survey-cover-zoom"
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || isDefaultCoverFocus(focus)}
            onClick={() => setFocus(DEFAULT_COVER_FOCUS)}
          >
            Reset
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || !dirty}
              onClick={() => onSave(focus)}
              data-test="survey-cover-crop-save"
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save position
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
