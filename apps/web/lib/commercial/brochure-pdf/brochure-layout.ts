/**
 * Pure layout + text helpers for the PDF renderer (no pdf-lib, unit-tested).
 */

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?) (\d[A-Z]{2})\b/gi;

/** Non-breaking space inside UK postcodes so "TN14 5PQ" never splits. */
export function keepPostcodesTogether(text: string): string {
  return text.replace(UK_POSTCODE_RE, '$1\u00a0$2');
}

/** "Sevenoaks, Kent, TN14 5PQ" -> "Sevenoaks, Kent TN14 5PQ" (UK address style). */
export function tidyAddress(address: string): string {
  return address
    .replace(/\s*,\s*,+/g, ',')
    .replace(/,\s*([A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2})\s*$/i, ' $1')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

/**
 * Cover title without repeating the address. A listing named
 * "10 High Street, Sevenoaks, TN14 5PQ" with address
 * "10 High Street, Otford, Sevenoaks, Kent, TN14 5PQ" becomes
 * title "10 High Street" + subtitle "Otford, Sevenoaks, Kent TN14 5PQ".
 */
export function coverTitleParts(
  title: string,
  address: string,
): { title: string; subtitle: string } {
  const rawTitle = title.trim();
  const rawAddress = address.trim();
  if (!rawTitle) {
    return { title: rawAddress, subtitle: '' };
  }

  const lowerAddress = rawAddress.toLowerCase();
  const head = rawTitle.split(',')[0]!.trim();

  for (const prefix of [rawTitle, head]) {
    if (prefix && lowerAddress.startsWith(prefix.toLowerCase())) {
      return {
        title: prefix,
        subtitle: tidyAddress(rawAddress.slice(prefix.length)),
      };
    }
  }

  if (rawTitle.includes(',') && head) {
    return {
      title: head,
      subtitle: tidyAddress(rawAddress || rawTitle.slice(head.length)),
    };
  }

  return {
    title: rawTitle,
    subtitle:
      rawAddress.toLowerCase() === rawTitle.toLowerCase()
        ? ''
        : tidyAddress(rawAddress),
  };
}

/**
 * Cover headline with the locality pulled up from the subtitle:
 * "10 High Street" + "Otford, Sevenoaks, Kent TN14 5PQ" becomes
 * "10 High Street, Otford" + "Sevenoaks, Kent TN14 5PQ".
 */
export function coverHeadline(parts: { title: string; subtitle: string }): {
  title: string;
  subtitle: string;
} {
  const segments = parts.subtitle.split(/,\s*/);
  const [first, ...rest] = segments;
  const isPostcodeOnly = /^[A-Z]{1,2}\d[A-Z\d]?[\s\u00a0]\d[A-Z]{2}$/i.test(
    first?.trim() ?? '',
  );
  if (
    rest.length === 0 ||
    !first?.trim() ||
    isPostcodeOnly ||
    /\d/.test(first) ||
    parts.title.includes(',')
  ) {
    return parts;
  }
  return {
    title: `${parts.title}, ${first.trim()}`,
    subtitle: rest.join(', '),
  };
}

/**
 * Opening line set as a larger lead: the first paragraph when there are
 * several, else the first sentence of a longer paragraph.
 */
export function splitLeadParagraph(body: string): {
  lead: string;
  rest: string;
} {
  const text = body.trim();
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1 && paragraphs[0]!.length <= 320) {
    return { lead: paragraphs[0]!, rest: paragraphs.slice(1).join('\n\n') };
  }
  const match = /^([\s\S]{40,220}?[.!?])\s+(?=[A-Z0-9“"‘'])/.exec(text);
  if (match && text.length - match[0].length >= 40) {
    return { lead: match[1]!.trim(), rest: text.slice(match[0].length).trim() };
  }
  return { lead: '', rest: text };
}

/** "Dominic Tomlinson" -> "DT"; one letter for single names. */
export function nameInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0]![0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]![0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export type DetailsBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string };

/**
 * Parse the details page body: "## Heading", "- bullet" / "• bullet", and
 * paragraphs separated by blank lines (single newlines also break lines).
 */
export function parseDetailsBody(body: string): DetailsBlock[] {
  const blocks: DetailsBlock[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^#{1,3}\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1]!.trim() });
      continue;
    }
    const bullet = /^[-*•·–]\s*(.*)$/.exec(line);
    if (bullet) {
      const text = bullet[1]!.trim();
      if (text) blocks.push({ kind: 'bullet', text });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: line });
  }
  return blocks;
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * Fit an image of `aspect` (w/h) into `area` with at most `maxCrop` of
 * either dimension cropped. Returns the box the image should cover — never
 * larger than the area, so there are no letterbox bars to paint.
 */
export function fitPhotoBox(
  aspect: number,
  area: Box,
  opts: { maxCrop?: number; align?: 'top' | 'center' } = {},
): Box {
  const maxCrop = opts.maxCrop ?? 0.2;
  const areaAspect = area.width / area.height;
  let width = area.width;
  let height = area.height;

  if (aspect > areaAspect) {
    // Image is wider: full width, height may shrink.
    const natural = area.width / aspect;
    height = Math.min(area.height, natural / (1 - maxCrop));
  } else {
    const natural = area.height * aspect;
    width = Math.min(area.width, natural / (1 - maxCrop));
  }

  const x = area.x + (area.width - width) / 2;
  const y =
    opts.align === 'top'
      ? area.y + area.height - height
      : area.y + (area.height - height) / 2;
  return { x, y, width, height };
}

