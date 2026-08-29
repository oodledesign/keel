/**
 * Workspace-branded circulation HTML (agency identity, not Ozer).
 * Kept free of `server-only` so unit tests can import it.
 */

export type CirculationEmailBrand = {
  agencyName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  websiteUrl: string | null;
  address: string | null;
  phone: string | null;
};

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export function escapeCirculationHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function safeCirculationHex(value: string, fallback: string): string {
  return HEX_COLOR_RE.test(value.trim()) ? value.trim() : fallback;
}

function expandHex(hex: string): string {
  const raw = hex.replace('#', '');
  if (raw.length === 3) {
    return raw
      .split('')
      .map((c) => `${c}${c}`)
      .join('');
  }
  return raw;
}

/** White text on dark brand bars, dark text on light bars. */
export function contrastTextOn(hex: string): string {
  const n = expandHex(safeCirculationHex(hex, '#0D2344'));
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y < 140 ? '#FFFFFF' : '#09111F';
}

function renderCta(label: string, href: string, accent: string) {
  const safeLabel = escapeCirculationHtml(label);
  const safeHref = escapeCirculationHtml(href);
  const text = contrastTextOn(accent);

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0;">
  <tr>
    <td align="center" bgcolor="${accent}" style="background:${accent};border-radius:8px;">
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${accent};color:${text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;padding:14px 28px;border-radius:8px;">${safeLabel}</a>
    </td>
  </tr>
</table>`.trim();
}

function footerLines(brand: CirculationEmailBrand) {
  const parts = [
    brand.agencyName,
    brand.address,
    brand.phone,
    brand.websiteUrl,
  ].filter(Boolean) as string[];
  return parts.map((part) => escapeCirculationHtml(part)).join(' · ');
}

export function buildCirculationEmailHtml(input: {
  brand: CirculationEmailBrand;
  listingName: string;
  listingSummary: string;
  address: string;
  unsubscribeUrl: string;
  viewUrl?: string | null;
  contactName?: string | null;
}): string {
  const primary = safeCirculationHex(input.brand.primaryColor, '#0D2344');
  const accent = safeCirculationHex(input.brand.accentColor, '#57C87F');
  const canvas = safeCirculationHex(input.brand.secondaryColor, '#FFFFFF');
  const headerText = contrastTextOn(primary);
  const agency = escapeCirculationHtml(input.brand.agencyName);
  const listing = escapeCirculationHtml(input.listingName);
  const greeting = input.contactName?.trim()
    ? `Hi ${escapeCirculationHtml(input.contactName.trim())},`
    : `Hello,`;
  const logo = input.brand.logoUrl
    ? `<img src="${escapeCirculationHtml(input.brand.logoUrl)}" alt="${agency}" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`
    : `<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:${headerText};">${agency}</span>`;

  const cta = input.viewUrl
    ? `<tr><td style="padding:4px 32px 24px;">${renderCta('View details', input.viewUrl, accent)}</td></tr>`
    : '';

  const address = input.address
    ? `<p style="margin:0 0 8px;color:#3D3D3D;">${escapeCirculationHtml(input.address)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${listing}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F1;width:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">Matching opportunity: ${listing}&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F4F4F1;border-collapse:collapse;width:100%;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:${canvas};border-radius:12px;overflow:hidden;border:1px solid #E4E2DC;border-collapse:separate;">
        <tr>
          <td align="left" bgcolor="${primary}" style="background:${primary};padding:20px 32px;">
            ${logo}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#09111F;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#09111F;">${listing}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3D3D3D;">
            <p style="margin:0 0 12px;">${greeting}</p>
            <p style="margin:0 0 12px;">${agency} thought this opportunity may match your registered requirement.</p>
            ${address}
            <p style="margin:0;white-space:pre-wrap;">${escapeCirculationHtml(input.listingSummary)}</p>
          </td>
        </tr>
        ${cta}
        <tr>
          <td style="padding:0 32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B6B6B;">
            You are receiving this because you registered a commercial property requirement with ${agency}.
            This is a matching opportunity from ${agency}, not a newsletter.
            <a href="${escapeCirculationHtml(input.unsubscribeUrl)}" style="color:${accent};">Unsubscribe</a>
            from matching opportunity emails.
          </td>
        </tr>
      </table>
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:16px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#6B6B6B;">
            ${footerLines(input.brand)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
