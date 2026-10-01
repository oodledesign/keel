'use client';

import { type PointerEvent, type ReactNode, useRef, useState } from 'react';

import { ViewportPortal, useReactFlow, useViewport } from '@xyflow/react';
import {
  ArrowUpToLine,
  Bold,
  Circle,
  Copy,
  Diamond,
  Eraser,
  FilePlus2,
  Frame,
  Gauge,
  Hand,
  ImagePlus,
  Italic,
  Link2,
  ListPlus,
  MessageSquare,
  MousePointer2,
  NotebookPen,
  Pencil,
  Redo2,
  Sparkles,
  Spline,
  Square,
  SquareDashed,
  StickyNote,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';

import { Input } from '@kit/ui/input';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { cn } from '@kit/ui/utils';

import { canvasPathToSvg } from '~/lib/projects/canvas/canvas-path';
import {
  CANVAS_COLORS,
  CANVAS_COLOR_KEYS,
  CANVAS_FONT_SIZES,
  type CanvasColorKey,
  type CanvasShapeType,
  type CanvasTextStyle,
} from '~/lib/projects/canvas/canvas-types';

import type { CanvasCursor, CanvasPeer } from './use-project-canvas-realtime';

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'sticky'
  | 'text'
  | 'shape'
  | 'frame'
  | 'metric'
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
  m: 'metric',
  c: 'connect',
  p: 'pen',
  e: 'eraser',
};

const panelClass =
  'pointer-events-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)] shadow-lg';

export function ToolButton({
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
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
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
    <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--workspace-shell-border)]" />
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

function CanvasTextStyleControls({
  value,
  onChange,
}: {
  value: CanvasTextStyle;
  onChange: (patch: Partial<CanvasTextStyle>) => void;
}) {
  const sizes = CANVAS_FONT_SIZES.includes(value.fontSize)
    ? CANVAS_FONT_SIZES
    : [...CANVAS_FONT_SIZES, value.fontSize].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-0.5">
      <ToolButton
        label="Bold (⌘B)"
        active={value.bold}
        onClick={() => onChange({ bold: !value.bold })}
      >
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label="Italic (⌘I)"
        active={value.italic}
        onClick={() => onChange({ italic: !value.italic })}
      >
        <Italic className="h-4 w-4" />
      </ToolButton>
      <Select
        value={String(value.fontSize)}
        onValueChange={(next) => onChange({ fontSize: Number(next) })}
      >
        <SelectTrigger
          className="h-7 w-[4.5rem] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-2 text-xs"
          aria-label="Text size"
          title="Text size"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((size) => (
            <SelectItem key={size} value={String(size)} className="text-xs">
              {size}px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type FlowRect = { x: number; y: number; w: number; h: number };

/** Drag to draw a section or shape; a plain click places the default size. */
export function CanvasRectOverlay({
  onDraw,
}: {
  onDraw: (rect: FlowRect | null, point: { x: number; y: number }) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const overlayRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ local: [number, number]; client: [number, number] }>(
    null,
  );
  const [box, setBox] = useState<FlowRect | null>(null);

  const local = (event: PointerEvent<HTMLDivElement>): [number, number] => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    start.current = null;
    setBox(null);
    if (!origin) return;
    const a = screenToFlowPosition({
      x: origin.client[0],
      y: origin.client[1],
    });
    const b = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const dragged =
      Math.hypot(
        event.clientX - origin.client[0],
        event.clientY - origin.client[1],
      ) > 8;
    onDraw(
      dragged
        ? {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x),
            h: Math.abs(b.y - a.y),
          }
        : null,
      a,
    );
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[5] cursor-crosshair touch-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = {
          local: local(event),
          client: [event.clientX, event.clientY],
        };
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin || event.buttons !== 1) return;
        const [x, y] = local(event);
        setBox({
          x: Math.min(origin.local[0], x),
          y: Math.min(origin.local[1], y),
          w: Math.abs(x - origin.local[0]),
          h: Math.abs(y - origin.local[1]),
        });
      }}
      onPointerUp={finish}
      onPointerCancel={() => {
        start.current = null;
        setBox(null);
      }}
    >
      {box ? (
        <div
          className="pointer-events-none absolute rounded-lg border-2 border-dashed border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      ) : null}
    </div>
  );
}

