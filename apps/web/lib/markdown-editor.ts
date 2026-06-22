/**
 * Textarea helpers for inserting Markdown syntax (notes.content contract).
 */

export type MarkdownFormat =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'bullet'
  | 'title'
  | 'subheading';

export type MarkdownEditResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): MarkdownEditResult {
  const selected = text.slice(start, end) || placeholder;
  const value =
    text.slice(0, start) + before + selected + after + text.slice(end);
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { value, selectionStart: cursorStart, selectionEnd: cursorEnd };
}

function prefixLines(
  text: string,
  start: number,
  end: number,
  prefix: string,
  emptyFallback: string,
): MarkdownEditResult {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', end);
  const blockEnd = lineEnd === -1 ? text.length : lineEnd;
  const block = text.slice(lineStart, blockEnd);
  const lines = block.length ? block.split('\n') : [emptyFallback];
  const prefixed = lines.map((line) => `${prefix}${line}`).join('\n');
  const value = text.slice(0, lineStart) + prefixed + text.slice(blockEnd);
  const cursor = lineStart + prefixed.length;
  return { value, selectionStart: cursor, selectionEnd: cursor };
}

export function applyMarkdownFormat(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  format: MarkdownFormat,
): MarkdownEditResult {
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);

  switch (format) {
    case 'bold':
      return wrapSelection(text, start, end, '**', '**', 'bold');
    case 'italic':
      return wrapSelection(text, start, end, '*', '*', 'italic');
    case 'underline':
      return wrapSelection(text, start, end, '<u>', '</u>', 'underline');
    case 'bullet':
      return prefixLines(text, start, end, '- ', 'list item');
    case 'title':
      return prefixLines(text, start, end, '# ', 'Title');
    case 'subheading':
      return prefixLines(text, start, end, '## ', 'Subheading');
    default:
      return { value: text, selectionStart: start, selectionEnd: end };
  }
}
