import type { ReactElement } from 'react';

import { cn } from '@kit/ui/utils';

import type {
  BrochureLayoutId,
  BrochureOrientation,
} from '~/lib/commercial/brochure-pdf/brochure-document';

type Box = { x: number; y: number; w: number; h: number };

type Shape =
  | ({ kind: 'photo' | 'map' | 'band' | 'panel' | 'plan' | 'scale' } & Box)
  | ({ kind: 'lines' | 'rows' | 'places'; dark?: boolean } & Box)
  | { kind: 'heading'; x: number; y: number; w: number; dark?: boolean };

const MARGIN = 3;
const GAP = 1;
const HEADING_H = 1.6;
const LINE_H = 0.8;
const LINE_STEP = 2.2;
/** Where content starts below a page heading. */
const BODY_Y = MARGIN + 4;

/** Paper colours stay fixed so the page reads as a printed sheet in both themes. */
const INK = 'var(--ozer-plum-900)';
const MUTED = 'var(--ozer-text-muted)';
const PAPER = 'var(--ozer-white)';
const ACCENT = 'var(--ozer-accent)';
const MAP = 'var(--ozer-info)';

const TEXT_KINDS: ReadonlySet<Shape['kind']> = new Set([
  'lines',
  'rows',
  'places',
]);

function heading(w: number, x = MARGIN, y = MARGIN): Shape {
  return { kind: 'heading', x, y, w };
}

function grid(
  area: Box,
  columns: number,
  rows: number,
  kind: 'photo' | 'lines' = 'photo',
): Shape[] {
  const w = (area.w - GAP * (columns - 1)) / columns;
  const h = (area.h - GAP * (rows - 1)) / rows;
  return Array.from({ length: columns * rows }, (_, i) => ({
    kind,
    x: area.x + (i % columns) * (w + GAP),
    y: area.y + Math.floor(i / columns) * (h + GAP),
    w,
    h,
  }));
}

function coverShapes(W: number, H: number, sideBand: boolean): Shape[] {
  if (sideBand) {
    const bandX = W * 0.68;
    const inner = bandX + 2;
    const innerW = W - bandX - 4;
    return [
      { kind: 'photo', x: 0, y: 0, w: bandX, h: H },
      { kind: 'band', x: bandX, y: 0, w: W - bandX, h: H },
      { kind: 'heading', x: inner, y: 4, w: innerW, dark: true },
      { kind: 'lines', x: inner, y: 8, w: innerW, h: 8, dark: true },
    ];
  }
  const bandY = H * 0.64;
  return [
    { kind: 'photo', x: 0, y: 0, w: W, h: bandY },
    { kind: 'band', x: 0, y: bandY, w: W, h: H - bandY },
    { kind: 'heading', x: MARGIN, y: bandY + 2.5, w: W * 0.55, dark: true },
    {
      kind: 'lines',
      x: MARGIN,
      y: bandY + 6,
      w: W * 0.45,
      h: H - bandY - 7,
      dark: true,
    },
  ];
}

