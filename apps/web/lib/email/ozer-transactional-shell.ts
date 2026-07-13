/**
 * Shared Ozer transactional email shell — table-based HTML for client compatibility.
 * Brand: plum header, cream canvas, coral CTA.
 */

const OZER = {
  accent: '#FF5C34',
  plum: '#2A1720',
  cream: '#FBF6EC',
  muted: '#5A4450',
  white: '#FFFFFF',
  border: '#E7DECF',
} as const;

export const OZER_EMAIL_BRAND = OZER;

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '') ||
    'https://ozer.so'
  );
}

export function getOzerEmailAssetUrls() {
  const origin = siteOrigin();
  return {
    /** Light wordmark for plum headers (PNG — safer than SVG in email clients). */
    wordmarkOnDark: `${origin}/brand/ozer-wordmark-dark.png`,
    wordmarkOnLight: `${origin}/brand/ozer-wordmark.png`,
    icon: `${origin}/brand/ozer-icon.png`,
    marketing: origin,
  };
}

export function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Bulletproof coral CTA — nested tables + VML-friendly padding for Outlook.
 */
export function renderOzerEmailCta(label: string, href: string) {
  const safeLabel = escapeEmailHtml(label);
  const safeHref = escapeEmailHtml(href);

  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0;">
  <tr>
    <td align="center" bgcolor="${OZER.accent}" style="background:${OZER.accent};border-radius:999px;mso-padding-alt:14px 28px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="50%" stroke="f" fillcolor="${OZER.accent}">
        <w:anchorlock/>
        <center style="color:${OZER.white};font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${OZER.accent};color:${OZER.white};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;padding:14px 28px;border-radius:999px;mso-padding-alt:0;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export type OzerTransactionalShellOptions = {
  /** Document + visible title */
  title: string;
  /** Hidden preheader for inbox preview */
  preview?: string;
  /** Main heading in the body */
  heading: string;
  /** HTML body (already escaped where needed) */
  bodyHtml: string;
  /** Optional CTA under the body */
  cta?: { label: string; href: string };
  /** Footer note under the card */
  footerNote?: string;
  productName?: string;
};

/**
 * Full HTML document for transactional mail (invites, billing, OTP-style notices).
 */
export function renderOzerTransactionalEmail(
  options: OzerTransactionalShellOptions,
): string {
  const productName = options.productName ?? process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const assets = getOzerEmailAssetUrls();
  const preview = options.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeEmailHtml(options.preview)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : '';
  const ctaBlock = options.cta
    ? `<tr><td style="padding:8px 32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${renderOzerEmailCta(options.cta.label, options.cta.href)}</td></tr>`
    : '';
  const footerNote =
    options.footerNote ??
    `You’re receiving this from ${escapeEmailHtml(productName)}.`;

  return `<!DOCTYPE html>
<html lang="en-GB" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeEmailHtml(options.title)}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  @media only screen and (max-width: 620px) {
    .ozer-email-card { width: 100% !important; }
    .ozer-email-pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${OZER.cream};width:100%;">
${preview}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${OZER.cream};border-collapse:collapse;width:100%;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" class="ozer-email-card" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:${OZER.white};border-radius:16px;overflow:hidden;border:1px solid ${OZER.border};border-collapse:separate;">
        <tr>
          <td align="left" bgcolor="${OZER.plum}" style="background:${OZER.plum};padding:22px 32px;" class="ozer-email-pad">
            <img src="${assets.wordmarkOnDark}" width="120" height="33" alt="${escapeEmailHtml(productName)}" style="display:block;width:120px;max-width:40%;height:auto;border:0;" />
          </td>
        </tr>
        <tr>
          <td class="ozer-email-pad" style="padding:28px 32px 8px;font-family:Georgia,'Times New Roman',serif;color:${OZER.plum};">
            <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:${OZER.plum};">${escapeEmailHtml(options.heading)}</h1>
          </td>
        </tr>
        <tr>
          <td class="ozer-email-pad" style="padding:8px 32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${OZER.muted};">
            ${options.bodyHtml}
          </td>
        </tr>
        ${ctaBlock}
        <tr>
          <td class="ozer-email-pad" style="padding:0 32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#9B8590;">
            ${footerNote}
          </td>
        </tr>
      </table>
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:16px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#9B8590;">
            <a href="${assets.marketing}" style="color:${OZER.accent};text-decoration:none;">${escapeEmailHtml(productName)}</a>
            — workspaces for community, business, and property
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
