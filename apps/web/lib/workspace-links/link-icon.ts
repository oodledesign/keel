import { googleFaviconUrl } from '~/lib/clients/client-logo-icons';

export type LinkIconKind = 'google_doc' | 'google_sheet' | 'web';

export const GOOGLE_DOCS_ICON_URL =
  'https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png';

export const GOOGLE_SHEETS_ICON_URL =
  'https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png';

export function linkIconKindFromUrl(url: string): LinkIconKind {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 'sheets.google.com') return 'google_sheet';
    if (host === 'docs.google.com') {
      if (path.includes('/spreadsheets')) return 'google_sheet';
      if (path.includes('/document')) return 'google_doc';
    }

    return 'web';
  } catch {
    return 'web';
  }
}

export function displayLinkIconUrl(
  url: string,
  faviconUrl: string | null,
): string | null {
  const kind = linkIconKindFromUrl(url);
  if (kind === 'google_doc') return GOOGLE_DOCS_ICON_URL;
  if (kind === 'google_sheet') return GOOGLE_SHEETS_ICON_URL;
  if (faviconUrl) return faviconUrl;

  try {
    return googleFaviconUrl(new URL(url).hostname, 64);
  } catch {
    return null;
  }
}