export function CanvasToolbar({
  tool,
  onToolChange,
  canEdit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddImage,
  onAddLink,
  onAddFile,
  onAddNote,
  onAddTask,
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
  onAddLink: () => void;
  onAddFile: () => void;
  /** Absent when notes can't be saved yet (canvas migration missing). */
  onAddNote?: () => void;
  /** Absent when the viewer can't add tasks. */
  onAddTask?: () => void;
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
    { key: 'frame', label: 'Section (F)', icon: Frame, edit: true },
    { key: 'metric', label: 'Figure (M)', icon: Gauge, edit: true },
    { key: 'connect', label: 'Arrow (C)', icon: Spline, edit: true },
    { key: 'pen', label: 'Pen (P)', icon: Pencil, edit: true },
    { key: 'eraser', label: 'Eraser (E)', icon: Eraser, edit: true },
  ];

  const hint =
    tool === 'connect'
      ? connectPending
        ? 'Now click the item to point at'
        : 'Click an item to start an arrow'
      : tool === 'shape' || tool === 'frame'
        ? 'Drag to draw, or click to place'
        : tool === 'sticky' || tool === 'text' || tool === 'metric'
          ? 'Click on the canvas to place'
          : tool === 'eraser'
            ? 'Click or drag over pen strokes to erase'
            : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,calc(env(safe-area-inset-bottom)_+_0.5rem))] z-10 flex flex-col items-center gap-2 px-3">
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
      {/* Scrolls sideways when the tools don't fit (phones). */}
      <div
        className={cn(
          panelClass,
          'flex max-w-full items-center gap-0.5 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
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
            {onAddTask ? (
              <ToolButton
                label="Add task (K) — added to the project board"
                onClick={onAddTask}
              >
                <ListPlus className="h-4 w-4" />
              </ToolButton>
            ) : null}
            {onAddNote ? (
              <ToolButton
                label="New project note (N) — saved to the project's notes"
                onClick={onAddNote}
              >
                <NotebookPen className="h-4 w-4" />
              </ToolButton>
            ) : null}
            <ToolButton
              label="Add image — or drop / paste one onto the canvas"
              onClick={onAddImage}
            >
              <ImagePlus className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              label="Add a link — or paste / drop one onto the canvas"
              onClick={onAddLink}
            >
              <Link2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton
              label="Add a file to the project — or drop one onto the canvas"
              onClick={onAddFile}
            >
              <FilePlus2 className="h-4 w-4" />
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
  textStyle,
  onTextStyleChange,
  canDuplicate,
  removeLabel,
  onColorChange,
  onBringToFront,
  onDuplicate,
  onDelete,
  onOpenTask,
  onEditNote,
  onWrapInSection,
  onComment,
  onAi,
  saveLinksCount = 0,
  onSaveLinks,
  onSaveAsNote,
}: {
  count: number;
  color: CanvasColorKey | undefined;
  colorMode: 'fill' | 'stroke';
  showColor: boolean;
  shape?: CanvasShapeType;
  onShapeChange?: (shape: CanvasShapeType) => void;
  label?: string;
  onLabelChange?: (label: string) => void;
  textStyle?: CanvasTextStyle;
  onTextStyleChange?: (patch: Partial<CanvasTextStyle>) => void;
  canDuplicate: boolean;
  removeLabel: string;
  onColorChange: (color: CanvasColorKey) => void;
  onBringToFront: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenTask?: () => void;
  onEditNote?: () => void;
  onWrapInSection?: () => void;
  onComment?: () => void;
  onAi?: () => void;
  saveLinksCount?: number;
  onSaveLinks?: () => void;
  onSaveAsNote?: () => void;
}) {
  const [labelDraft, setLabelDraft] = useState(label ?? '');

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex justify-center px-3">
      <div
        className={cn(
          panelClass,
          'flex max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0',
        )}
      >
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
        {textStyle && onTextStyleChange ? (
          <>
            <Divider />
            <CanvasTextStyleControls
              value={textStyle}
              onChange={onTextStyleChange}
            />
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
        {onEditNote ? (
          <button
            type="button"
            onClick={onEditNote}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Edit note
          </button>
        ) : null}
        {onSaveLinks && saveLinksCount > 0 ? (
          <button
            type="button"
            onClick={onSaveLinks}
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            {saveLinksCount === 1
              ? 'Save link to notes'
              : `Save ${saveLinksCount} links to notes`}
          </button>
        ) : null}
        {onSaveAsNote ? (
          <button
            type="button"
            onClick={onSaveAsNote}
            title="Turn this into a note in the project's notes"
            className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--workspace-shell-accent-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
          >
            Save as project note
          </button>
        ) : null}
        {onAi ? (
          <ToolButton label="Ask AI about the selection" onClick={onAi}>
            <Sparkles className="h-4 w-4" />
          </ToolButton>
        ) : null}
        {onComment ? (
          <ToolButton label="Comment" onClick={onComment}>
            <MessageSquare className="h-4 w-4" />
          </ToolButton>
        ) : null}
        {onWrapInSection ? (
          <ToolButton label="Wrap in section (⌥⌘G)" onClick={onWrapInSection}>
            <SquareDashed className="h-4 w-4" />
          </ToolButton>
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
  actions,
}: {
  peers: CanvasPeer[];
  me: CanvasPeer | null;
  connected: boolean;
  actions?: ReactNode;
}) {
  const everyone = me ? [me, ...peers] : peers;
  const shown = everyone.slice(0, 5);
  const extra = everyone.length - shown.length;

  return (
    <div className="pointer-events-none absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex items-center gap-2">
      {actions ? (
        <div
          className={cn(
            panelClass,
            'pointer-events-auto flex items-center gap-0.5 p-1',
          )}
        >
          {actions}
        </div>
      ) : null}
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
