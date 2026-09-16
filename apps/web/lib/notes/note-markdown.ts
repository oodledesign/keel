/**
 * Shared notes markdown subset with the iOS NoteMarkdown parser and TipTap toolbar:
 * bold (`**` / `__`), italic (`*` / `_`), underline (`<u>`), H1, H2, bullets.
 * Speaker labels stay as `## Me` / `## Speaker 1` headings.
 */

export type NoteMarkdownMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type NoteMarkdownRun = NoteMarkdownMarks & {
  text: string;
};

export type NoteMarkdownBlockKind =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'bullet';

export type NoteMarkdownBlock = {
  kind: NoteMarkdownBlockKind;
  runs: NoteMarkdownRun[];
};

export function parseNoteMarkdown(markdown: string): NoteMarkdownBlock[] {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim()) {
    return [];
  }

  const blocks: NoteMarkdownBlock[] = [];
  for (const line of normalized.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push({
        kind: 'heading2',
        runs: parseInlines(line.slice(3)),
      });
    } else if (line.startsWith('# ')) {
      blocks.push({
        kind: 'heading1',
        runs: parseInlines(line.slice(2)),
      });
    } else {
      const item = bulletItem(line);
      if (item !== null) {
        blocks.push({ kind: 'bullet', runs: parseInlines(item) });
      } else {
        blocks.push({ kind: 'paragraph', runs: parseInlines(line) });
      }
    }
  }

  return blocks;
}

export function noteMarkdownToHtml(markdown: string): string {
  const blocks = parseNoteMarkdown(markdown);
  if (blocks.length === 0) {
    return '';
  }

  const parts: string[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index]!;
    if (block.kind === 'bullet') {
      const items: string[] = [];
      while (index < blocks.length && blocks[index]!.kind === 'bullet') {
        items.push(`<li>${renderRuns(blocks[index]!.runs)}</li>`);
        index += 1;
      }
      parts.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const inner = renderRuns(block.runs);
    if (block.kind === 'heading1') {
      parts.push(`<h1>${inner}</h1>`);
    } else if (block.kind === 'heading2') {
      parts.push(`<h2>${inner}</h2>`);
    } else {
      parts.push(`<p>${inner}</p>`);
    }
    index += 1;
  }

  return parts.join('');
}

export function noteMarkdownToPlainText(markdown: string): string {
  return parseNoteMarkdown(markdown)
    .map((block) => block.runs.map((run) => run.text).join(''))
    .map((text) => text.trim())
    .filter(Boolean)
    .join('\n');
}

function bulletItem(line: string): string | null {
  const rest = line.replace(/^ +/, '');
  for (const prefix of ['- ', '* ', '+ ', '• ']) {
    if (rest.startsWith(prefix)) {
      return rest.slice(prefix.length);
    }
  }
  return null;
}

function parseInlines(input: string): NoteMarkdownRun[] {
  return mergeRuns(
    parseInlinesRange(input, 0, input.length, {
      bold: false,
      italic: false,
      underline: false,
    }).runs,
  );
}

function parseInlinesRange(
  input: string,
  start: number,
  end: number,
  marks: NoteMarkdownMarks,
): { runs: NoteMarkdownRun[]; index: number } {
  const runs: NoteMarkdownRun[] = [];
  let buffer = '';
  let index = start;

  const flush = () => {
    if (!buffer) return;
    runs.push({ text: buffer, ...marks });
    buffer = '';
  };

  while (index < end) {
    if (input[index] === '\\' && index + 1 < end) {
      buffer += input[index + 1];
      index += 2;
      continue;
    }

    if (
      input.startsWith('<u>', index) &&
      index + 3 < end
    ) {
      const close = findToken(input, '</u>', index + 3, end);
      if (close !== -1) {
        flush();
        const nested = parseInlinesRange(input, index + 3, close, {
          ...marks,
          underline: true,
        });
        runs.push(...nested.runs);
        index = close + 4;
        continue;
      }
    }

    const wrapped =
      wrap(input, index, end, '***', marks, { bold: true, italic: true }) ??
      wrap(input, index, end, '___', marks, { bold: true, italic: true }) ??
      wrap(input, index, end, '**', marks, { bold: true }) ??
      wrap(input, index, end, '__', marks, { bold: true }) ??
      wrap(input, index, end, '*', marks, { italic: true }) ??
      (canOpenUnderscore(input, index, end)
        ? wrap(input, index, end, '_', marks, { italic: true })
        : null);

    if (wrapped) {
      flush();
      runs.push(...wrapped.runs);
      index = wrapped.index;
      continue;
    }

    buffer += input[index];
    index += 1;
  }

  flush();
  return { runs, index };
}

function wrap(
  input: string,
  index: number,
  end: number,
  delimiter: string,
  marks: NoteMarkdownMarks,
  apply: Partial<NoteMarkdownMarks>,
): { runs: NoteMarkdownRun[]; index: number } | null {
  if (!input.startsWith(delimiter, index)) {
    return null;
  }

  const innerStart = index + delimiter.length;
  const close = findToken(input, delimiter, innerStart, end);
  if (close === -1 || close <= innerStart) {
    return null;
  }

  const nested = parseInlinesRange(input, innerStart, close, {
    ...marks,
    ...apply,
  });
  return { runs: nested.runs, index: close + delimiter.length };
}

function findToken(
  input: string,
  token: string,
  from: number,
  end: number,
): number {
  let index = from;
  while (index + token.length <= end) {
    if (input[index] === '\\') {
      index += 2;
      continue;
    }
    if (input.startsWith(token, index)) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function canOpenUnderscore(
  input: string,
  index: number,
  end: number,
): boolean {
  if (index >= end || input[index] !== '_') {
    return false;
  }
  if (index > 0 && /[A-Za-z0-9]/.test(input[index - 1]!)) {
    return false;
  }
  return true;
}

function mergeRuns(runs: NoteMarkdownRun[]): NoteMarkdownRun[] {
  const merged: NoteMarkdownRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = merged[merged.length - 1];
    if (
      last &&
      last.bold === run.bold &&
      last.italic === run.italic &&
      last.underline === run.underline
    ) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

function renderRuns(runs: NoteMarkdownRun[]): string {
  return runs
    .map((run) => {
      let html = escapeHtml(run.text);
      if (run.bold) html = `<strong>${html}</strong>`;
      if (run.italic) html = `<em>${html}</em>`;
      if (run.underline) html = `<u>${html}</u>`;
      return html;
    })
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
