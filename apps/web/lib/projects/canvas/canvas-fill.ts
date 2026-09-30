import { itemsInsideContainer } from './canvas-geometry';
import { PENDING_CANVAS_TIMESTAMP } from './canvas-layout';
import { CALENDAR_CELL } from './canvas-templates';
import {
  type CanvasColorKey,
  type CanvasItem,
  canvasItemSize,
} from './canvas-types';

export type CanvasSectionArea = {
  id: string;
  title: string;
  color: CanvasColorKey | undefined;
  existing: string[];
};

export type CanvasSectionOutline =
  | { layout: 'areas'; id: string; title: string; areas: CanvasSectionArea[] }
  | {
      layout: 'calendar';
      id: string;
      title: string;
      rows: CanvasSectionArea[];
      weeks: Array<{ id: string; label: string; x: number }>;
    };

export type CanvasSectionPlacement = {
  areaId: string;
  text: string;
  /** Calendar week column (header text item id). */
  weekId?: string;
};

const TEXT_KINDS = new Set<CanvasItem['kind']>(['sticky', 'text', 'shape']);
const AREA_HEADER = 48;
const AREA_INSET = 20;
const NOTE_H = 96;
const NOTE_GAP = 12;
const AREA_PAD_BOTTOM = 16;
const SECTION_PAD = 32;

function itemText(item: CanvasItem) {
  return (item.data.text ?? item.data.title ?? '').trim();
}

function centreInside(item: CanvasItem, frame: CanvasItem) {
  const a = canvasItemSize(item);
  const b = canvasItemSize(frame);
  const cx = item.x + a.w / 2;
  const cy = item.y + a.h / 2;
  return (
    cx >= frame.x && cx <= frame.x + b.w && cy >= frame.y && cy <= frame.y + b.h
  );
}

function readingOrder(a: CanvasItem, b: CanvasItem) {
  return Math.round(a.y / 24) - Math.round(b.y / 24) || a.x - b.x;
}

/** The titled sub-sections of a frame (template areas or calendar rows). */
export function outlineCanvasSection(
  items: CanvasItem[],
  sectionId: string,
): CanvasSectionOutline | null {
  const section = items.find(
    (item) => item.id === sectionId && item.kind === 'frame',
  );
  if (!section) return null;
  const inside = itemsInsideContainer(section, items);
  const frames = inside
    .filter((item) => item.kind === 'frame')
    .sort(readingOrder);
  if (frames.length === 0) return null;

  const areas = frames.map<CanvasSectionArea>((frame) => ({
    id: frame.id,
    title: frame.data.title?.trim() || 'Untitled',
    color: frame.data.color,
    existing: inside
      .filter((item) => TEXT_KINDS.has(item.kind) && centreInside(item, frame))
      .sort(readingOrder)
      .map(itemText)
      .filter(Boolean)
      .slice(0, 12),
  }));
  const title = section.data.title?.trim() || 'Section';

  if (section.data.preset === 'content_calendar') {
    const weeks = inside
      .filter(
        (item) =>
          item.kind === 'text' &&
          itemText(item) &&
          !frames.some((frame) => centreInside(item, frame)),
      )
      .sort((a, b) => a.x - b.x)
      .map((item) => ({ id: item.id, label: itemText(item), x: item.x }));
    if (weeks.length > 0) {
      return { layout: 'calendar', id: section.id, title, rows: areas, weeks };
    }
  }
  return { layout: 'areas', id: section.id, title, areas };
}

/**
 * Adds stickies to a section's areas, stacking under what's already there.
 * Areas grow to fit and push the areas below them down; the section grows
 * to wrap everything.
 */
