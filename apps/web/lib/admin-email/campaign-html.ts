import juice from 'juice';

const EMAIL_CLIENT_UNSUPPORTED_CSS =
  /\b(display\s*:\s*flex|flex-wrap|flex-shrink|align-items|justify-content|position\s*:\s*(absolute|relative|fixed)|box-sizing\s*:\s*border-box)\b/gi;

function stripUnsupportedEmailCss(html: string) {
  return html.replace(
    /style="([^"]*)"/gi,
    (_match, styles: string) =>
      `style="${styles.replace(EMAIL_CLIENT_UNSUPPORTED_CSS, '').replace(/;\s*;/g, ';').replace(/^;|;$/g, '').trim()}"`,
  );
}

export function prepareCampaignHtmlForDelivery(html: string): string {
  let prepared = html.trim();
  if (!prepared) return prepared;

  if (!/<!doctype/i.test(prepared)) {
    prepared = `<!DOCTYPE html>\n${prepared}`;
  }

  if (!/http-equiv=["']Content-Type["']/i.test(prepared)) {
    if (/<head[^>]*>/i.test(prepared)) {
      prepared = prepared.replace(
        /<head([^>]*)>/i,
        `<head$1>\n<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">`,
      );
    } else if (/<html[^>]*>/i.test(prepared)) {
      prepared = prepared.replace(
        /<html([^>]*)>/i,
        `<html$1><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>`,
      );
    }
  }

  if (/<style[\s>]/i.test(prepared)) {
    try {
      prepared = juice(prepared, {
        removeStyleTags: true,
        preserveImportant: true,
        applyWidthAttributes: true,
        applyHeightAttributes: true,
      });
    } catch {
      prepared = prepared.replace(/<style[\s\S]*?<\/style>/gi, '');
    }
  }

  return stripUnsupportedEmailCss(prepared);
}

export function wrapCampaignHtmlForEmailClients(
  html: string,
  extras: {
    bannerHtml?: string;
    footerHtml?: string;
    trackingPixelHtml?: string;
  },
): string {
  const bannerRow = extras.bannerHtml
    ? `<tr><td align="center" style="padding:0;margin:0;">${extras.bannerHtml}</td></tr>`
    : '';
  const footerBits = [extras.footerHtml, extras.trackingPixelHtml]
    .filter(Boolean)
    .join('');
  const footerRow = footerBits
    ? `<tr><td align="center" style="padding:16px 24px 24px;font-family:Arial,Helvetica,sans-serif;">${footerBits}</td></tr>`
    : '';

  const openWrap = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;border-collapse:collapse;">${bannerRow}<tr><td align="center" style="padding:0;margin:0;">`;
  const closeWrap = `</td></tr>${footerRow}</table>`;

  if (/<body[^>]*>/i.test(html)) {
    return html
      .replace(/<body([^>]*)>/i, `<body$1>${openWrap}`)
      .replace(/<\/body>/i, `${closeWrap}</body>`);
  }

  return `${openWrap}${html}${closeWrap}`;
}
