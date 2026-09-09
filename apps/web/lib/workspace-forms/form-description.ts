import {
  isHtmlContent,
  sanitizeCommunityHtml,
} from '~/lib/sanitize-community-html';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LIST_LINE_RE = /^[-*•]\s+(.*)$/;

function plainBlockToHtml(block: string): string {
  const lines = block.split('\n');
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    parts.push(
      `<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`,
    );
    listItems = [];
  };

  const flushParagraph = (text: string) => {
    if (!text) return;
    parts.push(`<p>${text.replace(/\n/g, '<br />')}</p>`);
  };

  let paragraph: string[] = [];

  const flushOpenParagraph = () => {
    if (paragraph.length === 0) return;
    flushParagraph(paragraph.map((line) => escapeHtml(line)).join('\n'));
    paragraph = [];
  };

  for (const line of lines) {
    const match = line.trim().match(LIST_LINE_RE);
    if (match) {
      flushOpenParagraph();
      listItems.push(escapeHtml(match[1] ?? ''));
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushOpenParagraph();
  flushList();
  return parts.join('');
}

/** Render a stored form intro: rich HTML or plain text with line breaks. */
export function formDescriptionToHtml(description: string | null): string {
  if (!description?.trim()) return '';

  if (isHtmlContent(description)) {
    return sanitizeCommunityHtml(description);
  }

  return description
    .split(/\n{2,}/)
    .map(plainBlockToHtml)
    .join('');
}

export function formDescriptionHasHeading(html: string): boolean {
  return /<h[23]\b/i.test(html);
}
