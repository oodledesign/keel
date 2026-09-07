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

/** Render a stored form intro: rich HTML or plain text with line breaks. */
export function formDescriptionToHtml(description: string | null): string {
  if (!description?.trim()) return '';

  if (isHtmlContent(description)) {
    return sanitizeCommunityHtml(description);
  }

  return description
    .split(/\n{2,}/)
    .map((paragraph) => {
      const html = escapeHtml(paragraph).replace(/\n/g, '<br />');
      return `<p>${html}</p>`;
    })
    .join('');
}
