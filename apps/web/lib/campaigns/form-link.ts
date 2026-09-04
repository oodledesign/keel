import pathsConfig from '~/config/paths.config';

export const CAMPAIGN_FORM_URL_TOKEN = '{{form_url}}';

export type CampaignFormLink = {
  formId: string;
  shareToken: string;
  formName: string;
  prefillEmail: boolean;
};

export function isCampaignFormUrlToken(value: string): boolean {
  return value.trim() === CAMPAIGN_FORM_URL_TOKEN;
}

export function buildCampaignFormUrl(input: {
  shareToken: string;
  recipientEmail?: string | null;
  prefillEmail?: boolean;
  siteUrl?: string | null;
}): string {
  const token = input.shareToken.trim();
  if (!token) return '';

  const path = pathsConfig.app.formShare.replace('[token]', token);
  const base = (
    input.siteUrl?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ''
  ).replace(/\/$/, '');

  const url = base
    ? new URL(path, `${base}/`)
    : new URL(path, 'https://ozer.so/');

  if (input.prefillEmail && input.recipientEmail?.trim()) {
    url.searchParams.set('email', input.recipientEmail.trim());
  }

  return url.toString();
}

export function formUrlForMerge(input: {
  formLink?: CampaignFormLink | null;
  recipientEmail: string;
  siteUrl?: string | null;
}): string {
  if (!input.formLink?.shareToken) return '';
  return buildCampaignFormUrl({
    shareToken: input.formLink.shareToken,
    recipientEmail: input.recipientEmail,
    prefillEmail: input.formLink.prefillEmail,
    siteUrl: input.siteUrl,
  });
}