/**
 * Rect for an image of `w`×`h` scaled to cover `box`. The overflow is cropped
 * from the side away from `focus` (top keeps the top edge, and so on).
 */
export function coverImageRect(
  w: number,
  h: number,
  box: Box,
  focus: 'top' | 'center' | 'bottom' = 'center',
): Box {
  const scale = Math.max(box.width / w, box.height / h);
  const width = w * scale;
  const height = h * scale;
  const overflowY = height - box.height;
  const y =
    focus === 'top'
      ? box.y - overflowY
      : focus === 'bottom'
        ? box.y
        : box.y - overflowY / 2;
  return { x: box.x + (box.width - width) / 2, y, width, height };
}

/** Rect for an image of `w`×`h` scaled to sit entirely inside `box`, centred. */
export function wholeImageRect(w: number, h: number, box: Box): Box {
  const scale = Math.min(box.width / w, box.height / h);
  const width = w * scale;
  const height = h * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}

type Strips = number[][];

const STRIP_PATTERNS: Record<number, Strips[]> = {
  1: [[[0]]],
  2: [[[0, 1]], [[0], [1]]],
  3: [[[0, 1, 2]], [[0], [1, 2]], [[0, 1], [2]], [[0], [1], [2]]],
};

/**
 * Justified rows: each strip is a row of images sharing a height, filling
 * `width`. Returns boxes relative to (0,0) top-left plus total height.
 */
function justifyRows(
  strips: Strips,
  aspects: number[],
  width: number,
  gap: number,
): { boxes: Box[]; height: number } {
  const boxes: Box[] = [];
  let top = 0;
  strips.forEach((strip, rowIndex) => {
    const sum = strip.reduce((acc, i) => acc + aspects[i]!, 0);
    const rowH = (width - gap * (strip.length - 1)) / sum;
    let left = 0;
    for (const i of strip) {
      const w = rowH * aspects[i]!;
      boxes[i] = { x: left, y: top, width: w, height: rowH };
      left += w + gap;
    }
    top += rowH + (rowIndex < strips.length - 1 ? gap : 0);
  });
  return { boxes, height: top };
}

function layoutRows(
  strips: Strips,
  aspects: number[],
  area: Box,
  gap: number,
  maxCrop: number,
): Box[] {
  let width = area.width;
  let { boxes, height } = justifyRows(strips, aspects, width, gap);

  if (height > area.height) {
    // Shrink width until the stack fits (height is linear in width).
    const rowGaps = gap * (strips.length - 1);
    const sumInv = strips.reduce(
      (acc, strip) => acc + 1 / strip.reduce((a, i) => a + aspects[i]!, 0),
      0,
    );
    const inner = strips.reduce(
      (acc, strip) =>
        acc +
        (gap * (strip.length - 1)) / strip.reduce((a, i) => a + aspects[i]!, 0),
      0,
    );
    width = (area.height - rowGaps + inner) / sumInv;
    ({ boxes, height } = justifyRows(strips, aspects, width, gap));
  }

  // Stretch rows (cropping each photo a little) to use spare height.
  const rowGaps = gap * (strips.length - 1);
  const stretch = Math.min(
    1 / (1 - maxCrop),
    (area.height - rowGaps) / Math.max(1, height - rowGaps),
  );
  if (stretch > 1) {
    let top = 0;
    for (const strip of strips) {
      const rowH = boxes[strip[0]!]!.height * stretch;
      for (const i of strip) {
        boxes[i] = { ...boxes[i]!, y: top, height: rowH };
      }
      top += rowH + gap;
    }
    height = top - gap;
  }

  const offsetX = area.x + (area.width - width) / 2;
  const offsetTop = area.y + area.height - (area.height - height) / 2;
  return boxes.map((b) => ({
    x: offsetX + b.x,
    y: offsetTop - b.y - b.height,
    width: b.width,
    height: b.height,
  }));
}

function transposeBox(b: Box): Box {
  return { x: b.y, y: b.x, width: b.height, height: b.width };
}

/**
 * Pick the justified arrangement (rows or columns) that shows the most
 * photo area for 1–3 photos. Photos keep their aspect apart from a small
 * `maxCrop` stretch; spare space stays white instead of letterbox bars.
 */
export function layoutPhotoGrid(
  aspects: number[],
  area: Box,
  opts: { gap?: number; maxCrop?: number } = {},
): Box[] {
  const gap = opts.gap ?? 12;
  const maxCrop = opts.maxCrop ?? 0.15;
  const safe = aspects.map((a) =>
    Number.isFinite(a) && a > 0 ? Math.min(4, Math.max(0.25, a)) : 1.5,
  );
  const patterns = STRIP_PATTERNS[safe.length];
  if (!patterns) return [];

  let best: { boxes: Box[]; score: number } | null = null;
  for (const strips of patterns) {
    const asRows = layoutRows(strips, safe, area, gap, maxCrop);
    // Columns = rows of the transposed problem.
    const transposedArea = transposeBox({ ...area, x: 0, y: 0 });
    const asCols = layoutRows(
      strips,
      safe.map((a) => 1 / a),
      transposedArea,
      gap,
      maxCrop,
    ).map((b) => {
      const t = transposeBox(b);
      // Transposition mirrors both axes; flip back so strip 0 is left/top.
      return {
        x: area.x + (area.width - t.x - t.width),
        y: area.y + (area.height - t.y - t.height),
        width: t.width,
        height: t.height,
      };
    });

    for (const boxes of [asRows, asCols]) {
      const score = boxes.reduce((acc, b) => acc + b.width * b.height, 0);
      if (!best || score > best.score + 1) best = { boxes, score };
    }
  }
  return best?.boxes ?? [];
}
