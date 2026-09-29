'use client';

import { type PointerEvent, type ReactNode, useRef, useState } from 'react';

import { ViewportPortal, useReactFlow, useViewport } from '@xyflow/react';
import {
  ArrowUpToLine,
  Circle,
  Copy,
  Diamond,
  Eraser,
  Frame,
  Hand,
  ImagePlus,
  MousePointer2,
  Pencil,
  Redo2,
  Spline,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';

import { Input } from '@kit/ui/input';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { cn } from '@kit/ui/utils';

import { canvasPathToSvg } from '~/lib/projects/canvas/canvas-path';
import {
  CANVAS_COLORS,
  CANVAS_COLOR_KEYS,
  type CanvasColorKey,
  type CanvasShapeType,
} from '~/lib/projects/canvas/canvas-types';

import type { CanvasCursor, CanvasPeer } from './use-project-canvas-realtime';

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'text'
  | 'shape'
  | 'frame'
  | 'connect'
  | 'pen'
  | 'eraser';

export const CANVAS_TOOL_SHORTCUTS: Record<string, CanvasTool> = {
  v: 'select',
  h: 'hand',
  s: 'sticky',
  t: 'text',
  r: 'shape',
  f: 'frame',
  c: 'connect',
  p: 'pen',
  e: 'eraser',
};

const panelClass =
  'pointer-events-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] shadow-lg';

function ToolButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
        active
          ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
          : 'text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span className="mx-0.5 h-5 w-px bg-[var(--workspace-shell-border)]" />
  );
}

export function CanvasColorSwatches({
  value,
  onChange,
  mode = 'fill',
}: {
  value: CanvasColorKey | undefined;
  onChange: (color: CanvasColorKey) => void;
  mode?: 'fill' | 'stroke';
}) {
  return (
    <div className="flex items-center gap-1">
      {CANVAS_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          title={CANVAS_COLORS[key].label}
          aria-label={CANVAS_COLORS[key].label}
          onClick={() => onChange(key)}
          className={cn(
            'h-5 w-5 rounded-full border border-black/10 transition-transform hover:scale-110',
            value === key &&
              'ring-2 ring-[var(--ozer-accent)] ring-offset-1 ring-offset-[var(--ozer-surface-panel)]',
          )}
          style={{
            background:
              mode === 'stroke'
                ? CANVAS_COLORS[key].stroke
                : CANVAS_COLORS[key].fill,
          }}
        />
      ))}
    </div>
  );
}

const SHAPE_ICONS: Record<CanvasShapeType, typeof Square> = {
  rectangle: Square,
  ellipse: Circle,
  diamond: Diamond,
};

export function CanvasShapePicker({
  value,
  onChange,
}: {
  value: CanvasShapeType;
  onChange: (shape: CanvasShapeType) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {(Object.keys(SHAPE_ICONS) as CanvasShapeType[]).map((shape) => {
        const Icon = SHAPE_ICONS[shape];
        return (
          <ToolButton
            key={shape}
            label={shape[0]!.toUpperCase() + shape.slice(1)}
            active={value === shape}
            onClick={() => onChange(shape)}
          >
            <Icon className="h-4 w-4" />
          </ToolButton>
        );
      })}
    </div>
  );
}

export const PEN_WIDTHS = [2, 4, 8] as const;

