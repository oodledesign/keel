export type MarketingTemplateData = {
  heading: string;
  subheading?: string;
  body?: string;
  cta_label?: string;
  cta_url?: string;
  hero_image_url?: string;
  features?: Array<{
    heading: string;
    body: string;
  }>;
  unsubscribe_url?: string;
};

const BRAND = {
  darkGreen: '#1A3A2E',
  accentGreen: '#4CC68A',
  white: '#ffffff',
  lightGrey: '#f5f5f5',
  text: '#1f2933',
  muted: '#667085',
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBody(body?: string) {
  if (!body?.trim()) {
    return '';
  }

  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:${BRAND.text};font-size:16px;line-height:1.7;">${paragraph.trim()}</p>`)
    .join('');
}

function renderCta(data: MarketingTemplateData) {
  if (!data.cta_label?.trim() || !data.cta_url?.trim()) {
    return '';
  }

  return `
    <div style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(data.cta_url)}" style="display:inline-block;background:${BRAND.accentGreen};color:${BRAND.darkGreen};font-weight:700;text-decoration:none;border-radius:999px;padding:14px 26px;font-size:15px;">
        ${escapeHtml(data.cta_label)}
      </a>
    </div>
  `;
}

function renderFooter(unsubscribeUrl?: string) {
  const unsubscribeLink = unsubscribeUrl ?? '#';

  return `
    <tr>
      <td style="background:${BRAND.lightGrey};padding:28px 32px;text-align:center;color:${BRAND.muted};font-size:12px;line-height:1.6;">
        <p style="margin:0 0 8px;">Tradeways, United Kingdom · <a href="mailto:info@tradeways.co.uk" style="color:${BRAND.darkGreen};text-decoration:underline;">info@tradeways.co.uk</a></p>
        <p style="margin:0 0 8px;">
          <a href="${escapeHtml(unsubscribeLink)}" style="color:${BRAND.darkGreen};text-decoration:underline;">Unsubscribe</a>
        </p>
        <p style="margin:0;">Powered by Tradeways</p>
      </td>
    </tr>
  `;
}

function documentShell(content: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Tradeways</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.lightGrey};font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.lightGrey};margin:0;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:${BRAND.white};border-radius:20px;overflow:hidden;">
            ${content}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderAnnouncementTemplate(data: MarketingTemplateData) {
  const hero = data.hero_image_url?.trim()
    ? `<img src="${escapeHtml(data.hero_image_url)}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover;">`
    : '';

  return documentShell(`
    <tr>
      <td style="background:${BRAND.darkGreen};padding:28px 32px;text-align:center;">
        <div style="color:${BRAND.white};font-size:24px;font-weight:800;letter-spacing:0.02em;">Tradeways</div>
      </td>
    </tr>
    ${hero ? `<tr><td>${hero}</td></tr>` : ''}
    <tr>
      <td style="padding:44px 40px 20px;text-align:center;">
        <h1 style="margin:0;color:${BRAND.darkGreen};font-size:38px;line-height:1.15;font-weight:800;">${escapeHtml(data.heading)}</h1>
        ${
          data.subheading?.trim()
            ? `<p style="margin:18px auto 0;max-width:540px;color:${BRAND.muted};font-size:18px;line-height:1.55;">${escapeHtml(data.subheading)}</p>`
            : ''
        }
      </td>
    </tr>
    <tr>
      <td style="padding:12px 40px 36px;">
        ${renderBody(data.body)}
        ${renderCta(data)}
      </td>
    </tr>
    ${renderFooter(data.unsubscribe_url)}
  `);
}

export function renderNewsletterTemplate(data: MarketingTemplateData) {
  const features = (data.features ?? [])
    .slice(0, 3)
    .filter((feature) => feature.heading.trim() || feature.body.trim())
    .map(
      (feature) => `
        <div style="border:1px solid #e5e7eb;border-radius:16px;padding:20px;margin:0 0 14px;background:${BRAND.white};">
          <h2 style="margin:0 0 8px;color:${BRAND.darkGreen};font-size:18px;line-height:1.35;">${escapeHtml(feature.heading)}</h2>
          <p style="margin:0;color:${BRAND.muted};font-size:15px;line-height:1.6;">${escapeHtml(feature.body)}</p>
        </div>
      `,
    )
    .join('');

  return documentShell(`
    <tr>
      <td style="background:${BRAND.darkGreen};padding:20px 32px;text-align:center;">
        <div style="color:${BRAND.white};font-size:21px;font-weight:800;letter-spacing:0.02em;">Tradeways</div>
      </td>
    </tr>
    <tr>
      <td style="padding:36px 40px 18px;">
        <h1 style="margin:0;color:${BRAND.darkGreen};font-size:32px;line-height:1.2;font-weight:800;">${escapeHtml(data.heading)}</h1>
        ${
          data.subheading?.trim()
            ? `<p style="margin:16px 0 0;color:${BRAND.muted};font-size:17px;line-height:1.6;">${escapeHtml(data.subheading)}</p>`
            : ''
        }
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 36px;">
        ${renderBody(data.body)}
        ${features}
        ${renderCta(data)}
      </td>
    </tr>
    ${renderFooter(data.unsubscribe_url)}
  `);
}

export function renderMarketingTemplate(
  templateId: string | null | undefined,
  data: MarketingTemplateData,
) {
  if (templateId === 'newsletter') {
    return renderNewsletterTemplate(data);
  }

  return renderAnnouncementTemplate(data);
}
