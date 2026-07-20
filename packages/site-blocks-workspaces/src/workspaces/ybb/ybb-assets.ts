/** Canonical YBB asset URLs — production site CDN + bundled workspace SVGs. */

export const YBB_SITE_ORIGIN = 'https://yourbridalbesties.co.uk';

/** Bundled in apps/web/public and apps/sites/public — same-origin on both apps. */
export const YBB_FOUNDERS_STAR_OUTER = '/workspace-assets/ybb/founders/star-outer.svg';
export const YBB_FOUNDERS_STAR_INNER = '/workspace-assets/ybb/founders/star-inner.svg';
export const YBB_FOUNDERS_STAR_MASK = '/workspace-assets/ybb/founders/star-mask.svg';
export const YBB_FOUNDERS_MASK_FILL = '#800000';

/** Encode only characters that break static file serving (spaces, &). */
export function ybbPhoto(filename: string): string {
  const encoded = filename.replace(/ /g, '%20').replace(/&/g, '%26');
  return `${YBB_SITE_ORIGIN}/assets/images/photos/${encoded}`;
}

export function ybbSiteAsset(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/workspace-assets/')) {
    return trimmed;
  }
  return `${YBB_SITE_ORIGIN}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

/** Resolve a media URL for img src — keeps bundled paths, upgrades legacy YBB paths. */
export function resolveYbbMediaUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/workspace-assets/')) return trimmed;
  if (trimmed.startsWith('/assets/')) return ybbSiteAsset(trimmed);
  return trimmed;
}
