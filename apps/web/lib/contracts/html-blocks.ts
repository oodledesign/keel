/**
 * Turn contract rich-text HTML into layout blocks for pdf-lib.
 *
 * Kept dependency-free (no DOM, no server-only) so PDF generation and
 * unit tests share the same parser. Supports the tags the document
 * editor actually emits, plus tables when they appear in stored HTML.
 */

export type HtmlTextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  href?: string;
};

export type HtmlHeadingBlock = {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  runs: HtmlTextRun[];
};

export type HtmlParagraphBlock = {
  type: 'paragraph';
  runs: HtmlTextRun[];
};

export type HtmlListBlock = {
  type: 'list';
  ordered: boolean;
  items: HtmlTextRun[][];
};

export type HtmlTableBlock = {
  type: 'table';
  rows: HtmlTextRun[][][];
};

export type HtmlSpacerBlock = {
  type: 'spacer';
};

export type HtmlBlock =
  | HtmlHeadingBlock
  | HtmlParagraphBlock
  | HtmlListBlock
  | HtmlTableBlock
  | HtmlSpacerBlock;

type ElementNode = {
  kind: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
};

type TextNode = {
  kind: 'text';
  text: string;
};

type HtmlNode = ElementNode | TextNode;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col']);

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (full, entity: string) => {
      if (entity[0] === '#') {
        const hex = entity[1] === 'x' || entity[1] === 'X';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (Number.isFinite(code) && code > 0) {
          try {
            return String.fromCodePoint(code);
          } catch {
            return full;
          }
        }
        return full;
      }
      return ENTITY_MAP[entity] ?? full;
    },
  );
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:@]?[a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const value = match[3] ?? match[4] ?? match[5] ?? '';
    attrs[match[1]!.toLowerCase()] = decodeHtmlEntities(value);
  }
  return attrs;
}

function parseHtmlTree(html: string): HtmlNode[] {
  const root: ElementNode = {
    kind: 'element',
    tag: 'root',
    attrs: {},
    children: [],
  };
  const stack: ElementNode[] = [root];
  const tokenRe =
    /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html))) {
    const parent = stack[stack.length - 1]!;
    if (match[0].startsWith('<!--')) continue;

    if (match[3] != null) {
      const text = decodeHtmlEntities(match[3]);
      if (text) parent.children.push({ kind: 'text', text });
      continue;
    }

    const tag = match[1]!.toLowerCase();
    const rest = match[2] ?? '';
    const isClose = match[0].startsWith('</');
    const selfClosing = VOID_TAGS.has(tag) || /\/\s*$/.test(rest);

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const node: ElementNode = {
      kind: 'element',
      tag,
      attrs: parseAttrs(rest),
      children: [],
    };
    parent.children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root.children;
}

type Style = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  href?: string;
};

function styleFromTag(
  tag: string,
  attrs: Record<string, string>,
  parent: Style,
): Style {
  const next: Style = { ...parent };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 'a') {
    const href = attrs.href?.trim();
    if (href && /^(https?:|mailto:)/i.test(href)) next.href = href;
  }
  return next;
}

function runFromText(text: string, style: Style): HtmlTextRun | null {
  if (!text) return null;
  const run: HtmlTextRun = { text };
  if (style.bold) run.bold = true;
  if (style.italic) run.italic = true;
  if (style.underline) run.underline = true;
  if (style.href) run.href = style.href;
  return run;
}

