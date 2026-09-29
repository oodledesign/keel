export type CanvasPoint = [number, number];

function perpendicularDistance(
  point: CanvasPoint,
  start: CanvasPoint,
  end: CanvasPoint,
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }
  return (
    Math.abs(
      dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0],
    ) / Math.hypot(dx, dy)
  );
}

/** Ramer–Douglas–Peucker simplification (iterative). */
export function simplifyCanvasPath(
  points: CanvasPoint[],
  tolerance = 1.5,
): CanvasPoint[] {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(
        points[i]!,
        points[first]!,
        points[last]!,
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/** Evenly thin a path to at most `maxPoints`, keeping both ends. */
export function decimateCanvasPath(
  points: CanvasPoint[],
  maxPoints: number,
): CanvasPoint[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil((points.length - 1) / (maxPoints - 1));
  const out = points.filter((_, i) => i % step === 0);
  if (out.at(-1) !== points.at(-1)) out.push(points.at(-1)!);
  return out;
}

export function canvasPathBounds(points: CanvasPoint[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Smooth SVG path through points using quadratic midpoints. */
export function canvasPathToSvg(points: CanvasPoint[]): string {
  if (points.length === 0) return '';
  const round = (value: number) => Math.round(value * 10) / 10;
  const [first, ...rest] = points;
  if (rest.length === 0) {
    return `M${round(first![0])},${round(first![1])}l0.1,0`;
  }
  let d = `M${round(first![0])},${round(first![1])}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const [x1, y1] = rest[i]!;
    const [x2, y2] = rest[i + 1]!;
    d += `Q${round(x1)},${round(y1)} ${round((x1 + x2) / 2)},${round((y1 + y2) / 2)}`;
  }
  const last = rest.at(-1)!;
  d += `L${round(last[0])},${round(last[1])}`;
  return d;
}

/**
 * Simplify absolute flow-space points and return them relative to their
 * bounding box (padded so the stroke isn't clipped).
 */
export function normalizeCanvasStroke(
  points: CanvasPoint[],
  strokeWidth: number,
  maxPoints = 4000,
): { x: number; y: number; w: number; h: number; points: CanvasPoint[] } {
  const simplified = decimateCanvasPath(
    simplifyCanvasPath(decimateCanvasPath(points, maxPoints * 2)),
    maxPoints,
  );
  const bounds = canvasPathBounds(simplified);
  const pad = Math.ceil(strokeWidth / 2) + 2;
  const originX = bounds.x - pad;
  const originY = bounds.y - pad;
  return {
    x: originX,
    y: originY,
    w: bounds.w + pad * 2,
    h: bounds.h + pad * 2,
    points: simplified.map(([x, y]) => [
      Math.round((x - originX) * 10) / 10,
      Math.round((y - originY) * 10) / 10,
    ]),
  };
}