export function CanvasToolbar({
  tool,
  onToolChange,
  canEdit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddImage,
  penColor,
  onPenColorChange,
  penWidth,
  onPenWidthChange,
  shapeType,
  onShapeTypeChange,
  connectPending,
}: {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddImage: () => void;
  penColor: CanvasColorKey;
  onPenColorChange: (color: CanvasColorKey) => void;
  penWidth: number;
  onPenWidthChange: (width: number) => void;
  shapeType: CanvasShapeType;
  onShapeTypeChange: (shape: CanvasShapeType) => void;
  connectPending: boolean;
}) {
  const tools: Array<{
    key: CanvasTool;
    label: string;
    icon: typeof Hand;
    edit?: boolean;
  }> = [
    { key: 'select', label: 'Select (V)', icon: MousePointer2 },
    { key: 'hand', label: 'Pan (H)', icon: Hand },
    { key: 'sticky', label: 'Sticky note (S)', icon: StickyNote, edit: true },
    { key: 'text', label: 'Text (T)', icon: Type, edit: true },
    {
      key: 'shape',
      label: 'Shape (R)',
      icon: SHAPE_ICONS[shapeType],
      edit: true,
    },
    { key: 'frame', label: 'Frame (F)', icon: Frame, edit: true },
    { key: 'connect', label: 'Arrow (C)', icon: Spline, edit: true },
    { key: 'pen', label: 'Pen (P)', icon: Pencil, edit: true },
    { key: 'eraser', label: 'Eraser (E)', icon: Eraser, edit: true },
  ];

  const hint =
    tool === 'connect'
      ? connectPending
        ? 'Now click the item to point at'
        : 'Click an item to start an arrow'
      : tool === 'sticky' ||
          tool === 'text' ||
          tool === 'shape' ||
          tool === 'frame'
        ? 'Click on the canvas to place'
        : tool === 'eraser'
          ? 'Click or drag over pen strokes to erase'
          : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2">
      {hint ? (
        <p className="rounded-full bg-[var(--ozer-plum-900)]/85 px-3 py-1 text-[11px] text-[var(--ozer-text-on-dark)]">
          {hint}
        </p>
      ) : null}
      {canEdit && (tool === 'pen' || tool === 'shape') ? (
        <div className={cn(panelClass, 'flex items-center gap-2 px-2 py-1.5')}>
          {tool === 'pen' ? (
            <>
              <CanvasColorSwatches
                value={penColor}
                onChange={onPenColorChange}
                mode="stroke"
              />
              <Divider />
              {PEN_WIDTHS.map((width) => (
                <ToolButton
                  key={width}
                  label={`${width}px`}
                  active={penWidth === width}
                  onClick={() => onPenWidthChange(width)}
                >
                  <span
                    className="rounded-full bg-current"
                    style={{ width: width + 4, height: width + 4 }}
                  />
                </ToolButton>
              ))}
            </>
          ) : (
            <CanvasShapePicker value={shapeType} onChange={onShapeTypeChange} />
          )}
        </div>
      ) : null}
      <div className={cn(panelClass, 'flex items-center gap-0.5 p-1')}>
        {tools
          .filter((item) => canEdit || !item.edit)
          .map(({ key, label, icon: Icon }) => (
            <ToolButton
              key={key}
              label={label}
              active={tool === key}
              onClick={() => onToolChange(key)}
            >
              <Icon className="h-4 w-4" />
            </ToolButton>
          ))}
        {canEdit ? (
          <>
            <ToolButton label="Image or link" onClick={onAddImage}>
              <ImagePlus className="h-4 w-4" />
            </ToolButton>
            <Divider />
            <ToolButton label="Undo (⌘Z)" disabled={!canUndo} onClick={onUndo}>
              <Undo2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton label="Redo (⇧⌘Z)" disabled={!canRedo} onClick={onRedo}>
              <Redo2 className="h-4 w-4" />
            </ToolButton>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Remount (via `key`) when the selection or label changes to reset the draft. */
export function CanvasSelectionBar({
  count,
  color,
  colorMode,
  showColor,
  shape,
  onShapeChange,
  label,
  onLabelChange,
  canDuplicate,
  removeLabel,
  onColorChange,
  onBringToFront,
  onDuplicate,
  onDelete,
  onOpenTask,
}: {
  count: number;
  color: CanvasColorKey | undefined;
  colorMode: 'fill' | 'stroke';
  showColor: boolean;
  shape?: CanvasShapeType;
  onShapeChange?: (shape: CanvasShapeType) => void;
  label?: string;
  onLabelChange?: (label: string) => void;
  canDuplicate: boolean;
  removeLabel: string;
  onColorChange: (color: CanvasColorKey) => void;
  onBringToFront: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenTask?: () => void;
}) {
  const [labelDraft, setLabelDraft] = useState(label ?? '');

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
      <div className={cn(panelClass, 'flex items-center gap-2 px-2 py-1.5')}>
        <span className="px-1 text-[11px] text-[var(--workspace-shell-text-muted)]">
          {count} selected
        </span>
        {showColor ? (
          <>
            <Divider />
            <CanvasColorSwatches
              value={color}
              onChange={onColorChange}
              mode={colorMode}
            />
          </>
        ) : null}
        {shape && onShapeChange ? (
          <>
            <Divider />
            <CanvasShapePicker value={shape} onChange={onShapeChange} />
          </>
        ) : null}
        {onLabelChange ? (
          <>
            <Divider />
            <Input
              value={labelDraft}
              placeholder="Arrow label"
              onChange={(event) => setLabelDraft(event.target.value)}
              onBlur={() => {
                if (labelDraft !== (label ?? '')) onLabelChange(labelDraft);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              className="h-7 w-40 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-xs"
            />
          </>
        ) : null}
        <Divider />
        {onOpenTask ? (
          <button
            type="button"
            onClick={onOpenTask}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Open task
          </button>
        ) : null}
        <ToolButton label="Bring to front" onClick={onBringToFront}>
          <ArrowUpToLine className="h-4 w-4" />
        </ToolButton>
        {canDuplicate ? (
          <ToolButton label="Duplicate (⌘D)" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
          </ToolButton>
        ) : null}
        <ToolButton label={removeLabel} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </ToolButton>
      </div>
    </div>
  );
}

export function CanvasPresence({
  peers,
  me,
  connected,
}: {
  peers: CanvasPeer[];
  me: CanvasPeer | null;
  connected: boolean;
}) {
  const everyone = me ? [me, ...peers] : peers;
  const shown = everyone.slice(0, 5);
  const extra = everyone.length - shown.length;

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-10">
      <div className={cn(panelClass, 'flex items-center gap-2 px-2 py-1')}>
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            connected
              ? 'bg-emerald-500'
              : 'bg-[var(--workspace-shell-text-muted)]',
          )}
          title={connected ? 'Live' : 'Offline — syncing periodically'}
        />
        <div className="flex -space-x-2">
          {shown.map((peer) => (
            <span
              key={peer.userId}
              className="rounded-full ring-2"
              style={{ ['--tw-ring-color' as string]: peer.color }}
              title={
                peer.userId === me?.userId ? `${peer.name} (you)` : peer.name
              }
            >
              <ProfileAvatar
                displayName={peer.name}
                pictureUrl={peer.pictureUrl}
                className="h-7 w-7 text-[10px]"
              />
            </span>
          ))}
        </div>
        <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
          {extra > 0 ? `+${extra} · ` : ''}
          {everyone.length} here
        </span>
      </div>
    </div>
  );
}

export function CanvasRemoteCursors({
  cursors,
}: {
  cursors: Record<string, CanvasCursor>;
}) {
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          className="pointer-events-none absolute top-0 left-0 z-[2000] transition-transform duration-75 ease-linear"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${1 / zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              d="M1 1l6.5 15 2.2-6.3L16 7.5z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className="ml-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow"
            style={{ background: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}

/** Captures freehand strokes in flow coordinates while the pen tool is active. */
export function CanvasPenOverlay({
  color,
  width,
  onStroke,
}: {
  color: string;
  width: number;
  onStroke: (points: Array<[number, number]>) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const { zoom } = useViewport();
  const overlayRef = useRef<HTMLDivElement>(null);
  const flowPoints = useRef<Array<[number, number]>>([]);
  const lastScreenPoint = useRef<[number, number] | null>(null);
  const [screenPoints, setScreenPoints] = useState<Array<[number, number]>>([]);

  const localPoint = (
    event: PointerEvent<HTMLDivElement>,
  ): [number, number] => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const addPoint = (event: PointerEvent<HTMLDivElement>) => {
    const local = localPoint(event);
    const last = lastScreenPoint.current;
    if (last && Math.hypot(local[0] - last[0], local[1] - last[1]) < 2) return;
    lastScreenPoint.current = local;
    const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    flowPoints.current.push([flow.x, flow.y]);
    setScreenPoints((prev) => [...prev, local]);
  };

  const finish = () => {
    const points = flowPoints.current;
    flowPoints.current = [];
    lastScreenPoint.current = null;
    setScreenPoints([]);
    if (points.length >= 2) onStroke(points);
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[5] cursor-crosshair touch-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        flowPoints.current = [];
        lastScreenPoint.current = null;
        setScreenPoints([]);
        addPoint(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1 || flowPoints.current.length === 0) return;
        addPoint(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      {screenPoints.length > 0 ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <path
            d={canvasPathToSvg(screenPoints)}
            fill="none"
            stroke={color}
            strokeWidth={width * zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