function mergeRuns(runs: HtmlTextRun[]): HtmlTextRun[] {
  const merged: HtmlTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Boolean(prev.bold) === Boolean(run.bold) &&
      Boolean(prev.italic) === Boolean(run.italic) &&
      Boolean(prev.underline) === Boolean(run.underline) &&
      (prev.href ?? '') === (run.href ?? '')
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function collectRuns(nodes: HtmlNode[], style: Style): HtmlTextRun[] {
  const runs: HtmlTextRun[] = [];
  for (const node of nodes) {
    if (node.kind === 'text') {
      const run = runFromText(node.text, style);
      if (run) runs.push(run);
      continue;
    }
    if (node.tag === 'br') {
      runs.push({ text: '\n' });
      continue;
    }
    const next = styleFromTag(node.tag, node.attrs, style);
    runs.push(...collectRuns(node.children, next));
  }
  return mergeRuns(runs);
}

function headingLevel(tag: string): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (!/^h[1-6]$/.test(tag)) return null;
  return Number(tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
}

function isBlockTag(tag: string): boolean {
  return (
    tag === 'p' ||
    tag === 'div' ||
    tag === 'blockquote' ||
    tag === 'ul' ||
    tag === 'ol' ||
    tag === 'li' ||
    tag === 'table' ||
    tag === 'thead' ||
    tag === 'tbody' ||
    tag === 'tfoot' ||
    tag === 'tr' ||
    tag === 'td' ||
    tag === 'th' ||
    headingLevel(tag) != null
  );
}

function hasVisibleRuns(runs: HtmlTextRun[]): boolean {
  return runs.some((run) => run.text.replace(/\s+/g, '').length > 0);
}

function collectListItems(
  nodes: HtmlNode[],
  ordered: boolean,
  style: Style,
): HtmlListBlock {
  const items: HtmlTextRun[][] = [];
  for (const node of nodes) {
    if (node.kind !== 'element') continue;
    if (node.tag === 'li') {
      items.push(collectRuns(node.children, style));
      continue;
    }
    if (node.tag === 'ul' || node.tag === 'ol') {
      // Nested lists flatten into extra items — practical, not a clone of Word.
      items.push(
        ...collectListItems(node.children, node.tag === 'ol', style).items,
      );
    }
  }
  return { type: 'list', ordered, items };
}

function collectTable(nodes: HtmlNode[], style: Style): HtmlTableBlock {
  const rows: HtmlTextRun[][][] = [];

  const consumeRow = (rowNode: ElementNode) => {
    const cells: HtmlTextRun[][] = [];
    for (const child of rowNode.children) {
      if (
        child.kind === 'element' &&
        (child.tag === 'td' || child.tag === 'th')
      ) {
        const cellStyle = child.tag === 'th' ? { ...style, bold: true } : style;
        cells.push(collectRuns(child.children, cellStyle));
      }
    }
    if (cells.length > 0) rows.push(cells);
  };

  const walk = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.kind !== 'element') continue;
      if (node.tag === 'tr') consumeRow(node);
      else walk(node.children);
    }
  };

  walk(nodes);
  return { type: 'table', rows };
}

function blocksFromNodes(nodes: HtmlNode[], style: Style): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const loose: HtmlNode[] = [];

  const flushLoose = () => {
    if (loose.length === 0) return;
    const runs = collectRuns(loose, style);
    loose.length = 0;
    if (hasVisibleRuns(runs)) blocks.push({ type: 'paragraph', runs });
  };

  for (const node of nodes) {
    if (node.kind === 'text') {
      loose.push(node);
      continue;
    }

    if (!isBlockTag(node.tag) && node.tag !== 'br') {
      loose.push(node);
      continue;
    }

    if (node.tag === 'br') {
      loose.push({ kind: 'text', text: '\n' });
      continue;
    }

    flushLoose();
    const next = styleFromTag(node.tag, node.attrs, style);
    const level = headingLevel(node.tag);

    if (node.tag === 'p' || node.tag === 'div' || node.tag === 'blockquote') {
      const runs = collectRuns(node.children, next);
      if (hasVisibleRuns(runs)) blocks.push({ type: 'paragraph', runs });
      continue;
    }

    if (level) {
      const runs = collectRuns(node.children, { ...next, bold: true });
      if (hasVisibleRuns(runs)) blocks.push({ type: 'heading', level, runs });
      continue;
    }

    if (node.tag === 'ul' || node.tag === 'ol') {
      const list = collectListItems(node.children, node.tag === 'ol', next);
      if (list.items.length > 0) blocks.push(list);
      continue;
    }

    if (node.tag === 'table') {
      const table = collectTable(node.children, next);
      if (table.rows.length > 0) blocks.push(table);
      continue;
    }

    if (node.tag === 'hr') {
      blocks.push({ type: 'spacer' });
      continue;
    }

    blocks.push(...blocksFromNodes(node.children, next));
  }

  flushLoose();
  return blocks;
}

export function htmlToBlocks(html: string): HtmlBlock[] {
  if (!html.trim()) return [];
  const tree = parseHtmlTree(html);
  return blocksFromNodes(tree, {
    bold: false,
    italic: false,
    underline: false,
  });
}

export function runsToPlainText(runs: HtmlTextRun[]): string {
  return runs.map((run) => run.text).join('');
}
