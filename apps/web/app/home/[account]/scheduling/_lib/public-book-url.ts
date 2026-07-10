/**
 * Public booking URL for display and copy-link.
 * Route `/book/{slug}` is established for the public flow (Phase 4+).
 */
export function publicBookUrl(slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_BOOKING_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://ozer.so';

  return `${base}/book/${slug}`;
}