export function placeSectionNotes(
  items: CanvasItem[],
  sectionId: string,
  placements: CanvasSectionPlacement[],
  options: { createId: () => string; zIndex: number },
): { creates: CanvasItem[]; updates: CanvasItem[] } {
  const outline = outlineCanvasSection(items, sectionId);
  const section = items.find((item) => item.id === sectionId);
  if (!outline || !section || placements.length === 0) {
    return { creates: [], updates: [] };
  }
  const calendar = outline.layout === 'calendar';
  const areaList = calendar ? outline.rows : outline.areas;
  const weekX = new Map(
    calendar ? outline.weeks.map((week) => [week.id, week.x]) : [],
  );

  const working = new Map<string, CanvasItem>(
    [section, ...itemsInsideContainer(section, items)].map((item) => [
      item.id,
      { ...item },
    ]),
  );
  const creates: CanvasItem[] = [];
  let z = options.zIndex;

  const orderedAreas = areaList
    .map((area) => working.get(area.id)!)
    .filter(Boolean)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  for (const areaStart of orderedAreas) {
    const mine = placements.filter((p) => p.areaId === areaStart.id);
    if (mine.length === 0) continue;
    const area = working.get(areaStart.id)!;
    const areaSize = canvasItemSize(area);
    const headerH = calendar ? CALENDAR_CELL.rowHeader : AREA_HEADER;
    const originalBottom = area.y + areaSize.h;
    const contents = [...working.values()].filter(
      (item) =>
        item.id !== area.id &&
        item.id !== section.id &&
        item.kind !== 'frame' &&
        centreInside(item, area),
    );

    const columns = new Map<string, CanvasSectionPlacement[]>();
    for (const placement of mine) {
      const key = calendar ? (placement.weekId ?? '') : '';
      if (calendar && !weekX.has(key)) continue;
      columns.set(key, [...(columns.get(key) ?? []), placement]);
    }

    const own = new Set(contents.map((item) => item.id));
    let lowest = area.y + headerH;
    for (const [weekId, list] of columns) {
      const colX = calendar ? weekX.get(weekId)! : area.x + AREA_INSET;
      const colW = calendar ? CALENDAR_CELL.w : areaSize.w - AREA_INSET * 2;
      const inColumn = contents.filter((item) => {
        const cx = item.x + canvasItemSize(item).w / 2;
        return cx >= colX && cx <= colX + colW;
      });
      let y = inColumn.length
        ? Math.max(...inColumn.map((item) => item.y + canvasItemSize(item).h)) +
          NOTE_GAP
        : area.y + headerH;
      for (const placement of list) {
        const note: CanvasItem = {
          id: options.createId(),
          kind: 'sticky',
          refId: null,
          x: Math.round(colX),
          y: Math.round(y),
          w: Math.round(colW),
          h: NOTE_H,
          zIndex: z++,
          data: {
            text: placement.text,
            color: area.data.color ?? 'yellow',
            fontSize: calendar ? 12 : 14,
          },
          updatedAt: PENDING_CANVAS_TIMESTAMP,
          updatedBy: null,
        };
        creates.push(note);
        own.add(note.id);
        working.set(note.id, note);
        y += NOTE_H + NOTE_GAP;
      }
      lowest = Math.max(lowest, y - NOTE_GAP);
    }

    const grow = lowest + AREA_PAD_BOTTOM - originalBottom;
    if (grow <= 0) continue;
    working.set(area.id, { ...area, h: areaSize.h + grow });
    for (const [id, item] of working) {
      if (id === area.id || id === section.id || own.has(id)) continue;
      const size = canvasItemSize(item);
      const overlapsX =
        item.x < area.x + areaSize.w && item.x + size.w > area.x;
      if (overlapsX && item.y >= originalBottom - 1) {
        working.set(id, { ...item, y: item.y + grow });
      }
    }
  }

  const sectionItem = working.get(section.id)!;
  const sectionSize = canvasItemSize(sectionItem);
  const contentBottom = Math.max(
    ...[...working.values()]
      .filter((item) => item.id !== section.id)
      .map((item) => item.y + canvasItemSize(item).h),
  );
  if (contentBottom + SECTION_PAD > sectionItem.y + sectionSize.h) {
    working.set(section.id, {
      ...sectionItem,
      h: Math.round(contentBottom + SECTION_PAD - sectionItem.y),
    });
  }

  const created = new Set(creates.map((item) => item.id));
  const original = new Map(items.map((item) => [item.id, item]));
  const updates = [...working.values()].filter((item) => {
    if (created.has(item.id)) return false;
    const before = original.get(item.id);
    return before && (before.y !== item.y || before.h !== item.h);
  });
  return {
    creates: creates.map((item) => working.get(item.id)!),
    updates,
  };
}