function layoutShapes(
  layoutId: BrochureLayoutId,
  W: number,
  H: number,
  landscape: boolean,
): Shape[] {
  const inner = W - MARGIN * 2;
  const page: Box = { x: MARGIN, y: MARGIN, w: inner, h: H - MARGIN * 2 };
  const body: Box = { x: MARGIN, y: BODY_Y, w: inner, h: H - BODY_Y - MARGIN };

  switch (layoutId) {
    case 'cover_hero_band':
      return coverShapes(W, H, landscape);
    case 'cover_photo_band':
      return coverShapes(W, H, false);

    case 'facts_table':
      if (landscape) {
        const split = W * 0.52;
        return [
          heading(W * 0.28),
          {
            kind: 'rows',
            x: MARGIN,
            y: BODY_Y,
            w: split - MARGIN - 2,
            h: body.h,
          },
          ...grid({ x: split, y: 0, w: W - split, h: H }, 1, 2),
        ];
      }
      return [
        heading(W * 0.4),
        { kind: 'rows', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.42 },
        ...grid(
          { x: MARGIN, y: H * 0.62, w: inner, h: H * 0.38 - MARGIN },
          2,
          1,
        ),
      ];

    case 'description_highlights':
      if (landscape) {
        const split = W * 0.58;
        return [
          heading(W * 0.32),
          {
            kind: 'lines',
            x: MARGIN,
            y: BODY_Y,
            w: split - MARGIN - 2,
            h: body.h,
          },
          {
            kind: 'panel',
            x: split,
            y: BODY_Y,
            w: W - split - MARGIN,
            h: H * 0.5,
          },
          {
            kind: 'lines',
            x: split + 1.5,
            y: BODY_Y + 2,
            w: W - split - MARGIN - 3,
            h: H * 0.5 - 3,
          },
        ];
      }
      return [
        heading(W * 0.5),
        { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.45 },
        {
          kind: 'panel',
          x: MARGIN,
          y: H * 0.62,
          w: inner,
          h: H * 0.38 - MARGIN,
        },
        {
          kind: 'lines',
          x: MARGIN + 1.5,
          y: H * 0.62 + 2,
          w: inner - 3,
          h: H * 0.38 - MARGIN - 3,
        },
      ];

    case 'description_photo':
    case 'photo_text': {
      const share = layoutId === 'photo_text' ? 0.4 : 0.52;
      const copyLines = layoutId === 'photo_text' ? 0.35 : 0.3;
      if (landscape) {
        const split = W * share;
        const textW = split - MARGIN - 2;
        const shapes: Shape[] = [
          heading(textW * 0.7),
          { kind: 'lines', x: MARGIN, y: BODY_Y, w: textW, h: H * copyLines },
          { kind: 'photo', x: split, y: 0, w: W - split, h: H },
        ];
        if (layoutId === 'description_photo') {
          shapes.push({
            kind: 'places',
            x: MARGIN,
            y: BODY_Y + H * 0.38,
            w: textW,
            h: H * 0.32,
          });
        }
        return shapes;
      }
      const photoY = H * 0.5;
      if (layoutId === 'description_photo') {
        return [
          heading(W * 0.5),
          { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.2 },
          {
            kind: 'places',
            x: MARGIN,
            y: BODY_Y + H * 0.25,
            w: inner,
            h: photoY - BODY_Y - H * 0.25 - 2,
          },
          {
            kind: 'photo',
            x: MARGIN,
            y: photoY,
            w: inner,
            h: H - photoY - MARGIN,
          },
        ];
      }
      return [
        heading(W * 0.5),
        {
          kind: 'lines',
          x: MARGIN,
          y: BODY_Y,
          w: inner,
          h: photoY - BODY_Y - 2,
        },
        {
          kind: 'photo',
          x: MARGIN,
          y: photoY,
          w: inner,
          h: H - photoY - MARGIN,
        },
      ];
    }

    case 'details_columns':
      return [heading(W * 0.4), ...grid(body, landscape ? 3 : 2, 1, 'lines')];

    case 'photo_full':
      return [{ kind: 'photo', x: 0, y: 0, w: W, h: H }];
    case 'photo_grid_2':
      return grid(page, landscape ? 2 : 1, landscape ? 1 : 2);
    case 'photo_grid_3': {
      const topH = (page.h - GAP) * 0.6;
      return [
        { kind: 'photo', x: page.x, y: page.y, w: page.w, h: topH },
        ...grid(
          { ...page, y: page.y + topH + GAP, h: page.h - topH - GAP },
          2,
          1,
        ),
      ];
    }
    case 'photo_row_3':
      return grid(page, landscape ? 3 : 1, landscape ? 1 : 3);
    case 'photo_grid_4':
      return grid(page, 2, 2);

    case 'floorplan':
      return [heading(W * 0.3), { kind: 'plan', ...body }];

    case 'epc':
      if (landscape) {
        const split = W * 0.42;
        return [
          heading(W * 0.28),
          { kind: 'scale', x: MARGIN, y: BODY_Y, w: split - MARGIN - 2, h: 13 },
          { kind: 'panel', x: split + 2, y: MARGIN, w: W * 0.36, h: page.h },
        ];
      }
      return [
        heading(W * 0.5),
        { kind: 'scale', x: MARGIN, y: BODY_Y, w: inner * 0.7, h: 13 },
        {
          kind: 'panel',
          x: MARGIN + inner * 0.15,
          y: BODY_Y + 15,
          w: inner * 0.7,
          h: H - BODY_Y - 15 - MARGIN,
        },
      ];

    case 'map_amenities':
      if (landscape) {
        const split = W * 0.42;
        return [
          heading(W * 0.26),
          {
            kind: 'lines',
            x: MARGIN,
            y: BODY_Y,
            w: split - MARGIN - 2,
            h: H * 0.3,
          },
          {
            kind: 'places',
            x: MARGIN,
            y: BODY_Y + H * 0.36,
            w: split - MARGIN - 2,
            h: H * 0.3,
          },
          {
            kind: 'map',
            x: split,
            y: MARGIN,
            w: W - split - MARGIN,
            h: page.h,
          },
        ];
      }
      return [
        heading(W * 0.4),
        { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.2 },
        { kind: 'map', x: MARGIN, y: H * 0.36, w: inner, h: H * 0.42 },
        {
          kind: 'places',
          x: MARGIN,
          y: H * 0.81,
          w: inner,
          h: H * 0.19 - MARGIN,
        },
      ];

    case 'map_text':
      if (landscape) {
        const split = W * 0.62;
        return [
          heading(W * 0.3),
          {
            kind: 'lines',
            x: MARGIN,
            y: BODY_Y,
            w: split - MARGIN - 2,
            h: H * 0.45,
          },
          {
            kind: 'places',
            x: MARGIN,
            y: BODY_Y + H * 0.52,
            w: split - MARGIN - 2,
            h: H * 0.22,
          },
          { kind: 'map', x: split, y: 0, w: W - split, h: H },
        ];
      }
      return [
        heading(W * 0.4),
        { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.4 },
        { kind: 'places', x: MARGIN, y: H * 0.56, w: inner, h: H * 0.12 },
        { kind: 'map', x: MARGIN, y: H * 0.72, w: inner, h: H * 0.28 - MARGIN },
      ];

    case 'map_top': {
      const mapH = H * 0.42;
      const textY = mapH + 2;
      return [
        { kind: 'map', x: 0, y: 0, w: W, h: mapH },
        heading(W * 0.35, MARGIN, textY),
        { kind: 'lines', x: MARGIN, y: textY + 3.5, w: inner, h: H * 0.2 },
        {
          kind: 'places',
          x: MARGIN,
          y: textY + 3.5 + H * 0.22,
          w: inner,
          h: H - textY - 3.5 - H * 0.22 - MARGIN,
        },
      ];
    }

    case 'location_text':
      return [
        heading(W * 0.35),
        { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner, h: H * 0.42 },
        {
          kind: 'places',
          x: MARGIN,
          y: BODY_Y + H * 0.48,
          w: inner,
          h: H - BODY_Y - H * 0.48 - MARGIN,
        },
      ];

    case 'contact':
      if (landscape) {
        const split = W * 0.55;
        return [
          heading(W * 0.25),
          {
            kind: 'lines',
            x: MARGIN,
            y: BODY_Y,
            w: split - MARGIN - 2,
            h: H * 0.3,
          },
          {
            kind: 'photo',
            x: MARGIN,
            y: BODY_Y + H * 0.36,
            w: split * 0.6,
            h: H * 0.32,
          },
          {
            kind: 'band',
            x: split,
            y: MARGIN,
            w: W - split - MARGIN,
            h: page.h,
          },
          {
            kind: 'lines',
            x: split + 2,
            y: MARGIN + 3,
            w: W - split - MARGIN - 4,
            h: page.h - 6,
            dark: true,
          },
        ];
      }
      return [
        heading(W * 0.4),
        { kind: 'lines', x: MARGIN, y: BODY_Y, w: inner * 0.55, h: H * 0.22 },
        {
          kind: 'photo',
          x: MARGIN + inner * 0.6,
          y: BODY_Y,
          w: inner * 0.4,
          h: H * 0.2,
        },
        {
          kind: 'band',
          x: MARGIN,
          y: H * 0.45,
          w: inner,
          h: H * 0.55 - MARGIN,
        },
        {
          kind: 'lines',
          x: MARGIN + 2,
          y: H * 0.45 + 3,
          w: inner - 4,
          h: H * 0.55 - MARGIN - 6,
          dark: true,
        },
      ];
  }
}

