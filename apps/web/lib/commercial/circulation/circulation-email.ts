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

export type CirculationDigestListing = {
  name: string;
  summary: string;
  address: string;
  viewUrl?: string | null;
  viewUrlLabel?: string | null;
  coverImageUrl?: string | null;
  sizeLabel?: string | null;
  disposalTypeLabel?: string | null;
};

export function buildCirculationEmailHtml(input: {
  brand: CirculationEmailBrand;
  listingName: string;
  listingSummary: string;
  address: string;
  unsubscribeUrl: string;
  viewUrl?: string | null;
  viewUrlLabel?: string | null;
  coverImageUrl?: string | null;
  manageUrl?: string | null;
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

  const viewLabel = input.viewUrlLabel?.trim() || 'View details';
  const cta = input.viewUrl
    ? `<tr><td style="padding:4px 32px 16px;">${renderCta(viewLabel, input.viewUrl, accent)}</td></tr>`
    : '';

  const manageCta = input.manageUrl
    ? `<tr><td style="padding:0 32px 24px;">${renderCta('View your live matches', input.manageUrl, accent)}<p style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B6B6B;">Your personal matches page stays up to date as new opportunities appear.</p></td></tr>`
    : '';

  const cover = input.coverImageUrl
    ? `<tr><td style="padding:0;">
            <img src="${escapeCirculationHtml(input.coverImageUrl)}" alt="${listing}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;line-height:0;" />
          </td></tr>`
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
        ${cover}
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
        ${manageCta}
        <tr>
          <td style="padding:0 32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B6B6B;">
            You are receiving this because you registered a commercial property requirement with ${agency}.
            This is a matching opportunity from ${agency}, not a newsletter.
            <a href="${escapeCirculationHtml(input.unsubscribeUrl)}" style="color:${accent};">Unsubscribe</a>
            from matching opportunity emails.
            ${
              input.manageUrl
                ? ` <a href="${escapeCirculationHtml(input.manageUrl)}" style="color:${accent};">Open your personal matches page</a>.`
                : ''
            }
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

export function buildCirculationDigestEmailHtml(input: {
  brand: CirculationEmailBrand;
  listings: CirculationDigestListing[];
  unsubscribeUrl: string;
  manageUrl?: string | null;
  contactName?: string | null;
}): string {
  const primary = safeCirculationHex(input.brand.primaryColor, '#0D2344');
  const accent = safeCirculationHex(input.brand.accentColor, '#57C87F');
  const canvas = safeCirculationHex(input.brand.secondaryColor, '#FFFFFF');
  const headerText = contrastTextOn(primary);
  const agency = escapeCirculationHtml(input.brand.agencyName);
  const greeting = input.contactName?.trim()
    ? `Hi ${escapeCirculationHtml(input.contactName.trim())},`
    : `Hello,`;
  const count = input.listings.length;
  const heading =
    count === 1
      ? 'A property that matches your requirement'
      : `${count} properties that match your requirement`;
  const logo = input.brand.logoUrl
    ? `<img src="${escapeCirculationHtml(input.brand.logoUrl)}" alt="${agency}" height="40" style="display:block;max-height:40px;width:auto;border:0;" />`
    : `<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:${headerText};">${agency}</span>`;

  const cards = input.listings
    .map((listing) => {
      const name = escapeCirculationHtml(listing.name);
      const meta = [listing.disposalTypeLabel, listing.sizeLabel]
        .filter(Boolean)
        .map((part) => escapeCirculationHtml(part as string))
        .join(' · ');
      const address = listing.address
        ? `<p style="margin:0 0 8px;color:#3D3D3D;">${escapeCirculationHtml(listing.address)}</p>`
        : '';
      const cover = listing.coverImageUrl
        ? `<tr><td style="padding:0;line-height:0;">
                  <img src="${escapeCirculationHtml(listing.coverImageUrl)}" alt="${name}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:10px 10px 0 0;" />
                </td></tr>`
        : '';
      const viewLabel = listing.viewUrlLabel?.trim() || 'View details';
      const cta = listing.viewUrl
        ? `<div style="margin-top:12px;">${renderCta(viewLabel, listing.viewUrl, accent)}</div>`
        : '';
      return `<tr>
          <td style="padding:0 32px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #E4E2DC;border-radius:10px;border-collapse:separate;overflow:hidden;">
              ${cover}
              <tr>
                <td style="padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#09111F;">
                  <h2 style="margin:0 0 6px;font-size:18px;line-height:1.3;font-weight:700;">${name}</h2>
                  ${meta ? `<p style="margin:0 0 8px;font-size:13px;color:#6B6B6B;">${meta}</p>` : ''}
                  ${address}
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#3D3D3D;white-space:pre-wrap;">${escapeCirculationHtml(listing.summary)}</p>
                  ${cta}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');

  const manageCta = input.manageUrl
    ? `<tr><td style="padding:4px 32px 20px;">${renderCta('View your live matches', input.manageUrl, accent)}<p style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B6B6B;">See your personal matches page — kept up to date as new opportunities appear.</p></td></tr>`
    : '';

  const manage = input.manageUrl
    ? ` <a href="${escapeCirculationHtml(input.manageUrl)}" style="color:${accent};">Open your personal matches page</a>.`
    : '';

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeCirculationHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F1;width:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeCirculationHtml(heading)} from ${agency}&nbsp;&zwnj;</div>
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
            <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;color:#09111F;">${escapeCirculationHtml(heading)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3D3D3D;">
            <p style="margin:0 0 12px;">${greeting}</p>
            <p style="margin:0;">${agency} thought these opportunities may match your registered requirement.</p>
          </td>
        </tr>
        ${cards}
        ${manageCta}
        <tr>
          <td style="padding:0 32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6B6B6B;">
            You are receiving this because you registered a commercial property requirement with ${agency}.
            This is a matching opportunity from ${agency}, not a newsletter.
            <a href="${escapeCirculationHtml(input.unsubscribeUrl)}" style="color:${accent};">Unsubscribe</a>
            from matching opportunity emails.${manage}
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
