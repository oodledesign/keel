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

  return sanitizeHtmlWithoutDom(html);
}

/** Node / SSR fallback: drop non-allowlisted tags and unsafe attributes. */
function sanitizeHtmlWithoutDom(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(
      /<\/?(iframe|object|embed|form|svg|math|link|meta|base|applet)[^>]*>/gi,
      '',
    )
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(
      /<\/?([a-z0-9]+)([^>]*)>/gi,
      (match, tag: string, attrs: string) => {
        const name = tag.toLowerCase();
        if (!ALLOWED_TAGS.has(name)) return '';
        if (name === 'br') return '<br />';
        if (name === 'a') {
          if (match.startsWith('</')) return '</a>';
          const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
          if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
            return '';
          }
          return `<a href="${href.replace(/"/g, '&quot;')}" rel="noopener noreferrer" target="_blank">`;
        }
        return match.startsWith('</') ? `</${name}>` : `<${name}>`;
      },
    );
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
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