function lineWidths(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 && count > 1 ? 0.6 : 1 - (i % 3) * 0.08,
  );
}

function ShapeView({
  shape,
  id,
  skeleton,
}: {
  shape: Shape;
  id: string;
  skeleton: boolean;
}): ReactElement {
  if (skeleton && 'h' in shape && !TEXT_KINDS.has(shape.kind)) {
    return (
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.w}
        height={shape.h}
        rx={0.4}
        fill={MUTED}
        opacity={shape.kind === 'band' ? 0.5 : 0.3}
      />
    );
  }
  switch (shape.kind) {
    case 'photo': {
      const { x, y, w, h } = shape;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={MUTED} opacity={0.4} />
          <polygon
            points={`${x + w * 0.15},${y + h * 0.82} ${x + w * 0.42},${y + h * 0.42} ${x + w * 0.66},${y + h * 0.82}`}
            fill={MUTED}
            opacity={0.7}
          />
          <circle
            cx={x + w * 0.72}
            cy={y + h * 0.3}
            r={Math.min(w, h) * 0.08}
            fill={MUTED}
            opacity={0.7}
          />
        </g>
      );
    }
    case 'map': {
      const { x, y, w, h } = shape;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} fill={MAP} opacity={0.22} />
          <path
            d={`M${x} ${y + h * 0.65} L${x + w} ${y + h * 0.35} M${x + w * 0.35} ${y} L${x + w * 0.55} ${y + h}`}
            stroke={PAPER}
            strokeWidth={0.6}
          />
          <circle cx={x + w * 0.5} cy={y + h * 0.5} r={1.1} fill={ACCENT} />
        </g>
      );
    }
    case 'band':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          fill={INK}
        />
      );
    case 'panel':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={0.6}
          fill={ACCENT}
          opacity={0.14}
        />
      );
    case 'plan': {
      const { x, y, w, h } = shape;
      return (
        <g fill="none" stroke={MUTED} strokeWidth={0.5}>
          <rect
            x={x + w * 0.1}
            y={y + h * 0.05}
            width={w * 0.8}
            height={h * 0.9}
          />
          <path
            d={`M${x + w * 0.5} ${y + h * 0.05} V${y + h * 0.6} M${x + w * 0.1} ${y + h * 0.6} H${x + w * 0.9} M${x + w * 0.7} ${y + h * 0.6} V${y + h * 0.95}`}
          />
        </g>
      );
    }
    case 'scale': {
      const { x, y, w, h } = shape;
      const rows = 8;
      const rowH = h / rows - 0.3;
      return (
        <g fill={MUTED}>
          {Array.from({ length: rows }, (_, i) => (
            <rect
              key={`${id}-${i}`}
              x={x}
              y={y + i * (h / rows)}
              width={w * (0.35 + (0.4 * i) / (rows - 1))}
              height={rowH}
              opacity={0.55}
            />
          ))}
          <rect
            x={x + w * 0.8}
            y={y + 2 * (h / rows)}
            width={w * 0.2}
            height={rowH}
            fill={ACCENT}
          />
        </g>
      );
    }
    case 'heading':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={HEADING_H}
          rx={0.4}
          fill={shape.dark ? PAPER : skeleton ? MUTED : INK}
          opacity={shape.dark ? 0.9 : 0.8}
        />
      );
    case 'lines':
    case 'rows':
    case 'places': {
      const { x, y, w, h } = shape;
      const step = shape.kind === 'rows' ? LINE_STEP * 1.2 : LINE_STEP;
      const count = Math.max(1, Math.floor((h + step - LINE_H) / step));
      const fill = shape.dark ? PAPER : MUTED;
      if (shape.kind === 'places') {
        const colW = (w - GAP * 2) / 2;
        return (
          <g fill={fill}>
            {Array.from({ length: count * 2 }, (_, i) => {
              const cx = x + (i % 2) * (colW + GAP * 2);
              const cy = y + Math.floor(i / 2) * step;
              return (
                <g key={`${id}-${i}`}>
                  <circle
                    cx={cx + 0.5}
                    cy={cy + LINE_H / 2}
                    r={0.6}
                    fill={skeleton ? fill : ACCENT}
                  />
                  <rect
                    x={cx + 1.6}
                    y={cy}
                    width={colW * 0.7}
                    height={LINE_H}
                    rx={0.3}
                  />
                </g>
              );
            })}
          </g>
        );
      }
      return (
        <g fill={fill} opacity={shape.dark ? 0.6 : 0.75}>
          {lineWidths(count).map((share, i) => {
            const ly = y + i * step;
            if (shape.kind === 'rows') {
              return (
                <g key={`${id}-${i}`}>
                  <rect
                    x={x}
                    y={ly}
                    width={w * 0.35}
                    height={LINE_H}
                    rx={0.3}
                  />
                  <rect
                    x={x + w * 0.55}
                    y={ly}
                    width={w * 0.3}
                    height={LINE_H}
                    rx={0.3}
                  />
                  <rect x={x} y={ly + step * 0.7} width={w} height={0.2} />
                </g>
              );
            }
            return (
              <rect
                key={`${id}-${i}`}
                x={x}
                y={ly}
                width={w * share}
                height={LINE_H}
                rx={0.3}
              />
            );
          })}
        </g>
      );
    }
  }
}

/** Wireframe of a page layout: where photos, copy, the map and brand band sit. */
export function BrochureLayoutThumb({
  layoutId,
  orientation,
  skeleton = false,
  className,
}: {
  layoutId: BrochureLayoutId;
  orientation: BrochureOrientation;
  /** Plain placeholder blocks, for standing in while the real page loads. */
  skeleton?: boolean;
  className?: string;
}) {
  const landscape = orientation === 'landscape';
  const W = landscape ? 42 : 30;
  const H = landscape ? 30 : 42;
  const shapes = layoutShapes(layoutId, W, H, landscape);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className={cn(
        'block overflow-hidden rounded-[3px] border border-[var(--workspace-shell-border)]',
        className,
      )}
    >
      <rect width={W} height={H} fill={PAPER} />
      {shapes.map((shape, i) => (
        <ShapeView
          key={`${layoutId}-${i}`}
          id={`${layoutId}-${i}`}
          shape={shape}
          skeleton={skeleton}
        />
      ))}
    </svg>
  );
}
