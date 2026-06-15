const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'form',
  'input',
  'button',
]);

function sanitizeElement(element: Element) {
  const tag = element.tagName.toLowerCase();

  if (BLOCKED_TAGS.has(tag)) {
    element.remove();
    return;
  }

  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value.trim().toLowerCase();

    if (name.startsWith('on')) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === 'href' || name === 'src') {
      if (
        value.startsWith('javascript:') ||
        value.startsWith('data:text/html')
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  for (const child of [...element.children]) {
    sanitizeElement(child);
  }
}

/** Basic sanitization for rendering user-authored signature HTML in preview. */
export function sanitizeSignatureHtml(html: string): string {
  if (typeof window === 'undefined' || !html.trim()) {
    return '';
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeElement(doc.body);

  return doc.body.innerHTML;
}
