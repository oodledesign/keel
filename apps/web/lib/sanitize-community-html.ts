/** Allowlisted HTML for community rich text (stored user content). */

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'h2',
  'h3',
  'blockquote',
  'div',
  'span',
]);

export function sanitizeCommunityHtml(html: string): string {
  if (!html?.trim()) return '';

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return [...el.childNodes].map(walk).join('');
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
          return [...el.childNodes].map(walk).join('');
        }
        const inner = [...el.childNodes].map(walk).join('');
        return `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer" target="_blank">${inner}</a>`;
      }
      const inner = [...el.childNodes].map(walk).join('');
      if (tag === 'br') return '<br />';
      return `<${tag}>${inner}</${tag}>`;
    };
    return [...doc.body.childNodes].map(walk).join('');
  }

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function plainTextFromHtml(html: string): string {
  if (!html?.trim()) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent?.trim() ?? '';
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
