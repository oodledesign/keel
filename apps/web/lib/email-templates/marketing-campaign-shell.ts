import { getAppSiteOrigin, getMarketingSiteOrigin } from '~/lib/app-host-routing';

const appOrigin = getAppSiteOrigin();
const marketingOrigin = getMarketingSiteOrigin();
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
const supportEmail =
  process.env.SUPPORT_INBOX?.trim() ??
  process.env.EMAIL_SENDER?.match(/<([^>]+)>/)?.[1] ??
  'support@keel.app';

export const MARKETING_EMAIL_URLS = {
  app: appOrigin,
  signIn: `${appOrigin}/auth/sign-in`,
  signUp: `${appOrigin}/auth/sign-up`,
  onboarding: `${appOrigin}/onboarding`,
  docs: `${marketingOrigin}/docs`,
  marketing: marketingOrigin,
  support: `mailto:${supportEmail}`,
  info: `mailto:${supportEmail}`,
  logo: `${appOrigin}/brand/keel-dark-transparent.png`,
} as const;

type ShellOptions = {
  title: string;
  preheader?: string;
  heroBadge?: string;
  heroTitle: string;
  heroSubtitle?: string;
  bodyHtml: string;
  ctaHtml?: string;
  footerNote?: string;
};

export function renderMarketingCampaignShell(options: ShellOptions) {
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${options.preheader}</div>`
    : '';

  const heroBadge = options.heroBadge
    ? `<span style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:6px 14px;border-radius:20px;margin-bottom:14px;">${options.heroBadge}</span><br />`
    : '';

  const heroSubtitle = options.heroSubtitle
    ? `<p style="color:rgba(255,255,255,0.78);font-size:15px;line-height:1.6;margin:12px 0 0;">${options.heroSubtitle}</p>`
    : '';

  const ctaHtml = options.ctaHtml ?? '';

  const footerNote =
    options.footerNote ??
    `You&apos;re receiving this from ${productName}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${options.title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f0f2f5;margin:0;padding:0;border-collapse:collapse;">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border-collapse:collapse;">

<tr>
<td align="center" style="background:#1a2e44;padding:32px 40px 24px;text-align:center;">
<img src="${MARKETING_EMAIL_URLS.logo}" alt="${productName}" width="170" style="display:block;margin:0 auto 10px;border:0;outline:none;text-decoration:none;" />
<div style="color:rgba(255,255,255,0.62);font-size:13px;letter-spacing:0.4px;">Workspaces for community, business, and property</div>
</td>
</tr>

<tr>
<td align="center" style="background:#1a2e44;padding:0 40px 36px;text-align:center;">
${heroBadge}
<h1 style="color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;margin:0;">${options.heroTitle}</h1>
${heroSubtitle}
</td>
</tr>

${ctaHtml}

<tr>
<td style="padding:36px 40px;">
${options.bodyHtml}
</td>
</tr>

<tr>
<td align="center" style="background:#1a2e44;padding:24px 40px;text-align:center;">
<p style="color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;margin:0;">${footerNote}<br />
<a href="${MARKETING_EMAIL_URLS.marketing}" style="color:#2A9D8F;text-decoration:none;">${marketingOrigin.replace(/^https?:\/\//, '')}</a> ·
<a href="${MARKETING_EMAIL_URLS.support}" style="color:#2A9D8F;text-decoration:none;">${supportEmail}</a></p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function renderPrimaryCta(label: string, href: string) {
  return `<tr>
<td align="center" style="background:#f0fdf4;border-top:3px solid #22c55e;padding:24px 40px;text-align:center;">
<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1a2e44;color:#ffffff;text-decoration:none;padding:15px 32px;border-radius:8px;font-size:16px;font-weight:700;">${label}</a>
</td>
</tr>`;
}

export function renderStepBox(title: string, body: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px;border-collapse:collapse;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 6px;color:#1a2e44;font-size:14px;font-weight:700;line-height:1.4;">${title}</p>
<p style="margin:0;color:#4b5563;font-size:14px;line-height:1.65;">${body}</p>
</td></tr></table>`;
}

export function renderBulletList(items: string[]) {
  return items
    .map(
      (item) =>
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px;border-collapse:collapse;"><tr><td width="24" valign="top" style="color:#22c55e;font-size:16px;padding-top:1px;">✓</td><td valign="top"><p style="margin:0;color:#374151;font-size:14px;line-height:1.65;">${item}</p></td></tr></table>`,
    )
    .join('');
}

export function renderParagraph(text: string) {
  return `<p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">${text}</p>`;
}

export function renderSectionLabel(text: string) {
  return `<p style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#22c55e;margin:28px 0 14px;">${text}</p>`;
}

export const CAMPAIGN_MERGE_TAG_PREVIEW = {
  firstName: 'Alex',
  email: 'you@example.com',
} as const;

function escapeMergeTagValue(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Replace {{first_name}} and {{email}} when sending (or previewing) campaigns. */
export function personalizeCampaignMergeTags(
  html: string,
  params: {
    firstName?: string | null;
    email: string;
  },
) {
  const firstName = params.firstName?.trim() || 'there';
  const email = params.email.trim();

  return html
    .replaceAll('{{first_name}}', escapeMergeTagValue(firstName))
    .replaceAll('{{email}}', escapeMergeTagValue(email));
}

export function previewCampaignMergeTags(html: string) {
  return personalizeCampaignMergeTags(html, CAMPAIGN_MERGE_TAG_PREVIEW);
}
