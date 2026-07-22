export function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export function buildPublicSeoReportPath(token: string) {
  return `/portal/seo/${encodeURIComponent(token)}`;
}

export function buildPublicSeoReportUrl(token: string, origin?: string) {
  const base = (origin ?? getSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildPublicSeoReportPath(token)}`;
}

export function buildSeoReportPdfPath(token: string) {
  return `/api/rankly/seo-report/export/${encodeURIComponent(token)}`;
}

export function buildSeoReportPdfUrl(token: string, origin?: string) {
  const base = (origin ?? getSiteOrigin()).replace(/\/$/, '');
  return `${base}${buildSeoReportPdfPath(token)}`;
}
