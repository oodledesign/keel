export function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export function buildPublicVideoWatchPath(token: string) {
  return `/watch/${token}`;
}

export function buildPublicVideoWatchUrl(token: string, origin?: string) {
  const base = (origin ?? getSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildPublicVideoWatchPath(token)}`;
}

export function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
