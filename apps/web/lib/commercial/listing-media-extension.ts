/**
 * Client-safe listing media extension/mime helpers (no Node built-ins).
 */
export function extensionFromMime(mime: string | null | undefined): string {
  const value = (mime ?? '').toLowerCase().split(';')[0]?.trim() ?? '';
  switch (value) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export function extensionFromUrlOrName(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const clean = value.split('?')[0]?.split('#')[0] ?? '';
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (!match?.[1]) return null;
  const ext = match[1].toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return null;
}

export function mimeFromExtension(ext: string | null): string | null {
  switch (ext) {
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    default:
      return null;
  }
}
